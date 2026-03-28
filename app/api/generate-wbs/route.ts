// API Route: /app/api/generate-wbs/route.ts
// AI-powered bulk WBS generation from requirements using Claude

// API Route: /app/api/generate-wbs/route.ts
// AI-powered bulk WBS generation from requirements using Claude

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { generateWbsRequestSchema } from '@/lib/schemas/wbs'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface GeneratedLaborEstimate {
  roleId: string
  roleName: string
  hoursByPeriod: {
    base: number
    option1: number
    option2: number
    option3: number
    option4: number
  }
  rationale: string
  confidence: 'high' | 'medium' | 'low'
}

interface GeneratedWBSElement {
  linkedRequirementId: string
  wbsNumber: string
  title: string
  sowReference: string
  why: string
  what: string
  notIncluded: string
  assumptions: string[]
  estimateMethod: 'engineering' | 'parametric' | 'level-of-effort'
  laborEstimates: GeneratedLaborEstimate[]
  risks: {
    description: string
    likelihood: 'high' | 'medium' | 'low'
    impact: 'high' | 'medium' | 'low'
    mitigation: string
  }[]
  suggestedDependencies: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const result = generateWbsRequestSchema.safeParse(body)
    if (!result.success) {
      const flat = result.error.flatten()
      const messages = [
        ...Object.entries(flat.fieldErrors).map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`),
        ...flat.formErrors,
      ]
      return NextResponse.json({ error: messages.join('; ') || 'Invalid request data' }, { status: 400 })
    }

    const { requirements, availableRoles, existingWbsNumbers, contractContext } = result.data

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      // Return mock data for testing when no API key
      const mockElements = requirements.map((req, idx) => ({
        linkedRequirementId: req.id,
        wbsNumber: getNextWbsNumber(existingWbsNumbers, idx),
        title: `Implement: ${req.title}`,
        sowReference: req.source || req.referenceNumber,
        why: `This work addresses the ${req.type} requirement in ${req.referenceNumber}. ${req.description.slice(0, 100)}`,
        what: `Deliver solution components for: ${req.title}. This includes analysis, design, development, testing, and documentation.`,
        notIncluded: 'Items not explicitly stated in the requirement. Third-party integrations unless specified.',
        assumptions: [
          'Requirements are stable and approved',
          'Resources will be available as planned',
          'Government will provide timely feedback'
        ],
        estimateMethod: 'engineering' as const,
        laborEstimates: availableRoles.slice(0, Math.min(3, availableRoles.length)).map(role => ({
          roleId: role.id,
          roleName: role.name,
          hoursByPeriod: { 
            base: req.type === 'shall' ? 120 : 60, 
            option1: contractContext.periodOfPerformance.optionYears >= 1 ? 40 : 0, 
            option2: contractContext.periodOfPerformance.optionYears >= 2 ? 20 : 0, 
            option3: 0, 
            option4: 0 
          },
          rationale: `Standard estimate for ${role.name} based on ${req.type} requirement complexity`,
          confidence: 'medium' as const
        })),
        risks: [],
        dependencies: []
      }))

      return NextResponse.json({
        success: true,
        wbsElements: mockElements,
        mock: true
      })
    }

    // Build the prompt
    const systemPrompt = `You are an expert government contracting estimator helping create Work Breakdown Structure (WBS) elements for a federal proposal.

Your task is to generate WBS elements that:
1. Are action-oriented and specific
2. Include clear deliverables (the "what")
3. Explain the business purpose (the "why")
4. List explicit exclusions to prevent scope creep
5. Include reasonable assumptions
6. Estimate labor hours by role

IMPORTANT GUIDELINES:
- Be realistic about labor estimates - government contracts typically range 40-400 hours per role per WBS element
- Use ONLY the available roles provided - don't invent new roles
- For "shall" requirements, be thorough - these are mandatory
- For "should" requirements, be practical
- For "may" requirements, suggest minimal effort
- Base year gets the bulk of hours, option years spread remaining maintenance/enhancement work
- Always explain your rationale for labor estimates

ROLE ASSIGNMENT GUIDELINES (match work to the right role):
- **Delivery Manager**: Project oversight, client communication, timeline management, status reporting, risk escalation
- **Product Manager**: Requirements gathering, backlog prioritization, stakeholder alignment, roadmap planning, acceptance criteria
- **Technical Lead**: Architecture decisions, code reviews, technical direction, team mentorship, integration strategy
- **Design Lead**: Design system ownership, visual direction, design reviews, brand consistency
- **Product Designer**: UI/UX design, wireframes, prototypes, user flows, visual design
- **UX Researcher**: User interviews, usability testing, research synthesis, persona development
- **Business Analyst**: Requirements documentation, process mapping, gap analysis, data requirements
- **Data Analyst**: Reporting, dashboards, data modeling, analytics, metrics definition
- **Backend Developer**: APIs, server code, database, authentication, business logic
- **Frontend Developer**: UI components, client-side code, responsive design, accessibility
- **DevOps Engineer**: CI/CD, deployment, SSL, infrastructure, environment configuration, monitoring
- **QA Engineer**: Test planning, test automation, regression testing, bug verification
- **Content & UX Writer**: User documentation, UI copy, help text, style guides - NOT infrastructure or code

⚠️ CRITICAL: SSL certificates, deployment automation, and environment configuration = DevOps Engineer, NOT Content & UX Writer

HOURS ALLOCATION GUIDANCE:
- Base Year: 60-80% of total effort (initial development, heavy lifting)
- Option Year 1: 15-25% of base year hours (enhancements, maintenance)
- Option Year 2: 10-15% of base year hours (steady state support)
- Option Years 3-4: 5-10% of base year hours (minimal maintenance)
- For "shall" requirements: Base year typically 100-300 hours per major role
- For "should" requirements: Base year typically 40-150 hours per major role
- For "may" requirements: Base year typically 20-60 hours per major role
- Not every role needs to be on every WBS - only include roles that genuinely contribute

RISKS AND DEPENDENCIES GUIDANCE:
- Include 1-2 realistic risks per WBS element
- Common risks: requirement ambiguity, resource availability, integration complexity, government feedback delays
- For dependencies, reference WBS numbers that must complete before this work can start
- Design work typically depends on requirements gathering
- Development depends on design
- Testing depends on development
- Don't create circular dependencies

CONTRACT CONTEXT:
- Title: ${contractContext.title}
- Agency: ${contractContext.agency}  
- Contract Type: ${contractContext.contractType.toUpperCase()}
- Period: Base Year${contractContext.periodOfPerformance.optionYears > 0 ? ` + ${contractContext.periodOfPerformance.optionYears} Option Years` : ''}

AVAILABLE ROLES (use ONLY these - do NOT invent new roles):
${availableRoles.map(r => `- ID: "${r.id}", Name: "${r.name}"${r.description ? `, Description: ${r.description}` : ''}, Category: ${r.category}`).join('\n')}

CRITICAL: Only use roleIds and roleNames from the list above. If a role doesn't exist for certain work, use the closest match or skip that labor estimate. Never create roles like "Content Specialist" or "UX Writer" unless they appear in the list above.

You must respond with ONLY valid JSON matching this exact structure - no markdown, no explanation, just the JSON object:
{
  "wbsElements": [
    {
      "linkedRequirementId": "the requirement ID from input",
      "wbsNumber": "sequential number like 1.4, 1.5",
      "title": "Action-oriented title",
      "sowReference": "Use the Source field value from the requirement (e.g., 'SOO 3.2.1' or section name like 'TASK ORDER TYPE'). Do NOT use the requirement ID here.",
      "why": "2-3 sentences explaining business purpose",
      "what": "2-3 sentences describing specific deliverables",
      "notIncluded": "What is explicitly NOT part of this work",
      "assumptions": ["assumption 1", "assumption 2"],
      "estimateMethod": "engineering",
      "laborEstimates": [
        {
          "roleId": "exact role ID from available roles",
          "roleName": "exact role name from available roles",
          "hoursByPeriod": {
            "base": 120,
            "option1": 40,
            "option2": 20,
            "option3": 0,
            "option4": 0
          },
          "rationale": "Why this role needs these hours",
          "confidence": "high"
        }
      ],
      "risks": [
        {
          "description": "What could go wrong",
          "likelihood": "medium",
          "impact": "medium",
          "mitigation": "How to prevent or reduce this risk"
        }
      ],
      "suggestedDependencies": ["1.1", "1.2"]
    }
  ]
}`

    const userPrompt = `Generate WBS elements for the following ${requirements.length} requirements. Start WBS numbering from ${getNextWbsNumber(existingWbsNumbers, 0)}.

REQUIREMENTS TO PROCESS:
${requirements.map((req, idx) => `
Requirement ${idx + 1}:
- ID: "${req.id}"
- Reference: ${req.referenceNumber}
- Type: ${req.type.toUpperCase()}
- Title: ${req.title}
- Description: ${req.description}
- Source: ${req.source}
- Category: ${req.category}
`).join('\n---\n')}

Generate exactly ${requirements.length} WBS elements, one for each requirement. Respond with only the JSON object.`

    console.log('Calling Claude with', requirements.length, 'requirements')
    console.log('Available roles:', availableRoles.map(r => r.name))

    // Call Claude with proper system message
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      system: systemPrompt,
      messages: [
        { 
          role: 'user', 
          content: userPrompt 
        }
      ],
    })

    // Extract text response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!responseText) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Check if response was truncated
    if (message.stop_reason === 'max_tokens') {
      console.error('Response was truncated - max_tokens reached')
      return NextResponse.json(
        { error: 'AI response was truncated. Try generating fewer requirements at once.' },
        { status: 500 }
      )
    }

    // Parse the response - handle potential markdown code blocks
    let jsonText = responseText.trim()
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    jsonText = jsonText.trim()

    let parsed: { wbsElements: GeneratedWBSElement[] }
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse AI response:', jsonText.slice(0, 1000))
      return NextResponse.json(
        { error: 'Failed to parse AI response. The AI may have returned invalid JSON.', details: jsonText.slice(0, 500) },
        { status: 500 }
      )
    }

    // Validate we got the expected number of elements
    if (!parsed.wbsElements || parsed.wbsElements.length === 0) {
      return NextResponse.json(
        { error: 'AI returned empty WBS elements' },
        { status: 500 }
      )
    }

    // Validate and clean up the response
    const validatedElements = parsed.wbsElements.map((el, idx) => {
      // Ensure WBS number is sequential
      const wbsNumber = el.wbsNumber || getNextWbsNumber(existingWbsNumbers, idx)
      
      // Validate role IDs exist in available roles
      const validatedLabor = (el.laborEstimates || [])
        .filter(labor => availableRoles.some(r => r.id === labor.roleId || r.name === labor.roleName))
        .map(labor => {
          // Find the role by ID or name
          const matchedRole = availableRoles.find(r => r.id === labor.roleId) 
            || availableRoles.find(r => r.name === labor.roleName)
          
          return {
            ...labor,
            roleId: matchedRole?.id || labor.roleId,
            roleName: matchedRole?.name || labor.roleName,
            confidence: labor.confidence || 'medium',
            hoursByPeriod: {
              base: labor.hoursByPeriod?.base || 0,
              option1: labor.hoursByPeriod?.option1 || 0,
              option2: labor.hoursByPeriod?.option2 || 0,
              option3: labor.hoursByPeriod?.option3 || 0,
              option4: labor.hoursByPeriod?.option4 || 0,
            }
          }
        })

      return {
        ...el,
        wbsNumber,
        laborEstimates: validatedLabor,
        estimateMethod: el.estimateMethod || 'engineering',
        assumptions: el.assumptions || [],
        risks: (el.risks || []).map(risk => ({
          id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: risk.description || '',
          likelihood: risk.likelihood || 'medium',
          impact: risk.impact || 'medium',
          mitigation: risk.mitigation || '',
        })),
        dependencies: (el.suggestedDependencies || []).map(dep => ({
          id: `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          predecessorId: dep,
          type: 'finish-to-start' as const,
        })),
      }
    })

    return NextResponse.json({
      success: true,
      wbsElements: validatedElements,
      usage: {
        inputTokens: message.usage?.input_tokens,
        outputTokens: message.usage?.output_tokens,
      }
    })

  } catch (error) {
    console.error('WBS generation error:', error)
    
    // Check for Anthropic-specific errors
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status: number; message?: string }
      return NextResponse.json(
        { error: `Anthropic API error: ${apiError.message || 'Unknown'}`, status: apiError.status },
        { status: apiError.status }
      )
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Helper function (defined outside try block for mock data fallback)
function getNextWbsNumber(existing: string[], offset: number): string {
  if (existing.length === 0) return `1.${1 + offset}`
  
  const numbers = existing
    .map(num => {
      const parts = num.split('.')
      return { major: parseInt(parts[0]) || 1, minor: parseInt(parts[1]) || 0 }
    })
    .sort((a, b) => a.major === b.major ? b.minor - a.minor : b.major - a.major)
  
  const highest = numbers[0]
  return `${highest.major}.${highest.minor + 1 + offset}`
}
