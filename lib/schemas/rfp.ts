import { z } from 'zod'

// Schema for validating the AI extraction response after JSON parsing.
// The extract-rfp route receives FormData (file upload), not JSON, so request
// body validation uses manual checks. This schema validates the AI output.

export const extractedMetadataSchema = z.object({
  title: z.string().default('Untitled Solicitation'),
  solicitationNumber: z.string().default('N/A'),
  clientAgency: z.string().default('N/A'),
  contractType: z.enum(['ffp', 'tm', 'cpff', 'idiq', 'hybrid', 'unknown']).catch('unknown'),
  naicsCode: z.union([z.string(), z.number()]).transform(v => String(v)).default('N/A'),
  responseDeadline: z.string().default('N/A'),
  periodOfPerformance: z.object({
    base: z.coerce.number().int().min(0).default(1),
    options: z.coerce.number().int().min(0).default(0),
  }).default({ base: 1, options: 0 }),
  placeOfPerformance: z.string().default('N/A'),
  setAside: z.string().default('N/A'),
}).passthrough()

export const extractedRequirementSchema = z.object({
  id: z.string().optional(),
  title: z.string().default(''),
  text: z.string().default(''),
  type: z.enum(['delivery', 'reporting', 'staffing', 'compliance', 'governance', 'transition', 'other']).catch('other'),
  sourceSection: z.string().default('N/A'),
  pageNumber: z.coerce.number().nullable().catch(null),
}).passthrough()

// Handle both string and object formats for suggested roles
const suggestedRoleObjectSchema = z.object({
  title: z.string().default('Unnamed Role'),
  quantity: z.coerce.number().int().min(1).catch(1),
  rationale: z.string().default(''),
}).passthrough()

export const suggestedRoleSchema = z.union([
  z.string().transform(title => ({ title, quantity: 1, rationale: '' })),
  suggestedRoleObjectSchema,
])

export const extractionResponseSchema = z.object({
  metadata: extractedMetadataSchema,
  requirements: z.array(extractedRequirementSchema).default([]),
  suggestedRoles: z.array(suggestedRoleSchema).default([]),
}).passthrough()

export type ExtractedMetadata = z.infer<typeof extractedMetadataSchema>
export type ExtractedRequirement = z.infer<typeof extractedRequirementSchema>
export type SuggestedRole = z.infer<typeof suggestedRoleSchema>
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>
