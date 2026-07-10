// @ts-nocheck
'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import {
  generateExport,
  downloadBlob,
  uploadToGoogleDrive,
  type ExportData,
  type ExportOptions,
  type WBSElement
} from '@/lib/export-utils'
import {
  resolveProfitRateWithFallback,
  type ContractType as PricingContractType,
} from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileSpreadsheet,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calculator,
  Users,
  Shield,
  X,
  FileType,
  ListTree,
  Settings,
  Eye,
  AlertTriangle,
  ArrowRight,
  Lock,
  Unlock,
  BookOpen
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface ExportSection {
  id: 'rateCard' | 'boe' | 'lcats' | 'audit'
  title: string
  description: string
  icon: React.ElementType
  included: boolean
  badge?: string
  badgeVariant?: 'default' | 'secondary' | 'outline'
}

interface ExportConfig {
  solicitation: string
  client: string
  proposalTitle: string
  preparedBy: string
  preparedDate: string
  includeEscalation: boolean
  format: 'xlsx' | 'pdf' | 'docx'
}

type ExportStatus = 'idle' | 'generating' | 'success' | 'error'

// ============================================================================
// CONSTANTS
// ============================================================================

const FORMAT_OPTIONS = [
  { value: 'docx', label: 'Word', icon: FileText },
  { value: 'pdf', label: 'PDF', icon: FileType },
  { value: 'xlsx', label: 'CSV', icon: FileSpreadsheet },
] as const

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Find matching company role with improved matching logic
 * Priority: 1) companyRoleId, 2) exact title, 3) laborCategory, 4) fuzzy match
 */
const findMatchingCompanyRole = (
  role: { 
    companyRoleId?: string
    name?: string
    title?: string
    icLevel?: string
    laborCategory?: string 
  },
  companyRoles: any[]
): any | null => {
  if (!companyRoles || companyRoles.length === 0) return null

  const roleName = (role.title || role.name || '').toLowerCase().trim()
  const roleLaborCat = (role.laborCategory || '').toLowerCase().trim()

  // 1. Match by companyRoleId (most reliable)
  if (role.companyRoleId) {
    const match = companyRoles.find(cr => cr.id === role.companyRoleId)
    if (match) return match
  }

  // 2. Exact title match
  const exactMatch = companyRoles.find(cr => 
    cr.title.toLowerCase().trim() === roleName
  )
  if (exactMatch) return exactMatch

  // 3. Match by labor category
  if (roleLaborCat) {
    const laborCatMatch = companyRoles.find(cr =>
      (cr.laborCategory || '').toLowerCase().trim() === roleLaborCat
    )
    if (laborCatMatch) return laborCatMatch
  }

  // 4. Fuzzy match - title contains or is contained by
  const fuzzyMatch = companyRoles.find(cr => {
    const crTitle = cr.title.toLowerCase().trim()
    return (
      crTitle.includes(roleName) ||
      roleName.includes(crTitle) ||
      // Also check words overlap (e.g., "Senior Software Engineer" matches "Software Engineer")
      roleName.split(' ').filter(w => w.length > 3).some(word => crTitle.includes(word))
    )
  })
  if (fuzzyMatch) return fuzzyMatch

  // 5. No match found
  return null
}

// ============================================================================
// MOCK WBS DATA
// ============================================================================

const MOCK_WBS_ELEMENTS: WBSElement[] = [
  {
    id: 'wbs-1',
    wbsNumber: '1.0',
    title: 'Program Management',
    description: 'Overall program management including sprint ceremonies, stakeholder coordination, and status reporting.',
    hours: 1920,
    laborBreakdown: [
      { roleId: 'dm', roleName: 'Delivery Manager', hours: 1200, rationale: 'Full-time PM across base + options' },
      { roleId: 'pm', roleName: 'Product Manager', hours: 720, rationale: 'Part-time coordination' }
    ],
    estimateMethod: 'historical',
    confidenceLevel: 'high',
    assumptions: ['26 two-week sprints per year', 'Weekly stakeholder meetings'],
    sooReference: 'Section 2.1'
  },
  {
    id: 'wbs-2',
    wbsNumber: '2.0',
    title: 'User Research & Design',
    description: 'User research, UX design, and accessibility compliance.',
    hours: 3840,
    laborBreakdown: [
      { roleId: 'dl', roleName: 'Design Lead', hours: 1920, rationale: 'Full-time design leadership' },
      { roleId: 'uxr', roleName: 'UX Researcher', hours: 1200, rationale: 'Usability testing' },
      { roleId: 'pd', roleName: 'Product Designer', hours: 720, rationale: 'Design support' }
    ],
    estimateMethod: 'expert',
    confidenceLevel: 'high',
    assumptions: ['Section 508 compliance required'],
    sooReference: 'Section 1.1'
  },
  {
    id: 'wbs-3',
    wbsNumber: '3.0',
    title: 'Development',
    description: 'Frontend and backend development.',
    hours: 7680,
    laborBreakdown: [
      { roleId: 'fe', roleName: 'Frontend Engineer', hours: 3840, rationale: 'UI development' },
      { roleId: 'be', roleName: 'Backend Engineer', hours: 3840, rationale: 'API development' }
    ],
    estimateMethod: 'engineering',
    confidenceLevel: 'medium',
    assumptions: ['React with TypeScript', 'Cloud-native architecture'],
    sooReference: 'Section 1.2'
  }
]

