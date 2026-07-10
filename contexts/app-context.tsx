'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, SetStateAction } from 'react';
import { rolesApi, settingsApi, companiesApi } from '@/lib/api';
import {
  calculateFullyBurdenedRate as pricingEngineRate,
  calculateEscalatedRate as pricingEngineEscalation,
  resolveProfitRateWithFallback,
  type ContractType as PricingContractType,
} from '@/lib/pricing';

// ==================== LOCALSTORAGE KEYS ====================

const STORAGE_KEYS = {
  COMPANY_ROLES: 'truebid-company-roles',
  COMPANY_SETTINGS: 'truebid-company-settings',
} as const;

// Save status for UI indicators
export type SaveStatus = 'idle' | 'saving' | 'saved';

// ==================== TYPE DEFINITIONS ====================

export type ContractType = 'tm' | 'ffp' | 'gsa';

// Salary structure options for company-wide configuration
export type SalaryStructure = 'steps' | 'bands' | 'single';

// Education requirements for a role
export interface EducationRequirement {
  minimum: string;
  preferred?: string;
  substitution?: string;
}

// GSA Labor Category within a SIN
export interface GSALaborCategory {
  id: string;
  laborCategory: string;
  hourlyRate: number;
  yearsExperience?: string;
  education?: string;
}

// GSA SIN (Special Item Number)
export interface GSASin {
  id: string;
  sin: string;
  title: string;
  laborCategories: GSALaborCategory[];
}

// Company-wide settings
export interface CompanySettings {
  salaryStructure: SalaryStructure;
  stepIncreasePercent: number;
}

export const defaultCompanySettings: CompanySettings = {
  salaryStructure: 'steps',
  stepIncreasePercent: 3,
};

// ==================== EXTRACTED REQUIREMENTS (from AI) ====================

export interface ExtractedRequirement {
  id: string
  title: string           // ← Must exist
  text: string
  type: 'delivery' | 'reporting' | 'staffing' | 'compliance' | 'governance' | 'transition' | 'other'
  sourceSection: string
  pageNumber: number | null  // ← Must exist
  reference_number?: string  // Optional: from API
  description?: string       // Optional: from API
  source?: string            // Optional: from API
}

// ==================== ESTIMATE TAB TYPES (BOE Support) ====================

// Estimate method types based on BOE document hierarchy (best to worst)
export type EstimateMethod = 
  | 'historical'      // Best - Historical Program Data with charge numbers
  | 'parametric'      // Good - Productivity/parametric data
  | 'firm-quote'      // Good - Subcontractor quote
  | 'level-of-effort' // Acceptable - LOE (should be <15-20% of project)
  | 'engineering';    // Least desired - WAG warning

// Quality grade based on government color coding (DCAA standards)
export type QualityGrade = 'blue' | 'green' | 'yellow' | 'red';

// Labor estimate for a single role within a WBS element
export interface WBSLaborEstimate {
  id: string;
  roleId: string;
  roleName: string;
  baseHours: number;
  complexityFactor: number;
  calculatedHours: number;
  rationale: string;
}

// Historical reference for "Historical Program" estimate method
export interface HistoricalReference {
  programName: string;
  chargeNumber: string;          // Critical for GREEN/BLUE grade
  actualHours: number;
  taskDescription: string;
}

// WBS Element - the core unit for BOE-focused workflow
export interface WBSElement {
  id: string;
  wbsNumber: string;                    // e.g., "1.2.3"
  title: string;
  
  // 1. Header Information (Required for audit)
  sowReference: string;                 // PWS/SOW paragraph reference
  clin?: string;                        // Contract Line Item Number
  periodOfPerformance: {
    start: string;                      // ISO date
    end: string;
  };
  
  // 2. Task Description (Required for audit)
  why: string;                          // Why is this task being done?
  what: string;                         // What will be done?
  notIncluded: string;                  // Scope exclusions - equally important!
  assumptions: string[];
  dependencies: string[];
  
  // 3. Basis of Estimate (Determines quality grade)
  estimateMethod: EstimateMethod;
  historicalReference?: HistoricalReference;  // Required for GREEN when using 'historical'
  complexityFactor: number;             // 1.0 = same, 1.2 = 20% more complex
  complexityJustification: string;      // Required when factor ≠ 1.0
  
  // 4. Bid Detail (Labor Hours)
  laborEstimates: WBSLaborEstimate[];
  totalHours: number;
  
  // Quality tracking (auto-calculated)
  qualityGrade: QualityGrade;
  qualityIssues: string[];
  isComplete: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Complete estimate data structure
export interface EstimateData {
  wbsElements: WBSElement[];
  
  // Contract period context
  contractPeriod: {
    baseYear: boolean;
    optionYears: number;
  };
  
  // WBS settings
  wbsPrefix: string;  // e.g., "1.0" for "1.0.1", "1.0.2", etc.
  
  // Metadata
  lastUpdated: string;
}

// Empty estimate data (for new bids)
export const emptyEstimateData: EstimateData = {
  wbsElements: [],
  contractPeriod: {
    baseYear: true,
    optionYears: 2
  },
  wbsPrefix: '1.0',
  lastUpdated: new Date().toISOString()
};

// ==================== ENHANCED WBS ELEMENT (Shared between Estimate & Roles tabs) ====================

// This interface matches what the Estimate tab uses internally
// and allows sharing WBS data with Roles & Pricing tab
export interface EstimateWBSElement {
  id: string;
  wbsNumber: string;
  title: string;
  description?: string;
  
  // Labor estimates with period-based hours
  laborEstimates: Array<{
    id: string;
    roleId: string;
    roleName: string;
    hoursByPeriod: {
      base: number;
      option1: number;
      option2: number;
      option3: number;
      option4: number;
    };
    rationale: string;
    confidence: 'high' | 'medium' | 'low';
    isAISuggested?: boolean;
    isOrphaned?: boolean;
  }>;
  
  // Status tracking
  status?: 'draft' | 'review' | 'approved';
  storyPoints?: number;
  totalHours?: number;
  
  // Quality tracking
  qualityGrade?: QualityGrade;
  qualityScore?: number;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;

  // Requirement links
  requirementLinks?: string[];
}

// ==================== QUALITY CALCULATION UTILITY ====================

export interface QualityResult {
  grade: QualityGrade;
  score: number;
  issues: string[];
}

export const calculateWBSQuality = (element: WBSElement): QualityResult => {
  const issues: string[] = [];
  let score = 100;
  
  // Check header completeness (-10 to -15 each)
  if (!element.sowReference) {
    issues.push('Missing SOW/PWS reference');
    score -= 15;
  }
  if (!element.periodOfPerformance.start || !element.periodOfPerformance.end) {
    issues.push('Period of performance not defined');
    score -= 10;
  }
  
  // Check task description (-10 each)
  if (!element.why || element.why.length < 20) {
    issues.push('Task purpose (WHY) not adequately described');
    score -= 10;
  }
  if (!element.what || element.what.length < 20) {
    issues.push('Task scope (WHAT) not adequately described');
    score -= 10;
  }
  
  // Check basis of estimate method (-10 to -20)
  if (element.estimateMethod === 'engineering') {
    issues.push('Engineering estimate requires detailed step-by-step breakdown');
    score -= 20;
  } else if (element.estimateMethod === 'level-of-effort') {
    issues.push('LOE method - ensure <15-20% of total project value');
    score -= 10;
  }
  
  // Check historical reference for historical method (-15 to -25)
  if (element.estimateMethod === 'historical') {
    if (!element.historicalReference?.chargeNumber) {
      issues.push('Missing charge number for historical comparison');
      score -= 25;
    }
    if (!element.historicalReference?.actualHours) {
      issues.push('Missing actual hours from historical program');
      score -= 15;
    }
  }
  
  // Check complexity factor justification (-10 to -15)
  if (element.complexityFactor !== 1.0 && !element.complexityJustification) {
    issues.push('Complexity factor requires justification');
    score -= 15;
  }
  if (element.complexityFactor > 1.5 || element.complexityFactor < 0.5) {
    if (!element.complexityJustification || element.complexityJustification.length < 50) {
      issues.push('Extreme complexity factor (>1.5x or <0.5x) requires strong justification');
      score -= 10;
    }
  }
  
  // Check labor estimates (-10 to -30)
  if (element.laborEstimates.length === 0) {
    issues.push('No labor estimates defined');
    score -= 30;
  } else {
    const missingRationale = element.laborEstimates.filter(l => !l.rationale || l.rationale.length < 10);
    if (missingRationale.length > 0) {
      issues.push(`${missingRationale.length} labor estimate(s) missing rationale`);
      score -= 10;
    }
  }
  
  // Check math (-20)
  const calculatedTotal = element.laborEstimates.reduce((sum, l) => sum + l.calculatedHours, 0);
  if (Math.abs(calculatedTotal - element.totalHours) > 0.5) {
    issues.push('Hours summary does not match labor detail calculations');
    score -= 20;
  }
  
  // Determine grade
  let grade: QualityGrade;
  if (score >= 90 && element.estimateMethod === 'historical' && element.historicalReference?.chargeNumber) {
    grade = 'blue';  // Excellent - multiple sources or strong historical
  } else if (score >= 75) {
    grade = 'green';  // Good - passes audit
  } else if (score >= 50) {
    grade = 'yellow';  // Needs work
  } else {
    grade = 'red';  // Unsupported - will be questioned
  }
  
  return { grade, score: Math.max(0, score), issues };
};

// ==================== PROPOSAL SETUP TYPE ====================

export interface ProposalSetup {
  contractType: 'tm' | 'ffp' | 'cpff';
  optionYears: number;
  setAside: string;
  billableHoursPerYear: number;
  escalationRate: number;
  proposalDueDate?: string;
  wordsPerPage?: number;
}

// ==================== PRICING SETTINGS TYPE ====================

export interface PricingSettings {
  billableHours: number;        // Default: 1920
  profitMargin: number;         // Default: 8 (percent)
  escalationEnabled: boolean;   // Default: true
  laborEscalation: number;      // Default: 3 (percent/yr)
  odcEscalation: number;        // Default: 2 (percent/yr)
}

export const defaultPricingSettings: PricingSettings = {
  billableHours: 1920,
  profitMargin: 8,
  escalationEnabled: true,
  laborEscalation: 3,
  odcEscalation: 0
};

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
  contractType: 'FFP' | 'T&M' | 'GSA' | 'CPFF' | 'CPAF' | 'IDIQ' | 'BPA' | 'hybrid' | ''
  contractVehicle?: string
  naicsCode?: string
  psc?: string
  
