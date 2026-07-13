/**
 * Solicitation Brief Schema
 *
 * Structured brief describing what the government wants from a solicitation.
 * Generated at extraction time, frozen on confirm, included in confirmation hash.
 */

import { z } from 'zod'

/**
 * Challenge schema with BC-1 enforcement:
 * Each challenge must have at least one evidence reference.
 */
export const challengeSchema = z.object({
  title: z.string().min(1).describe('Short label for the challenge'),
  description: z.string().min(1).describe('2-3 sentences describing the challenge'),
  evidence_refs: z
    .array(z.string().uuid())
    .min(1) // BC-1: at least one evidence ref per challenge
    .describe('References to fact_evidence.id rows'),
})

/**
 * Solicitation Brief schema with BC-1 enforcement:
 * Brief must have at least one challenge.
 */
export const solicitationBriefSchema = z.object({
  summary: z.string().min(1).describe('1-2 sentence summary of what the government wants'),
  rationale: z.string().min(1).describe('Why this procurement matters to the agency'),
  challenges: z
    .array(challengeSchema)
    .min(1) // BC-1: at least one challenge required
    .describe('Key technical or delivery challenges (2-4 items)'),
  evaluation_emphasis: z
    .string()
    .min(1)
    .describe('What criteria will matter most in evaluation'),
})

export type Challenge = z.infer<typeof challengeSchema>
export type SolicitationBrief = z.infer<typeof solicitationBriefSchema>

/**
 * JSON Schema for Anthropic tool definition.
 * Used in extraction tool-use pattern.
 * Note: AI outputs evidence_quotes (strings), which are converted to
 * fact_evidence rows and stored as UUIDs in evidence_refs.
 */
export const solicitationBriefJsonSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: '1-2 sentence summary of what the government wants',
    },
    rationale: {
      type: 'string',
      description: 'Why this procurement matters to the agency (mission context)',
    },
    challenges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short label (2-5 words)' },
          description: {
            type: 'string',
            description: '2-3 sentences describing the challenge',
          },
          evidence_quotes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Verbatim quotes from the document supporting this challenge',
            minItems: 1,
          },
        },
        required: ['title', 'description', 'evidence_quotes'],
      },
      description: 'Key technical or delivery challenges (2-4 items)',
      minItems: 1,
    },
    evaluation_emphasis: {
      type: 'string',
      description: 'What criteria will matter most in evaluation (1-2 sentences)',
    },
  },
  required: ['summary', 'rationale', 'challenges', 'evaluation_emphasis'],
} as const
