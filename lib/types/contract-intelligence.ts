export type Confidence = 'high' | 'medium' | 'low'

export type StaffingModel = 'prescribed' | 'offeror_proposed' | 'unclear'

export type Discipline =
  | 'engineering'
  | 'design'
  | 'research'
  | 'product'
  | 'delivery'
  | 'program-management'
  | 'content'
  | 'accessibility'

export type RateSource = 'internal' | 'gsa_mas' | 'sub'

export type ContractPeriod = {
  name: string
  months: number
  cumulativeMonthsEnd: number
  gsaRateYear: 1 | 2 | 3 | 4 | 5
}

export type ExtractedRole = {
  title: string
  laborCategory: string | null
  hoursPerMonth: number | null
  utilizationPct: number | null
  appearsInPeriods: string[]
  confidence: Confidence
  sourceText: string
}

export type ContractIntelligence = {
  documentType: {
    value: 'RFP' | 'RFQ' | 'SOO' | 'PWS' | 'SOW' | 'task_order' | 'unknown'
    confidence: Confidence
  }
  vehicle: {
    value: string | null
    confidence: Confidence
  }
  contractType: {
    value: 'FFP' | 'T&M' | 'IDIQ' | 'BPA' | 'CPFF' | 'unknown'
    confidence: Confidence
  }
  setAside: {
    value: '8(a)' | 'WOSB' | 'SDVOSB' | 'small_business' | 'none' | 'unknown'
    confidence: Confidence
  }
  rateSource: {
    value: RateSource
    confidence: Confidence
  }
  // Phase 4B: Staffing model - whether RFP prescribes roles or offeror proposes
  staffingModel?: StaffingModel
  periods: ContractPeriod[]
  disciplines: {
    required: Discipline[]
    confidence: Confidence
    sourceText: string
  }
  roles: ExtractedRole[]
  confirmed: boolean
  confirmedAt: string | null
  extractedAt: string
}

export function getGSARateYear(cumulativeMonths: number): 1 | 2 | 3 | 4 | 5 {
  if (cumulativeMonths <= 12) return 1
  if (cumulativeMonths <= 24) return 2
  if (cumulativeMonths <= 36) return 3
  if (cumulativeMonths <= 48) return 4
  return 5
}

export function computePeriods(
  basePeriodMonths: number,
  optionPeriodMonths: number[]
): ContractPeriod[] {
  const periods: ContractPeriod[] = []
  let cumulative = 0

  const allPeriods = [
    { name: 'Base Period', months: basePeriodMonths },
    ...optionPeriodMonths.map((m, i) => ({
      name: `Option Period ${i + 1}`,
      months: m,
    })),
  ]

  for (const p of allPeriods) {
    cumulative += p.months
    periods.push({
      name: p.name,
      months: p.months,
      cumulativeMonthsEnd: cumulative,
      gsaRateYear: getGSARateYear(cumulative),
    })
  }

  return periods
}
