import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Seed content library table with FFTC past performance entries
export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }

  // FFTC Past Performance entries formatted for content_library table
  const pastPerformanceEntries = [
    {
      type: 'past_performance',
      title: 'DoS CAMP — Consular Appointment Management Platform',
      content: {
        contract_name: 'DoS CAMP — Consular Appointment Management Platform',
        agency: 'Department of State, Bureau of Consular Affairs',
        contract_number: '47QTCA23D0076',
        period_start: '2026-03',
        period_end: '2031-03',
        contract_value: 24908163,
        role: 'prime',
        scope_description: 'FFTC is delivering design, research, and product management services for CAMP, the Department of State\'s mission-critical appointment scheduling platform serving 300+ consular locations including 230+ overseas posts, 29 domestic passport agencies, and 2 domestic visa processing centers. The platform supports approximately 10,000 worldwide clients and serves millions of U.S. citizens and foreign nationals annually.',
        relevance_statement: 'Active contract demonstrating FFTC\'s ability to deliver mission-critical scheduling platforms at federal scale with 24/7 availability requirements.',
        results: 'Active contract — currently in base year. Supporting 300+ consular locations globally. Delivering agile product development across ACS, NIV, IV, and crisis scheduling workstreams.',
      },
      tags: ['DOS', 'State Department', 'scheduling', 'digital services', 'federal', 'active'],
    },
    {
      type: 'past_performance',
      title: 'CMS Quality Payment Program (QPP)',
      content: {
        contract_name: 'CMS Quality Payment Program (QPP)',
        agency: 'Centers for Medicare and Medicaid Services',
        contract_number: '75FCMC23F0038',
        period_start: '2023-05',
        period_end: '2026-05',
        contract_value: 20032424,
        role: 'subcontractor',
        scope_description: 'FFTC is providing UX research services for the Quality Payment Program website, which serves clinicians, practice administrators, and billing staff who must understand and comply with federal quality reporting requirements.',
        relevance_statement: 'Demonstrates FFTC\'s UX research expertise in healthcare IT and ability to drive measurable improvements in federal digital services.',
        results: 'Reduced key tasks from 7 clicks to 3 through research-informed IA redesign. Reduced WCAG 2.1 AA accessibility violations by 95%. Research surfaced consistent patterns behind 8,834 help desk tickets. Launched AI-powered Resource Library Assistant.',
      },
      tags: ['CMS', 'Medicare', 'healthcare', 'UX research', 'accessibility', 'federal', 'active'],
    },
    {
      type: 'past_performance',
      title: 'Maryland DOIT — State User Experience Research',
      content: {
        contract_name: 'Maryland DOIT — State User Experience Research',
        agency: 'Maryland Department of Information Technology / SDAT',
        contract_number: 'FC-336-25',
        period_start: '2025-04',
        period_end: '2025-08',
        contract_value: 94650,
        role: 'prime',
        scope_description: 'FFTC conducted the first user research program ever completed by Maryland Digital Service, focused on the OneStop tax credit application portal serving seniors and low-income homeowners.',
        relevance_statement: 'Demonstrates FFTC\'s ability to establish user research programs from scratch and redirect agency priorities based on evidence.',
        results: 'Surveyed 3,400 constituents and interviewed 13 homeowners. Research found 84% satisfaction with the form — failures were in outreach and correspondence, redirecting agency priorities. SDAT launched plain language initiative. Maryland using FFTC artifacts as model for future state initiatives.',
      },
      tags: ['Maryland', 'state', 'user research', 'plain language', 'constituent services', 'complete'],
    },
    {
      type: 'past_performance',
      title: 'VA Debt Resolution — Financial Status Report and Streamlined Waiver',
      content: {
        contract_name: 'VA Debt Resolution — Financial Status Report and Streamlined Waiver',
        agency: 'Department of Veterans Affairs',
        contract_number: '36C10B23N00060007',
        period_start: '2022-12',
        period_end: '2023-12',
        contract_value: 9967609,
        role: 'subcontractor',
        scope_description: 'FFTC provided UX design and research services for the VA debt resolution platform, redesigning the digital Financial Status Report and launching the Streamlined Waiver — a Presidential Initiative offering fast-track debt forgiveness for qualifying Veterans.',
        relevance_statement: 'Demonstrates FFTC\'s expertise in sensitive Veteran-facing services and trauma-informed research protocols.',
        results: '88% increase in waiver submissions following redesign. 95% instant approval rate for qualifying Veterans. Developed trauma-informed research protocols now a model for sensitive VA research. First time Veterans could submit and receive immediate confirmation.',
      },
      tags: ['VA', 'Veterans', 'debt', 'benefits', 'UX', 'SDVOSB', 'federal', 'complete'],
    },
    {
      type: 'past_performance',
      title: 'VA Financial Management',
      content: {
        contract_name: 'VA Financial Management',
        agency: 'Department of Veterans Affairs',
        contract_number: '36C10B25N00010002',
        period_start: '2025-01',
        period_end: '2028-07',
        contract_value: 15246422,
        role: 'subcontractor',
        scope_description: 'FFTC is providing UX design and research services for VA financial management systems, supporting the VA\'s financial management modernization efforts.',
        relevance_statement: 'Active VA contract demonstrating continued trust and performance on VA Spruce vehicle.',
        results: 'Active contract — currently in base year.',
      },
      tags: ['VA', 'financial management', 'UX', 'SDVOSB', 'federal', 'VA Spruce', 'active'],
    },
    {
      type: 'past_performance',
      title: 'CMS SEAS-IT — Systems Engineering and Application Support',
      content: {
        contract_name: 'CMS SEAS-IT — Systems Engineering and Application Support',
        agency: 'Centers for Medicare and Medicaid Services',
        contract_number: '75FCMC24F0059',
        period_start: '2024-03',
        period_end: '2029-03',
        contract_value: 24384120,
        role: 'subcontractor',
        scope_description: 'FFTC is providing UX research and design services for CMS SEAS-IT, a 5-year T&M systems engineering and application support program at the Centers for Medicare and Medicaid Services.',
        relevance_statement: 'Demonstrates FFTC\'s ability to deliver sustained UX services on large-scale federal IT programs.',
        results: 'Active contract — currently in Option Year 1 of 5. 2+ years of continuous UX research and design delivery supporting CMS digital systems.',
      },
      tags: ['CMS', 'healthcare', 'UX', '8a', 'T&M', 'federal', 'active'],
    },
    {
      type: 'past_performance',
      title: 'VA Clinical Decision Support — Data Visualization Design Patterns',
      content: {
        contract_name: 'VA Clinical Decision Support — Data Visualization Design Patterns',
        agency: 'Department of Veterans Affairs',
        contract_number: '36C10B25N00050010',
        period_start: '2024-10',
        period_end: '2025-11',
        contract_value: 1999962,
        role: 'subcontractor',
        scope_description: 'FFTC provided UX research services for the VA Clinical Decision Support Collaborative, standardizing data visualization patterns across five product teams building clinical workflow tools.',
        relevance_statement: 'Demonstrates FFTC\'s design systems expertise and ability to create reusable components adopted government-wide.',
        results: '3x faster access to patient details via the Drawer pattern. 6 components adopted by the US Web Design System and VA Design System. Standardized 5 patterns: Data Grid, Drawer, Line Chart, Bar Chart, Single Value Visualization.',
      },
      tags: ['VA', 'clinical', 'design systems', 'USWDS', 'data visualization', 'SDVOSB', 'federal', 'complete'],
    },
    {
      type: 'past_performance',
      title: 'VA Benefits and Claims — PACT Act 526ez',
      content: {
        contract_name: 'VA Benefits and Claims — PACT Act 526ez',
        agency: 'Department of Veterans Affairs, Veterans Benefits Administration',
        contract_number: 'TBD',
        role: 'subcontractor',
        scope_description: 'FFTC provided design and development services expanding the VA\'s 526ez digital disability claims form to support toxic exposure claims under the PACT Act, requiring coordination across VA forms platform tooling, the Lighthouse API, and claims processing systems.',
        relevance_statement: 'Demonstrates FFTC\'s ability to deliver design and frontend development on complex VA forms with tight coordination across systems.',
        results: 'Veterans can now file toxic exposure claims online with more detail than the paper form — launched fall 2024. Created the Checkbox and Loop Flow — new VA forms platform pattern now reused across VA.gov. Built toggle-aware end-to-end tests preventing regressions.',
      },
      tags: ['VA', 'benefits', 'PACT Act', '526ez', 'UX', 'development', 'SDVOSB', 'federal', 'complete'],
    },
  ]

  // Check for existing entries to avoid duplicates
  const { data: existingItems } = await supabase
    .from('content_library')
    .select('title')
    .eq('company_id', company.id)
    .eq('type', 'past_performance')

  const existingTitles = new Set((existingItems || []).map(i => i.title))

  // Filter out duplicates
  const newEntries = pastPerformanceEntries.filter(e => !existingTitles.has(e.title))

  if (newEntries.length === 0) {
    return NextResponse.json({
      success: true,
      added: 0,
      total: existingItems?.length || 0,
      message: 'All entries already exist'
    })
  }

  // Insert new entries
  const { error: insertError } = await supabase
    .from('content_library')
    .insert(newEntries.map(entry => ({
      company_id: company.id,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      created_by: user.id,
    })))

  if (insertError) {
    console.error('[Seed Content Library] Insert error:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    added: newEntries.length,
    total: (existingItems?.length || 0) + newEntries.length,
    message: `Added ${newEntries.length} new past performance entries`
  })
}
