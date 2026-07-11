#!/usr/bin/env tsx
/**
 * TrueBid Eval Harness - REAL API CALLS
 *
 * Executes actual AI extractions against corpus samples and compares to ground truth.
 */

import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'

// Import shared prompts from production code
import { buildExtractionSystemPrompt, buildExtractionUserPrompt } from '../lib/ai/prompts/extraction'

// Import JSON schema for tool-use pattern (must use require for tsx compatibility)
const contractIntelligenceJsonSchema = {
  type: 'object',
  properties: {
    documentType: {
      type: 'object',
      properties: {
        value: { type: 'string', enum: ['RFP', 'RFQ', 'SOO', 'PWS', 'SOW', 'task_order', 'unknown'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['value', 'confidence']
    },
    vehicle: {
      type: 'object',
      properties: {
        value: { type: ['string', 'null'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['value', 'confidence']
    },
    contractType: {
      type: 'object',
      properties: {
        value: { type: 'string', enum: ['FFP', 'T&M', 'IDIQ', 'BPA', 'CPFF', 'unknown'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['value', 'confidence']
    },
    setAside: {
      type: 'object',
      properties: {
        value: { type: 'string', enum: ['8(a)', 'WOSB', 'SDVOSB', 'small_business', 'none', 'unknown'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['value', 'confidence']
    },
    rateSource: {
      type: 'object',
      properties: {
        value: { type: 'string', enum: ['internal', 'gsa_mas', 'sub'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        reasoning: { type: 'string' }
      },
      required: ['value', 'confidence']
    },
    basePeriodMonths: { type: ['number', 'null'] },
    optionPeriodMonths: { type: 'array', items: { type: 'number' } },
    disciplines: {
      type: 'object',
      properties: {
        required: {
          type: 'array',
          items: { type: 'string', enum: ['engineering', 'design', 'product', 'research', 'management', 'data', 'security', 'devops'] }
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        sourceText: { type: 'string' }
      },
      required: ['required', 'confidence', 'sourceText']
    },
    roles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          laborCategory: { type: ['string', 'null'] },
          hoursPerMonth: { type: ['number', 'null'] },
          utilizationPct: { type: ['number', 'null'] },
          appearsInPeriods: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          sourceText: { type: 'string' }
        },
        required: ['title', 'confidence', 'sourceText']
      }
    }
  },
  required: ['documentType', 'vehicle', 'contractType', 'setAside', 'rateSource', 'basePeriodMonths', 'optionPeriodMonths', 'disciplines', 'roles']
}

// Types
interface ExpectedJson {
  metadata: { proposalId: string; solicitationName: string }
  intelligence: {
    contractType: { expected: string; required: boolean; sourceDocument?: string }
    vehicle: { expected: string | null; required: boolean; sourceDocument?: string }
    setAside: { expected: string | null; required: boolean; sourceDocument?: string; requires?: string }
    periods: { count: number; details: Array<{ name: string; months: string }> }
    disciplines: { expected: string[]; forbidden: string[] }
    laborRequirements: { count: number; titles: string[] }
  }
  wbs: {
    parentTaskCount: number
    totalTaskCount: number
    totalAssignments: number
    totalHours: number
    disciplineCompliance: { allowedDisciplines: string[]; forbiddenRoles: string[] }
    hoursPlausibility: { minTotalHours: number; maxTotalHours: number }
  }
}

interface CorpusSample {
  id: string
  expected: ExpectedJson
  solicitationText: string
  intelligenceInput?: {
    disciplines: string[]
    periods: Array<{ name: string; months: number }>
    laborRequirements: Array<{ title: string }>
  }
  requirements?: Array<{ id: string; title: string; text: string }>
}

interface ExtractionResult {
  raw: string
  parsed: {
    contractType?: { value: string }
    vehicle?: { value: string | null }
    setAside?: { value: string }
    basePeriodMonths?: number
    optionPeriodMonths?: number[]
    disciplines?: { required: string[] }
    roles?: Array<{ title: string }>
  } | null
  parseError?: string
  usage: { input_tokens: number; output_tokens: number }
}

interface WbsResult {
  raw: string
  parsed: Array<{
    ref: string
    name: string
    tasks: Array<{ suggestedRole: string; estimatedHours: number }>
  }> | null
  parseError?: string
  usage: { input_tokens: number; output_tokens: number }
}

// ============================================================================
// CURRENT PROMPTS (matching production routes)
// ============================================================================

// Use shared prompts from production code (imported above)
// buildExtractionSystemPrompt() and buildExtractionUserPrompt() provide canonical discipline vocabulary

// The full 293-line WBS system prompt
const WBS_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, 'prompts/wbs-system-prompt.txt'),
  'utf-8'
)

function buildWbsUserPrompt(params: {
  disciplines: string[]
  periods: Array<{ name: string; months: number }>
  requirements: Array<{ id: string; title: string; text: string }>
  billableHoursPerYear: number
}): string {
  const { disciplines, periods, requirements, billableHoursPerYear } = params

  const reqsText = requirements
    .map(r => `${r.id}: ${r.title}\n${r.text}`)
    .join('\n\n')

  const periodsText = periods
    .map((p, i) => `${i === 0 ? 'Base Period' : `Option Period ${i}`}: ${p.months} months`)
    .join('\n')

  return `Generate a WBS for this government IT contract.

CONTRACT PERIODS:
${periodsText}

BILLABLE HOURS PER YEAR: ${billableHoursPerYear}

${disciplines.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISCIPLINE CONSTRAINTS — CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This contract requires ONLY these disciplines:
${disciplines.join(', ')}

Generate WBS tasks ONLY within these disciplines. If a task falls outside these disciplines,
do not include it. A PM/HCD contract does not need engineering tasks. An engineering contract
does not need research tasks. Read the disciplines list and stay within it.
` : ''}

REQUIREMENTS TO ADDRESS:
${reqsText}

Return ONLY a JSON array of work packages. No explanation. No markdown fences.

[
  {
    "ref": "WBS-01",
    "name": "Work package name (noun phrase)",
    "description": "2-3 sentences describing what is delivered and why it matters",
    "sfiaLevel": 4,
    "requirementRefs": ["REQ-001", "REQ-002"],
    "dependsOn": [],
    "estimationType": "engineering_estimate",
    "complianceMultipliers": [],
    "tasks": [
      {
        "name": "Specific task name",
        "suggestedRole": "Back-end Developer",
        "estimatedHours": 320,
        "estimatedHoursPerMonth": 160,
        "applicablePeriods": ["Base Period", "Option Period 1"],
        "loeType": "development",
        "basisOfEstimate": "2-3 sprints for implementation"
      }
    ],
    "totalHours": 640,
    "assumptions": ["Assumption 1"]
  }
]`
}

// ============================================================================
// EVAL EXECUTION
// ============================================================================

async function runExtractionEval(
  client: Anthropic,
  sample: CorpusSample
): Promise<ExtractionResult> {
  console.log('  Calling extract-contract-intelligence API (tool-use pattern)...')

  // Tool definition for structured output
  const extractionTool: Anthropic.Tool = {
    name: 'extract_contract_intelligence',
    description: 'Extract structured contract intelligence from a solicitation document.',
    input_schema: contractIntelligenceJsonSchema as unknown as Anthropic.Tool.InputSchema
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: buildExtractionSystemPrompt(),
    tools: [extractionTool],
    tool_choice: { type: 'tool', name: 'extract_contract_intelligence' },
    messages: [
      { role: 'user', content: buildExtractionUserPrompt(sample.solicitationText) }
    ],
  })

  const usage = response.usage

  // Extract tool use result
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

  if (!toolUse) {
    return {
      raw: JSON.stringify(response.content),
      parsed: null,
      parseError: 'No tool_use block in response',
      usage
    }
  }

  // Tool input IS the structured output
  const raw = JSON.stringify(toolUse.input, null, 2)
  const parsed = toolUse.input as ExtractionResult['parsed']

  return { raw, parsed, parseError: undefined, usage }
}

async function runWbsEval(
  client: Anthropic,
  sample: CorpusSample
): Promise<WbsResult> {
  console.log('  Calling generate-wbs API...')

  if (!sample.intelligenceInput || !sample.requirements) {
    return {
      raw: '',
      parsed: null,
      parseError: 'Missing intelligence input or requirements',
      usage: { input_tokens: 0, output_tokens: 0 }
    }
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: WBS_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildWbsUserPrompt({
          disciplines: sample.intelligenceInput.disciplines,
          periods: sample.intelligenceInput.periods,
          requirements: sample.requirements,
          billableHoursPerYear: 1920,
        })
      }
    ],
  })

  const raw = response.content.find(b => b.type === 'text')?.text || '[]'
  const usage = response.usage

  // Parse using current route logic (regex extraction)
  let parsed = null
  let parseError: string | undefined

  try {
    const arrayMatch = raw.match(/\[[\s\S]*\]/)
    if (!arrayMatch) {
      parseError = 'No JSON array found in response'
      console.log('  DEBUG WBS raw output (first 500 chars):', raw.slice(0, 500))
    } else {
      parsed = JSON.parse(arrayMatch[0])
    }
  } catch (e) {
    parseError = `JSON parse failed: ${e}`
    console.log('  DEBUG WBS parse error, raw (first 500 chars):', raw.slice(0, 500))
  }

  return { raw, parsed, parseError, usage }
}

// ============================================================================
// METRICS
// ============================================================================

function computeExtractionMetrics(
  result: ExtractionResult,
  expected: ExpectedJson
): { fieldScores: Record<string, { match: boolean; actual: string; expected: string }>; f1: number } {
  const fieldScores: Record<string, { match: boolean; actual: string; expected: string }> = {}

  if (!result.parsed) {
    return { fieldScores: { parseError: { match: false, actual: result.parseError || 'null', expected: 'valid JSON' } }, f1: 0 }
  }

  // Contract Type
  const actualContractType = result.parsed.contractType?.value?.toUpperCase() || 'unknown'
  const expectedContractType = expected.intelligence.contractType.expected.toUpperCase()
  fieldScores['contractType'] = {
    match: actualContractType === expectedContractType,
    actual: actualContractType,
    expected: expectedContractType
  }

  // Vehicle (fuzzy match - check if expected is contained in actual or vice versa)
  const actualVehicle = result.parsed.vehicle?.value || 'null'
  const expectedVehicle = expected.intelligence.vehicle.expected || 'null'
  const vehicleMatch = actualVehicle === 'null' && expectedVehicle === 'null' ||
    (actualVehicle && expectedVehicle && (
      actualVehicle.toLowerCase().includes('gsa') && expectedVehicle.toLowerCase().includes('gsa') ||
      actualVehicle.toLowerCase().includes(expectedVehicle.toLowerCase()) ||
      expectedVehicle.toLowerCase().includes(actualVehicle.toLowerCase())
    ))
  fieldScores['vehicle'] = { match: !!vehicleMatch, actual: actualVehicle, expected: expectedVehicle }

  // Set-Aside (skip if requires additional documents not in corpus)
  if (expected.intelligence.setAside.requires === 'additional-documents') {
    fieldScores['setAside'] = {
      match: true, // Skip - not derivable from corpus input
      actual: result.parsed.setAside?.value?.toUpperCase() || 'UNKNOWN',
      expected: `${expected.intelligence.setAside.expected} (requires: SF-1449, skipped)`
    }
  } else {
    const actualSetAside = result.parsed.setAside?.value?.toUpperCase() || 'unknown'
    const expectedSetAside = expected.intelligence.setAside.expected?.toUpperCase() || 'unknown'
    fieldScores['setAside'] = {
      match: actualSetAside === expectedSetAside || actualSetAside.includes(expectedSetAside) || expectedSetAside.includes(actualSetAside),
      actual: actualSetAside,
      expected: expectedSetAside
    }
  }

  // Periods count
  const actualPeriods = 1 + (result.parsed.optionPeriodMonths?.length || 0)
  const expectedPeriods = expected.intelligence.periods.count
  fieldScores['periodsCount'] = {
    match: actualPeriods === expectedPeriods,
    actual: String(actualPeriods),
    expected: String(expectedPeriods)
  }

  // Disciplines (set-based precision AND recall)
  const actualDisciplines = new Set((result.parsed.disciplines?.required || []).map((d: string) => d.toLowerCase()))
  const expectedDisciplines = new Set(expected.intelligence.disciplines.expected.map(d => d.toLowerCase()))
  const truePositives = [...actualDisciplines].filter(d => expectedDisciplines.has(d)).length
  const precision = actualDisciplines.size > 0 ? truePositives / actualDisciplines.size : 0
  const recall = expectedDisciplines.size > 0 ? truePositives / expectedDisciplines.size : 0
  // Match only if precision AND recall are both >= 0.8 (strict)
  fieldScores['disciplines'] = {
    match: precision >= 0.8 && recall >= 0.8,
    actual: `${[...actualDisciplines].join(', ')} (P=${precision.toFixed(2)} R=${recall.toFixed(2)})`,
    expected: [...expectedDisciplines].join(', ')
  }

  // Labor requirements count
  const actualLaborCount = result.parsed.roles?.length || 0
  const expectedLaborCount = expected.intelligence.laborRequirements.count
  fieldScores['laborRequirements'] = {
    match: actualLaborCount === expectedLaborCount,
    actual: String(actualLaborCount),
    expected: String(expectedLaborCount)
  }

  // Compute overall F1
  const matches = Object.values(fieldScores).filter(s => s.match).length
  const total = Object.keys(fieldScores).length
  const f1 = total > 0 ? matches / total : 0

  return { fieldScores, f1 }
}

function computeDisciplineViolations(
  result: WbsResult,
  expected: ExpectedJson
): { violations: string[]; count: number; allRoles: string[] } {
  if (!result.parsed) {
    return { violations: [], count: 0, allRoles: [] }
  }

  const forbiddenRoles = new Set(expected.wbs.disciplineCompliance.forbiddenRoles.map(r => r.toLowerCase()))
  const allRoles: string[] = []
  const violations: string[] = []

  for (const pkg of result.parsed) {
    for (const task of pkg.tasks || []) {
      const role = task.suggestedRole
      if (role) {
        allRoles.push(role)
        if (forbiddenRoles.has(role.toLowerCase())) {
          violations.push(`${pkg.ref}: ${role}`)
        }
      }
    }
  }

  return { violations, count: violations.length, allRoles: [...new Set(allRoles)] }
}

// ============================================================================
// MAIN
// ============================================================================

async function loadCorpus(): Promise<CorpusSample[]> {
  const corpusDir = path.join(__dirname, 'corpus')
  const samples: CorpusSample[] = []

  const sampleDirs = fs.readdirSync(corpusDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const sampleId of sampleDirs) {
    const expectedPath = path.join(corpusDir, sampleId, 'expected.json')
    const solicitationPath = path.join(corpusDir, sampleId, 'solicitation.txt')
    const intelligencePath = path.join(corpusDir, sampleId, 'intelligence-input.json')
    const requirementsPath = path.join(corpusDir, sampleId, 'requirements.json')

    if (!fs.existsSync(expectedPath) || !fs.existsSync(solicitationPath)) {
      console.warn(`WARN: Skipping ${sampleId} - missing expected.json or solicitation.txt`)
      continue
    }

    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'))
    const solicitationText = fs.readFileSync(solicitationPath, 'utf-8')

    let intelligenceInput = undefined
    if (fs.existsSync(intelligencePath)) {
      const intel = JSON.parse(fs.readFileSync(intelligencePath, 'utf-8'))
      intelligenceInput = {
        disciplines: intel.disciplines || [],
        periods: (intel.periods || []).map((p: { name: string; months: string | number }) => ({
          name: p.name,
          months: typeof p.months === 'string' ? parseFloat(p.months) : p.months
        })),
        laborRequirements: intel.laborRequirements || []
      }
    }

    let requirements = undefined
    if (fs.existsSync(requirementsPath)) {
      requirements = JSON.parse(fs.readFileSync(requirementsPath, 'utf-8'))
    }

    samples.push({ id: sampleId, expected, solicitationText, intelligenceInput, requirements })
  }

  return samples
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const saveBaselineFlag = args.includes('--save-baseline')
  const compareFlag = args.includes('--compare')

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable required')
    process.exit(1)
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const corpus = await loadCorpus()

  if (corpus.length === 0) {
    console.error('ERROR: No valid samples found')
    process.exit(1)
  }

  console.log(`Loaded ${corpus.length} sample(s)\n`)

  let totalInputTokens = 0
  let totalOutputTokens = 0
  const results: Array<{
    sampleId: string
    extraction: ReturnType<typeof computeExtractionMetrics>
    disciplineViolations: ReturnType<typeof computeDisciplineViolations>
    schemaParseSuccess: boolean
  }> = []

  for (const sample of corpus) {
    console.log(`Running: ${sample.id}`)

    // Run extraction
    const extractionResult = await runExtractionEval(client, sample)
    totalInputTokens += extractionResult.usage.input_tokens
    totalOutputTokens += extractionResult.usage.output_tokens

    const extractionMetrics = computeExtractionMetrics(extractionResult, sample.expected)
    console.log('  Extraction F1:', extractionMetrics.f1.toFixed(2))

    // Run WBS generation
    const wbsResult = await runWbsEval(client, sample)
    totalInputTokens += wbsResult.usage.input_tokens
    totalOutputTokens += wbsResult.usage.output_tokens

    const disciplineViolations = computeDisciplineViolations(wbsResult, sample.expected)
    console.log('  Discipline violations:', disciplineViolations.count)
    console.log('  All roles generated:', disciplineViolations.allRoles.join(', '))

    results.push({
      sampleId: sample.id,
      extraction: extractionMetrics,
      disciplineViolations,
      schemaParseSuccess: !extractionResult.parseError && !wbsResult.parseError
    })
  }

  // Compute cost (Sonnet 4 pricing: $3/M input, $15/M output)
  const costUsd = (totalInputTokens * 3 + totalOutputTokens * 15) / 1_000_000

  // Print report
  console.log('\n' + '='.repeat(60))
  console.log('TrueBid Eval Report - BASELINE')
  console.log('='.repeat(60))
  console.log(`Date: ${new Date().toISOString()}`)
  console.log(`Samples: ${results.length}`)

  console.log('\nEXTRACTION METRICS')
  for (const r of results) {
    console.log(`\n  [${r.sampleId}]`)
    for (const [field, score] of Object.entries(r.extraction.fieldScores)) {
      const status = score.match ? '✓' : '✗'
      console.log(`    ${status} ${field}: ${score.actual} (expected: ${score.expected})`)
    }
    console.log(`    Overall F1: ${r.extraction.f1.toFixed(2)}`)
  }

  console.log('\nSCHEMA VALIDATION')
  const schemaPassRate = results.filter(r => r.schemaParseSuccess).length / results.length
  console.log(`  Pass Rate: ${(schemaPassRate * 100).toFixed(0)}%`)

  console.log('\nDISCIPLINE VIOLATIONS (raw generation, before validator)')
  for (const r of results) {
    console.log(`  [${r.sampleId}]`)
    console.log(`    Violations: ${r.disciplineViolations.count}`)
    if (r.disciplineViolations.violations.length > 0) {
      for (const v of r.disciplineViolations.violations) {
        console.log(`      - ${v}`)
      }
    }
    console.log(`    All roles: ${r.disciplineViolations.allRoles.join(', ')}`)
  }

  const totalViolations = results.reduce((sum, r) => sum + r.disciplineViolations.count, 0)
  console.log(`\n  Total violations: ${totalViolations}`)
  console.log(`  Target zero: ${totalViolations === 0 ? 'ACHIEVED' : 'NOT YET'}`)

  console.log('\nCOST')
  console.log(`  Input tokens: ${totalInputTokens.toLocaleString()}`)
  console.log(`  Output tokens: ${totalOutputTokens.toLocaleString()}`)
  console.log(`  Estimated cost: $${costUsd.toFixed(4)}`)

  // Save report
  const report = {
    runId: `eval-${Date.now()}`,
    timestamp: new Date().toISOString(),
    samples: results,
    summary: {
      extractionF1: results.reduce((sum, r) => sum + r.extraction.f1, 0) / results.length,
      schemaPassRate,
      disciplineViolationCount: totalViolations,
      cost: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, usd: costUsd }
    }
  }

  const reportPath = path.join(__dirname, 'reports', `report-${new Date().toISOString().split('T')[0]}.json`)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nReport saved: ${reportPath}`)

  if (saveBaselineFlag) {
    const baselinePath = path.join(__dirname, 'baseline', `baseline-${new Date().toISOString().split('T')[0]}.json`)
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
    fs.writeFileSync(baselinePath, JSON.stringify(report, null, 2))
    console.log(`Baseline saved: ${baselinePath}`)
  }

  if (compareFlag) {
    const baselineDir = path.join(__dirname, 'baseline')
    const files = fs.existsSync(baselineDir)
      ? fs.readdirSync(baselineDir).filter(f => f.startsWith('baseline-')).sort().reverse()
      : []

    if (files.length > 0) {
      const baseline = JSON.parse(fs.readFileSync(path.join(baselineDir, files[0]), 'utf-8'))
      console.log('\n=== COMPARISON TO BASELINE ===')
      console.log(`Baseline: ${baseline.runId}`)
      const f1Diff = report.summary.extractionF1 - baseline.summary.extractionF1
      console.log(`  Extraction F1: ${report.summary.extractionF1.toFixed(2)} vs ${baseline.summary.extractionF1.toFixed(2)} (${f1Diff >= 0 ? '+' : ''}${(f1Diff * 100).toFixed(0)}%)`)
      const violDiff = report.summary.disciplineViolationCount - baseline.summary.disciplineViolationCount
      console.log(`  Discipline Violations: ${report.summary.disciplineViolationCount} vs ${baseline.summary.disciplineViolationCount} (${violDiff >= 0 ? '+' : ''}${violDiff})`)
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
