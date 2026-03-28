import { z } from 'zod'

const requirementInputSchema = z.object({
  id: z.string().min(1),
  referenceNumber: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.string(),
  category: z.string(),
  source: z.string(),
})

const roleInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  description: z.string().optional(),
})

const contractContextSchema = z.object({
  title: z.string(),
  agency: z.string(),
  contractType: z.string(),
  periodOfPerformance: z.object({
    baseYear: z.boolean(),
    optionYears: z.number().int().min(0).max(10),
  }),
})

export const generateWbsRequestSchema = z.object({
  requirements: z.array(requirementInputSchema).min(1, 'At least one requirement is required'),
  availableRoles: z.array(roleInputSchema).min(1, 'At least one role is required'),
  existingWbsNumbers: z.array(z.string()).default([]),
  contractContext: contractContextSchema,
})

export type GenerateWbsRequest = z.infer<typeof generateWbsRequestSchema>
export type RequirementInput = z.infer<typeof requirementInputSchema>
export type RoleInput = z.infer<typeof roleInputSchema>
