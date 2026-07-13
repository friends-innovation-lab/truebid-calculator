/**
 * Zod schemas for contract intelligence extraction
 * Used for validating AI extraction output with structured outputs (tool-use pattern)
 */

import { z } from 'zod'
import { solicitationBriefJsonSchema } from './solicitation-brief'

// Confidence level enum
export const confidenceSchema = z.enum(['high', 'medium', 'low'])

// Document type enum
export const documentTypeSchema = z.enum([
  'RFP', 'RFQ', 'SOO', 'PWS', 'SOW', 'task_order', 'unknown'
])

// Contract type enum
export const contractTypeSchema = z.enum([
  'FFP', 'T&M', 'IDIQ', 'BPA', 'CPFF', 'unknown'
])

// Set-aside enum
export const setAsideSchema = z.enum([
  '8(a)', 'WOSB', 'SDVOSB', 'small_business', 'none', 'unknown'
])

// Rate source enum
export const rateSourceSchema = z.enum(['internal', 'gsa_mas', 'sub'])

// Staffing model enum - Phase 4B Pillar 2
export const staffingModelSchema = z.enum([
  'prescribed',       // RFP specifies exact roles (closed vocabulary)
  'offeror_proposed', // Offeror proposes team composition
  'unclear'           // Needs user clarification
])

// Discipline enum - CANONICAL vocabulary from intelligence_disciplines table
// MUST match: engineering, hcd, product, research, management, data, security, devops
export const disciplineSchema = z.enum([
  'engineering',
  'design',
  'product',
  'research',
  'management',
  'data',
  'security',
  'devops'
])

// Role/labor requirement from document
export const extractedRoleSchema = z.object({
  title: z.string().describe('Exact role title from document'),
  laborCategory: z.string().nullable().describe('LCAT name if stated, null otherwise'),
  hoursPerMonth: z.number().nullable().describe('Hours per month if explicitly stated'),
  utilizationPct: z.number().nullable().describe('Utilization percentage if stated (e.g. 0.8 for 80%)'),
  appearsInPeriods: z.array(z.string()).describe('Period names where role appears'),
  isPrescribed: z.boolean().describe('True if explicitly named as key personnel or required position, not inferred'),
  confidence: confidenceSchema,
  sourceText: z.string().describe('Exact quote from document')
})

// Solicitation brief challenge schema (AI outputs evidence_quotes, not evidence_refs)
const extractedChallengeSchema = z.object({
  title: z.string().describe('Short label for the challenge (2-5 words)'),
  description: z.string().describe('2-3 sentences describing the challenge'),
  evidence_quotes: z.array(z.string()).min(1).describe('Verbatim quotes from document supporting this challenge')
})

// Solicitation brief schema for extraction (uses evidence_quotes)
const extractedSolicitationBriefSchema = z.object({
  summary: z.string().describe('1-2 sentence summary of what the government wants'),
  rationale: z.string().describe('Why this procurement matters to the agency'),
  challenges: z.array(extractedChallengeSchema).min(1).describe('Key technical or delivery challenges (2-4 items)'),
  evaluation_emphasis: z.string().describe('What criteria will matter most in evaluation')
})

// Main extraction schema - the AI output structure
export const contractIntelligenceExtractionSchema = z.object({
  documentType: z.object({
    value: documentTypeSchema,
    confidence: confidenceSchema
  }),
  vehicle: z.object({
    value: z.string().nullable().describe('Exact vehicle name from document, or null'),
    confidence: confidenceSchema
  }),
  contractType: z.object({
    value: contractTypeSchema,
    confidence: confidenceSchema
  }),
  setAside: z.object({
    value: setAsideSchema,
    confidence: confidenceSchema
  }),
  rateSource: z.object({
    value: rateSourceSchema,
    confidence: confidenceSchema,
    reasoning: z.string().optional().describe('One sentence explaining why')
  }),
  basePeriodMonths: z.number().nullable().describe('Base period duration in months'),
  optionPeriodMonths: z.array(z.number()).describe('Array of option period durations in months'),
  disciplines: z.object({
    required: z.array(disciplineSchema).describe('List of disciplines explicitly required'),
    confidence: confidenceSchema,
    sourceText: z.string().describe('Exact quote identifying these disciplines')
  }),
  staffingModel: z.object({
    value: staffingModelSchema,
    confidence: confidenceSchema,
    reasoning: z.string().describe('One sentence explaining why this staffing model was determined')
  }).describe('Whether RFP prescribes specific roles (closed vocabulary) or allows offeror-proposed staffing'),
  roles: z.array(extractedRoleSchema).describe('Labor requirements from document'),
  solicitationBrief: extractedSolicitationBriefSchema.describe('Structured brief describing what the government wants')
})

// Type inference from schema
export type ContractIntelligenceExtraction = z.infer<typeof contractIntelligenceExtractionSchema>

// JSON Schema for Anthropic tool definition
// We export the raw JSON schema format for the tool input_schema
export const contractIntelligenceJsonSchema = {
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
        value: { type: ['string', 'null'], description: 'Exact vehicle name from document, or null' },
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
        reasoning: { type: 'string', description: 'One sentence explaining why' }
      },
      required: ['value', 'confidence']
    },
    basePeriodMonths: {
      type: ['number', 'null'],
      description: 'Base period duration in months'
    },
    optionPeriodMonths: {
      type: 'array',
      items: { type: 'number' },
      description: 'Array of option period durations in months'
    },
    disciplines: {
      type: 'object',
      properties: {
        required: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['engineering', 'design', 'product', 'research', 'management', 'data', 'security', 'devops']
          },
          description: 'List of disciplines explicitly required by the scope of work (use canonical vocabulary)'
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        sourceText: { type: 'string', description: 'Exact quote identifying these disciplines' }
      },
      required: ['required', 'confidence', 'sourceText']
    },
    staffingModel: {
      type: 'object',
      properties: {
        value: {
          type: 'string',
          enum: ['prescribed', 'offeror_proposed', 'unclear'],
          description: 'prescribed: RFP names specific roles (Key Personnel, LCAT table). offeror_proposed: RFP lets offeror propose team. unclear: ambiguous.'
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        reasoning: { type: 'string', description: 'One sentence explaining the staffing model determination' }
      },
      required: ['value', 'confidence', 'reasoning'],
      description: 'Whether RFP prescribes specific roles or allows offeror-proposed staffing'
    },
    roles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Exact role title from document' },
          laborCategory: { type: ['string', 'null'], description: 'LCAT name if stated' },
          hoursPerMonth: { type: ['number', 'null'], description: 'Hours per month if stated' },
          utilizationPct: { type: ['number', 'null'], description: 'Utilization as decimal (e.g. 0.8)' },
          appearsInPeriods: { type: 'array', items: { type: 'string' } },
          isPrescribed: { type: 'boolean', description: 'True if explicitly named as key personnel or required position' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          sourceText: { type: 'string', description: 'Exact quote from document' }
        },
        required: ['title', 'isPrescribed', 'confidence', 'sourceText']
      },
      description: 'Labor requirements extracted from document'
    },
    solicitationBrief: solicitationBriefJsonSchema
  },
  required: ['documentType', 'vehicle', 'contractType', 'setAside', 'rateSource', 'basePeriodMonths', 'optionPeriodMonths', 'disciplines', 'staffingModel', 'roles', 'solicitationBrief']
} as const