  // Period of Performance
  periodOfPerformance: {
    baseYear: boolean
    optionYears: number
    totalMonths?: number
  }
  
  // Set-Aside & Compliance
  setAside: 'full-open' | 'small-business' | '8a' | 'hubzone' | 'sdvosb' | 'wosb' | 'edwosb' | ''
  requiresClearance: boolean
  clearanceLevel?: 'public-trust' | 'secret' | 'top-secret' | 'ts-sci' | ''
  
  // Place of Performance
  placeOfPerformance: {
    type: 'remote' | 'on-site' | 'hybrid' | ''
    locations: string[]
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
  
  // Pricing Settings (centralized for all tabs)
  pricingSettings?: PricingSettings
  
  // Metadata
  createdAt: string
  updatedAt: string
  analyzedFromDocument?: string
}

export interface EvaluationCriterion {
  id: string
  factor: string
  weight?: number
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
  pricingSettings: defaultPricingSettings,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

// Helper functions for solicitation
export const hasSolicitationData = (sol: SolicitationInfo): boolean => {
  return Boolean(sol.solicitationNumber || sol.title || sol.clientAgency)
}

export const getSolicitationDisplayName = (sol: SolicitationInfo): string => {
  if (sol.title) return sol.title
  if (sol.solicitationNumber) return sol.solicitationNumber
  return 'Untitled Solicitation'
}

export const contractTypeLabels: Record<string, string> = {
  'FFP': 'Firm Fixed Price',
  'T&M': 'Time & Materials',
  'GSA': 'GSA Schedule',
  'CPFF': 'Cost Plus Fixed Fee',
  'CPAF': 'Cost Plus Award Fee',
  'IDIQ': 'Indefinite Delivery/Indefinite Quantity',
  'BPA': 'Blanket Purchase Agreement',
  'hybrid': 'Hybrid'
}

export const setAsideLabels: Record<string, string> = {
  'full-open': 'Full & Open Competition',
  'small-business': 'Small Business Set-Aside',
  '8a': '8(a) Set-Aside',
  'hubzone': 'HUBZone Set-Aside',
  'sdvosb': 'SDVOSB Set-Aside',
  'wosb': 'WOSB Set-Aside',
  'edwosb': 'EDWOSB Set-Aside'
}

// ==================== RATE JUSTIFICATION TYPES ====================

export type JustificationStrength = 'strong' | 'adequate' | 'weak' | 'missing'

export interface RateComparison {
  id: string
  source: string // e.g., "BLS OES (May 2024)", "GSA IT Schedule 70"
  sourceUrl?: string
  comparisonType: 'salary' | 'hourly'
  medianValue: number // Median salary or hourly rate from source
  ourValue: number // Our base salary or bill rate
  percentile?: number // Where our rate falls (e.g., 68th percentile)
  delta: number // Percentage difference from median
  status: 'below' | 'at' | 'above' | 'justified-above'
  notes?: string
}

export interface PremiumFactor {
  id: string
  type: 'location' | 'clearance' | 'certification' | 'experience' | 'specialized' | 'scarcity' | 'other'
  label: string
  percentage: number
  justification?: string // Tie to SOO requirement or rationale
  sourceReference?: string // e.g., "SOO 3.2.1", "BLS locality data"
}

export interface RoleJustification {
  roleId: string
  roleTitle: string
  
  // Market comparisons (BLS, GSA, etc.)
  comparisons: RateComparison[]
  
  // Premium factors that justify above-median rates
  premiumFactors: PremiumFactor[]
  
  // Calculated strength based on comparisons and documentation
  strength: JustificationStrength
  
  // Free-form notes for additional rationale
  notes: string
  
  // Timestamps
  savedAt: string
  lastUpdated?: string
  
  // Legacy fields for backward compatibility
  percentile?: number
  selectedReasons?: {
    // High rate justifications (≥75th percentile)
    clearance?: string
    location?: string
    certifications?: string[]
    keyPersonnel?: boolean
    nicheSkills?: boolean
    experience?: string
    pastPerformance?: boolean
    // Low rate justifications (≤25th percentile - cost realism)
    efficiency?: boolean
    reusableAssets?: boolean
    lowCostLocation?: string
    establishedRelationship?: boolean
    volumeDiscount?: boolean
    provenDelivery?: boolean
  }
}

// Helper function to calculate justification strength
export function calculateJustificationStrength(justification: Partial<RoleJustification>): JustificationStrength {
  const hasComparisons = (justification.comparisons?.length || 0) > 0
  const hasPremiumFactors = (justification.premiumFactors?.length || 0) > 0
  const hasNotes = (justification.notes?.trim().length || 0) > 0
  
  // Check if any comparison shows unjustified above-market
  const hasUnjustifiedAbove = justification.comparisons?.some(c => c.status === 'above')
  
  if (!hasComparisons) {
    return 'missing'
  }
  
  if (hasUnjustifiedAbove && !hasPremiumFactors) {
    return 'weak'
  }
  
  if (hasComparisons && (hasPremiumFactors || hasNotes)) {
    return 'strong'
  }
  
  return 'adequate'
}

// ==================== SCOPING TYPES (Legacy - kept for backward compatibility) ====================

// Hours breakdown per role for an epic - this is the key BOE data
export interface EpicHoursBreakdown {
  roleId: string
  roleName: string
  hours: number
  rationale: string
  confidence: 'high' | 'medium' | 'low'
  assumptions: string[]
}

// Enhanced Epic interface for BOE generation
export interface ScopingEpic {
  id: string
  title: string
  description: string
  storyPoints: number
  priority: 'high' | 'medium' | 'low'
  
  // Hours breakdown by role (key for BOE)
  hoursBreakdown: EpicHoursBreakdown[]
  
  // PWS/SOW traceability
  pwsReferences: string[]  // e.g., ["PWS 3.1.1", "PWS 3.2.4"]
  
  // Timeline
  timeline: {
    estimatedStart: string
    estimatedEnd: string
    milestones: string[]
  }
  
  // Dependencies and assumptions
  dependencies: string[]
  assumptions: string[]
  
  // Technical details
  technicalDetails: {
    stack: string[]
    constraints: string[]
    integrations: string[]
    compliance: string[]
  }
  
  // Quality
  acceptanceCriteria: string[]
  successMetrics: string[]
  testingStrategy: string[]
  
  // Documentation
  documentationNeeds: string[]
  dataRequirements: string[]
  openQuestions: string[]
  
  // Legacy compatibility
  requiredRoles: string[]
}

// Risk for scoping
export interface ScopingRisk {
  id: string
  title: string
  description: string
  probability: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  mitigation: string
  owner: string
  relatedEpics: string[]
}

// Technical decision
export interface TechnicalDecision {
  id: string
  category: 'stack' | 'architecture' | 'compliance' | 'security' | 'infrastructure'
  title: string
  description: string
  rationale: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  relatedEpics: string[]
}

// BD Assumption for delivery handoff
export interface BDAssumption {
  id: string
  category: 'budget' | 'resource' | 'timeline' | 'technical' | 'client' | 'delivery'
  title: string
  description: string
  impact: string
  validationNeeded: boolean
  validated?: boolean
  validatedBy?: string
  validatedDate?: string
  owner: string
  relatedEpics: string[]
}

// Complete scoping data structure (Legacy)
export interface ScopingData {
  epics: ScopingEpic[]
  risks: ScopingRisk[]
  technicalDecisions: TechnicalDecision[]
  assumptions: BDAssumption[]
  
  // Velocity settings for hours calculation
  velocitySettings: {
    sprintLengthWeeks: number
    hoursPerSprint: number
    velocitySpPerSprint: number
  }
  
  // WBS settings
  wbsPrefix: string  // e.g., "1.0" for "1.0.1", "1.0.2", etc.
}

// Default scoping data WITH mock data for development
export const defaultScopingData: ScopingData = {
  epics: [],
  risks: [],
  technicalDecisions: [],
  assumptions: [],
  velocitySettings: {
    sprintLengthWeeks: 2,
    hoursPerSprint: 160,
    velocitySpPerSprint: 20
  },
  wbsPrefix: '1.0'
}

// Empty scoping data (for production/reset)
export const emptyScopingData: ScopingData = {
  epics: [],
  risks: [],
  technicalDecisions: [],
  assumptions: [],
  velocitySettings: {
    sprintLengthWeeks: 2,
    hoursPerSprint: 160,
    velocitySpPerSprint: 20
  },
  wbsPrefix: '1.0'
}

// ==================== COMPANY PROFILE (SaaS-Ready) ====================

export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string;
  samUei: string;
  cageCode: string;
  businessSize: 'small' | 'other-than-small';
  naicsCodes: string[];
  gsaContractNumber?: string;
  gsaMasSchedule?: boolean;
  gsaEscalationRate?: number;    // e.g., 0.03 for 3%
  gsaBaseYear?: number;          // e.g., 2024
  gsaSins?: GSASin[];
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  dunsNumber?: string;
  ein?: string;
  idiqContracts?: any[];
  gsaExpirationDate?: string;
}

// ==================== INDIRECT RATES (Audit-Ready) ====================

export interface IndirectRates {
  fringe: number;
  overhead: number;
  ga: number;
  effectiveDate: string;
  fiscalYear: number;
  rateType: 'provisional' | 'final' | 'billing' | 'forward-pricing';
  source: string;
  lastUpdated: string;
}

// ==================== PROFIT TARGETS ====================

export interface ProfitTargets {
  tmDefault: number;
  ffpLowRisk: number;
  ffpMediumRisk: number;
  ffpHighRisk: number;
  gsaDefault: number;
}

// ==================== ESCALATION RATES ====================

export interface EscalationRates {
  laborDefault: number;
  odcDefault: number;
  source: string;
}

// ==================== COMPANY POLICY ====================

export interface CompanyPolicy {
  standardHours: number;
  ptoHours: number;
  holidayHours: number;
  sickHours: number;
  targetBillableHours: number;
  overtimeMultiplier: number;
}

// ==================== ROLE DEFINITIONS ====================

export interface CompanyRoleStep {
  step: number;
  salary: number;
  monthsToNextStep: number | null;
}

export interface CompanyRoleLevel {
  level: string;
  levelName: string;
  steps: CompanyRoleStep[];
  monthsBeforePromotionReady: number | null;
  isTerminal: boolean;
  yearsExperience: string;
}

export interface CompanyRole {
  id: string;
  title: string;
  laborCategory: string;
  description: string;
  
