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

    // 2. Count proposals visible for FFTC tenant (the "invisible row" check)
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('name', 'FFTC')
      .single()

    if (company) {
      const { count } = await supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('archived', false)

      proposals_visible = count ?? 0
    }
  } catch {
    db = 'fail'
  }

  return NextResponse.json(
    { db, proposals_visible, version, timestamp },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
