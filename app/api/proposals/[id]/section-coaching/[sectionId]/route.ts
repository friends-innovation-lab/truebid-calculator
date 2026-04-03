import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId, sectionId } = await params

  const { data: coaching, error } = await supabase
    .from('section_coaching')
    .select('scores, feedback, overall_assessment, generated_at')
    .eq('proposal_id', proposalId)
    .eq('section_id', sectionId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine
    console.error('[section-coaching] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!coaching) {
    return NextResponse.json({ coaching: null })
  }

  // Transform to match the format expected by the client
  return NextResponse.json({
    coaching: {
      overall: parseFloat(coaching.overall_assessment) || 0,
      scores: coaching.scores,
      feedback: coaching.feedback,
      generatedAt: coaching.generated_at,
    }
  })
}
