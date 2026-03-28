import { z } from 'zod'

// ===== Collab Session Schemas =====

export const createCollabSessionSchema = z.object({
  reviewer_name: z.string().min(1, 'Reviewer name is required'),
  reviewer_title: z.string().optional(),
  assigned_wbs_ids: z.array(z.string().uuid()).min(1, 'At least one WBS element must be assigned'),
  expires_at: z.string().datetime().optional(),
})

export const updateCollabSessionSchema = z.object({
  status: z.enum(['open', 'closed']),
})

// ===== WBS Submission Schemas =====

export const createSubmissionSchema = z.object({
  wbs_element_id: z.string().uuid().optional(),
  is_new_element: z.boolean().optional().default(false),
  proposed_title: z.string().optional(),
  proposed_hours: z.record(z.string(), z.number()).optional().default({}),
  proposed_roles: z.array(z.object({
    role: z.string(),
    fte: z.number().min(0).max(10),
  })).optional().default([]),
  proposed_estimation_method: z.enum(['engineering', 'parametric', 'historical']).optional(),
  proposed_assumptions: z.string().optional(),
  proposed_notes: z.string().optional(),
  reviewer_comment: z.string().optional(),
})

export const reviewSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(['accepted', 'modified', 'rejected']),
  owner_response: z.string().optional(),
  modified_values: z.object({
    title: z.string().optional(),
    hours: z.number().optional(),
    description: z.string().optional(),
  }).optional(),
})

// ===== Inferred Types =====

export type CreateCollabSession = z.infer<typeof createCollabSessionSchema>
export type UpdateCollabSession = z.infer<typeof updateCollabSessionSchema>
export type CreateSubmission = z.infer<typeof createSubmissionSchema>
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>
