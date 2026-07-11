/**
 * Sanitize a production database dump for staging use.
 *
 * This script takes a pg_dump SQL file and produces a staging-safe version by:
 * 1. Rewriting user emails to user+<id>@fftc.test
 * 2. Stripping API keys/tokens from settings rows
 * 3. Preserving Lapedra's account mapping for login testing
 *
 * Storage buckets are NOT copied — staging uses sample PDFs only.
 *
 * Usage:
 *   npx tsx scripts/sanitize-dump.ts <input.sql> <output.sql>
 *
 * Example:
 *   pg_dump --no-owner --no-acl -h db.xxx.supabase.co -U postgres -d postgres > prod-dump.sql
 *   npx tsx scripts/sanitize-dump.ts prod-dump.sql staging-safe.sql
 *   psql -h db.staging.supabase.co -U postgres -d postgres < staging-safe.sql
 *
 * Lapedra account preservation:
 *   The script looks for lapedra@cityfriends.tech in auth.users and preserves it.
 *   All other emails become user+<user_id_short>@fftc.test
 *   This allows Lapedra to log in to staging with the same credentials.
 *
 * @module sanitize-dump
 */

import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Configuration
// ============================================================================

/** Email to preserve for login testing */
const PRESERVED_EMAIL = 'lapedra@cityfriends.tech'

/** Domain for sanitized emails */
const SANITIZED_DOMAIN = 'fftc.test'

/** Patterns to strip from JSONB columns (API keys, tokens, secrets) */
const SENSITIVE_PATTERNS = [
  /ANTHROPIC_API_KEY/gi,
  /sk-ant-[a-zA-Z0-9-]+/g, // Anthropic API keys
  /supabase_service_role_key/gi,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWT tokens
  /"api_key"\s*:\s*"[^"]+"/gi,
  /"secret"\s*:\s*"[^"]+"/gi,
  /"token"\s*:\s*"[^"]+"/gi,
  /"password"\s*:\s*"[^"]+"/gi,
]

// ============================================================================
// Main Logic
// ============================================================================

