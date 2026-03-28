import { z } from 'zod'

// Schema for validating the AI extraction response after JSON parsing.
// The extract-rfp route receives FormData (file upload), not JSON, so request
// body validation uses manual checks. This schema validates the AI output.

export const extractedMetadataSchema = z.object({
  title: z.string().default('Untitled Solicitation'),
  solicitationNumber: z.string().default('N/A'),
  clientAgency: z.string().default('N/A'),
  contractType: z.enum(['ffp', 'tm', 'cpff', 'idiq', 'hybrid', 'unknown']).default('unknown'),
  naicsCode: z.string().default('N/A'),
  responseDeadline: z.string().default('N/A'),
  periodOfPerformance: z.object({
    base: z.number().int().min(0).default(1),
    options: z.number().int().min(0).default(0),
  }).default({ base: 1, options: 0 }),
  placeOfPerformance: z.string().default('N/A'),
  setAside: z.string().default('N/A'),
})

export const extractedRequirementSchema = z.object({
  id: z.string().optional(),
  title: z.string().default(''),
  text: z.string().default(''),
  type: z.enum(['delivery', 'reporting', 'staffing', 'compliance', 'governance', 'transition', 'other']).default('other'),
  sourceSection: z.string().default('N/A'),
  pageNumber: z.number().nullable().default(null),
})

export const suggestedRoleSchema = z.object({
  title: z.string().default('Unnamed Role'),
  quantity: z.number().int().min(1).default(1),
  rationale: z.string().default(''),
})

export const extractionResponseSchema = z.object({
  metadata: extractedMetadataSchema,
  requirements: z.array(extractedRequirementSchema).default([]),
  suggestedRoles: z.array(suggestedRoleSchema).default([]),
})

export type ExtractedMetadata = z.infer<typeof extractedMetadataSchema>
export type ExtractedRequirement = z.infer<typeof extractedRequirementSchema>
export type SuggestedRole = z.infer<typeof suggestedRoleSchema>
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>
