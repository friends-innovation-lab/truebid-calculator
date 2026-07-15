#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const STAGING_URL = 'https://tcobyquewjootwxpqijq.supabase.co'
const STAGING_KEY = process.env.STAGING_SERVICE_KEY || ''

if (!STAGING_KEY) {
  console.error('STAGING_SERVICE_KEY required')
  process.exit(1)
}

const supabase = createClient(STAGING_URL, STAGING_KEY)

interface ArtifactTotals {
  grandTotalHours: number
  grandTotalCost: number
  grandTotalFee: number
  grandTotal: number
  wbsEstimateHours: number
  wbsEstimateCost: number
  wbsEstimateFee: number
  wbsEstimateTotal: number
  laborLoadingHours: number
  laborLoadingCost: number
  laborLoadingFee: number
  laborLoadingTotal: number
}

async function main() {
  // Get the current generated artifact
  const { data: artifact } = await supabase
    .from('boe_artifacts')
    .select('id, content, generated_at')
    .eq('proposal_id', 'e2e66666-6666-6666-6666-666666666666')
    .eq('status', 'generated')
    .single()

  if (!artifact) {
    console.log('No generated artifact found')
    return
  }

  const content = artifact.content as { totals: ArtifactTotals }
  const t = content.totals

  console.log('=== T4: Server-Side Values (from boe_artifacts.content.totals) ===')
  console.log('Artifact ID:', artifact.id)
  console.log('Generated At:', artifact.generated_at)
  console.log('')
  console.log('| Metric        | WBS Estimates    | Labor Loading    | Grand Total      |')
  console.log('|---------------|------------------|------------------|------------------|')
  console.log(`| Hours         | ${t.wbsEstimateHours.toLocaleString().padStart(16)} | ${t.laborLoadingHours.toLocaleString().padStart(16)} | ${t.grandTotalHours.toLocaleString().padStart(16)} |`)
  console.log(`| Cost          | $${t.wbsEstimateCost.toLocaleString().padStart(15)} | $${t.laborLoadingCost.toLocaleString().padStart(15)} | $${t.grandTotalCost.toLocaleString().padStart(15)} |`)
  console.log(`| Fee           | $${t.wbsEstimateFee.toLocaleString().padStart(15)} | $${t.laborLoadingFee.toLocaleString().padStart(15)} | $${t.grandTotalFee.toLocaleString().padStart(15)} |`)
  console.log(`| Total         | $${t.wbsEstimateTotal.toLocaleString().padStart(15)} | $${t.laborLoadingTotal.toLocaleString().padStart(15)} | $${t.grandTotal.toLocaleString().padStart(15)} |`)
  console.log('')
  console.log('Conservation check: Cost + Fee = Total')
  const computedGrand = Math.round((t.grandTotalCost + t.grandTotalFee) * 100) / 100
  console.log(`  ${t.grandTotalCost} + ${t.grandTotalFee} = ${computedGrand}`)
  console.log(`  Expected grandTotal: ${t.grandTotal}`)
  console.log(`  Match: ${computedGrand === t.grandTotal}`)
}

main().catch(console.error)