  // Detailed responsibilities for Labor Category Descriptions export
  functionalResponsibilities?: string;
  
  // Education Requirements
  education?: EducationRequirement;
  
  // Required/Preferred Certifications
  certifications?: string[];
  
  // Salary levels
  levels: CompanyRoleLevel[];
  
  // BLS/SOC Classification
  blsOccCode?: string;
  blsOccTitle?: string;
  
  // GSA mapping
  gsaLaborCategory?: string;
  gsaSin?: string;
  
  // Service Contract Act
  scaCode?: string;
  scaOccupation?: string;
}

// ==================== BID-SPECIFIC ROLES ====================

export interface Role {
  id: string;
  name: string;
  description: string;
  icLevel: 'IC1' | 'IC2' | 'IC3' | 'IC4' | 'IC5' | 'IC6';
  baseSalary: number;
  quantity: number;
  fte: number;
  storyPoints: number;
  years: {
    base: boolean;
    option1: boolean;
    option2: boolean;
    option3: boolean;
    option4: boolean;
  };
  assumptions?: string[];
  isKeyPersonnel?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  isCustom?: boolean;
  title?: string;
  loadedRate?: number;
  annualCost?: number;
  billableHours?: number;
  hourlyRate?: number;
  selectedLevel?: string;
  selectedLevelTitle?: string;
  selectedStep?: number;
  currentSalary?: number;
  billRateBase?: number;
  profitMargin?: number;
  laborCategory?: string | null;
  socCode?: string | null;
  hoursByYear?: {
    baseYear: number;
    oy1: number;
    oy2: number;
    oy3: number;
    oy4: number;
  };
  totalHoursFromWBS?: number;
  isManual?: boolean;
  type?: 'prime' | 'sub';
  subcontractorName?: string | null;
  subRate?: number;
  subMarkup?: number;
  hoursPerMonth?: number; // Utilization-based: hours worked per month
  gsaLaborCategory?: string; // GSA MAS labor category for rate lookup
  gsaHourlyRate?: number; // GSA rate per hour (from schedule)
}

// ==================== SUBCONTRACTORS ====================

export interface Subcontractor {
  id: string;
  companyName: string;
  role: string;
  laborCategory?: string;
  theirRate: number;
  markupPercent: number;
  billedRate: number;
  
  // NEW: Period-specific allocations (replaces single fte + years booleans)
  allocations: {
    base: { enabled: boolean; fte: number };
    option1: { enabled: boolean; fte: number };
    option2: { enabled: boolean; fte: number };
    option3: { enabled: boolean; fte: number };
    option4: { enabled: boolean; fte: number };
  };
  
  // Keep for backward compatibility, but derive from allocations
  fte: number; // Total/default FTE
  years: {
    base: boolean;
    option1: boolean;
    option2: boolean;
    option3: boolean;
    option4: boolean;
  };
  
  rateSource?: string;
  quoteDate?: string;
  quoteReference?: string;
  partnerId?: string;
}

// ==================== TEAMING PARTNERS ====================

export interface TeamingPartnerCertifications {
  sb: boolean;
  wosb: boolean;
  sdvosb: boolean;
  hubzone: boolean;
  eightA: boolean;
}

export interface TeamingPartner {
  id: string;
  companyName: string;
  legalName?: string;
  uei?: string;
  cageCode?: string;
  
  // Business Size & Certifications
  businessSize: 'small' | 'other-than-small' | '';
  certifications: TeamingPartnerCertifications;
  
  // Teaming Agreement
  teamingAgreementStatus: 'none' | 'draft' | 'under-review' | 'signed' | 'executed';
  teamingAgreementExpiration?: string;
  ndaStatus: 'none' | 'draft' | 'signed';
  ndaExpiration?: string;
  
  // Rate Information
  defaultRate?: number;
  rateSource: 'quote' | 'prior-agreement' | 'gsa-schedule' | 'market-research' | '';
  quoteDate?: string;
  quoteReference?: string;
  
  // Capabilities
  capabilities?: string[];
  otherCapabilities?: string;
  pastPerformance?: string;
  
  // Contact
  primaryContact?: string;
  contactEmail?: string;
  contactPhone?: string;
  
  // Internal tracking
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== TEAM MEMBERS ====================

export interface TeamMember {
  id: string;
  name: string;
  type: 'prime' | 'sub' | 'partner';
  contactName: string | null;
  workShare: number;
  uei: string | null;
  agreementStatus: 'signed' | 'pending' | 'none';
  agreementType: string | null;
  notes: string | null;
}

// ==================== DIRECTORS ====================

export interface Director {
  id: string;
  name: string;
  role: string;
  email: string;
  token: string | null;
  tokenExpiry: string | null;
  lastViewed: string | null;
  createdAt: string;
}

// ==================== OUTLINE ====================

export type OutlineSectionStatus = 'not_started' | 'in_progress' | 'draft' | 'review'

export interface OutlineSubsection {
  id: string
  number: string
  title: string
  pageTarget: number | null
  status: OutlineSectionStatus
  statusOverride?: boolean // true if user manually set the status
}

export interface OutlineSection {
  id: string
  number: string
  title: string
  description: string | null
  pageTarget: number | null
  status: OutlineSectionStatus
  assignee: string | null
  complianceRefs: string[]
  requirementRefs: string[]
  subsections: OutlineSubsection[]
}

export interface OutlineVolume {
  id: string
  title: string
  description: string | null
  maxPages: number | null
  complianceRef: string | null
  sections: OutlineSection[]
}

export interface ProposalOutline {
  volumes: OutlineVolume[]
}

// ==================== SECTION CONTENT ====================

export interface SectionContent {
  sectionId: string
  content: string
  lastSaved: string
  wordCount: number
  status: 'not_started' | 'in_progress' | 'draft' | 'review'
}

// ==================== ODCs ====================

export interface ODCItem {
  id: string;
  category: 'travel' | 'materials' | 'equipment' | 'software' | 'other';
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  years: {
    base: boolean;
    option1: boolean;
    option2: boolean;
    option3: boolean;
    option4: boolean;
  };
  costSource?: string;
  quoteReference?: string;
}

// ==================== PER DIEM ====================

export interface PerDiemCalculation {
  id: string;
  location: string;
  ratePerDay: number;
  numberOfDays: number;
  numberOfPeople: number;
  totalCost: number;
  years: {
    base: boolean;
    option1: boolean;
    option2: boolean;
    option3: boolean;
    option4: boolean;
  };
}

// ==================== GSA SCHEDULE ====================


export interface GSAContractInfo {
  contractNumber: string;
  contractorName: string;
  samUei: string;
  periodOfPerformance: {
    start: string;
    end: string;
  };
  maxOrder: number;
  minOrder: number;
  iffRate: number;
  sins: {
    sin: string;
    name: string;
    laborCategories: GSALaborCategory[];
  }[];
}

// ==================== CONTEXT INTERFACE ====================

// Main application tab type for navigation (matches tabs-navigation.tsx TabType)
// Note: 'sub-rates' is now a utility tool in the Tools menu, not a main tab
// Note: 'gsa-bid' functionality merged into Upload tab (contract type selection)
// Workflow order: Upload → Estimate → Roles → Teaming → Rate Justification → Export
export type MainTabId =
  | 'upload'
  | 'estimate'
  | 'roles'  // Roles & Pricing
  | 'teaming-partners'
  | 'rate-justification'
  | 'write'  // Technical Volume Outline
  | 'review'  // Pre-flight checklist
  | 'export';

  // Utility tool type - accessed via Tools menu in header
export type UtilityToolType = 'sub-rates' | 'rate-builder' | 'wrap-rate' | null;

// ==================== PROJECT VERSION TYPES ====================

export interface ProjectSnapshot {
  solicitation: SolicitationInfo;
  estimateWbsElements: EstimateWBSElement[];
  selectedRoles: Role[];
  subcontractors: Subcontractor[];
  teamingPartners: TeamingPartner[];
  rateJustifications: Record<string, RoleJustification>;
  odcs: ODCItem[];
  perDiem: PerDiemCalculation[];
}

export interface ProjectVersion {
  id: string;
  name: string;
  notes?: string;
  snapshot: ProjectSnapshot;
  createdAt: string;
  createdBy?: string;
}

interface AppContextType {
  // Main Tab Navigation
  activeMainTab: MainTabId;
  setActiveMainTab: (tab: MainTabId) => void;
  navigateToRateJustification: (roleId?: string) => void;
  selectedRoleIdForJustification: string | null;
  clearSelectedRoleForJustification: () => void;
  
  // Utility Tool State (for Tools menu in header)
  activeUtilityTool: UtilityToolType;
  setActiveUtilityTool: (tool: UtilityToolType) => void;
  
  // Project Version History
  projectVersions: ProjectVersion[];
  saveProjectVersion: (name: string, notes?: string) => ProjectVersion;
  restoreProjectVersion: (versionId: string) => void;
  deleteProjectVersion: (versionId: string) => void;
  
  // Solicitation (RFP Details)
  solicitation: SolicitationInfo;
  setSolicitation: (sol: SolicitationInfo) => void;
  updateSolicitation: (updates: Partial<SolicitationInfo>) => void;
  resetSolicitation: () => void;
  
  // Solicitation Editor Slideout Control (for cross-component access)
  isSolicitationEditorOpen: boolean;
  openSolicitationEditor: () => void;
  closeSolicitationEditor: () => void;

  // Proposal Setup (persists contract type, option years, etc.)
  proposalSetup: ProposalSetup | null;
  setProposalSetup: (setup: ProposalSetup | null) => void;

  // Helper to get pricing settings with defaults
  getPricingSettings: () => PricingSettings;
  
  // Company Profile (SaaS)
  companyProfile: CompanyProfile;
  setCompanyProfile: (profile: CompanyProfile) => void;
  saveCompanyProfile: (profile: CompanyProfile) => Promise<void>;
  
  // Company Settings
  companySettings: CompanySettings;
  setCompanySettings: (settings: CompanySettings) => void;
  updateCompanySettings: (updates: Partial<CompanySettings>) => void;
  
  // Indirect Rates (Audit-Ready)
  indirectRates: IndirectRates;
  setIndirectRates: (rates: IndirectRates) => void;
  
  // Profit Targets
  profitTargets: ProfitTargets;
  setProfitTargets: (targets: ProfitTargets) => void;
  
  // Escalation (base rates as decimals)
  escalationRates: EscalationRates;
  setEscalationRates: (rates: EscalationRates) => void;
  
