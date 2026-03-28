import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { shareLinkCreateSchema, shareLinkUpdateSchema } from '@/lib/schemas/share-link'

// Generate a secure random token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// GET - Get existing share link for proposal
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  // Verify user owns this proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Get existing share link
  const { data: shareLink, error } = await supabase
    .from('boe_share_links')
    .select('*')
    .eq('proposal_id', proposalId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine
    console.error('[GET /api/proposals/[id]/share-link] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    shareLink: shareLink ? {
      id: shareLink.id,
      token: shareLink.token,
      isActive: shareLink.is_active,
      expiresAt: shareLink.expires_at,
      viewCount: shareLink.view_count,
      lastViewedAt: shareLink.last_viewed_at,
      createdAt: shareLink.created_at,
    } : null,
  })
}

// POST - Create a new share link
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params
  const body = await request.json()

  // Validate input
  const parsed = shareLinkCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  // Verify user owns this proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Check if a share link already exists
  const { data: existingLink } = await supabase
    .from('boe_share_links')
    .select('id')
    .eq('proposal_id', proposalId)
    .single()

  if (existingLink) {
    return NextResponse.json({ error: 'Share link already exists for this proposal' }, { status: 409 })
  }

  // Calculate expiration date
  const expiresInDays = parsed.data.expiresInDays || 7
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  // Create share link
  const { data: shareLink, error } = await supabase
    .from('boe_share_links')
    .insert({
      proposal_id: proposalId,
      token: generateToken(),
      is_active: true,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/proposals/[id]/share-link] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    shareLink: {
      id: shareLink.id,
      token: shareLink.token,
      isActive: shareLink.is_active,
      expiresAt: shareLink.expires_at,
      viewCount: shareLink.view_count,
      lastViewedAt: shareLink.last_viewed_at,
      createdAt: shareLink.created_at,
    },
  })
}

// PUT - Update share link settings
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params
  const body = await request.json()

  // Validate input
  const parsed = shareLinkUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  // Verify user owns this proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.isActive !== undefined) {
    updateData.is_active = parsed.data.isActive
  }

  if (parsed.data.expiresInDays !== undefined) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + parsed.data.expiresInDays)
    updateData.expires_at = expiresAt.toISOString()
  }

  // Update share link
  const { data: shareLink, error } = await supabase
    .from('boe_share_links')
    .update(updateData)
    .eq('proposal_id', proposalId)
    .select()
    .single()

  if (error) {
    console.error('[PUT /api/proposals/[id]/share-link] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    shareLink: {
      id: shareLink.id,
      token: shareLink.token,
      isActive: shareLink.is_active,
      expiresAt: shareLink.expires_at,
      viewCount: shareLink.view_count,
      lastViewedAt: shareLink.last_viewed_at,
      createdAt: shareLink.created_at,
    },
  })
}

// DELETE - Delete share link
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  // Verify user owns this proposal (RLS will handle this, but explicit check is good)
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('boe_share_links')
    .delete()
    .eq('proposal_id', proposalId)

  if (error) {
    console.error('[DELETE /api/proposals/[id]/share-link] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
