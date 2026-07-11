import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Seed content library with FFTC past performance entries
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

  // FFTC Past Performance entries
  const pastPerformance = [
    {
      id: 'pp-dos-camp',
      title: 'DoS CAMP — Consular Appointment Management Platform',
      agency: 'Department of State, Bureau of Consular Affairs',
      contractNumber: '47QTCA23D0076',
      periodOfPerformance: 'March 2026 – March 2029 (base), 2 option years through March 2031',
      contractValue: '$24,908,163 (prime contract value)',
      setAside: 'Small Business',
      vehicle: 'GSA MAS',
      rolesPerformed: ['Product Manager', 'Delivery Manager', 'Frontend Developer', 'UX Designer', 'UX Researcher'],
      scope: 'FFTC is delivering design, research, and product management services for CAMP, the Department of State\'s mission-critical appointment scheduling platform serving 300+ consular locations including 230+ overseas posts, 29 domestic passport agencies, and 2 domestic visa processing centers. The platform supports approximately 10,000 worldwide clients and serves millions of U.S. citizens and foreign nationals annually.',
      outcomes: [
        'Active contract — currently in base year',
        'Supporting 300+ consular locations globally on a platform with 24/7 availability requirements',
        'Delivering agile product development across ACS, NIV, IV, and crisis scheduling workstreams'
      ],
      poc: 'Ki Yong Choi, COR — ChoiK@state.gov',
      status: 'active',
      relevantTo: ['scheduling', 'digital services', 'DOS', 'State Department', 'federal']
    },
    {
      id: 'pp-cms-qpp',
      title: 'CMS Quality Payment Program (QPP)',
      agency: 'Centers for Medicare and Medicaid Services',
      contractNumber: '75FCMC23F0038',
      periodOfPerformance: 'May 2023 – May 2026',
      contractValue: '$20,032,424 (prime contract value)',
      setAside: 'None — GSA MAS',
      vehicle: 'GSA MAS',
      rolesPerformed: ['UX Researcher'],
      scope: 'FFTC is providing UX research services for the Quality Payment Program website, which serves clinicians, practice administrators, and billing staff who must understand and comply with federal quality reporting requirements.',
      outcomes: [
        'Reduced key tasks from 7 clicks to 3 through research-informed information architecture redesign',
        'Reduced WCAG 2.1 AA accessibility violations by 95%',
        'Research surfaced consistent patterns behind 8,834 help desk tickets in a single submission window',
        'Launched AI-powered Resource Library Assistant for plain-language queries against QPP documentation',
        'Introduced NPI lookup and suggested prompts for users unfamiliar with correct vocabulary'
      ],
      poc: 'Matt Levenson — matt.levenson@agile6.com',
      status: 'active',
      relevantTo: ['CMS', 'Medicare', 'quality reporting', 'UX research', 'accessibility', 'federal']
    },
    {
      id: 'pp-md-doit',
      title: 'Maryland DOIT — State User Experience Research',
      agency: 'Maryland Department of Information Technology / SDAT',
      contractNumber: 'FC-336-25',
      periodOfPerformance: 'April 2025 – August 2025',
      contractValue: '$94,650 (FFTC as prime)',
      setAside: 'Small Business',
      vehicle: 'State',
      rolesPerformed: ['UX Researcher', 'Product Manager'],
      scope: 'FFTC conducted the first user research program ever completed by Maryland Digital Service, focused on the OneStop tax credit application portal serving seniors and low-income homeowners.',
      outcomes: [
        'Surveyed 3,400 constituents and interviewed 13 homeowners across race, income, age, and geography',
        'Research found 84% satisfaction with the form itself — failures were in outreach letters and post-submission correspondence, redirecting agency priorities entirely',
        'SDAT launched plain language initiative to rewrite all resident-facing communications',
        'Maryland using FFTC artifacts as model for future state initiatives',
        'Maryland Digital Service: \'This is what good looks like. This is the standard we are going to hold everyone to.\''
      ],
      poc: 'Lilly Madigan, Maryland Digital Service — lilly.madigan@maryland.gov',
      status: 'complete',
      relevantTo: ['Maryland', 'state', 'user research', 'plain language', 'constituent services']
    },
    {
      id: 'pp-va-debt',
      title: 'VA Debt Resolution — Financial Status Report and Streamlined Waiver',
      agency: 'Department of Veterans Affairs',
      contractNumber: '36C10B23N00060007',
      periodOfPerformance: 'December 2022 – December 2023',
      contractValue: '$9,967,609 (prime contract value)',
      setAside: 'SDVOSB',
      vehicle: 'VA CEDAR',
      rolesPerformed: ['UX Designer', 'UX Researcher'],
      scope: 'FFTC provided UX design and research services for the VA debt resolution platform, redesigning the digital Financial Status Report and launching the Streamlined Waiver — a Presidential Initiative offering fast-track debt forgiveness for qualifying Veterans.',
      outcomes: [
        '88% increase in waiver submissions following redesign',
        '95% instant approval rate for Veterans qualifying for the Streamlined Waiver',
        'Co-design sessions with Veterans including those with PTSD, TBI, and cognitive impairments',
        'Developed trauma-informed research protocols now a model for sensitive VA research',
        'First time Veterans could submit and receive immediate confirmation of receipt'
      ],
      poc: 'Matt Levenson, Agile6 — matt.levenson@agile6.com',
      status: 'complete',
      relevantTo: ['VA', 'Veterans', 'debt', 'benefits', 'UX', 'SDVOSB', 'federal']
    },
    {
      id: 'pp-va-financial-mgmt',
      title: 'VA Financial Management',
      agency: 'Department of Veterans Affairs',
      contractNumber: '36C10B25N00010002',
      periodOfPerformance: 'January 2025 – July 2028 (base + 2 option years)',
      contractValue: '$15,246,422 (prime contract value)',
      setAside: 'SDVOSB',
      vehicle: 'VA Spruce',
      rolesPerformed: ['UX Designer', 'UX Researcher'],
      scope: 'FFTC is providing UX design and research services for VA financial management systems, supporting the VA\'s financial management modernization efforts.',
      outcomes: ['Active contract — currently in base year'],
      poc: 'Jessica N. Miller, Agile6 — contracts@agile6.com',
      status: 'active',
      relevantTo: ['VA', 'financial management', 'UX', 'SDVOSB', 'federal', 'VA Spruce']
    },
    {
      id: 'pp-cms-seas-it',
      title: 'CMS SEAS-IT — Systems Engineering and Application Support',
      agency: 'Centers for Medicare and Medicaid Services',
      contractNumber: '75FCMC24F0059',
      periodOfPerformance: 'March 2024 – March 2029 (base + 4 option years)',
      contractValue: '$24,384,120 (prime contract value)',
      setAside: '8(a)',
      vehicle: 'Direct award',
      rolesPerformed: ['UX Researcher', 'UX Designer'],
      scope: 'FFTC is providing UX research and design services for CMS SEAS-IT, a 5-year T&M systems engineering and application support program at the Centers for Medicare and Medicaid Services.',
      outcomes: [
        'Active contract — currently in Option Year 1 of 5',
        '2+ years of continuous UX research and design delivery supporting CMS digital systems'
      ],
      poc: 'Shannon Gueringer, Skyward — sgueringer@skywarditsolutions.com',
      status: 'active',
      relevantTo: ['CMS', 'healthcare', 'UX', '8a', 'T&M', 'federal', '5-year']
    },
    {
      id: 'pp-va-data-viz',
      title: 'VA Clinical Decision Support — Data Visualization Design Patterns',
      agency: 'Department of Veterans Affairs',
      contractNumber: '36C10B25N00050010',
      periodOfPerformance: 'October 2024 – November 2025',
      contractValue: '$1,999,962 (prime contract value)',
      setAside: 'SDVOSB',
      vehicle: 'VA CEDAR',
      rolesPerformed: ['UX Researcher'],
      scope: 'FFTC provided UX research services for the VA Clinical Decision Support Collaborative, standardizing data visualization patterns across five product teams building clinical workflow tools.',
      outcomes: [
        '3x faster access to patient details via the Drawer pattern',
        '6 components adopted by the US Web Design System and VA Design System — now support federal teams government-wide',
        'Standardized 5 patterns: Data Grid, Drawer, Line Chart, Bar Chart, Single Value Visualization',
        'Accessibility shaped design decisions throughout — not reviewed at the end'
      ],
      poc: 'Ann Laidlaw, VA',
      status: 'complete',
      relevantTo: ['VA', 'clinical', 'design systems', 'USWDS', 'data visualization', 'SDVOSB', 'federal']
    },
    {
      id: 'pp-va-pact',
      title: 'VA Benefits and Claims — PACT Act 526ez',
      agency: 'Department of Veterans Affairs, Veterans Benefits Administration',
      contractNumber: 'TO BE ADDED',
      periodOfPerformance: 'TO BE ADDED',
      contractValue: 'TO BE ADDED',
      setAside: 'SDVOSB',
      vehicle: 'VA CEDAR',
      rolesPerformed: ['UX Designer', 'Frontend Developer'],
      scope: 'FFTC provided design and development services expanding the VA\'s 526ez digital disability claims form to support toxic exposure claims under the PACT Act, requiring coordination across VA forms platform tooling, the Lighthouse API, and claims processing systems.',
      outcomes: [
        'Veterans can now file toxic exposure claims online with more detail than the paper form — launched fall 2024',
        'Created the Checkbox and Loop Flow — new VA forms platform pattern now reused across VA.gov',
        'Built toggle-aware end-to-end tests preventing regressions across production and new feature flows',
        'Used Mural to compare paper form, API structure, and design mocks side by side — gaps visible before code was written'
      ],
      poc: 'TO BE ADDED',
      status: 'complete',
      relevantTo: ['VA', 'benefits', 'PACT Act', '526ez', 'UX', 'development', 'SDVOSB', 'federal']
    }
  ]

  // Fetch existing settings
  const { data: existing } = await supabase
    .from('company_settings')
    .select('id, content_library')
    .eq('company_id', company.id)
    .single()

  // Get existing content library or initialize
  const currentLibrary = (existing?.content_library || {}) as Record<string, unknown>
  const existingPP = (currentLibrary.pastPerformance || []) as Array<{ id: string }>

  // Filter out duplicates (by id)
  const existingIds = new Set(existingPP.map(pp => pp.id))
  const newEntries = pastPerformance.filter(pp => !existingIds.has(pp.id))

  // Merge: existing + new
  const mergedPP = [...existingPP, ...newEntries]

  const updatedLibrary = {
    ...currentLibrary,
    pastPerformance: mergedPP
  }

  let result
  if (existing) {
    result = await supabase
      .from('company_settings')
      .update({ content_library: updatedLibrary, updated_at: new Date().toISOString() })
      .eq('company_id', company.id)
      .select()
      .single()
  } else {
    result = await supabase
      .from('company_settings')
      .insert({ company_id: company.id, content_library: updatedLibrary })
      .select()
      .single()
  }

  if (result.error) {
    console.error('[Seed Content Library] Error:', result.error)
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    added: newEntries.length,
    total: mergedPP.length,
    message: `Added ${newEntries.length} new past performance entries (${mergedPP.length} total)`
  })
}
