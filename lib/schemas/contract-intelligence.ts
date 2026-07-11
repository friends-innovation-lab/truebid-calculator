/**
 * Zod schemas for contract intelligence extraction
 * Used for validating AI extraction output with structured outputs (tool-use pattern)
 */

import { z } from 'zod'

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
  confidence: confidenceSchema,
  sourceText: z.string().describe('Exact quote from document')
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
  roles: z.array(extractedRoleSchema).describe('Labor requirements from document')
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
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          sourceText: { type: 'string', description: 'Exact quote from document' }
        },
        required: ['title', 'confidence', 'sourceText']
      },
      description: 'Labor requirements extracted from document'
    }
  },
  required: ['documentType', 'vehicle', 'contractType', 'setAside', 'rateSource', 'basePeriodMonths', 'optionPeriodMonths', 'disciplines', 'roles']
} as const
