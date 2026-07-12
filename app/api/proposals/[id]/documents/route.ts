import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractText } from 'unpdf'

/**
 * Documents API
 * Phase 4B: Multi-document upload support
 *
 * GET - List all documents for a proposal
 * POST - Add a new document to the proposal's document set
 */

// GET - List documents for proposal
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

  const { data: documents, error } = await supabase
    .from('solicitation_documents')
    .select('id, filename, doc_type, doc_type_source, classification_confidence, status, page_count, uploaded_at')
    .eq('proposal_id', proposalId)
    .order('precedence_rank', { ascending: false })

  if (error) {
    console.error('[documents/GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ documents: documents || [] })
}

// POST - Upload and add a new document
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

  try {
    // Get tenant ID from proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('company_id')
      .eq('id', proposalId)
      .single()

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Get tenant_id - use first tenant (current single-tenant architecture)
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 500 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    // Upload to Supabase Storage
    const timestamp = Date.now()
    const storagePath = `solicitations/${proposalId}/${timestamp}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file)

    if (uploadError) {
      console.error('[documents/POST] Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Extract text from PDF
    let rawText = ''
    let pageCount = 0

    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      const { text, totalPages } = await extractText(buffer, { mergePages: true })
      rawText = text
      pageCount = totalPages
      console.log(`[documents/POST] PDF has ${pageCount} pages, ${rawText.length} chars`)
    } catch (pdfError) {
      console.error('[documents/POST] PDF extraction error:', pdfError)
      // Continue without text - classification will fail but document is saved
    }

    // Create solicitation_documents record
    const { data: document, error: insertError } = await supabase
      .from('solicitation_documents')
      .insert({
        tenant_id: tenant.id,
        proposal_id: proposalId,
        storage_path: storagePath,
        filename: file.name,
        file_size_bytes: file.size,
        page_count: pageCount,
        status: rawText ? 'uploaded' : 'failed',
        raw_text: rawText || null,
        error_message: rawText ? null : 'Failed to extract text from PDF',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[documents/POST] Insert error:', insertError)
      // Clean up uploaded file
      await supabase.storage.from('documents').remove([storagePath])
      return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 })
    }

    // Trigger classification in background (don't await)
    if (rawText) {
      fetch(`${request.url}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id }),
      }).catch(err => console.warn('[documents/POST] Classification trigger failed:', err))
    }

    return NextResponse.json({
      document: {
        id: document.id,
        filename: document.filename,
        doc_type: document.doc_type,
        status: document.status,
        page_count: document.page_count,
      },
      message: 'Document uploaded successfully',
    }, { status: 201 })

  } catch (error) {
    console.error('[documents/POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    )
  }
}
