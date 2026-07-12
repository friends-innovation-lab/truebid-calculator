import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || 'local'
  const timestamp = new Date().toISOString()

  let db: 'ok' | 'fail' = 'fail'
  let proposals_visible = 0

  try {
    const supabase = createServiceClient()

    // 1. DB connectivity check
    const { error: pingError } = await supabase.from('companies').select('id').limit(1)
    if (pingError) throw pingError
    db = 'ok'

    // 2. Count non-archived proposals (mirrors dashboard visibility)
    // Service role bypasses RLS, so this counts all proposals any user would see
    const { count, error: countError } = await supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false)

    if (countError) throw countError
    proposals_visible = count ?? 0
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
