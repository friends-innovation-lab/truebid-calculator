import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateCollabSessionSchema } from '@/lib/schemas/collab'

// PUT — update session status
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = await params
  const body = await request.json()

  const result = updateCollabSessionSchema.safeParse(body)
  if (!result.success) {
    const flat = result.error.flatten()
    const messages = [
      ...Object.entries(flat.fieldErrors).map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`),
      ...flat.formErrors,
    ]
    return NextResponse.json({ error: messages.join('; ') || 'Invalid request data' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {
    status: result.data.status,
  }
  if (result.data.status === 'closed') {
    updateData.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('collab_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session: data })
}

// DELETE — delete session
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = await params

  const { error } = await supabase
    .from('collab_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
