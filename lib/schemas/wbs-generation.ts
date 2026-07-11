/**
 * Zod schemas for WBS generation
 * Used for validating AI WBS output with structured outputs (tool-use pattern)
 */

import { z } from 'zod'

// LOE type enum
export const loeTypeSchema = z.enum([
  'development',
  'configuration',
  'integration',
  'testing',
  'documentation',
  'management',
  'research',
  'design'
])

// Estimation type enum
export const estimationTypeSchema = z.enum([
  'engineering_estimate',
  'loe',
  'historical',
  'parametric',
  'analogy'
])

// Compliance multiplier enum
export const complianceMultiplierSchema = z.enum([
  'fedramp',
  'section508',
  'legacy_integration',
  'global_deployment',
  'training'
])

// Task within a work package
export const wbsTaskSchema = z.object({
  name: z.string().describe('Specific task name'),
  suggestedRole: z.string().describe('FFTC role from allowed list'),
  estimatedHours: z.number().describe('Total hours for this task'),
  estimatedHoursPerMonth: z.number().optional().describe('Hours per month if applicable'),
  applicablePeriods: z.array(z.string()).optional().describe('Periods this task spans'),
  loeType: loeTypeSchema.optional().describe('Type of level of effort'),
  basisOfEstimate: z.string().optional().describe('Rationale for hours estimate')
})

// Work package (WBS element)
export const wbsElementSchema = z.object({
  ref: z.string().describe('WBS reference number (e.g., WBS-01)'),
  name: z.string().describe('Work package name (noun phrase)'),
  description: z.string().describe('2-3 sentences describing deliverable'),
  sfiaLevel: z.number().min(1).max(7).optional().describe('SFIA complexity level 1-7'),
  requirementRefs: z.array(z.string()).describe('Linked requirement IDs'),
  dependsOn: z.array(z.string()).describe('WBS refs this depends on'),
  estimationType: estimationTypeSchema.describe('Estimation method used'),
  complianceMultipliers: z.array(complianceMultiplierSchema).optional().describe('Compliance factors'),
  tasks: z.array(wbsTaskSchema).describe('Tasks within this work package'),
  totalHours: z.number().describe('Sum of all task hours'),
  assumptions: z.array(z.string()).describe('Assumptions for this package')
})

// Full WBS output schema (array of work packages)
export const wbsGenerationSchema = z.array(wbsElementSchema)

// Type inference
export type WbsTask = z.infer<typeof wbsTaskSchema>
export type WbsElement = z.infer<typeof wbsElementSchema>
export type WbsGeneration = z.infer<typeof wbsGenerationSchema>

// JSON Schema for Anthropic tool definition
export const wbsGenerationJsonSchema = {
  type: 'object',
  properties: {
    workPackages: {
      type: 'array',
      description: 'Array of WBS work packages',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'WBS reference (e.g., WBS-01)' },
          name: { type: 'string', description: 'Work package name (noun phrase)' },
          description: { type: 'string', description: '2-3 sentences describing deliverable' },
          sfiaLevel: { type: 'integer', minimum: 1, maximum: 7, description: 'SFIA complexity level' },
          requirementRefs: { type: 'array', items: { type: 'string' }, description: 'Linked requirement IDs' },
          dependsOn: { type: 'array', items: { type: 'string' }, description: 'WBS refs this depends on' },
          estimationType: {
            type: 'string',
            enum: ['engineering_estimate', 'loe', 'historical', 'parametric', 'analogy']
          },
          complianceMultipliers: {
            type: 'array',
            items: { type: 'string', enum: ['fedramp', 'section508', 'legacy_integration', 'global_deployment', 'training'] }
          },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Specific task name' },
                suggestedRole: { type: 'string', description: 'FFTC role from allowed list' },
                estimatedHours: { type: 'number', description: 'Total hours for this task' },
                estimatedHoursPerMonth: { type: 'number', description: 'Hours per month' },
                applicablePeriods: { type: 'array', items: { type: 'string' } },
                loeType: {
                  type: 'string',
                  enum: ['development', 'configuration', 'integration', 'testing', 'documentation', 'management', 'research', 'design']
                },
                basisOfEstimate: { type: 'string', description: 'Rationale for hours' }
              },
              required: ['name', 'suggestedRole', 'estimatedHours']
            }
          },
          totalHours: { type: 'number', description: 'Sum of task hours' },
          assumptions: { type: 'array', items: { type: 'string' } }
        },
        required: ['ref', 'name', 'description', 'requirementRefs', 'dependsOn', 'estimationType', 'tasks', 'totalHours', 'assumptions']
      }
    }
  },
  required: ['workPackages']
} as const
