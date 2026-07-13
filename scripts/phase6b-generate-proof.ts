/**
 * Phase 6B: GenerateBOEArtifact Command Proof
 *
 * Executes the actual command against staging to prove it works.
 */

import { createClient } from '@supabase/supabase-js'
import { createGenerateBOEArtifactCommand } from '../lib/commands/boe/generate-artifact'

const STAGING_URL = 'https://tcobyquewjootwxpqijq.supabase.co'
const STAGING_KEY = process.env.STAGING_SERVICE_ROLE_KEY || ''

async function main() {
  if (!STAGING_KEY) {
    console.error('STAGING_SERVICE_ROLE_KEY environment variable required')
    process.exit(1)
  }

  const supabase = createClient(STAGING_URL, STAGING_KEY)

  const command = createGenerateBOEArtifactCommand(supabase)

   
  const context: any = {
    tenant: {
      tenant: { id: '44444444-4444-4444-4444-444444444444' },
      membership: { role: 'owner', userId: '2adaf420-5e98-40b3-93cb-9b480301d90b', tenantId: '44444444-4444-4444-4444-444444444444' }
    },
    correlationId: 'phase6b-proof-' + Date.now(),
    actorType: 'user',
    actorId: '2adaf420-5e98-40b3-93cb-9b480301d90b'
  }

  const input = {
    proposalId: 'e2e66666-6666-6666-6666-666666666666',
    pricingScenarioId: '82c6a22d-91b0-421e-9ae5-07a948881306'
  }

  console.log('=== GenerateBOEArtifact Command Proof ===')
  console.log('Input:', JSON.stringify(input, null, 2))
  console.log('')

  const result = await command.execute(context, input)

  console.log('Result:')
  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error('Error:', err.message)
  if (err.details) console.error('Details:', JSON.stringify(err.details, null, 2))
  process.exit(1)
})
