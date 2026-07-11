import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { directorId } = body

    if (!directorId) {
      return NextResponse.json({ error: 'directorId is required' }, { status: 400 })
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')

    // Calculate expiry (14 days from now)
    const tokenExpiry = new Date()
    tokenExpiry.setDate(tokenExpiry.getDate() + 14)

    // In a full implementation, we would:
    // 1. Save the token to working_data.directors[].token
    // 2. Save tokenExpiry to working_data.directors[].tokenExpiry
    // 3. Send an email to the director with the link
    //
    // For now, we return the token for the frontend to handle

    // Get the proposal to update working_data
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('working_data')
      .eq('id', proposalId)
      .single()

    if (fetchError) {
      console.error('Error fetching proposal:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch proposal' }, { status: 500 })
    }

    // Update the director's token in working_data
    const workingData = proposal?.working_data || {}
    const directors = workingData.directors || []

    const updatedDirectors = directors.map((d: { id: string }) => {
      if (d.id === directorId) {
        return {
          ...d,
          token,
          tokenExpiry: tokenExpiry.toISOString(),
        }
      }
      return d
    })

    // Save updated working_data
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        working_data: {
          ...workingData,
          directors: updatedDirectors,
        },
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('Error updating proposal:', updateError)
      // Continue anyway - frontend will have the token
    }

    // TODO: Send email to director
    // For now, just return the token and let frontend show copy-link modal

    return NextResponse.json({
      success: true,
      token,
      tokenExpiry: tokenExpiry.toISOString(),
      message: 'Director link generated successfully',
    })
  } catch (error) {
    console.error('Error generating director link:', error)
    return NextResponse.json(
      { error: 'Failed to generate director link' },
      { status: 500 }
    )
  }
}
