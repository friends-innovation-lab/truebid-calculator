#!/usr/bin/env tsx
/**
 * Generate expected.json from production database
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx evals/scripts/generate-expected.ts
 *
 * Queries the confirmed intelligence version and active WBS for the PM-HCD proposal,
 * then outputs ground truth to evals/corpus/pm-hcd/expected.json
 *
 * SAFETY: This is a READ-ONLY script. No mutations.
 */

import * as fs from 'fs'
import * as path from 'path'

// PM-HCD proposal ID from production (from handover doc)
const PM_HCD_PROPOSAL_ID = '490ea2dd-6a5b-417a-b121-919477f4df82'

interface ExpectedJson {
  metadata: {
    proposalId: string
    solicitationName: string
    generatedAt: string
    source: string
  }
  intelligence: {
    contractType: { expected: string; required: boolean }
    vehicle: { expected: string | null; required: boolean }
    setAside: { expected: string | null; required: boolean }
    periods: {
      count: number
      details: Array<{ name: string; months: number }>
    }
    disciplines: {
      expected: string[]
      forbidden: string[]
    }
    laborRequirements: {
      count: number
      titles: string[]
    }
  }
  wbs: {
    parentTaskCount: number
    totalTaskCount: number
    totalAssignments: number
    totalHours: number
    disciplineCompliance: {
      allowedDisciplines: string[]
      forbiddenRoles: string[]
    }
    hoursPlausibility: {
      minTotalHours: number
      maxTotalHours: number
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable required')
    console.error('Usage: DATABASE_URL="postgresql://..." npx tsx evals/scripts/generate-expected.ts')
    process.exit(1)
  }

  // Parse connection string for Supabase client
  // Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(\w+)/)
  if (!urlMatch) {
    console.error('ERROR: Invalid DATABASE_URL format')
    process.exit(1)
  }

  // For direct postgres queries, we use the Supabase JS client with service role
  // But since we only have DATABASE_URL, we'll use pg directly
  const { Client } = await import('pg')
  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()
    console.log('Connected to database')

    // 1. Get the proposal
    const proposalResult = await client.query(
      `SELECT id, title, solicitation_number, active_intelligence_version_id
       FROM proposals
       WHERE id = $1`,
      [PM_HCD_PROPOSAL_ID]
    )

    if (proposalResult.rows.length === 0) {
      console.error('ERROR: Proposal not found:', PM_HCD_PROPOSAL_ID)
      process.exit(1)
    }

    const proposal = proposalResult.rows[0]
    console.log('Found proposal:', proposal.title)

    // 2. Get the confirmed intelligence version
    const intelligenceResult = await client.query(
      `SELECT iv.id, iv.version_number, iv.status, iv.contract_type, iv.facts_json
       FROM intelligence_versions iv
       WHERE iv.proposal_id = $1 AND iv.status = 'confirmed'
       ORDER BY iv.version_number DESC
       LIMIT 1`,
      [PM_HCD_PROPOSAL_ID]
    )

    if (intelligenceResult.rows.length === 0) {
      console.error('ERROR: No confirmed intelligence version found')
      process.exit(1)
    }

    const intelligence = intelligenceResult.rows[0]
    console.log('Found intelligence version:', intelligence.version_number, 'status:', intelligence.status)

    // 3. Get periods
    const periodsResult = await client.query(
      `SELECT name, months, sort_order
       FROM intelligence_periods
       WHERE version_id = $1
       ORDER BY sort_order`,
      [intelligence.id]
    )
    console.log('Found', periodsResult.rows.length, 'periods')

    // 4. Get disciplines
    const disciplinesResult = await client.query(
      `SELECT discipline, confidence
       FROM intelligence_disciplines
       WHERE version_id = $1`,
      [intelligence.id]
    )
    console.log('Found', disciplinesResult.rows.length, 'disciplines')

    // 5. Get labor requirements
    const laborResult = await client.query(
      `SELECT title, labor_category, hours_per_month
       FROM intelligence_labor_requirements
       WHERE version_id = $1`,
      [intelligence.id]
    )
    console.log('Found', laborResult.rows.length, 'labor requirements')

    // 6. Get active WBS version
    const wbsVersionResult = await client.query(
      `SELECT id, version_number, status
       FROM wbs_versions
       WHERE proposal_id = $1 AND status = 'active'
       LIMIT 1`,
      [PM_HCD_PROPOSAL_ID]
    )

    const wbsStats = {
      parentTaskCount: 0,
      totalTaskCount: 0,
      totalAssignments: 0,
      totalHours: 0,
    }

    if (wbsVersionResult.rows.length > 0) {
      const wbsVersion = wbsVersionResult.rows[0]
      console.log('Found active WBS version:', wbsVersion.version_number)

      // Get task counts
      const taskCountResult = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE parent_task_id IS NULL) as parent_count,
           COUNT(*) as total_count
         FROM wbs_tasks
         WHERE wbs_version_id = $1`,
        [wbsVersion.id]
      )
      wbsStats.parentTaskCount = parseInt(taskCountResult.rows[0].parent_count)
      wbsStats.totalTaskCount = parseInt(taskCountResult.rows[0].total_count)

      // Get assignment counts and total hours
      const assignmentResult = await client.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(hours), 0) as total_hours
         FROM staffing_assignments sa
         JOIN wbs_tasks wt ON sa.wbs_task_id = wt.id
         WHERE wt.wbs_version_id = $1`,
        [wbsVersion.id]
      )
      wbsStats.totalAssignments = parseInt(assignmentResult.rows[0].count)
      wbsStats.totalHours = parseFloat(assignmentResult.rows[0].total_hours)
    }

    console.log('WBS stats:', wbsStats)

    // Build forbidden roles based on disciplines
    const confirmedDisciplines = disciplinesResult.rows.map((d: { discipline: string }) => d.discipline)
    const engineeringRoles = [
      'Back-end Developer',
      'Front-end Developer',
      'DevOps Engineer',
      'QA Engineer',
      'Technical Lead',
      'Software Engineer',
    ]
    // If engineering not in confirmed disciplines, these roles are forbidden
    const forbiddenRoles = confirmedDisciplines.includes('engineering') ? [] : engineeringRoles

    // Build expected.json
    const expected: ExpectedJson = {
      metadata: {
        proposalId: PM_HCD_PROPOSAL_ID,
        solicitationName: proposal.title || 'PM-HCD Proposal',
        generatedAt: new Date().toISOString(),
        source: 'production database query via generate-expected.ts',
      },
      intelligence: {
        contractType: {
          expected: intelligence.contract_type || 'unknown',
          required: true,
        },
        vehicle: {
          expected: intelligence.facts_json?.vehicle?.value || null,
          required: false,
        },
        setAside: {
          expected: intelligence.facts_json?.setAside?.value || null,
          required: false,
        },
        periods: {
          count: periodsResult.rows.length,
          details: periodsResult.rows.map((p: { name: string; months: number }) => ({
            name: p.name,
            months: p.months,
          })),
        },
        disciplines: {
          expected: confirmedDisciplines,
          forbidden: confirmedDisciplines.includes('engineering')
            ? []
            : ['engineering', 'devops', 'security'],
        },
        laborRequirements: {
          count: laborResult.rows.length,
          titles: laborResult.rows.map((l: { title: string }) => l.title),
        },
      },
      wbs: {
        parentTaskCount: wbsStats.parentTaskCount,
        totalTaskCount: wbsStats.totalTaskCount,
        totalAssignments: wbsStats.totalAssignments,
        totalHours: wbsStats.totalHours,
        disciplineCompliance: {
          allowedDisciplines: confirmedDisciplines,
          forbiddenRoles,
        },
        hoursPlausibility: {
          // ±30% band around actual
          minTotalHours: Math.round(wbsStats.totalHours * 0.7),
          maxTotalHours: Math.round(wbsStats.totalHours * 1.3),
        },
      },
    }

    // Write to file
    const outputPath = path.join(__dirname, '../corpus/pm-hcd/expected.json')
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(expected, null, 2))

    console.log('\nGenerated:', outputPath)
    console.log('\nSummary:')
    console.log('  Contract Type:', expected.intelligence.contractType.expected)
    console.log('  Periods:', expected.intelligence.periods.count, expected.intelligence.periods.details.map(p => `${p.months}mo`).join('/'))
    console.log('  Disciplines:', expected.intelligence.disciplines.expected.join(', '))
    console.log('  Labor Requirements:', expected.intelligence.laborRequirements.titles.join(', '))
    console.log('  WBS Tasks:', expected.wbs.parentTaskCount, 'parent /', expected.wbs.totalTaskCount, 'total')
    console.log('  Total Hours:', expected.wbs.totalHours)

  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
