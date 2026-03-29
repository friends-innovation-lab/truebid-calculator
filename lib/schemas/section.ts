import { z } from 'zod'

// Status values for proposal sections
export const sectionStatusSchema = z.enum(['draft', 'in_progress', 'review', 'complete'])
export type SectionStatus = z.infer<typeof sectionStatusSchema>

// Create section schema
export const sectionCreateSchema = z.object({
  parent_id: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),

  sort_order: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int().nonnegative().optional(),

  section_number: z.string().max(20).optional(),
  sectionNumber: z.string().max(20).optional(),

  title: z.string().min(1, 'Title is required').max(500),

  summary: z.string().max(2000).optional(),
  content: z.string().max(50000).optional(),
  instructions: z.string().max(5000).optional(),

  compliance_item_ids: z.array(z.string()).optional(),
  complianceItemIds: z.array(z.string()).optional(),

  requirement_refs: z.array(z.string()).optional(),
  requirementRefs: z.array(z.string()).optional(),

  status: sectionStatusSchema.optional(),

  target_word_count: z.number().int().positive().optional(),
  targetWordCount: z.number().int().positive().optional(),

  owner: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),

  ai_generated: z.boolean().optional(),
  aiGenerated: z.boolean().optional(),
})

export const sectionUpdateSchema = sectionCreateSchema.partial()

export const sectionBulkCreateSchema = z.array(sectionCreateSchema)

export type SectionCreate = z.infer<typeof sectionCreateSchema>
export type SectionUpdate = z.infer<typeof sectionUpdateSchema>
