import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const serviceClient = createServiceClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  // Verify proposal belongs to user's company
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, company_id')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Get the file from form data
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!file.type.includes('pdf')) {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
  }

  // Max 25MB
  const MAX_SIZE = 25 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 25MB.' }, { status: 400 })
  }

  try {
    // Create unique file path
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${proposal.company_id}/${proposalId}/${timestamp}-${sanitizedName}`

    // Upload to Supabase Storage (use service client to bypass RLS)
    const fileBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from('solicitations')
      .upload(filePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('[upload-pdf] Storage upload error:', uploadError)
      return NextResponse.json({ error: `Failed to upload file: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = serviceClient.storage
      .from('solicitations')
      .getPublicUrl(uploadData.path)

    const pdfUrl = urlData.publicUrl

    // Update proposal working_data with PDF info
    const { data: existing } = await supabase
      .from('proposals')
      .select('working_data')
      .eq('id', proposalId)
      .single()

    const existingWorkingData = existing?.working_data || {}
    const updatedWorkingData = {
      ...existingWorkingData,
      pdfUrl,
      pdfFileName: file.name,
      pdfUploadDate: new Date().toISOString(),
      pdfStoragePath: uploadData.path,
    }

    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        working_data: updatedWorkingData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('[upload-pdf] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to save PDF info' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      pdfUrl,
      fileName: file.name,
      uploadDate: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[upload-pdf] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