  // UI-specific escalation settings (persist across tab switches)
  // These are stored as percentages (e.g., 3 for 3%) for direct UI binding
  uiLaborEscalation: number;
  uiOdcEscalation: number;
  uiShowEscalation: boolean;
  setUiLaborEscalation: (rate: number) => void;
  setUiOdcEscalation: (rate: number) => void;
  setUiShowEscalation: (show: boolean) => void;
  
  // UI-specific profit margin (persist across tab switches)
  uiProfitMargin: number;
  setUiProfitMargin: (margin: number) => void;
  uiBillableHours: number;
  setUiBillableHours: (hours: number) => void;
  
  // Company Policy
  companyPolicy: CompanyPolicy;
  setCompanyPolicy: (policy: CompanyPolicy) => void;
  
  // Contract Configuration
  contractType: ContractType;
  setContractType: (type: ContractType) => void;
  
  // Company Role Library
  companyRoles: CompanyRole[];
  setCompanyRoles: (roles: CompanyRole[]) => void;
  addCompanyRole: (role: CompanyRole) => void;
  updateCompanyRole: (id: string, updates: Partial<CompanyRole>) => void;
  removeCompanyRole: (id: string) => void;
  companyRolesSaveStatus: SaveStatus;
  
  // Bid-Specific Roles
  recommendedRoles: Role[];
  setRecommendedRoles: (roles: Role[]) => void;
   // Extracted Requirements (from AI analysis)
  extractedRequirements: ExtractedRequirement[];
  setExtractedRequirements: (requirements: ExtractedRequirement[]) => void;
  selectedRoles: Role[];
  setSelectedRoles: (roles: Role[]) => void;
  addRole: (role: Role) => void;
  removeRole: (id: string) => void;
  updateRole: (id: string, updates: Partial<Role>) => void;
  
  // Subcontractors
  subcontractors: Subcontractor[];
  setSubcontractors: (subs: Subcontractor[]) => void;
  addSubcontractor: (sub: Subcontractor) => void;
  removeSubcontractor: (id: string) => void;
  updateSubcontractor: (id: string, updates: Partial<Subcontractor>) => void;
  
  // Teaming Partners (Company-level compliance)
  teamingPartners: TeamingPartner[];
  setTeamingPartners: (partners: TeamingPartner[]) => void;
  addTeamingPartner: (partner: TeamingPartner) => void;
  removeTeamingPartner: (id: string) => void;
  updateTeamingPartner: (id: string, updates: Partial<TeamingPartner>) => void;
  getOrCreatePartnerByName: (companyName: string) => TeamingPartner;
  getPartnerById: (id: string) => TeamingPartner | undefined;
  getSubcontractorsByPartnerId: (partnerId: string) => Subcontractor[];

  // Team Members (proposal-specific team)
  teamMembers: TeamMember[];
  setTeamMembers: (members: SetStateAction<TeamMember[]>) => void;

  // Directors (internal reviewers)
  directors: Director[];
  setDirectors: (directors: SetStateAction<Director[]>) => void;

  // Outline
  outline: ProposalOutline | null;
  setOutline: (outline: SetStateAction<ProposalOutline | null>) => void;

  // Section Content
  sectionContent: Record<string, SectionContent>;
  setSectionContent: (content: SetStateAction<Record<string, SectionContent>>) => void;

  // Rate Justifications (persist across tab switches)
  rateJustifications: Record<string, RoleJustification>;
  setRateJustifications: (justifications: Record<string, RoleJustification>) => void;
  updateRateJustification: (roleId: string, justification: RoleJustification) => void;
  removeRateJustification: (roleId: string) => void;
  
  // Scoping Data (Legacy - kept for backward compatibility)
  scopingData: ScopingData;
  setScopingData: (data: ScopingData) => void;
  
  // Epic management (Legacy)
  addEpic: (epic: ScopingEpic) => void;
  updateEpic: (id: string, updates: Partial<ScopingEpic>) => void;
  removeEpic: (id: string) => void;
  
  // Risk management (Legacy)
  addScopingRisk: (risk: ScopingRisk) => void;
  updateScopingRisk: (id: string, updates: Partial<ScopingRisk>) => void;
  removeScopingRisk: (id: string) => void;
  
  // Technical decision management (Legacy)
  addTechnicalDecision: (decision: TechnicalDecision) => void;
  updateTechnicalDecision: (id: string, updates: Partial<TechnicalDecision>) => void;
  removeTechnicalDecision: (id: string) => void;
  
  // BD Assumption management (Legacy)
  addBDAssumption: (assumption: BDAssumption) => void;
  updateBDAssumption: (id: string, updates: Partial<BDAssumption>) => void;
  removeBDAssumption: (id: string) => void;
  
  // Scoping calculations (Legacy)
  getTotalScopingHours: () => number;
  getTotalStoryPoints: () => number;
  getHoursByRole: () => Record<string, number>;
  
  // ==================== ESTIMATE TAB (NEW) ====================
  
  // Estimate Data (BOE support)
  estimateData: EstimateData;
  setEstimateData: (data: EstimateData) => void;
  
  // WBS Element management
  addWBSElement: (element: WBSElement) => void;
  updateWBSElement: (id: string, updates: Partial<WBSElement>) => void;
  removeWBSElement: (id: string) => void;
  
  // Estimate calculations
  getEstimateTotalHours: () => number;
  getEstimateHoursByRole: () => Record<string, number>;
  getEstimateReadiness: () => { score: number; complete: number; total: number };
  
  // ==================== SHARED WBS ELEMENTS (Estimate ↔ Roles & Pricing) ====================
  
  // Enhanced WBS elements shared between Estimate tab and Roles & Pricing tab
  // This is the primary data source for role hours in the Roles & Pricing tab
  estimateWbsElements: EstimateWBSElement[];
  setEstimateWbsElements: (elements: EstimateWBSElement[]) => void;
  
  // ODCs
  odcs: ODCItem[];
  setODCs: (odcs: ODCItem[]) => void;
  addODC: (odc: ODCItem) => void;
  removeODC: (id: string) => void;
  updateODC: (id: string, updates: Partial<ODCItem>) => void;
  
  // Per Diem
  perDiem: PerDiemCalculation[];
  setPerDiem: (perDiem: PerDiemCalculation[]) => void;
  addPerDiem: (pd: PerDiemCalculation) => void;
  removePerDiem: (id: string) => void;
  updatePerDiem: (id: string, updates: Partial<PerDiemCalculation>) => void;
  
  // GSA Schedule
  gsaContractInfo: GSAContractInfo | null;
  setGSAContractInfo: (info: GSAContractInfo | null) => void;
  
  // ==================== CALCULATION FUNCTIONS (Audit-Ready) ====================
  
  calculateFullyBurdenedRate: (
    baseSalary: number, 
    includeProfit?: boolean,
    profitOverride?: number
  ) => number;
  
  calculateLoadedCost: (baseSalary: number) => number;
  
  calculateLoadedRate: (baseSalary: number) => number;
  
  calculateEscalatedRate: (baseRate: number, year: number) => number;
  
  getRateBreakdown: (baseSalary: number, includeProfit?: boolean) => {
    baseRate: number;
    fringeAmount: number;
    afterFringe: number;
    overheadAmount: number;
    afterOverhead: number;
    gaAmount: number;
    afterGA: number;
    profitAmount: number;
    fullyBurdenedRate: number;
  };
  
  calculateYearSalaries: (
    role: CompanyRole,
    levelIndex: number,
    startingStepIndex: number,
    contractYears: number
  ) => number[];
  
  // ==================== DERIVED VALUES ====================
  
  // Get total contract years from solicitation
  getTotalContractYears: () => number;
  
  // Get years array for iteration
  getContractYearsArray: () => { key: string; label: string; enabled: boolean }[];
  getIcLevelSalaries: () => Record<string, number>;
  
  // Legacy compatibility
  costMultipliers: { fringe: number; overhead: number; ga: number };
  setCostMultipliers: (multipliers: { fringe: number; overhead: number; ga: number }) => void;
  profitMargin: number;
  setProfitMargin: (margin: number) => void;
  annualEscalation: number;
  setAnnualEscalation: (rate: number) => void;
}

// ==================== CONTEXT CREATION ====================

const AppContext = createContext<AppContextType | undefined>(undefined);

// ==================== DEFAULT COMPANY ROLES ====================

const DEFAULT_COMPANY_ROLES: CompanyRole[] = [
  {
    id: 'cr-1',
    title: 'Product Designer',
    laborCategory: 'UX/UI Designer',
    description: 'User research and product design',
    blsOccCode: '15-1252',
    blsOccTitle: 'Software Developers',
    gsaLaborCategory: 'UX/UI Designer',
    gsaSin: '54151S',
    levels: [
      {
        level: 'IC1',
        levelName: 'Temp',
        yearsExperience: '0-1',
        monthsBeforePromotionReady: 12,
        isTerminal: false,
        steps: [
          { step: 1, salary: 79850, monthsToNextStep: null },
        ]
      },
      {
        level: 'IC2',
        levelName: 'Junior',
        yearsExperience: '0-2',
        monthsBeforePromotionReady: 18,
        isTerminal: false,
        steps: [
          { step: 1, salary: 79850, monthsToNextStep: 12 },
          { step: 2, salary: 82246, monthsToNextStep: null },
        ]
      },
      {
        level: 'IC3',
        levelName: 'Intermediate',
        yearsExperience: '2-4',
        monthsBeforePromotionReady: 24,
        isTerminal: false,
        steps: [
          { step: 1, salary: 103100, monthsToNextStep: 12 },
          { step: 2, salary: 106193, monthsToNextStep: 12 },
          { step: 3, salary: 109379, monthsToNextStep: null },
        ]
      },
      {
        level: 'IC4',
        levelName: 'Senior',
        yearsExperience: '4-7',
        monthsBeforePromotionReady: 30,
        isTerminal: false,
        steps: [
          { step: 1, salary: 133100, monthsToNextStep: 15 },
          { step: 2, salary: 137093, monthsToNextStep: 15 },
          { step: 3, salary: 141206, monthsToNextStep: null },
        ]
      },
      {
        level: 'IC5',
        levelName: 'Staff',
        yearsExperience: '7-10',
        monthsBeforePromotionReady: 36,
        isTerminal: false,
        steps: [
          { step: 1, salary: 169000, monthsToNextStep: 18 },
          { step: 2, salary: 174070, monthsToNextStep: 18 },
          { step: 3, salary: 179292, monthsToNextStep: null },
        ]
      },
      {
        level: 'IC6',
        levelName: 'Principal',
        yearsExperience: '10+',
        monthsBeforePromotionReady: null,
        isTerminal: true,
        steps: [
          { step: 1, salary: 211400, monthsToNextStep: 24 },
          { step: 2, salary: 217742, monthsToNextStep: 24 },
          { step: 3, salary: 224274, monthsToNextStep: null },
        ]
      }
    ]
  },
];

// ==================== LOCALSTORAGE HELPERS ====================

// Helper to get initial companySettings from localStorage (handles SSR)
const getInitialCompanySettings = (): CompanySettings => {
  if (typeof window === 'undefined') return defaultCompanySettings;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.COMPANY_SETTINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultCompanySettings, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load company settings from localStorage:', e);
  }
  
