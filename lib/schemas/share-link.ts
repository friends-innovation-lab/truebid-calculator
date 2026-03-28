import { z } from 'zod'

export const shareLinkCreateSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

export const shareLinkUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

export type ShareLinkCreate = z.infer<typeof shareLinkCreateSchema>
export type ShareLinkUpdate = z.infer<typeof shareLinkUpdateSchema>