// ============================================================================
// SECTION CARD COMPONENT
// ============================================================================

interface SectionCardProps {
  section: ExportSection
  onToggle: () => void
  onClick: () => void
  isSelected: boolean
}

function SectionCard({ section, onToggle, onClick, isSelected }: SectionCardProps) {
  const Icon = section.icon
  
  return (
    <div 
      className={`group relative bg-white border rounded-lg transition-all cursor-pointer ${
        isSelected 
          ? 'border-blue-300 ring-2 ring-blue-100' 
          : section.included 
            ? 'border-blue-200 bg-blue-50/30 hover:border-blue-300' 
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Checkbox in corner */}
      <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox 
          checked={section.included} 
          onCheckedChange={onToggle}
          className="h-5 w-5"
        />
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${section.included ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm text-gray-900">{section.title}</h4>
              {section.badge && (
                <Badge 
                  variant={section.badgeVariant || 'secondary'} 
                  className="text-[10px] px-1.5 py-0"
                >
                  {section.badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{section.description}</p>
          </div>
        </div>
        
        {/* Click for details hint */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 group-hover:text-blue-500 transition-colors">
            Click for details & preview
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION SLIDEOUT COMPONENT
// ============================================================================

interface SectionSlideoutProps {
  section: ExportSection | null
  isOpen: boolean
  onClose: () => void
  config: ExportConfig
  onUpdateConfig: (updates: Partial<ExportConfig>) => void
  selectedRoles: any[]
  companyRoles: any[]
  wbsElements: WBSElement[]
  indirectRates: any
  escalationRates: any
  contractYears: number
  contractType: string
  calculateFullyBurdenedRate: (salary: number, includeProfit: boolean) => number
  calculateEscalatedRate: (rate: number, year: number) => number
}

function SectionSlideout({ 
  section, 
  isOpen, 
  onClose, 
  config,
  onUpdateConfig,
  selectedRoles,
  companyRoles,
  wbsElements,
  indirectRates,
  escalationRates,
  contractYears,
  contractType,
  calculateFullyBurdenedRate,
  calculateEscalatedRate
}: SectionSlideoutProps) {
  
  const wbsSummary = useMemo(() => {
    const totalHours = wbsElements.reduce((sum, el) => sum + ((el as any).totalHours || (el as any).hours || 0), 0)
    const confidenceCounts = wbsElements.reduce((acc, el) => {
      acc[(el as any).confidence || "medium"] = (acc[(el as any).confidence || "medium"] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return {
      totalElements: wbsElements.length,
      totalHours,
      highConfidencePercent: wbsElements.length > 0 ? ((confidenceCounts.high || 0) / wbsElements.length) * 100 : 0
    }
  }, [wbsElements])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !section) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div 
        className="fixed inset-y-0 right-0 w-[750px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${section.included ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                <section.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                <p className="text-sm text-gray-500">{section.description}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {section.id === 'rateCard' && (
            <div className="space-y-6">
              {/* Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">Options</h4>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Checkbox 
                    id="escalation" 
                    checked={config.includeEscalation} 
                    onCheckedChange={(checked) => onUpdateConfig({ includeEscalation: checked as boolean })} 
                  />
                  <div>
                    <Label htmlFor="escalation" className="text-sm font-medium text-gray-900 cursor-pointer">
                      Apply annual escalation
                    </Label>
                    <p className="text-xs text-gray-500">
                      {(escalationRates.laborDefault * 100).toFixed(1)}% per year for option years
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Preview</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left p-3 text-xs font-medium text-gray-500">Labor Category</th>
                        <th className="text-center p-3 text-xs font-medium text-gray-500">Level</th>
                        <th className="text-right p-3 text-xs font-medium text-gray-500">Base Year</th>
                        {contractYears >= 2 && <th className="text-right p-3 text-xs font-medium text-gray-500">Opt 1</th>}
                        {contractYears >= 3 && <th className="text-right p-3 text-xs font-medium text-gray-500">Opt 2</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRoles.map((role, idx) => {
                        const baseRate = calculateFullyBurdenedRate(role.baseSalary, (contractType as string) !== 'ffp')
                        return (
                          <tr key={role.id} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                            <td className="p-3 text-gray-900">{role.title || role.name}</td>
                            <td className="p-3 text-center">
                              <Badge variant="outline" className="text-xs">{role.icLevel}</Badge>
                            </td>
                            <td className="p-3 text-right font-mono text-gray-900">{formatCurrency(baseRate)}</td>
                            {contractYears >= 2 && (
                              <td className="p-3 text-right font-mono text-gray-900">
                                {formatCurrency(config.includeEscalation ? calculateEscalatedRate(baseRate, 2) : baseRate)}
                              </td>
                            )}
                            {contractYears >= 3 && (
                              <td className="p-3 text-right font-mono text-gray-900">
                                {formatCurrency(config.includeEscalation ? calculateEscalatedRate(baseRate, 3) : baseRate)}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500">
                  Fringe {(indirectRates.fringe * 100).toFixed(1)}% · OH {(indirectRates.overhead * 100).toFixed(1)}% · G&A {(indirectRates.ga * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {section.id === 'boe' && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-semibold text-gray-900">{wbsSummary.totalElements}</p>
                  <p className="text-xs text-gray-500">WBS Elements</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-semibold text-gray-900">{wbsSummary.totalHours.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total Hours</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-semibold text-gray-900">{Math.round(wbsSummary.highConfidencePercent)}%</p>
                  <p className="text-xs text-gray-500">High Confidence</p>
                </div>
              </div>

              {/* WBS List */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">WBS Elements</h4>
                <div className="space-y-3">
                  {wbsElements.map((element) => (
                    <div key={element.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs font-mono text-gray-500">{element.wbsNumber}</span>
                          <h5 className="font-medium text-gray-900">{element.title}</h5>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{element.estimateMethod}</Badge>
                          <Badge 
                            variant={((element as any).confidence || (element as any).confidenceLevel || "medium") === 'high' ? 'default' : 'secondary'} 
                            className="text-[10px]"
                          >
                            {(element as any).confidence || (element as any).confidenceLevel || "medium"}
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-500 mb-3">{(element as any).description || (element as any).what || ""}</p>
                      
                      {/* Total Hours */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm">
                          <strong className="text-gray-900">{element.hours.toLocaleString()}</strong>
                          <span className="text-gray-500 ml-1">total hours</span>
                        </span>
                        {element.sooReference && (
                          <span className="text-xs text-gray-500 border-l border-gray-300 pl-3">
                            SOO: {element.sooReference}
                          </span>
                        )}
                      </div>

                      {/* Labor Breakdown */}
                      {element.laborBreakdown && element.laborBreakdown.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Labor Allocation
                          </p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[10px] font-medium text-gray-500 border-b border-gray-200">
                                <th className="text-left pb-1">Role</th>
                                <th className="text-right pb-1">Total</th>
                                <th className="text-right pb-1">Base</th>
                                {contractYears >= 2 && <th className="text-right pb-1">OY1</th>}
                                {contractYears >= 3 && <th className="text-right pb-1">OY2</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {element.laborBreakdown.map((labor, idx) => {
                                const hoursPerYear = Math.round(labor.hours / contractYears)
                                return (
                                  <tr key={idx}>
                                    <td className="py-1.5 font-medium text-gray-900">{labor.roleName}</td>
                                    <td className="py-1.5 text-right font-semibold text-gray-900">
                                      {labor.hours.toLocaleString()}
                                    </td>
                                    <td className="py-1.5 text-right text-gray-600 text-xs">
                                      {hoursPerYear.toLocaleString()}
                                    </td>
                                    {contractYears >= 2 && (
                                      <td className="py-1.5 text-right text-gray-600 text-xs">
                                        {hoursPerYear.toLocaleString()}
                                      </td>
                                    )}
                                    {contractYears >= 3 && (
                                      <td className="py-1.5 text-right text-gray-600 text-xs">
                                        {hoursPerYear.toLocaleString()}
                                      </td>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Assumptions */}
                      {element.assumptions && element.assumptions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Assumptions
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {element.assumptions.map((assumption, idx) => (
                              <span 
                                key={idx} 
                                className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
                              >
                                {assumption}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section.id === 'lcats' && (
            <div className="space-y-6">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <CheckCircle2 className="w-4 h-4" />
                  Role definitions from Company Settings
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Labor Categories ({selectedRoles.length})</h4>
                <div className="space-y-3">
                  {selectedRoles.map((role) => {
                    // Use improved matching function
                    const companyRole = findMatchingCompanyRole(role, companyRoles)
                    
                    // Find level info
                    const levelInfo = companyRole?.levels?.find((l: any) => l.level === role.icLevel)
                    
                    // Mock data fallback based on role name
                    const mockDescriptions: Record<string, string> = {
                      'delivery manager': 'Oversees project delivery, manages client relationships, and ensures on-time execution of deliverables. Coordinates cross-functional teams and maintains project schedules.',
                      'product manager': 'Defines product vision and roadmap, prioritizes features based on user research and business value. Works closely with engineering and design teams.',
                      'product designer': 'Creates user-centered designs including wireframes, prototypes, and high-fidelity mockups. Conducts usability testing and ensures Section 508 compliance.',
                      'frontend engineer': 'Develops responsive web applications using modern JavaScript frameworks. Implements accessible UI components and optimizes performance.',
                      'backend engineer': 'Designs and implements scalable APIs and microservices. Manages database architecture and ensures system reliability.',
                      'design lead': 'Leads design strategy and mentors junior designers. Establishes design systems and ensures consistency across products.',
                      'ux researcher': 'Conducts user research including interviews, surveys, and usability testing. Synthesizes findings into actionable insights.',
                      'data engineer': 'Builds and maintains data pipelines and ETL processes. Ensures data quality and availability for analytics.',
                      'devops engineer': 'Manages CI/CD pipelines, infrastructure as code, and cloud environments. Ensures system security and reliability.',
                      'technical lead': 'Provides technical leadership and architectural guidance. Mentors engineers and ensures code quality standards.',
                    }
                    
                    const mockExperience: Record<string, string> = {
                      'IC3': '3-5 years',
                      'IC4': '5-8 years', 
                      'IC5': '8-12 years',
                      'IC6': '12+ years',
                    }
                    
                    const mockEducation: Record<string, string> = {
                      'delivery manager': "Bachelor's in Business, IT, or related field",
                      'product manager': "Bachelor's in Business, Computer Science, or related field",
                      'product designer': "Bachelor's in Design, HCI, or related field",
                      'frontend engineer': "Bachelor's in Computer Science or related field",
                      'backend engineer': "Bachelor's in Computer Science or related field",
                      'design lead': "Bachelor's in Design, HCI, or related field",
                      'ux researcher': "Master's in HCI, Psychology, or related field",
                      'data engineer': "Bachelor's in Computer Science, Data Science, or related field",
                      'devops engineer': "Bachelor's in Computer Science or related field",
                      'technical lead': "Bachelor's in Computer Science or related field",
                    }

                    const mockBLSCodes: Record<string, string> = {
                      'delivery manager': '11-3021',
                      'product manager': '11-3021',
                      'product designer': '15-1255',
                      'frontend engineer': '15-1252',
                      'backend engineer': '15-1252',
                      'design lead': '15-1255',
                      'ux researcher': '15-1255',
                      'data engineer': '15-1252',
                      'devops engineer': '15-1252',
                      'technical lead': '15-1252',
                    }
                    
                    const roleLower = (role.name || role.title || '').toLowerCase()
                    const description = companyRole?.description || mockDescriptions[roleLower] || 'Provides specialized expertise supporting federal government initiatives.'
                    const experience = levelInfo?.yearsExperience || mockExperience[role.icLevel] || '5+ years'
                    const education = levelInfo?.education || mockEducation[roleLower] || "Bachelor's degree in relevant field"
                    const blsCode = companyRole?.blsOccCode || mockBLSCodes[roleLower] || '15-1252'
                    
                    return (
                      <div key={role.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">{role.title || role.name}</h5>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{role.icLevel}</Badge>
                            {companyRole && (
                              <Badge variant="secondary" className="text-[10px]">
                                Matched
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Description */}
                        <p className="text-sm text-gray-700 mb-3">
                          {description}
                        </p>
                        
                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                              Experience Required
                            </p>
                            <p className="text-sm text-gray-900">{experience}</p>
                          </div>
                          
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                              Education
                            </p>
                            <p className="text-sm text-gray-900">{education}</p>
                          </div>
                          
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                              BLS Code
                            </p>
                            <p className="text-sm text-gray-900 font-mono">{blsCode}</p>
                          </div>
                          
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                              Level
                            </p>
                            <p className="text-sm text-gray-900">{levelInfo?.levelName || role.icLevel}</p>
                          </div>
                        </div>
                        
                        {/* Certifications if any */}
                        {levelInfo?.certifications && levelInfo.certifications.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                              Certifications
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {levelInfo.certifications.map((cert: string, idx: number) => (
                                <span 
                                  key={idx} 
                                  className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
                                >
                                  {cert}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {section.id === 'audit' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">What&apos;s Included</h4>
                <p className="text-xs text-blue-800">
                  The audit defense package provides detailed documentation to support your rates during government audits.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Package Contents</h4>
                <div className="space-y-2">
                  {[
                    { title: 'Rate Calculation Walkthrough', description: 'Step-by-step breakdown showing how each rate was calculated' },
                    { title: 'Indirect Rate Documentation', description: `FY${indirectRates.fiscalYear} rates with source documentation` },
                    { title: 'FAR 31.2 Compliance Matrix', description: 'Mapping of cost elements to FAR allowability criteria' },
                    { title: 'Salary Survey References', description: 'BLS and market data supporting base salary ranges' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}


function SettingsSlideout_REMOVED() {
  // Local state for editing
  const [localConfig, setLocalConfig] = useState({
    solicitation: config.solicitation,
    client: config.client,
    proposalTitle: config.proposalTitle,
    preparedBy: config.preparedBy,
    preparedDate: config.preparedDate,
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Reset local state when opening or config changes externally
  useEffect(() => {
    if (isOpen) {
      setLocalConfig({
        solicitation: config.solicitation,
        client: config.client,
        proposalTitle: config.proposalTitle,
        preparedBy: config.preparedBy,
        preparedDate: config.preparedDate,
      })
      setHasUnsavedChanges(false)
    }
  }, [isOpen, config.solicitation, config.client, config.proposalTitle, config.preparedBy, config.preparedDate])

  // Track changes
  useEffect(() => {
    const changed = 
      localConfig.solicitation !== config.solicitation ||
      localConfig.client !== config.client ||
      localConfig.proposalTitle !== config.proposalTitle ||
      localConfig.preparedBy !== config.preparedBy ||
      localConfig.preparedDate !== config.preparedDate
    setHasUnsavedChanges(changed)
  }, [localConfig, config])

  const handleSave = () => {
    onUpdateConfig(localConfig)
    setHasUnsavedChanges(false)
  }

  const updateLocal = (field: string, value: string) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div 
        className="fixed inset-y-0 right-0 w-[750px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Document Settings</h3>
                <p className="text-sm text-gray-500">Configure export metadata</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Unsaved changes banner */}
            {hasUnsavedChanges && (
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                  You have unsaved changes
                </div>
                <Button size="sm" onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            )}

            {solicitation?.solicitationNumber && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <CheckCircle2 className="w-4 h-4" />
                  Auto-filled from uploaded solicitation
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Solicitation Number</Label>
                <Input
                  placeholder="e.g., 47QTCA24R0001"
                  value={localConfig.solicitation}
                  onChange={(e) => updateLocal('solicitation', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Client / Agency</Label>
                <Input
                  placeholder="e.g., Department of Commerce"
                  value={localConfig.client}
                  onChange={(e) => updateLocal('client', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Proposal Title</Label>
                <Input
                  placeholder="e.g., IT Modernization Support"
                  value={localConfig.proposalTitle}
                  onChange={(e) => updateLocal('proposalTitle', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Prepared By</Label>
                  <Input
                    value={localConfig.preparedBy}
                    onChange={(e) => updateLocal('preparedBy', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date</Label>
                  <Input
                    type="date"
                    value={localConfig.preparedDate}
                    onChange={(e) => updateLocal('preparedDate', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Save button at bottom */}
            <div className="pt-4 border-t border-gray-200">
              <Button 
                onClick={handleSave} 
                disabled={!hasUnsavedChanges}
                className="w-full"
              >
                {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ExportTab() {
  const params = useParams()
  const proposalId = params?.id as string

  const {
    companyProfile,
    indirectRates,
    profitTargets,
    escalationRates,
    companyPolicy,
    selectedRoles,
    calculateFullyBurdenedRate,
    calculateEscalatedRate,
    companyRoles,
    solicitation,
    estimateData,
    contractType,
  } = useAppContext()

  const wbsElements = estimateData?.wbsElements?.length > 0 ? estimateData.wbsElements : MOCK_WBS_ELEMENTS

  const [activeTab, setLocalActiveTab] = useState('sections')
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [exportResult, setExportResult] = useState<{ fileName?: string } | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)

  // Technical Volume export state
  const [tvExportStatus, setTvExportStatus] = useState<ExportStatus>('idle')
  const [tvSectionStats, setTvSectionStats] = useState<{
    total: number
    locked: number
    notLocked: number
    allLocked: boolean
  } | null>(null)

  // Fetch section lock status for Technical Volume
  useEffect(() => {
    if (!proposalId) return
    async function fetchSectionStatus() {
      try {
        const response = await fetch(`/api/proposals/${proposalId}/export/technical-volume`)
        if (response.ok) {
          const data = await response.json()
          setTvSectionStats(data)
        }
      } catch {
        // Silently fail
      }
    }
    fetchSectionStatus()
  }, [proposalId])

  // Handle Technical Volume export
  const handleTechnicalVolumeExport = async () => {
    if (!proposalId) return
    setTvExportStatus('generating')

    try {
      const response = await fetch(`/api/proposals/${proposalId}/export/technical-volume`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'Technical-Volume.docx'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) {
          filename = match[1]
        }
      }

      const blob = await response.blob()
      downloadBlob(blob, filename)
      setTvExportStatus('success')

      // Reset after 3 seconds
      setTimeout(() => setTvExportStatus('idle'), 3000)
    } catch (error) {
      console.error('Technical Volume export failed:', error)
      setTvExportStatus('error')
      setTimeout(() => setTvExportStatus('idle'), 3000)
    }
  }

  const [config, setConfig] = useState<ExportConfig>({
    solicitation: '',
    client: '',
    proposalTitle: '',
    preparedBy: companyProfile.name,
    preparedDate: new Date().toISOString().split('T')[0],
    includeEscalation: true,
    format: 'docx'
  })

  const [includedSections, setIncludedSections] = useState({
    rateCard: true,
    boe: true,
    lcats: false,
    audit: false
  })

  // Auto-populate from solicitation
  useEffect(() => {
    if (solicitation) {
      // Check multiple possible property names for agency/client
      const clientAgency = solicitation.clientAgency || ''
      
      setConfig(prev => ({
        ...prev,
        solicitation: solicitation.solicitationNumber || prev.solicitation,
        client: clientAgency || prev.client,
        proposalTitle: solicitation.title || prev.proposalTitle,
      }))
    }
  }, [solicitation])

  const updateConfig = (updates: Partial<ExportConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  const contractType = solicitation?.contractType || 'tm'
  const contractYears = (solicitation?.periodOfPerformance?.optionYears || 0) + 1

  // WBS Summary
  const wbsSummary = useMemo(() => {
    const totalHours = wbsElements.reduce((sum, el) => sum + ((el as any).totalHours || (el as any).hours || 0), 0)
    const confidenceCounts = wbsElements.reduce((acc, el) => {
      acc[(el as any).confidence || "medium"] = (acc[(el as any).confidence || "medium"] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return {
      totalElements: wbsElements.length,
      totalHours,
      highConfidencePercent: wbsElements.length > 0 ? ((confidenceCounts.high || 0) / wbsElements.length) * 100 : 0
    }
  }, [wbsElements])

  // Build sections array
  const sections: ExportSection[] = useMemo(() => [
    {
      id: 'rateCard',
      title: 'Rate Card',
      description: `${contractType.toUpperCase()} rates for ${contractYears} year${contractYears !== 1 ? 's' : ''} with ${selectedRoles.length} roles`,
      icon: Calculator,
      included: includedSections.rateCard,
    },
    {
      id: 'boe',
      title: 'Basis of Estimate',
      description: `${wbsElements.length} WBS elements totaling ${wbsSummary.totalHours.toLocaleString()} hours`,
      icon: ListTree,
      included: includedSections.boe,
      badge: wbsSummary.highConfidencePercent >= 70 ? 'Strong' : 'Review',
      badgeVariant: wbsSummary.highConfidencePercent >= 70 ? 'default' : 'secondary',
    },
    {
      id: 'lcats',
      title: 'Labor Categories',
      description: `${selectedRoles.length} roles with descriptions from Company Settings`,
      icon: Users,
      included: includedSections.lcats,
    },
    {
      id: 'audit',
      title: 'Audit Defense',
      description: 'Rate calculations and compliance documentation',
      icon: Shield,
      included: includedSections.audit,
      badge: 'Advanced',
      badgeVariant: 'secondary',
    },
  ], [contractType, contractYears, selectedRoles.length, wbsElements.length, wbsSummary, includedSections])

  const selectedSection = sections.find(s => s.id === selectedSectionId) || null

  // Readiness checks
  const checks = useMemo(() => {
    const hasRoles = selectedRoles.length > 0
    const hasRates = indirectRates.fringe > 0
    const hasWBS = wbsElements.length > 0
    const hasSolicitation = !!config.solicitation
    
    return {
      hasRoles,
      hasRates,
      hasWBS,
      hasSolicitation,
      passCount: [hasRoles, hasRates, hasWBS, hasSolicitation].filter(Boolean).length,
    }
  }, [selectedRoles.length, indirectRates.fringe, wbsElements.length, config.solicitation])

  const selectedCount = Object.values(includedSections).filter(Boolean).length
  const isReady = checks.passCount >= 2 && selectedCount > 0

  // Handle export
  const handleExport = async () => {
    setExportStatus('generating')
    setExportResult(null)

    try {
      const exportData: ExportData = {
        solicitation: config.solicitation,
        client: config.client,
        proposalTitle: config.proposalTitle,
        preparedBy: config.preparedBy,
        preparedDate: config.preparedDate,
        companyName: companyProfile.name,
        samUei: companyProfile.samUei,
        gsaContract: companyProfile.gsaContractNumber,
        indirectRates: {
          fringe: indirectRates.fringe,
          overhead: indirectRates.overhead,
          ga: indirectRates.ga,
          source: indirectRates.source,
          fiscalYear: String(indirectRates.fiscalYear || 2024)
        },
        profitMargin: resolveProfitRateWithFallback({
          contractType: contractType as PricingContractType,
          profitTargets: {
            tm: profitTargets.tmDefault,
            ffp: profitTargets.ffpLowRisk,
            gsa: profitTargets.gsaDefault,
          },
        }, profitTargets.tmDefault).profitRate,
        escalationRate: escalationRates.laborDefault,
        productiveHours: companyPolicy.standardHours,
        roles: selectedRoles.map(role => {
          // Use improved matching function
          const companyRole = findMatchingCompanyRole(role, companyRoles)
          const levelInfo = companyRole?.levels?.find((l: any) => l.level === role.icLevel)
          
          return {
            id: role.id,
            title: role.title || role.name,
            icLevel: role.icLevel,
            baseSalary: role.baseSalary,
            quantity: role.quantity,
            description: companyRole?.description || role.description,
            blsCode: companyRole?.blsOccCode,
            yearsExperience: levelInfo?.yearsExperience,
            education: levelInfo?.education
          }
        }),
        wbsElements: wbsElements as any, // Always pass - used by both BOE and Labor Categories
        calculateRate: (salary: number, includeProfit: boolean) => 
          calculateFullyBurdenedRate(salary, includeProfit),
        calculateEscalatedRate: (rate: number, year: number) => 
          calculateEscalatedRate(rate, year),
        rateCardType: contractType as any,
        yearsToInclude: contractYears,
        includeEscalation: config.includeEscalation
      }

      const options: ExportOptions = {
        includeRateCard: includedSections.rateCard,
        includeBOE: includedSections.boe,
        includeLCATs: includedSections.lcats,
        includeAuditPackage: includedSections.audit
      }

      const blob = await generateExport(exportData, options, config.format)
      const extension = config.format === 'xlsx' ? 'csv' : config.format
      const filename = `TrueBid_${config.solicitation || 'Export'}_${new Date().toISOString().split('T')[0]}.${extension}`
      
      downloadBlob(blob, filename)
      setExportResult({ fileName: filename })
      setExportStatus('success')
      
      // Reset after 3 seconds
      setTimeout(() => setExportStatus('idle'), 3000)
    } catch (error) {
      console.error('Export failed:', error)
      setExportStatus('error')
    }
  }

  const toggleSection = (id: keyof typeof includedSections) => {
    setIncludedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Export</h1>
          <Badge variant="outline" className="text-xs">
            {selectedCount} section{selectedCount !== 1 ? 's' : ''} selected
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Format Toggle */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {FORMAT_OPTIONS.map((format) => (
              <button
                key={format.value}
                onClick={() => updateConfig({ format: format.value })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  config.format === format.value 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <format.icon className="w-3.5 h-3.5" />
                {format.label}
              </button>
            ))}
          </div>


          {/* Export Button */}
          <Button 
            onClick={handleExport}
            disabled={!isReady || exportStatus === 'generating'}
          >
            {exportStatus === 'generating' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
            ) : exportStatus === 'success' ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Downloaded!</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />Export Document</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 bg-gray-50 rounded-lg flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          {checks.hasRoles ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
          <span className={checks.hasRoles ? 'text-gray-700' : 'text-amber-600'}>
            {selectedRoles.length} roles
          </span>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
        <div className="flex items-center gap-2">
          {checks.hasWBS ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
          <span className={checks.hasWBS ? 'text-gray-700' : 'text-amber-600'}>
            {wbsElements.length} WBS elements
          </span>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
        <div className="flex items-center gap-2">
          {checks.hasRates ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
          <span className={checks.hasRates ? 'text-gray-700' : 'text-amber-600'}>
            FY{indirectRates.fiscalYear} rates
          </span>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
        <div className="flex items-center gap-2">
          {checks.hasSolicitation ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
          <span className={checks.hasSolicitation ? 'text-gray-700' : 'text-amber-600'}>
            {config.solicitation || 'No solicitation #'}
          </span>
        </div>
      </div>

      {/* Error / Success Messages */}
      {exportStatus === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-800">Export failed. Please try again.</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setLocalActiveTab}>
        <TabsList className="bg-gray-100 p-1">
          <TabsTrigger value="sections" className="data-[state=active]:bg-white text-xs">
            Sections
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-white text-xs">
            Preview
          </TabsTrigger>
        </TabsList>

        {/* SECTIONS TAB */}
        <TabsContent value="sections" className="mt-4 space-y-6">
          {selectedRoles.length === 0 ? (
            <div className="text-center py-12 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-amber-900 mb-1">No roles selected</h3>
              <p className="text-sm text-amber-700">
                Add roles in the Roles & Pricing tab to generate export documents.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  onToggle={() => toggleSection(section.id)}
                  onClick={() => setSelectedSectionId(section.id)}
                  isSelected={selectedSectionId === section.id}
                />
              ))}
            </div>
          )}

          {/* Technical Volume Export */}
          <div className="pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Technical Volume</h3>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">Technical Volume (Word)</h4>
                    <Badge variant="secondary" className="text-[10px]">InDesign-Ready</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    Paragraph styles match your FFTC template. Place directly in InDesign without reformatting.
                  </p>

                  {/* Section lock status */}
                  {tvSectionStats && tvSectionStats.total > 0 && (
                    <div className="flex items-center gap-3 mb-4">
                      {tvSectionStats.allLocked ? (
                        <div className="flex items-center gap-1.5 text-sm text-green-600">
                          <Lock className="w-4 h-4" />
                          <span>All {tvSectionStats.locked} sections locked</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm text-amber-600">
                          <Unlock className="w-4 h-4" />
                          <span>{tvSectionStats.notLocked} of {tvSectionStats.total} sections not locked</span>
                        </div>
                      )}
                    </div>
                  )}

                  {tvSectionStats && tvSectionStats.total === 0 && (
                    <p className="text-sm text-gray-500 mb-4">
                      No outline sections created yet. Create an outline in Write → Proposal Outline first.
                    </p>
                  )}

                  {/* Warning for unlocked sections */}
                  {tvSectionStats && tvSectionStats.notLocked > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium">Unlocked sections detected</p>
                        <p className="text-xs mt-0.5">
                          Lock all sections in Write → Proposal Outline before exporting to ensure content is final.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={handleTechnicalVolumeExport}
                  disabled={tvExportStatus === 'generating' || !tvSectionStats || tvSectionStats.total === 0}
                >
                  {tvExportStatus === 'generating' ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                  ) : tvExportStatus === 'success' ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2" />Downloaded!</>
                  ) : tvExportStatus === 'error' ? (
                    <><AlertCircle className="w-4 h-4 mr-2" />Failed</>
                  ) : (
                    <><Download className="w-4 h-4 mr-2" />Export Word</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* PREVIEW TAB */}
        <TabsContent value="preview" className="mt-4">
          {selectedRoles.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
              <Eye className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-600 mb-1">Nothing to preview</h3>
              <p className="text-sm text-gray-500">Add roles to see a preview of your export.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Rate Card Preview */}
              {includedSections.rateCard && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Rate Card</h4>
                    <Badge variant="outline" className="text-xs">
                      {contractYears} year{contractYears !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left p-3 text-xs font-medium text-gray-500">Labor Category</th>
                          <th className="text-center p-3 text-xs font-medium text-gray-500">Level</th>
                          <th className="text-right p-3 text-xs font-medium text-gray-500">Base Year</th>
                          {contractYears >= 2 && <th className="text-right p-3 text-xs font-medium text-gray-500">Opt 1</th>}
                          {contractYears >= 3 && <th className="text-right p-3 text-xs font-medium text-gray-500">Opt 2</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRoles.slice(0, 5).map((role, idx) => {
                          const baseRate = calculateFullyBurdenedRate(role.baseSalary, (contractType as string) !== 'ffp')
                          return (
                            <tr key={role.id} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                              <td className="p-3 text-gray-900">{role.title || role.name}</td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" className="text-xs">{role.icLevel}</Badge>
                              </td>
                              <td className="p-3 text-right font-mono text-gray-900">{formatCurrency(baseRate)}</td>
                              {contractYears >= 2 && (
                                <td className="p-3 text-right font-mono text-gray-900">
                                  {formatCurrency(config.includeEscalation ? calculateEscalatedRate(baseRate, 2) : baseRate)}
                                </td>
                              )}
                              {contractYears >= 3 && (
                                <td className="p-3 text-right font-mono text-gray-900">
                                  {formatCurrency(config.includeEscalation ? calculateEscalatedRate(baseRate, 3) : baseRate)}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {selectedRoles.length > 5 && (
                      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
                        + {selectedRoles.length - 5} more roles
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BOE Preview */}
              {includedSections.boe && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Basis of Estimate</h4>
                    <Badge variant="outline" className="text-xs">
                      {wbsSummary.totalHours.toLocaleString()} total hours
                    </Badge>
                  </div>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                    {wbsElements.map((element) => (
                      <div key={element.id} className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-xs font-mono text-gray-500">{element.wbsNumber}</span>
                            <h5 className="font-medium text-gray-900">{element.title}</h5>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{element.estimateMethod}</Badge>
                            <Badge 
                              variant={((element as any).confidence || (element as any).confidenceLevel || "medium") === 'high' ? 'default' : 'secondary'} 
                              className="text-[10px]"
                            >
                              {(element as any).confidence || (element as any).confidenceLevel || "medium"}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-xs text-gray-500 mb-3">{(element as any).description || (element as any).what || ""}</p>
                        
                        {/* Total Hours */}
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm">
                            <strong className="text-gray-900">{element.hours.toLocaleString()}</strong>
                            <span className="text-gray-500 ml-1">total hours</span>
                          </span>
                          {element.sooReference && (
                            <span className="text-xs text-gray-500 border-l border-gray-300 pl-3">
                              SOO: {element.sooReference}
                            </span>
                          )}
                        </div>

                        {/* Labor Breakdown with hours by period */}
                        {element.laborBreakdown && element.laborBreakdown.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Labor Allocation
                            </p>
                            
                            {/* Table */}
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[10px] font-medium text-gray-500 border-b border-gray-200">
                                  <th className="text-left pb-1">Role</th>
                                  <th className="text-right pb-1">Total</th>
                                  <th className="text-right pb-1">Base</th>
                                  {contractYears >= 2 && <th className="text-right pb-1">OY1</th>}
                                  {contractYears >= 3 && <th className="text-right pb-1">OY2</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {element.laborBreakdown.map((labor, idx) => {
                                  const hoursPerYear = Math.round(labor.hours / contractYears)
                                  return (
                                    <tr key={idx}>
                                      <td className="py-1.5 font-medium text-gray-900">{labor.roleName}</td>
                                      <td className="py-1.5 text-right font-semibold text-gray-900">
                                        {labor.hours.toLocaleString()}
                                      </td>
                                      <td className="py-1.5 text-right text-gray-600 text-xs">
                                        {hoursPerYear.toLocaleString()}
                                      </td>
                                      {contractYears >= 2 && (
                                        <td className="py-1.5 text-right text-gray-600 text-xs">
                                          {hoursPerYear.toLocaleString()}
                                        </td>
                                      )}
                                      {contractYears >= 3 && (
                                        <td className="py-1.5 text-right text-gray-600 text-xs">
                                          {hoursPerYear.toLocaleString()}
                                        </td>
                                      )}
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Assumptions */}
                        {element.assumptions && element.assumptions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                              Assumptions
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {element.assumptions.map((assumption, idx) => (
                                <span 
                                  key={idx} 
                                  className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
                                >
                                  {assumption}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Footer */}
              <p className="text-xs text-gray-500">
                Fringe {(indirectRates.fringe * 100).toFixed(1)}% ·
                OH {(indirectRates.overhead * 100).toFixed(1)}% ·
                G&A {(indirectRates.ga * 100).toFixed(1)}%
                {(contractType as string) !== 'ffp' && ` · Profit ${(resolveProfitRateWithFallback({
                  contractType: contractType as PricingContractType,
                  profitTargets: {
                    tm: profitTargets.tmDefault,
                    ffp: profitTargets.ffpLowRisk,
                    gsa: profitTargets.gsaDefault,
                  },
                }, profitTargets.tmDefault).profitRate * 100).toFixed(1)}%`}
                {config.includeEscalation && ` · ${(escalationRates.laborDefault * 100).toFixed(1)}% escalation`}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Section Slideout */}
      <SectionSlideout
        section={selectedSection}
        isOpen={!!selectedSectionId}
        onClose={() => setSelectedSectionId(null)}
        config={config}
        onUpdateConfig={updateConfig}
        selectedRoles={selectedRoles}
        companyRoles={companyRoles}
        wbsElements={wbsElements as any}
        indirectRates={indirectRates}
        escalationRates={escalationRates}
        contractYears={contractYears}
        contractType={contractType as any}
        calculateFullyBurdenedRate={calculateFullyBurdenedRate}
        calculateEscalatedRate={calculateEscalatedRate}
      />

    </div>
  )
}