  return defaultCompanySettings;
};

// ==================== PROVIDER COMPONENT ====================

export function AppProvider({ children }: { children: ReactNode }) {
  
  // ==================== MAIN TAB NAVIGATION ====================
  const [activeMainTab, setActiveMainTab] = useState<MainTabId>('upload');
  const [selectedRoleIdForJustification, setSelectedRoleIdForJustification] = useState<string | null>(null);
  
  const navigateToRateJustification = (roleId?: string) => {
    if (roleId) {
      setSelectedRoleIdForJustification(roleId);
    }
    setActiveMainTab('rate-justification');
  };
  
 const clearSelectedRoleForJustification = () => {
    setSelectedRoleIdForJustification(null);
  };
  
  // ==================== UTILITY TOOL STATE ====================
  const [activeUtilityTool, setActiveUtilityTool] = useState<UtilityToolType>(null);
  
  // ==================== PROJECT VERSION HISTORY ====================
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);
  
  // ==================== SOLICITATION STATE ====================
  const [solicitation, setSolicitation] = useState<SolicitationInfo>(emptySolicitation);

  const updateSolicitation = (updates: Partial<SolicitationInfo>) => {
    setSolicitation(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString()
    }));
  };

  const resetSolicitation = () => {
    setSolicitation({
      ...emptySolicitation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  // ==================== PROPOSAL SETUP STATE ====================
  const [proposalSetup, setProposalSetup] = useState<ProposalSetup | null>(null);

  // ==================== SOLICITATION EDITOR SLIDEOUT CONTROL ====================
  const [isSolicitationEditorOpen, setIsSolicitationEditorOpen] = useState(false);
  
  const openSolicitationEditor = () => setIsSolicitationEditorOpen(true);
  const closeSolicitationEditor = () => setIsSolicitationEditorOpen(false);
  
  // Helper to get pricing settings with defaults
  const getPricingSettings = (): PricingSettings => {
    return solicitation.pricingSettings ?? defaultPricingSettings;
  };

  // ==================== COMPANY SETTINGS (API with localStorage cache) ====================
  const [companySettings, setCompanySettings] = useState<CompanySettings>(getInitialCompanySettings);
  const companySettingsLoaded = React.useRef(false);

  // Load company settings from API on mount (localStorage is just initial/cache)
  useEffect(() => {
    async function loadCompanySettings() {
      if (typeof window === 'undefined') return;
      try {
        const response = await settingsApi.get() as { settings: Record<string, unknown> | null };
        if (response.settings) {
          const s = response.settings;
          const fromApi: Partial<CompanySettings> = {};
          if (s.salary_structure) fromApi.salaryStructure = s.salary_structure as CompanySettings['salaryStructure'];
          if (s.step_increase_percent != null) fromApi.stepIncreasePercent = s.step_increase_percent as number;
          if (Object.keys(fromApi).length > 0) {
            setCompanySettings(prev => ({ ...prev, ...fromApi }));
          }
        }
      } catch (e) {
        console.warn('Failed to load company settings from API, using localStorage cache:', e);
      }
      companySettingsLoaded.current = true;
    }
    loadCompanySettings();
  }, []);

  // Persist to localStorage (cache) and API when settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.COMPANY_SETTINGS, JSON.stringify(companySettings));
      } catch (e) {
        console.warn('Failed to cache company settings to localStorage:', e);
      }
    }

    // Don't save to API until initial load is complete
    if (!companySettingsLoaded.current) return;

    settingsApi.save({
      salary_structure: companySettings.salaryStructure,
      step_increase_percent: companySettings.stepIncreasePercent,
    }).catch(e => {
      console.warn('Failed to save company settings to API:', e);
    });
  }, [companySettings]);

  const updateCompanySettings = (updates: Partial<CompanySettings>) => {
    setCompanySettings(prev => ({ ...prev, ...updates }));
  };

  // ==================== COMPANY PROFILE (SaaS) ====================
  const [companyProfile, setCompanyProfileState] = useState<CompanyProfile>({
    id: '',
    name: '',
    legalName: '',
    samUei: '',
    cageCode: '',
    businessSize: 'small',
    naicsCodes: [],
    gsaContractNumber: '',
    gsaMasSchedule: false,
  });
  const [companyProfileLoaded, setCompanyProfileLoaded] = useState(false);

  // Load company profile from API on mount
  useEffect(() => {
    async function loadCompanyProfile() {
      if (typeof window === 'undefined') return;

      try {
        const response = await companiesApi.get() as { company: Record<string, unknown> | null };
        if (response.company) {
          const c = response.company;
          const gsaConfig = (c.gsa_config as Record<string, unknown>) || {};
          setCompanyProfileState({
            id: (c.id as string) || '',
            name: (c.name as string) || '',
            legalName: (c.legal_name as string) || '',
            samUei: (c.sam_uei as string) || '',
            cageCode: (c.cage_code as string) || '',
            businessSize: ((c.address as Record<string, unknown>)?.businessSize as 'small' | 'other-than-small') || 'small',
            naicsCodes: (c.naics_codes as string[]) || [],
            gsaContractNumber: (gsaConfig.gsaContractNumber as string) || '',
            gsaMasSchedule: (gsaConfig.gsaMasSchedule as boolean) || false,
            gsaEscalationRate: (gsaConfig.gsaEscalationRate as number) || 0.052,
            gsaBaseYear: (gsaConfig.gsaBaseYear as number) || new Date().getFullYear(),
            gsaSins: (gsaConfig.gsaSins as GSASin[]) || [],
            streetAddress: ((c.address as Record<string, unknown>)?.street as string) || '',
            city: ((c.address as Record<string, unknown>)?.city as string) || '',
            state: ((c.address as Record<string, unknown>)?.state as string) || '',
            zipCode: ((c.address as Record<string, unknown>)?.zip as string) || '',
            dunsNumber: (c.duns as string) || '',
            ein: (c.ein as string) || '',
          });
        }
      } catch (e) {
        console.warn('Failed to load company profile from API:', e);
      }
      setCompanyProfileLoaded(true);
    }

    loadCompanyProfile();
  }, []);

  // Update local state immediately (no API call)
  const setCompanyProfile = (profile: CompanyProfile) => {
    setCompanyProfileState(profile);
  };

  // Save company profile to API (call this after debouncing)
  const saveCompanyProfile = async (profile: CompanyProfile) => {
    if (!companyProfileLoaded) return;

    const apiData = {
      name: profile.name,
      legal_name: profile.legalName,
      sam_uei: profile.samUei,
      cage_code: profile.cageCode,
      duns: profile.dunsNumber,
      ein: profile.ein,
      naics_codes: profile.naicsCodes,
      address: {
        street: profile.streetAddress,
        city: profile.city,
        state: profile.state,
        zip: profile.zipCode,
        businessSize: profile.businessSize,
      },
      gsa_config: {
        gsaMasSchedule: profile.gsaMasSchedule,
        gsaContractNumber: profile.gsaContractNumber,
        gsaEscalationRate: profile.gsaEscalationRate,
        gsaBaseYear: profile.gsaBaseYear,
        gsaSins: profile.gsaSins,
      },
    };

    try {
      if (profile.id) {
        await companiesApi.update(apiData);
      } else {
        const response = await companiesApi.create(apiData) as { company: { id: string } };
        if (response.company?.id) {
          setCompanyProfileState(prev => ({ ...prev, id: response.company.id }));
        }
      }
    } catch (err) {
      console.error('[AppContext] Failed to save company profile:', err);
      throw err;
    }
  };

  // ==================== INDIRECT RATES (From Accountant) ====================
  const [indirectRates, setIndirectRatesState] = useState<IndirectRates>({
    fringe: 0.211562,
    overhead: 0.342588,
    ga: 0.19831,
    effectiveDate: '2025-01-01',
    fiscalYear: 2026,
    rateType: 'forward-pricing',
    source: 'FFTC Rate Model 202511',
    lastUpdated: '2025-11-25',
  });
  const [indirectRatesLoaded, setIndirectRatesLoaded] = useState(false);

  // Load indirect rates and profit targets from API on mount
  useEffect(() => {
    async function loadSettings() {
      if (typeof window === 'undefined') return;

      try {
        const response = await settingsApi.get() as { settings: Record<string, unknown> | null };
        if (response.settings) {
          const s = response.settings;
          // Load indirect rates
          setIndirectRatesState(prev => ({
            ...prev,
            fringe: (s.fringe_rate as number) ?? prev.fringe,
            overhead: (s.overhead_rate as number) ?? prev.overhead,
            ga: (s.ga_rate as number) ?? prev.ga,
          }));
          // Load profit targets if present
          if (s.profit_targets && typeof s.profit_targets === 'object') {
            const pt = s.profit_targets as Record<string, number>;
            setProfitTargetsState(prev => ({
              ...prev,
              tmDefault: pt.tm ?? prev.tmDefault,
              ffpLowRisk: pt.ffp ?? prev.ffpLowRisk,
              gsaDefault: pt.gsa ?? prev.gsaDefault,
            }));
          }
        }
      } catch (e) {
        console.warn('Failed to load settings from API:', e);
      }
      setIndirectRatesLoaded(true);
    }

    loadSettings();
  }, []);

  // Wrapper to save indirect rates to API when they change
  const setIndirectRates = async (rates: IndirectRates) => {
    setIndirectRatesState(rates);

    // Don't save until initial load is complete
    if (!indirectRatesLoaded) return;

    try {
      await settingsApi.save({
        fringe_rate: rates.fringe,
        overhead_rate: rates.overhead,
        ga_rate: rates.ga,
      });
    } catch (e) {
      console.warn('Failed to save indirect rates to API:', e);
    }
  };

  // ==================== PROFIT TARGETS ====================
  const [profitTargetsState, setProfitTargetsState] = useState<ProfitTargets>({
    tmDefault: 0.08,      // Time & Materials: 8%
    ffpLowRisk: 0.10,     // FFP Low risk: 10% (resolver default)
    ffpMediumRisk: 0.12,  // FFP Medium risk: 12% (explicit only)
    ffpHighRisk: 0.15,    // FFP High risk: 15% (explicit only)
    gsaDefault: 0.08,     // GSA Schedule: 8%
  });

  // Alias for reading (components use profitTargets)
  const profitTargets = profitTargetsState;

  // Wrapper to save profit targets to API when they change
  const setProfitTargets = async (targets: ProfitTargets) => {
    setProfitTargetsState(targets);

    // Don't save until initial load is complete
    if (!indirectRatesLoaded) return;

    try {
      await settingsApi.save({
        profit_targets: {
          tm: targets.tmDefault,
          ffp: targets.ffpLowRisk, // FFP default is Low risk
          gsa: targets.gsaDefault,
        },
      });
    } catch (e) {
      console.warn('Failed to save profit targets to API:', e);
    }
  };

  // ==================== ESCALATION ====================
  const [escalationRates, setEscalationRates] = useState<EscalationRates>({
    laborDefault: 0.03,
    odcDefault: 0,
    source: 'BLS Employment Cost Index - Professional and Technical Services',
  });

  // ==================== UI-SPECIFIC SETTINGS (Persist across tab switches) ====================
  // These are stored as percentages for direct UI binding
  const [uiLaborEscalation, setUiLaborEscalation] = useState<number>(3); // 3%
  const [uiOdcEscalation, setUiOdcEscalation] = useState<number>(2);     // 2%
  const [uiShowEscalation, setUiShowEscalation] = useState<boolean>(true);
  const [uiProfitMargin, setUiProfitMargin] = useState<number>(8);       // 8%
  const [uiBillableHours, setUiBillableHours] = useState<number>(1920);

  // ==================== COMPANY POLICY ====================
  const [companyPolicy, setCompanyPolicy] = useState<CompanyPolicy>({
    standardHours: 2080,
    ptoHours: 144,
    holidayHours: 88,
    sickHours: 40,
    targetBillableHours: 1920,
    overtimeMultiplier: 1.5,
  });

  // ==================== CONTRACT CONFIG ====================
  const [contractType, setContractType] = useState<ContractType>('tm');

  // ==================== COMPANY ROLE LIBRARY (with localStorage) ====================
  const [companyRoles, setCompanyRoles] = useState<CompanyRole[]>(DEFAULT_COMPANY_ROLES);
  const [isHydrated, setIsHydrated] = useState(false);
  const [companyRolesSaveStatus, setCompanyRolesSaveStatus] = useState<SaveStatus>('idle');
  const saveStatusTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = React.useRef(true);

  // Load company roles from API (with localStorage fallback)
  useEffect(() => {
    async function loadCompanyRoles() {
      if (typeof window === 'undefined') return;

      try {
        // Try API first
        const response = await rolesApi.list() as { roles: CompanyRole[] };
        if (response.roles && response.roles.length > 0) {
          setCompanyRoles(response.roles);
          // Cache to localStorage
          localStorage.setItem(STORAGE_KEYS.COMPANY_ROLES, JSON.stringify(response.roles));
        } else {
          // No roles in API, try localStorage
          const stored = localStorage.getItem(STORAGE_KEYS.COMPANY_ROLES);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCompanyRoles(parsed);
            }
          }
        }
      } catch (e) {
        // API failed, fallback to localStorage
        console.warn('Failed to load company roles from API, using localStorage:', e);
        try {
          const stored = localStorage.getItem(STORAGE_KEYS.COMPANY_ROLES);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCompanyRoles(parsed);
            }
          }
        } catch (localErr) {
          console.warn('Failed to load company roles from localStorage:', localErr);
        }
      }
      setIsHydrated(true);
    }

    loadCompanyRoles();
  }, []);

  // Persist companyRoles to localStorage whenever it changes (skip initial mount)
  useEffect(() => {
    if (typeof window !== 'undefined' && isHydrated) {
      // Skip the first render after hydration to avoid overwriting with same data
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      
      // Clear any pending timeout
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
      
      setCompanyRolesSaveStatus('saving');
      
      try {
        localStorage.setItem(STORAGE_KEYS.COMPANY_ROLES, JSON.stringify(companyRoles));
        setCompanyRolesSaveStatus('saved');
        
        // Reset to idle after 2 seconds
        saveStatusTimeoutRef.current = setTimeout(() => {
          setCompanyRolesSaveStatus('idle');
        }, 2000);
      } catch (e) {
        console.warn('Failed to save company roles to localStorage:', e);
        setCompanyRolesSaveStatus('idle');
      }
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, [companyRoles, isHydrated]);

  // ==================== BID-SPECIFIC DATA ====================
  const [recommendedRoles, setRecommendedRoles] = useState<Role[]>([]);
  const [extractedRequirements, setExtractedRequirements] = useState<ExtractedRequirement[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([])
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [teamingPartners, setTeamingPartners] = useState<TeamingPartner[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [outline, setOutline] = useState<ProposalOutline | null>(null);
  const [sectionContent, setSectionContent] = useState<Record<string, SectionContent>>({});
  const [odcs, setODCs] = useState<ODCItem[]>([]);
  const [perDiem, setPerDiem] = useState<PerDiemCalculation[]>([]);
  const [gsaContractInfo, setGSAContractInfo] = useState<GSAContractInfo | null>(null);
  
  // ==================== SHARED WBS ELEMENTS (Estimate ↔ Roles & Pricing) ====================
  // This state is shared between the Estimate tab and Roles & Pricing tab
  // The Estimate tab writes to it, and the Roles & Pricing tab reads from it
  const [estimateWbsElements, setEstimateWbsElements] = useState<EstimateWBSElement[]>([]);
  
  // ==================== RATE JUSTIFICATIONS (Persist across tab switches) ====================
  const [rateJustifications, setRateJustifications] = useState<Record<string, RoleJustification>>({});
  
  const updateRateJustification = (roleId: string, justification: RoleJustification) => {
    setRateJustifications(prev => ({
      ...prev,
      [roleId]: justification
    }));
  };
  
  const removeRateJustification = (roleId: string) => {
    setRateJustifications(prev => {
      const updated = { ...prev };
      delete updated[roleId];
      return updated;
    });
  };

  // ==================== SCOPING DATA (Legacy - kept for backward compatibility) ====================
  const [scopingData, setScopingData] = useState<ScopingData>(defaultScopingData);

  // Epic management (Legacy)
  const addEpic = (epic: ScopingEpic) => {
    setScopingData(prev => ({
      ...prev,
      epics: [...prev.epics, epic]
    }));
  };

  const updateEpic = (id: string, updates: Partial<ScopingEpic>) => {
    setScopingData(prev => ({
      ...prev,
      epics: prev.epics.map(e => e.id === id ? { ...e, ...updates } : e)
    }));
  };

  const removeEpic = (id: string) => {
    setScopingData(prev => ({
      ...prev,
      epics: prev.epics.filter(e => e.id !== id)
    }));
  };

  // Risk management (Legacy)
  const addScopingRisk = (risk: ScopingRisk) => {
    setScopingData(prev => ({
      ...prev,
      risks: [...prev.risks, risk]
    }));
  };

  const updateScopingRisk = (id: string, updates: Partial<ScopingRisk>) => {
    setScopingData(prev => ({
      ...prev,
      risks: prev.risks.map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  };

  const removeScopingRisk = (id: string) => {
    setScopingData(prev => ({
      ...prev,
      risks: prev.risks.filter(r => r.id !== id)
    }));
  };

  // Technical decision management (Legacy)
  const addTechnicalDecision = (decision: TechnicalDecision) => {
    setScopingData(prev => ({
      ...prev,
      technicalDecisions: [...prev.technicalDecisions, decision]
    }));
  };

  const updateTechnicalDecision = (id: string, updates: Partial<TechnicalDecision>) => {
    setScopingData(prev => ({
      ...prev,
      technicalDecisions: prev.technicalDecisions.map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  };

  const removeTechnicalDecision = (id: string) => {
    setScopingData(prev => ({
      ...prev,
      technicalDecisions: prev.technicalDecisions.filter(d => d.id !== id)
    }));
  };

  // BD Assumption management (Legacy)
  const addBDAssumption = (assumption: BDAssumption) => {
    setScopingData(prev => ({
      ...prev,
      assumptions: [...prev.assumptions, assumption]
    }));
  };

  const updateBDAssumption = (id: string, updates: Partial<BDAssumption>) => {
    setScopingData(prev => ({
      ...prev,
      assumptions: prev.assumptions.map(a => a.id === id ? { ...a, ...updates } : a)
    }));
  };

  const removeBDAssumption = (id: string) => {
    setScopingData(prev => ({
      ...prev,
      assumptions: prev.assumptions.filter(a => a.id !== id)
    }));
  };

  // Scoping calculations (Legacy)
  const getTotalScopingHours = (): number => {
    return scopingData.epics.reduce((total, epic) => {
      const epicHours = epic.hoursBreakdown.reduce((sum, hb) => sum + hb.hours, 0);
      return total + epicHours;
    }, 0);
  };

  const getTotalStoryPoints = (): number => {
    return scopingData.epics.reduce((total, epic) => total + epic.storyPoints, 0);
  };

  const getHoursByRole = (): Record<string, number> => {
    const hoursByRole: Record<string, number> = {};
    scopingData.epics.forEach(epic => {
      epic.hoursBreakdown.forEach(hb => {
        if (!hoursByRole[hb.roleName]) {
          hoursByRole[hb.roleName] = 0;
        }
        hoursByRole[hb.roleName] += hb.hours;
      });
    });
    return hoursByRole;
  };

  // ==================== ESTIMATE DATA (NEW - BOE Support) ====================
  const [estimateData, setEstimateData] = useState<EstimateData>(emptyEstimateData);

  // WBS Element management
  const addWBSElement = (element: WBSElement) => {
    const quality = calculateWBSQuality(element);
    const elementWithQuality: WBSElement = {
      ...element,
      qualityGrade: quality.grade,
      qualityIssues: quality.issues,
      isComplete: quality.issues.length === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEstimateData(prev => ({
      ...prev,
      wbsElements: [...prev.wbsElements, elementWithQuality],
      lastUpdated: new Date().toISOString()
    }));
  };

  const updateWBSElement = (id: string, updates: Partial<WBSElement>) => {
    setEstimateData(prev => ({
      ...prev,
      wbsElements: prev.wbsElements.map(el => {
        if (el.id !== id) return el;
        const updated: WBSElement = { ...el, ...updates, updatedAt: new Date().toISOString() };
        const quality = calculateWBSQuality(updated);
        return {
          ...updated,
          qualityGrade: quality.grade,
          qualityIssues: quality.issues,
          isComplete: quality.issues.length === 0
        };
      }),
      lastUpdated: new Date().toISOString()
    }));
  };

  const removeWBSElement = (id: string) => {
    setEstimateData(prev => ({
      ...prev,
      wbsElements: prev.wbsElements.filter(el => el.id !== id),
      lastUpdated: new Date().toISOString()
    }));
  };

  // Estimate calculations
  const getEstimateTotalHours = (): number => {
    return estimateData.wbsElements.reduce((total, el) => total + el.totalHours, 0);
  };

  const getEstimateHoursByRole = (): Record<string, number> => {
    const hoursByRole: Record<string, number> = {};
    estimateData.wbsElements.forEach(el => {
      el.laborEstimates.forEach(labor => {
        if (!hoursByRole[labor.roleName]) {
          hoursByRole[labor.roleName] = 0;
        }
        hoursByRole[labor.roleName] += labor.calculatedHours;
      });
    });
    return hoursByRole;
  };

  const getEstimateReadiness = (): { score: number; complete: number; total: number } => {
    const total = estimateData.wbsElements.length;
    const complete = estimateData.wbsElements.filter(
      el => el.qualityGrade === 'green' || el.qualityGrade === 'blue'
    ).length;
    const score = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { score, complete, total };
  };

  // ==================== CALCULATION FUNCTIONS ====================
  // All pricing calculations now use the centralized pricing engine (lib/pricing)

  /**
   * Calculate fully burdened rate using the centralized pricing engine.
   *
   * @param baseSalary - Annual salary
   * @param includeProfit - Whether to include profit margin
   * @param profitOverride - Optional profit rate override (as decimal, e.g., 0.10)
   * @returns Hourly rate
   */
  const calculateFullyBurdenedRate = (
    baseSalary: number,
    includeProfit: boolean = true,
    profitOverride?: number
  ): number => {
    let profit = 0;
    if (includeProfit) {
      const resolved = resolveProfitRateWithFallback({
        explicitProfitRate: profitOverride,
        contractType: contractType as PricingContractType,
        profitTargets: {
          tm: profitTargets.tmDefault,
          ffp: profitTargets.ffpLowRisk,
          gsa: profitTargets.gsaDefault,
        },
      }, profitTargets.tmDefault);
      profit = resolved.profitRate;
    }
    const breakdown = pricingEngineRate({
      annualSalary: baseSalary,
      rates: {
        fringe: indirectRates.fringe,
        overhead: indirectRates.overhead,
        ga: indirectRates.ga,
      },
      profitRate: profit,
      standardHours: companyPolicy.standardHours,
    });
    return includeProfit ? breakdown.fullyBurdenedRate : breakdown.costBeforeProfit;
  };

  const calculateLoadedCost = (baseSalary: number): number => {
    return calculateFullyBurdenedRate(baseSalary, false);
  };

  /**
   * Calculate loaded rate using uiProfitMargin (from UI slider).
   * Used by Rate Justification tab.
   * Note: uiProfitMargin is passed as explicit rate to the resolver.
   */
  const calculateLoadedRate = (baseSalary: number): number => {
    const resolved = resolveProfitRateWithFallback({
      explicitProfitRate: uiProfitMargin / 100,
      contractType: contractType as PricingContractType,
      profitTargets: {
        tm: profitTargets.tmDefault,
        ffp: profitTargets.ffpLowRisk,
        gsa: profitTargets.gsaDefault,
      },
    }, profitTargets.tmDefault);
    return calculateFullyBurdenedRate(baseSalary, true, resolved.profitRate);
  };

  /**
   * Calculate escalated rate using the pricing engine.
   */
  const calculateEscalatedRate = (baseRate: number, year: number): number => {
    const result = pricingEngineEscalation({
      baseRate,
      year,
      escalationRate: escalationRates.laborDefault,
    });
    return result.escalatedRate;
  };

  /**
   * Get full rate breakdown using the pricing engine.
   *
   * @param baseSalary - Annual salary
   * @param includeProfit - Whether to include profit
   * @param profitOverride - Optional profit rate override (as decimal)
   * @returns Rate breakdown object
   */
  const getRateBreakdown = (baseSalary: number, includeProfit: boolean = true, profitOverride?: number) => {
    let profit = 0;
    if (includeProfit) {
      const resolved = resolveProfitRateWithFallback({
        explicitProfitRate: profitOverride,
        contractType: contractType as PricingContractType,
        profitTargets: {
          tm: profitTargets.tmDefault,
          ffp: profitTargets.ffpLowRisk,
          gsa: profitTargets.gsaDefault,
        },
      }, profitTargets.tmDefault);
      profit = resolved.profitRate;
    }
    const breakdown = pricingEngineRate({
      annualSalary: baseSalary,
      rates: {
        fringe: indirectRates.fringe,
        overhead: indirectRates.overhead,
        ga: indirectRates.ga,
      },
      profitRate: profit,
      standardHours: companyPolicy.standardHours,
    });

    // Map to existing interface for backwards compatibility
    return {
      baseRate: breakdown.baseHourly,
      fringeAmount: breakdown.fringeAmount,
      afterFringe: breakdown.afterFringe,
      overheadAmount: breakdown.overheadAmount,
      afterOverhead: breakdown.afterOverhead,
      gaAmount: breakdown.gaAmount,
      afterGA: breakdown.costBeforeProfit,
      profitAmount: breakdown.profitAmount,
      fullyBurdenedRate: breakdown.fullyBurdenedRate,
    };
  };

  const calculateYearSalaries = (
    role: CompanyRole,
    levelIndex: number,
    startingStepIndex: number,
    contractYears: number
  ): number[] => {
    const level = role.levels[levelIndex];
    if (!level) return [];
    
    const salaries: number[] = [];
    let currentStepIndex = startingStepIndex;
    let monthsInCurrentStep = 0;
    
    for (let year = 0; year < contractYears; year++) {
      const currentStep = level.steps[currentStepIndex];
      if (!currentStep) {
        salaries.push(level.steps[level.steps.length - 1].salary);
        continue;
      }
      
      salaries.push(currentStep.salary);
      
      monthsInCurrentStep += 12;
      
      if (currentStep.monthsToNextStep !== null && 
          monthsInCurrentStep >= currentStep.monthsToNextStep &&
          currentStepIndex < level.steps.length - 1) {
        currentStepIndex++;
        monthsInCurrentStep = monthsInCurrentStep - currentStep.monthsToNextStep;
      }
    }
    
    return salaries;
  };

  // ==================== DERIVED VALUES FROM SOLICITATION ====================

  const getTotalContractYears = (): number => {
    const baseYears = solicitation.periodOfPerformance.baseYear ? 1 : 0;
    return baseYears + solicitation.periodOfPerformance.optionYears;
  };

const getContractYearsArray = (): { key: string; label: string; enabled: boolean }[] => {
    const years: { key: string; label: string; enabled: boolean }[] = [];
    
    if (solicitation.periodOfPerformance.baseYear) {
      years.push({ key: 'base', label: 'Base Year', enabled: true });
    }
    
    for (let i = 1; i <= solicitation.periodOfPerformance.optionYears; i++) {
      years.push({ 
        key: `option${i}`, 
        label: `Option Year ${i}`, 
        enabled: true 
      });
    }
    
    return years;
  };

 // Get IC level salaries from company roles (for Roles & Pricing tab)
  const getIcLevelSalaries = (): Record<string, number> => {
    // Default salaries if no company roles exist
    const defaults: Record<string, number> = {
      IC1: 55000,
      IC2: 75000,
      IC3: 95000,
      IC4: 120000,
      IC5: 150000,
      IC6: 180000,
    };

    // If no company roles, return defaults
    if (companyRoles.length === 0) return defaults;

    // Build salary map ONLY from company roles (no defaults mixed in)
    const salaries: Record<string, number> = {};
    
    companyRoles.forEach(role => {
      role.levels.forEach(level => {
        if (level.steps.length > 0 && level.steps[0].salary) {
          // Only add if not already set (first role's value wins)
          if (!(level.level in salaries)) {
            salaries[level.level] = level.steps[0].salary;
          }
        }
      });
    });

    // If somehow no levels were found, return defaults
    return Object.keys(salaries).length > 0 ? salaries : defaults;
  };
  

  // ==================== ROLE MANAGEMENT ====================

  const addCompanyRole = async (role: CompanyRole) => {
    // Optimistic update - add to state immediately
    setCompanyRoles(prev => [...prev, role]);

    // Persist to API
    try {
      const response = await rolesApi.create(role as unknown as Record<string, unknown>) as { role: CompanyRole };
      // Update the role with the server-generated ID
      if (response.role?.id && response.role.id !== role.id) {
        setCompanyRoles(prev => prev.map(r => r.id === role.id ? { ...r, id: response.role.id } : r));
      }
    } catch (e) {
      console.error('Failed to create role in API:', e);
      // Rollback: remove the optimistically added role
      setCompanyRoles(prev => prev.filter(r => r.id !== role.id));
    }
  };

  const updateCompanyRole = async (id: string, updates: Partial<CompanyRole>) => {
    // Capture previous state for rollback
    const previousRole = companyRoles.find(r => r.id === id);

    // Optimistic update
    setCompanyRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

    // Persist to API
    try {
      const updatedRole = companyRoles.find(r => r.id === id);
      if (updatedRole) {
        await rolesApi.update({ ...updatedRole, ...updates, id } as unknown as Record<string, unknown>);
      }
    } catch (e) {
      console.error('Failed to update role in API:', e);
      // Rollback: restore previous state
      if (previousRole) {
        setCompanyRoles(prev => prev.map(r => r.id === id ? previousRole : r));
      }
    }
  };

  const removeCompanyRole = async (id: string) => {
    // Capture previous state for rollback
    const previousRole = companyRoles.find(r => r.id === id);
    const previousIndex = companyRoles.findIndex(r => r.id === id);

    // Optimistic update
    setCompanyRoles(prev => prev.filter(r => r.id !== id));

    // Persist to API
    try {
      await rolesApi.delete(id);
    } catch (e) {
      console.error('Failed to delete role from API:', e);
      // Rollback: restore the deleted role at its original position
      if (previousRole) {
        setCompanyRoles(prev => {
          const newRoles = [...prev];
          newRoles.splice(previousIndex, 0, previousRole);
          return newRoles;
        });
      }
    }
  };

  const addRole = (role: Role) => {
    console.trace('🔴 addRole called with:', role.name) 
    setSelectedRoles([...selectedRoles, role]);
  };

  const removeRole = (id: string) => {
    setSelectedRoles(prev => prev.filter(r => r.id !== id));
    // Also remove any justification for this role
    removeRateJustification(id);
  };

  const updateRole = (id: string, updates: Partial<Role>) => {
    setSelectedRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // ==================== SUBCONTRACTOR MANAGEMENT ====================

  const addSubcontractor = (sub: Subcontractor) => {
    // Auto-create or link to teaming partner
    if (sub.companyName && !sub.partnerId) {
      const partner = getOrCreatePartnerByName(sub.companyName);
      sub.partnerId = partner.id;
    }
    setSubcontractors([...subcontractors, sub]);
  };

  const removeSubcontractor = (id: string) => {
    setSubcontractors(subcontractors.filter(s => s.id !== id));
    // Also remove any justification for this subcontractor
    removeRateJustification(id);
  };

  const updateSubcontractor = (id: string, updates: Partial<Subcontractor>) => {
    setSubcontractors(subcontractors.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // ==================== TEAMING PARTNER MANAGEMENT ====================

  const addTeamingPartner = (partner: TeamingPartner) => {
    setTeamingPartners([...teamingPartners, partner]);
  };

  const removeTeamingPartner = (id: string) => {
    // Also unlink any subcontractors that reference this partner
    setSubcontractors(subcontractors.map(s => 
      s.partnerId === id ? { ...s, partnerId: undefined } : s
    ));
    setTeamingPartners(teamingPartners.filter(p => p.id !== id));
  };

  const updateTeamingPartner = (id: string, updates: Partial<TeamingPartner>) => {
    setTeamingPartners(teamingPartners.map(p => 
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ));
  };

  const getOrCreatePartnerByName = (companyName: string): TeamingPartner => {
    // Check if partner already exists (case-insensitive)
    const existing = teamingPartners.find(
      p => p.companyName.toLowerCase() === companyName.toLowerCase()
    );
    if (existing) return existing;

    // Create a new shell partner
    const newPartner: TeamingPartner = {
      id: `partner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      companyName,
      businessSize: '',
      certifications: {
        sb: false,
        wosb: false,
        sdvosb: false,
        hubzone: false,
        eightA: false,
      },
      teamingAgreementStatus: 'none',
      ndaStatus: 'none',
      rateSource: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Add to state
    setTeamingPartners(prev => [...prev, newPartner]);
    return newPartner;
  };

  const getPartnerById = (id: string): TeamingPartner | undefined => {
    return teamingPartners.find(p => p.id === id);
  };

  const getSubcontractorsByPartnerId = (partnerId: string): Subcontractor[] => {
    return subcontractors.filter(s => s.partnerId === partnerId);
  };

  // ==================== ODC MANAGEMENT ====================

  const addODC = (odc: ODCItem) => {
    setODCs([...odcs, odc]);
  };

  const removeODC = (id: string) => {
    setODCs(odcs.filter(o => o.id !== id));
  };

  const updateODC = (id: string, updates: Partial<ODCItem>) => {
    setODCs(odcs.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  // ==================== PER DIEM MANAGEMENT ====================

  const addPerDiem = (pd: PerDiemCalculation) => {
    setPerDiem([...perDiem, pd]);
  };

  const removePerDiem = (id: string) => {
    setPerDiem(perDiem.filter(p => p.id !== id));
  };

  const updatePerDiem = (id: string, updates: Partial<PerDiemCalculation>) => {
    setPerDiem(perDiem.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // ==================== LEGACY COMPATIBILITY ====================

  const costMultipliers = {
    fringe: indirectRates.fringe,
    overhead: indirectRates.overhead,
    ga: indirectRates.ga,
  };

  const setCostMultipliers = (multipliers: { fringe: number; overhead: number; ga: number }) => {
    setIndirectRates({
      ...indirectRates,
      fringe: multipliers.fringe,
      overhead: multipliers.overhead,
      ga: multipliers.ga,
    });
  };

  const profitMargin = profitTargets.tmDefault * 100;
  const setProfitMargin = (margin: number) => {
    setProfitTargets({
      ...profitTargets,
      tmDefault: margin / 100,
    });
  };

  const annualEscalation = escalationRates.laborDefault * 100;
  const setAnnualEscalation = (rate: number) => {
    setEscalationRates({
      ...escalationRates,
      laborDefault: rate / 100,
    });
  };
// ==================== VERSION HISTORY FUNCTIONS ====================
  
  const saveProjectVersion = (name: string, notes?: string): ProjectVersion => {
    const snapshot: ProjectSnapshot = {
      solicitation,
      estimateWbsElements,
      selectedRoles,
      subcontractors,
      teamingPartners,
      rateJustifications,
      odcs,
      perDiem,
    };
    
    const newVersion: ProjectVersion = {
      id: `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      notes,
      snapshot,
      createdAt: new Date().toISOString(),
    };
    
    setProjectVersions(prev => [newVersion, ...prev]);
    return newVersion;
  };
  
  const restoreProjectVersion = (versionId: string) => {
    const version = projectVersions.find(v => v.id === versionId);
    if (!version) return;
    
    const { snapshot } = version;
    
    // Restore all state from snapshot
    setSolicitation(snapshot.solicitation);
    setEstimateWbsElements(snapshot.estimateWbsElements);
    setSelectedRoles(snapshot.selectedRoles);
    setSubcontractors(snapshot.subcontractors);
    setTeamingPartners(snapshot.teamingPartners);
    setRateJustifications(snapshot.rateJustifications);
    setODCs(snapshot.odcs);
    setPerDiem(snapshot.perDiem);
  };
  
  const deleteProjectVersion = (versionId: string) => {
    setProjectVersions(prev => prev.filter(v => v.id !== versionId));
  };
  // ==================== CONTEXT VALUE ====================

  const value: AppContextType = {
    // Main Tab Navigation
    activeMainTab,
    setActiveMainTab,
    navigateToRateJustification,
    selectedRoleIdForJustification,
    clearSelectedRoleForJustification,
    
    // Utility Tool State
    activeUtilityTool,
    setActiveUtilityTool,
    
    // Project Version History
    projectVersions,
    saveProjectVersion,
    restoreProjectVersion,
    deleteProjectVersion,
    
    // Solicitation
    solicitation,
    setSolicitation,
    updateSolicitation,
    resetSolicitation,
    
    // Solicitation Editor Slideout Control
    isSolicitationEditorOpen,
    openSolicitationEditor,
    closeSolicitationEditor,
    getPricingSettings,

    // Proposal Setup
    proposalSetup,
    setProposalSetup,

    // Company Settings
    companySettings,
    setCompanySettings,
    updateCompanySettings,
    
    // Company Profile
    companyProfile,
    setCompanyProfile,
    saveCompanyProfile,

    // Indirect Rates
    indirectRates,
    setIndirectRates,
    
    // Profit Targets
    profitTargets,
    setProfitTargets,
    
    // Escalation
    escalationRates,
    setEscalationRates,
    
    // UI-specific settings (persist across tab switches)
    uiLaborEscalation,
    uiOdcEscalation,
    uiShowEscalation,
    setUiLaborEscalation,
    setUiOdcEscalation,
    setUiShowEscalation,
    uiProfitMargin,
    setUiProfitMargin,
    uiBillableHours,
    setUiBillableHours,
    
    // Company Policy
    companyPolicy,
    setCompanyPolicy,
    
    // Contract Config
    contractType,
    setContractType,
    
    // Company Roles
    companyRoles,
    setCompanyRoles,
    addCompanyRole,
    updateCompanyRole,
    removeCompanyRole,
    companyRolesSaveStatus,
    
    // Bid Roles
    recommendedRoles,
    setRecommendedRoles,
    // Extracted Requirements
    extractedRequirements,
    setExtractedRequirements,
    selectedRoles,
    setSelectedRoles,
    addRole,
    removeRole,
    updateRole,
    
    // Subcontractors
    subcontractors,
    setSubcontractors,
    addSubcontractor,
    removeSubcontractor,
    updateSubcontractor,
    
    // Teaming Partners
    teamingPartners,
    setTeamingPartners,
    addTeamingPartner,
    removeTeamingPartner,
    updateTeamingPartner,
    getOrCreatePartnerByName,
    getPartnerById,
    getSubcontractorsByPartnerId,

    // Team Members
    teamMembers,
    setTeamMembers,

    // Directors
    directors,
    setDirectors,

    // Outline
    outline,
    setOutline,

    // Section Content
    sectionContent,
    setSectionContent,

    // Rate Justifications
    rateJustifications,
    setRateJustifications,
    updateRateJustification,
    removeRateJustification,
    
    // Scoping Data (Legacy)
    scopingData,
    setScopingData,
    addEpic,
    updateEpic,
    removeEpic,
    addScopingRisk,
    updateScopingRisk,
    removeScopingRisk,
    addTechnicalDecision,
    updateTechnicalDecision,
    removeTechnicalDecision,
    addBDAssumption,
    updateBDAssumption,
    removeBDAssumption,
    getTotalScopingHours,
    getTotalStoryPoints,
    getHoursByRole,
    
    // Estimate Data (NEW)
    estimateData,
    setEstimateData,
    addWBSElement,
    updateWBSElement,
    removeWBSElement,
    getEstimateTotalHours,
    getEstimateHoursByRole,
    getEstimateReadiness,
    
    // Shared WBS Elements (Estimate ↔ Roles & Pricing)
    estimateWbsElements,
    setEstimateWbsElements,
    
    // ODCs
    odcs,
    setODCs,
    addODC,
    removeODC,
    updateODC,
    
    // Per Diem
    perDiem,
    setPerDiem,
    addPerDiem,
    removePerDiem,
    updatePerDiem,
    
    // GSA
    gsaContractInfo,
    setGSAContractInfo,
    
    // Calculations (Audit-Ready)
    calculateFullyBurdenedRate,
    calculateLoadedCost,
    calculateLoadedRate,
    calculateEscalatedRate,
    getRateBreakdown,
    calculateYearSalaries,
    
    // Derived values
    getTotalContractYears,
    getContractYearsArray,
    getIcLevelSalaries,
    
    // Legacy compatibility
    costMultipliers,
    setCostMultipliers,
    profitMargin,
    setProfitMargin,
    annualEscalation,
    setAnnualEscalation,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ==================== HOOK ====================

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}