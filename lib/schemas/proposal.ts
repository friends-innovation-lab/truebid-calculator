import { z } from 'zod'

// Accepts both camelCase (frontend) and snake_case (database) field names.
// The route handler normalizes to snake_case before inserting.
export const proposalCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).default('Untitled Proposal'),

  // Accept either naming convention
  solicitation_number: z.string().max(100).optional(),
  solicitation: z.string().max(100).optional(),

  client: z.string().max(200).optional(),
  agency: z.string().max(200).optional(),

  status: z.enum(['draft', 'active', 'submitted', 'won', 'lost', 'archived']).default('draft'),

  contract_type: z.string().max(50).optional(),
  contractType: z.string().max(50).optional(),

  due_date: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),

  total_value: z.number().nonnegative().optional(),
  totalValue: z.number().nonnegative().optional(),

  estimated_value: z.number().nonnegative().nullable().optional(),

  team_size: z.number().int().nonnegative().optional(),
  teamSize: z.number().int().nonnegative().optional(),

  progress: z.number().min(0).max(100).optional(),
  starred: z.boolean().optional(),
  archived: z.boolean().optional(),
  description: z.string().max(5000).optional(),

  period_of_performance: z.union([
    z.string(),
    z.object({
      baseYear: z.boolean().default(true),
      optionYears: z.number().int().min(0).max(10).default(2),
      totalMonths: z.number().int().positive().optional(),
      display: z.string().optional(),
    }),
  ]).nullable().optional(),
  periodOfPerformance: z.union([
    z.string(),
    z.object({
      baseYear: z.boolean().default(true),
      optionYears: z.number().int().min(0).max(10).default(2),
      totalMonths: z.number().int().positive().optional(),
      display: z.string().optional(),
    }),
  ]).nullable().optional(),
})

export const proposalUpdateSchema = proposalCreateSchema.partial()

export type ProposalCreate = z.infer<typeof proposalCreateSchema>
export type ProposalUpdate = z.infer<typeof proposalUpdateSchema>
