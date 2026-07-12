import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Anon client for health check - no service role key on public path
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || 'local'
  const timestamp = new Date().toISOString()

  let db: 'ok' | 'fail' = 'fail'
  let proposals_visible = 0

  try {
    const supabase = createAnonClient()

    // 1. DB connectivity check (anon can read tenants via RLS or this simple query)
    const { error: pingError } = await supabase.from('tenants').select('id').limit(1)
    if (pingError) throw pingError
    db = 'ok'

    // 2. Call SECURITY DEFINER function to get proposal count
    // Function runs with definer privileges, anon has EXECUTE grant only
    const { data, error: rpcError } = await supabase.rpc('health_check_proposal_count')
    if (rpcError) throw rpcError
    proposals_visible = data ?? 0
  } catch {
    db = 'fail'
  }

  // Return 503 if unhealthy — allows plain HTTP status monitoring
  const healthy = db === 'ok' && proposals_visible > 0
  const status = healthy ? 200 : 503

  return NextResponse.json(
    { db, proposals_visible, version, timestamp },
    {
      status,
      headers: { 'Cache-Control': 'no-store' }
    }
  )
}
