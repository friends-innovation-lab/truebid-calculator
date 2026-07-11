import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch current user's profile from auth
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name || user.user_metadata?.name || '',
      avatarUrl: user.user_metadata?.avatar_url || null,
    }
  })
}

// PUT - Update user's profile metadata
export async function PUT(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const { data, error } = await supabase.auth.updateUser({
    data: {
      full_name: body.fullName,
      avatar_url: body.avatarUrl,
    }
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name || '',
      avatarUrl: data.user.user_metadata?.avatar_url || null,
    }
  })
}
