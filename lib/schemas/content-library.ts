import { z } from 'zod'

// ===== Content Types =====

export const contentTypeSchema = z.enum([
  'past_performance',
  'key_personnel',
  'capability_statement',
  'standard_approach',
  'win_theme',
])

export type ContentType = z.infer<typeof contentTypeSchema>

// ===== Content Shapes (JSONB) =====

export const pastPerformanceContentSchema = z.object({
  contract_name: z.string(),
  agency: z.string(),
  contract_number: z.string().optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  contract_value: z.number().optional(),
  role: z.enum(['prime', 'subcontractor']).optional(),
  naics_codes: z.array(z.string()).optional().default([]),
  scope_description: z.string().optional(),
  relevance_statement: z.string().optional(),
  results: z.string().optional(),
  points_of_contact: z.array(z.object({
    name: z.string(),
    title: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  })).optional().default([]),
})

export const keyPersonnelContentSchema = z.object({
  name: z.string(),
  proposed_title: z.string().optional(),
  clearance_level: z.string().optional(),
  education: z.array(z.object({
    degree: z.string(),
    field: z.string().optional(),
    institution: z.string().optional(),
  })).optional().default([]),
  years_experience: z.number().optional(),
  bio: z.string().optional(),
  relevant_projects: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    description: z.string().optional(),
  })).optional().default([]),
  certifications: z.array(z.string()).optional().default([]),
})

export const capabilityStatementContentSchema = z.object({
  overview: z.string().optional(),
  core_competencies: z.array(z.string()).optional().default([]),
  differentiators: z.array(z.string()).optional().default([]),
  naics_codes: z.array(z.string()).optional().default([]),
  certifications: z.array(z.string()).optional().default([]),
  contract_vehicles: z.array(z.string()).optional().default([]),
})

export const standardApproachContentSchema = z.object({
  category: z.enum(['agile', 'engineering', 'design', 'research', 'product', 'delivery', 'security', 'accessibility', 'quality', 'transition', 'staffing', 'other']).optional(),
  body: z.string().optional(),
  customization_notes: z.string().optional(),
})

export const winThemeContentSchema = z.object({
  theme: z.string(),
  discriminator_statement: z.string().optional(),
  proof_points: z.array(z.string()).optional().default([]),
  best_used_for: z.string().optional(),
})

// ===== Request Schemas =====

export const createContentItemSchema = z.object({
  type: contentTypeSchema,
  title: z.string().min(1, 'Title is required'),
  content: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string()).optional().default([]),
})

export const updateContentItemSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

export const recordUseSchema = z.object({
  proposal_id: z.string().uuid('Invalid proposal ID'),
})

// ===== Inferred Types =====

export type PastPerformanceContent = z.infer<typeof pastPerformanceContentSchema>
export type KeyPersonnelContent = z.infer<typeof keyPersonnelContentSchema>
export type CapabilityStatementContent = z.infer<typeof capabilityStatementContentSchema>
export type StandardApproachContent = z.infer<typeof standardApproachContentSchema>
export type WinThemeContent = z.infer<typeof winThemeContentSchema>

export type CreateContentItem = z.infer<typeof createContentItemSchema>
export type UpdateContentItem = z.infer<typeof updateContentItemSchema>
export type RecordUse = z.infer<typeof recordUseSchema>

// ===== Content Item (from DB) =====

export interface ContentLibraryItem {
  id: string
  company_id: string
  type: ContentType
  title: string
  content: Record<string, unknown>
  tags: string[]
  is_active: boolean
  last_used_at: string | null
  use_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}
