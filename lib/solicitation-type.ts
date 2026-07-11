// ==================== SOLICITATION TYPES ====================
// These types define the RFP/solicitation data that flows across all tabs

export interface SolicitationInfo {
  // Basic Info
  solicitationNumber: string
  title: string
  clientAgency: string
  subAgency?: string
  
  // Dates
  releaseDate?: string
  questionsDeadline?: string
  proposalDueDate?: string
  anticipatedAwardDate?: string
  
  // Contract Details
  contractType: 'FFP' | 'T&M' | 'CPFF' | 'CPAF' | 'IDIQ' | 'BPA' | 'hybrid' | ''
  contractVehicle?: string // e.g., "GSA MAS", "SEWP V", "CIO-SP3"
  naicsCode?: string
  psc?: string // Product Service Code
  
  // Period of Performance
  periodOfPerformance: {
    baseYear: boolean
    optionYears: number // 0-4 typically
    totalMonths?: number
  }
  
  // Set-Aside & Compliance
  setAside: 'full-open' | 'small-business' | '8a' | 'hubzone' | 'sdvosb' | 'wosb' | 'edwosb' | ''
  requiresClearance: boolean
  clearanceLevel?: 'public-trust' | 'secret' | 'top-secret' | 'ts-sci' | ''
  
  // Place of Performance
  placeOfPerformance: {
    type: 'remote' | 'on-site' | 'hybrid' | ''
    locations: string[] // City, State pairs
    travelRequired: boolean
    travelPercent?: number
  }
  
  // Budget & Evaluation
  budgetRange?: {
    min?: number
    max?: number
    ceiling?: number
  }
  evaluationCriteria?: EvaluationCriterion[]
  
  // Key Contacts
  contractingOfficer?: ContactInfo
  contractingOfficerRep?: ContactInfo
  
  // Source Selection
  evaluationMethod?: 'LPTA' | 'best-value' | 'tradeoff' | ''
  
  // Extracted Requirements (from AI analysis)
  keyRequirements?: string[]
  technicalRequirements?: string[]
  
  // Internal Tracking
  internalBidNumber?: string
  bidDecision?: 'go' | 'no-go' | 'pending' | ''
  bidDecisionDate?: string
  bidDecisionRationale?: string
  
  // Metadata
  createdAt: string
  updatedAt: string
  analyzedFromDocument?: string // filename of uploaded RFP
}

export interface EvaluationCriterion {
  id: string
  factor: string
  weight?: number // percentage or points
  description?: string
  subfactors?: string[]
}

export interface ContactInfo {
  name: string
  email?: string
  phone?: string
  organization?: string
}

// Default empty solicitation
export const emptySolicitation: SolicitationInfo = {
  solicitationNumber: '',
  title: '',
  clientAgency: '',
  contractType: '',
  periodOfPerformance: {
    baseYear: true,
    optionYears: 2
  },
  setAside: '',
  requiresClearance: false,
  placeOfPerformance: {
    type: '',
    locations: [],
    travelRequired: false
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

// Helper to check if solicitation has minimum required data
export const hasSolicitationData = (sol: SolicitationInfo): boolean => {
  return Boolean(sol.solicitationNumber || sol.title || sol.clientAgency)
}

// Helper to get display name for solicitation
export const getSolicitationDisplayName = (sol: SolicitationInfo): string => {
  if (sol.title) return sol.title
  if (sol.solicitationNumber) return sol.solicitationNumber
  return 'Untitled Solicitation'
}

// Contract type display names (keys: both lowercase API values and uppercase context values)
export const contractTypeLabels: Record<string, string> = {
  'ffp': 'Firm Fixed Price',
  'FFP': 'Firm Fixed Price',
  'tm': 'Time & Materials',
  'T&M': 'Time & Materials',
  'cpff': 'Cost Plus Fixed Fee',
  'CPFF': 'Cost Plus Fixed Fee',
  'cpaf': 'Cost Plus Award Fee',
  'CPAF': 'Cost Plus Award Fee',
  'idiq': 'IDIQ',
  'IDIQ': 'Indefinite Delivery/Indefinite Quantity',
  'bpa': 'Blanket Purchase Agreement',
  'BPA': 'Blanket Purchase Agreement',
  'hybrid': 'Hybrid',
  'unknown': 'Not Specified',
}

// Set-aside display names (keys: both slug and display forms for flexible lookup)
export const setAsideLabels: Record<string, string> = {
  'full-open': 'Full & Open Competition',
  'Full & Open': 'Full & Open Competition',
  'small-business': 'Small Business Set-Aside',
  'Small Business': 'Small Business Set-Aside',
  '8a': '8(a) Set-Aside',
  '8(a)': '8(a) Set-Aside',
  'hubzone': 'HUBZone Set-Aside',
  'HUBZone': 'HUBZone Set-Aside',
  'sdvosb': 'SDVOSB Set-Aside',
  'SDVOSB': 'SDVOSB Set-Aside',
  'wosb': 'WOSB Set-Aside',
  'WOSB': 'WOSB Set-Aside',
  'edwosb': 'EDWOSB Set-Aside',
  'EDWOSB': 'EDWOSB Set-Aside',
  'N/A': 'Not Specified',
  'unrestricted': 'Unrestricted',
}