function sanitizeDump(inputPath: string, outputPath: string): void {
  console.log(`\n🔒 Sanitizing database dump for staging use`)
  console.log(`   Input:  ${inputPath}`)
  console.log(`   Output: ${outputPath}\n`)

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(inputPath, 'utf-8')
  const lines = content.split('\n')

  const sanitizedLines: string[] = []
  let emailsRewritten = 0
  let secretsStripped = 0
  let preservedLapedra = false

  // Track user IDs we've seen to create consistent email mappings
  const userEmailMap = new Map<string, string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // -------------------------------------------------------------------------
    // 1. Rewrite emails in auth.users COPY statements
    // -------------------------------------------------------------------------
    // Format: COPY auth.users (id, ..., email, ...) FROM stdin;
    // Data lines follow until \. terminator

    if (line.includes('COPY auth.users') && line.includes('FROM stdin')) {
      sanitizedLines.push(line)
      i++

      // Process data rows until we hit \.
      while (i < lines.length && lines[i] !== '\\.') {
        const dataLine = lines[i]
        const columns = dataLine.split('\t')

        // auth.users columns (typical order):
        // id, instance_id, aud, role, email, encrypted_password, ...
        // Find the email column (usually index 4, but let's be safe)
        const emailIndex = findEmailColumnIndex(lines, 'auth.users')

        if (emailIndex !== -1 && columns.length > emailIndex) {
          const originalEmail = columns[emailIndex]
          const userId = columns[0] // First column is always id

          if (originalEmail === PRESERVED_EMAIL) {
            // Preserve Lapedra's email
            preservedLapedra = true
            console.log(`   ✓ Preserved: ${PRESERVED_EMAIL}`)
          } else if (originalEmail && originalEmail !== '\\N' && originalEmail.includes('@')) {
            // Sanitize other emails
            const shortId = userId.substring(0, 8)
            const sanitizedEmail = `user+${shortId}@${SANITIZED_DOMAIN}`
            columns[emailIndex] = sanitizedEmail
            userEmailMap.set(userId, sanitizedEmail)
            emailsRewritten++
          }

          // Also update raw_user_meta_data if it contains email
          const metaIndex = columns.findIndex(c => c.includes('"email"'))
          if (metaIndex !== -1 && columns[metaIndex] !== PRESERVED_EMAIL) {
            columns[metaIndex] = columns[metaIndex].replace(
              /"email"\s*:\s*"[^"]+"/g,
              `"email": "${columns[emailIndex]}"`
            )
          }
        }

        sanitizedLines.push(columns.join('\t'))
        i++
      }

      // Add the terminator
      if (i < lines.length) {
        sanitizedLines.push(lines[i])
      }
      continue
    }

    // -------------------------------------------------------------------------
    // 2. Rewrite emails in auth.identities COPY statements
    // -------------------------------------------------------------------------
    if (line.includes('COPY auth.identities') && line.includes('FROM stdin')) {
      sanitizedLines.push(line)
      i++

      while (i < lines.length && lines[i] !== '\\.') {
        let dataLine = lines[i]

        // Check if this line contains the preserved email
        if (!dataLine.includes(PRESERVED_EMAIL)) {
          // Replace any email patterns
          dataLine = dataLine.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            (match) => {
              // Try to find corresponding sanitized email from our map
              for (const [userId, sanitizedEmail] of userEmailMap) {
                if (dataLine.includes(userId)) {
                  return sanitizedEmail
                }
              }
              // Fallback: generate a random sanitized email
              const shortHash = match.split('@')[0].substring(0, 8)
              emailsRewritten++
              return `user+${shortHash}@${SANITIZED_DOMAIN}`
            }
          )
        }

        sanitizedLines.push(dataLine)
        i++
      }

      if (i < lines.length) {
        sanitizedLines.push(lines[i])
      }
      continue
    }

    // -------------------------------------------------------------------------
    // 3. Strip sensitive data from company_settings and other tables
    // -------------------------------------------------------------------------
    if (
      line.includes('COPY company_settings') ||
      line.includes('COPY companies') ||
      line.includes('settings')
    ) {
      sanitizedLines.push(line)

      if (line.includes('FROM stdin')) {
        i++
        while (i < lines.length && lines[i] !== '\\.') {
          let dataLine = lines[i]

          // Strip sensitive patterns
          for (const pattern of SENSITIVE_PATTERNS) {
            if (pattern.test(dataLine)) {
              dataLine = dataLine.replace(pattern, '"[REDACTED]"')
              secretsStripped++
            }
          }

          sanitizedLines.push(dataLine)
          i++
        }

        if (i < lines.length) {
          sanitizedLines.push(lines[i])
        }
        continue
      }
    }

    // -------------------------------------------------------------------------
    // 4. Pass through all other lines unchanged
    // -------------------------------------------------------------------------
    sanitizedLines.push(line)
  }

  // Write output
  fs.writeFileSync(outputPath, sanitizedLines.join('\n'))

  // Report
  console.log(`\n📊 Sanitization complete:`)
  console.log(`   • Emails rewritten: ${emailsRewritten}`)
  console.log(`   • Secrets stripped: ${secretsStripped}`)
  console.log(`   • Lapedra preserved: ${preservedLapedra ? 'Yes' : 'No'}`)
  console.log(`\n✅ Output written to: ${outputPath}`)
  console.log(`\n⚠️  NOTE: Storage buckets are NOT included.`)
  console.log(`   Staging should use sample PDFs only.`)
}

/**
 * Find the email column index by parsing the COPY statement header
 */
function findEmailColumnIndex(lines: string[], tableName: string): number {
  // Look backwards for the COPY statement
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line.includes(`COPY ${tableName}`) && line.includes('(')) {
      // Parse column list
      const match = line.match(/\(([^)]+)\)/)
      if (match) {
        const columns = match[1].split(',').map((c) => c.trim())
        const emailIdx = columns.findIndex((c) => c === 'email')
        return emailIdx
      }
    }
  }

  // Fallback: typical auth.users email position
  return 4
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const args = process.argv.slice(2)

if (args.length !== 2) {
  console.log(`
Usage: npx tsx scripts/sanitize-dump.ts <input.sql> <output.sql>

This script sanitizes a pg_dump SQL file for staging use:
• Rewrites user emails to user+<id>@fftc.test
• Preserves lapedra@cityfriends.tech for login testing
• Strips API keys/tokens from settings
• Does NOT copy storage buckets

Example:
  pg_dump --no-owner --no-acl -h db.xxx.supabase.co -U postgres > prod.sql
  npx tsx scripts/sanitize-dump.ts prod.sql staging.sql
  psql -h db.staging.supabase.co -U postgres < staging.sql
`)
  process.exit(1)
}

const [inputPath, outputPath] = args
sanitizeDump(path.resolve(inputPath), path.resolve(outputPath))
