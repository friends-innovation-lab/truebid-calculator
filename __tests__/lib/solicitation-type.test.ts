import {
  hasSolicitationData,
  getSolicitationDisplayName,
  emptySolicitation,
} from '@/lib/solicitation-type'

describe('hasSolicitationData', () => {
  it('returns false for empty solicitation', () => {
    expect(hasSolicitationData(emptySolicitation)).toBe(false)
  })

  it('returns true when title is present', () => {
    const sol = { ...emptySolicitation, title: 'IT Support Services' }
    expect(hasSolicitationData(sol)).toBe(true)
  })

  it('returns true when solicitation number is present', () => {
    const sol = { ...emptySolicitation, solicitationNumber: 'W91CRB-25-R-0001' }
    expect(hasSolicitationData(sol)).toBe(true)
  })

  it('returns true when client agency is present', () => {
    const sol = { ...emptySolicitation, clientAgency: 'Department of Defense' }
    expect(hasSolicitationData(sol)).toBe(true)
  })
})

describe('getSolicitationDisplayName', () => {
  it('returns title when present', () => {
    const sol = { ...emptySolicitation, title: 'IT Support', solicitationNumber: 'SOL-001' }
    expect(getSolicitationDisplayName(sol)).toBe('IT Support')
  })

  it('falls back to solicitation number', () => {
    const sol = { ...emptySolicitation, solicitationNumber: 'SOL-001' }
    expect(getSolicitationDisplayName(sol)).toBe('SOL-001')
  })

  it('returns default when nothing is set', () => {
    expect(getSolicitationDisplayName(emptySolicitation)).toBe('Untitled Solicitation')
  })
})
