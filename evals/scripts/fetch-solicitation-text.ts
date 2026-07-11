#!/usr/bin/env tsx
/**
 * Fetch solicitation text from production for eval corpus
 */

import * as fs from 'fs'
import * as path from 'path'

const PM_HCD_PROPOSAL_ID = '490ea2dd-6a5b-417a-b121-919477f4df82'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL required')
    process.exit(1)
  }

  const { Client } = await import('pg')
  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()
    console.log('Connected to database')

    // Get the working_data which contains rfpText
    const result = await client.query(
      `SELECT working_data FROM proposals WHERE id = $1`,
      [PM_HCD_PROPOSAL_ID]
    )

    if (result.rows.length === 0) {
      console.error('Proposal not found')
      process.exit(1)
    }

    const workingData = result.rows[0].working_data || {}
    const rfpText = workingData.rfpText || workingData.solicitationRawText || ''

    if (!rfpText) {
      console.error('No rfpText found in working_data')
      console.log('Available keys:', Object.keys(workingData))
      process.exit(1)
    }

    console.log('Found rfpText:', rfpText.length, 'chars')

    // Save to corpus
    const outputPath = path.join(__dirname, '../corpus/pm-hcd/solicitation.txt')
    fs.writeFileSync(outputPath, rfpText)
    console.log('Saved to:', outputPath)

    // Also get the confirmed intelligence for WBS generation input
    const intellResult = await client.query(
      `SELECT
         iv.id, iv.contract_type, iv.facts_json,
         (SELECT json_agg(json_build_object('name', name, 'months', months) ORDER BY sort_order)
          FROM intelligence_periods WHERE version_id = iv.id) as periods,
         (SELECT json_agg(discipline) FROM intelligence_disciplines WHERE version_id = iv.id) as disciplines,
         (SELECT json_agg(json_build_object('title', title, 'laborCategory', labor_category, 'hoursPerMonth', hours_per_month))
          FROM intelligence_labor_requirements WHERE version_id = iv.id) as labor_requirements
       FROM intelligence_versions iv
       WHERE iv.proposal_id = $1 AND iv.status = 'confirmed'
       LIMIT 1`,
      [PM_HCD_PROPOSAL_ID]
    )

    if (intellResult.rows.length > 0) {
      const intel = intellResult.rows[0]
      const intelligenceInput = {
        versionId: intel.id,
        contractType: intel.contract_type,
        factsJson: intel.facts_json,
        periods: intel.periods,
        disciplines: intel.disciplines,
        laborRequirements: intel.labor_requirements
      }

      const intelPath = path.join(__dirname, '../corpus/pm-hcd/intelligence-input.json')
      fs.writeFileSync(intelPath, JSON.stringify(intelligenceInput, null, 2))
      console.log('Saved intelligence input to:', intelPath)
    }

    // Get requirements for WBS generation
    const reqResult = await client.query(
      `SELECT working_data->'extractedRequirements' as requirements
       FROM proposals WHERE id = $1`,
      [PM_HCD_PROPOSAL_ID]
    )

    if (reqResult.rows[0]?.requirements) {
      const reqPath = path.join(__dirname, '../corpus/pm-hcd/requirements.json')
      fs.writeFileSync(reqPath, JSON.stringify(reqResult.rows[0].requirements, null, 2))
      console.log('Saved requirements to:', reqPath)
    }

  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
