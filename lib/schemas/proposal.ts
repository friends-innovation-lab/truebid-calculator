import { z } from 'zod'

export const proposalCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  solicitation_number: z.string().max(100).optional(),
  client: z.string().max(200).optional(),
  agency: z.string().max(200).optional(),
  status: z.enum(['draft', 'active', 'submitted', 'won', 'lost', 'archived']).default('draft'),
  contract_type: z.enum(['tm', 'ffp', 'gsa', '']).default(''),
  due_date: z.string().datetime().nullable().optional(),
  estimated_value: z.number().nonnegative().nullable().optional(),
  period_of_performance: z
    .object({
      baseYear: z.boolean().default(true),
      optionYears: z.number().int().min(0).max(10).default(2),
      totalMonths: z.number().int().positive().optional(),
    })
    .optional(),
})

export const proposalUpdateSchema = proposalCreateSchema.partial()

export type ProposalCreate = z.infer<typeof proposalCreateSchema>
export type ProposalUpdate = z.infer<typeof proposalUpdateSchema>
