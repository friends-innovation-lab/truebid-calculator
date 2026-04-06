import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH — Request corrections on BOE (public endpoint, token-based auth)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceClient()
  const { token } = await params

  let body: { note?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Look up share link by token
  const { data: shareLink, error: linkError } = await supabase
    .from('boe_share_links')
    .select('*')
    .eq('token', token)
    .single()

  if (linkError || !shareLink) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  if (!shareLink.is_active) {
    return NextResponse.json({ error: 'This link has been deactivated' }, { status: 410 })
  }

  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
  }

  // Update with corrections request
  const { error: updateError } = await supabase
    .from('boe_share_links')
    .update({
      approval_status: 'corrections_requested',
      accountant_note: body.note || '',
    })
    .eq('id', shareLink.id)

  if (updateError) {
    console.error('[PATCH /api/boe/[token]/corrections] Error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Corrections sent' })
}
