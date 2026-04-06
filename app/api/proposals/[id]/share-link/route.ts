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

  // Get all share links for this proposal
  const { data: shareLinks, error } = await supabase
    .from('boe_share_links')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /api/proposals/[id]/share-link] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const mapLink = (link: typeof shareLinks[number]) => ({
    id: link.id,
    token: link.token,
    isActive: link.is_active,
    expiresAt: link.expires_at,
    viewCount: link.view_count,
    lastViewedAt: link.last_viewed_at,
    createdAt: link.created_at,
    approvalStatus: link.approval_status || null,
    accountantNote: link.accountant_note || null,
    approvedAt: link.approved_at || null,
    reviewerEmail: link.reviewer_email || null,
    label: link.label || null,
    linkType: link.link_type || null,
  })

  const allLinks = (shareLinks || []).map(mapLink)
  const primaryLink = allLinks[0] || null

  return NextResponse.json({
    shareLink: primaryLink,
    allLinks,
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
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
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

  // Calculate expiration date
  const expiresInDays = parsed.data.expiresInDays || 7
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  // Create share link
  const insertData: Record<string, unknown> = {
    proposal_id: proposalId,
    token: generateToken(),
    is_active: true,
    expires_at: expiresAt.toISOString(),
  }
  if (parsed.data.reviewerEmail) insertData.reviewer_email = parsed.data.reviewerEmail
  if (parsed.data.label) insertData.label = parsed.data.label
  if (parsed.data.linkType) insertData.link_type = parsed.data.linkType

  const { data: shareLink, error } = await supabase
    .from('boe_share_links')
    .insert(insertData)
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
      approvalStatus: shareLink.approval_status || null,
      accountantNote: shareLink.accountant_note || null,
      approvedAt: shareLink.approved_at || null,
      reviewerEmail: shareLink.reviewer_email || null,
      label: shareLink.label || null,
      linkType: shareLink.link_type || null,
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
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
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
      approvalStatus: shareLink.approval_status || null,
      accountantNote: shareLink.accountant_note || null,
      approvedAt: shareLink.approved_at || null,
      reviewerEmail: shareLink.reviewer_email || null,
      label: shareLink.label || null,
      linkType: shareLink.link_type || null,
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
