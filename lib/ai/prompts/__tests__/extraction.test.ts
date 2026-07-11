/**
 * Prompt Assembly Tests
 *
 * Verifies discipline-conditional content:
 * - HCD/research contracts get zero engineering text
 * - Engineering contracts get engineering text
 * - Canonical vocabulary is used
 */

import { buildExtractionSystemPrompt } from '../extraction'
import { DISCIPLINES } from '../../knowledge/disciplines'

describe('buildExtractionSystemPrompt', () => {
  describe('discipline-conditional content', () => {
    it('includes all disciplines when no filter provided', () => {
      const prompt = buildExtractionSystemPrompt()

      // Should contain all canonical disciplines
      for (const discipline of DISCIPLINES) {
        expect(prompt).toContain(`- ${discipline}:`)
      }
    })

    it('includes only design/research disciplines when filtered', () => {
      const prompt = buildExtractionSystemPrompt({
        filterDisciplines: ['design', 'research', 'product']
      })

      // Should contain design/research disciplines
      expect(prompt).toContain('- design:')
      expect(prompt).toContain('- research:')
      expect(prompt).toContain('- product:')

      // Should NOT contain engineering disciplines
      expect(prompt).not.toContain('- engineering:')
      expect(prompt).not.toContain('- devops:')
      expect(prompt).not.toContain('- security:')
    })

    it('includes only engineering disciplines when filtered to engineering', () => {
      const prompt = buildExtractionSystemPrompt({
        filterDisciplines: ['engineering', 'devops', 'security']
      })

      // Should contain engineering disciplines
      expect(prompt).toContain('- engineering:')
      expect(prompt).toContain('- devops:')
      expect(prompt).toContain('- security:')

      // Should NOT contain design/research disciplines
      expect(prompt).not.toContain('- design:')
      expect(prompt).not.toContain('- research:')
    })
  })

  describe('canonical vocabulary', () => {
    it('uses only canonical discipline names (FFTC list)', () => {
      const prompt = buildExtractionSystemPrompt()

      // Should use canonical names from FFTC discipline list
      expect(prompt).toContain('- engineering:')
      expect(prompt).toContain('- design:')
      expect(prompt).toContain('- research:')
      expect(prompt).toContain('- management:')

      // Should NOT use non-canonical umbrella terms
      expect(prompt).not.toContain('- hcd:')      // Umbrella term, not a discipline
      expect(prompt).not.toContain('- delivery:')
      expect(prompt).not.toContain('- content:')
      expect(prompt).not.toContain('- accessibility:')
      expect(prompt).not.toContain('- program-management:')
    })

    it('contains extraction instructions', () => {
      const prompt = buildExtractionSystemPrompt()

      expect(prompt).toContain('government contracting expert')
      expect(prompt).toContain('extract')
      expect(prompt).toContain('confidence')
    })
  })
})
