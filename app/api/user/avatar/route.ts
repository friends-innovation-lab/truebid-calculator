import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Upload avatar image
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, GIF, or WebP.' }, { status: 400 })
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 })
  }

  // Generate unique filename
  const ext = file.name.split('.').pop()
  const fileName = `${user.id}/${Date.now()}.${ext}`

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(uploadData.path)

  // Update user metadata with avatar URL
  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl }
  })

  if (updateError) {
    console.error('Update error:', updateError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ avatarUrl: publicUrl })
}

// DELETE - Remove avatar
export async function DELETE() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // List user's files and delete them
  const { data: files } = await supabase.storage
    .from('avatars')
    .list(user.id)

  if (files && files.length > 0) {
    const filesToDelete = files.map(f => `${user.id}/${f.name}`)
    await supabase.storage.from('avatars').remove(filesToDelete)
  }

  // Clear avatar URL from user metadata
  await supabase.auth.updateUser({
    data: { avatar_url: null }
  })

  return NextResponse.json({ success: true })
}
