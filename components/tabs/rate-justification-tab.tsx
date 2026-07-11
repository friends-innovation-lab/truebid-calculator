// @ts-nocheck
'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { 
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  X,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Award,
  Calculator,
  Users,
  Shield,
  AlertTriangle,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppContext, RoleJustification } from '@/contexts/app-context'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

// ==================== TYPES ====================

interface RoleDisplay {
  id: string
  title: string
  level: string
  salary: number
  hourlyRate: number
  fte: number
  isPrime?: boolean
  companyName?: string
  theirRate?: number
  billedRate?: number
  markupPercent?: number
}

interface BLSData {
  socCode: string
  occupation: string
  percentile10: number
  percentile25: number
  median: number
  percentile75: number
  percentile90: number
  mean: number
  lastUpdated: string
  dataSource: string
}

interface GSACompetitor {
  id: string
  vendor: string
  laborCategory: string
  sin: string
  rate: number
  education: string
  yearsExp: number
  contractNumber: string
  awardYear: number
  region: string
}

// ==================== BLS DATA MAPPINGS ====================

const BLS_MAPPINGS: { [key: string]: BLSData } = {
  'Technical Lead': {
    socCode: '11-3021',
    occupation: 'Computer and Information Systems Managers',
    percentile10: 98890, percentile25: 128230, median: 169510, percentile75: 217200, percentile90: 267620,
    mean: 179780, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'Solutions Architect': {
    socCode: '15-1299',
    occupation: 'Computer Occupations, All Other',
    percentile10: 62480, percentile25: 88450, median: 118370, percentile75: 153050, percentile90: 189170,
    mean: 121370, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'Senior Software Engineer': {
    socCode: '15-1252',
    occupation: 'Software Developers',
    percentile10: 77020, percentile25: 103690, median: 132270, percentile75: 168570, percentile90: 208620,
    mean: 139380, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'Software Engineer': {
    socCode: '15-1252',
    occupation: 'Software Developers',
    percentile10: 77020, percentile25: 103690, median: 132270, percentile75: 168570, percentile90: 208620,
    mean: 139380, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'DevOps Engineer': {
    socCode: '15-1252',
    occupation: 'Software Developers',
    percentile10: 77020, percentile25: 103690, median: 132270, percentile75: 168570, percentile90: 208620,
    mean: 139380, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'Security Engineer': {
    socCode: '15-1212',
    occupation: 'Information Security Analysts',
    percentile10: 64280, percentile25: 84100, median: 120360, percentile75: 156230, percentile90: 188150,
    mean: 125750, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'QA Engineer': {
    socCode: '15-1253',
    occupation: 'Software Quality Assurance Analysts and Testers',
    percentile10: 51350, percentile25: 71290, median: 101800, percentile75: 130870, percentile90: 158830,
    mean: 104090, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'Data Scientist': {
    socCode: '15-2051',
    occupation: 'Data Scientists',
    percentile10: 61090, percentile25: 85560, median: 108020, percentile75: 141330, percentile90: 178440,
    mean: 113310, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'UI/UX Designer': {
    socCode: '15-1255',
    occupation: 'Web and Digital Interface Designers',
    percentile10: 41810, percentile25: 57220, median: 80730, percentile75: 109890, percentile90: 142980,
    mean: 85560, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'Project Manager': {
    socCode: '11-9199',
    occupation: 'Managers, All Other',
    percentile10: 62610, percentile25: 89030, median: 125540, percentile75: 172770, percentile90: 224080,
    mean: 135960, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'Business Analyst': {
    socCode: '13-1111',
    occupation: 'Management Analysts',
    percentile10: 52250, percentile25: 71500, median: 99410, percentile75: 137160, percentile90: 175080,
    mean: 107640, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  },
  'DEFAULT': {
    socCode: '15-1299',
    occupation: 'Computer Occupations, All Other',
    percentile10: 62480, percentile25: 88450, median: 118370, percentile75: 153050, percentile90: 189170,
    mean: 121370, lastUpdated: '2024-05-01', dataSource: 'BLS OEWS Survey'
  }
}

const findBLSData = (roleTitle: string): BLSData | null => {
  if (!roleTitle) return null
  if (BLS_MAPPINGS[roleTitle]) return BLS_MAPPINGS[roleTitle]
  
  const lowerTitle = roleTitle.toLowerCase()
  for (const [key, data] of Object.entries(BLS_MAPPINGS)) {
    if (key !== 'DEFAULT' && lowerTitle.includes(key.toLowerCase())) return data
  }
  
  if (lowerTitle.includes('engineer') && lowerTitle.includes('software')) return BLS_MAPPINGS['Software Engineer']
  if (lowerTitle.includes('lead') || lowerTitle.includes('architect')) return BLS_MAPPINGS['Technical Lead']
  if (lowerTitle.includes('devops') || lowerTitle.includes('cloud')) return BLS_MAPPINGS['DevOps Engineer']
  if (lowerTitle.includes('security') || lowerTitle.includes('cyber')) return BLS_MAPPINGS['Security Engineer']
  if (lowerTitle.includes('data') && lowerTitle.includes('scien')) return BLS_MAPPINGS['Data Scientist']
  if (lowerTitle.includes('qa') || lowerTitle.includes('test')) return BLS_MAPPINGS['QA Engineer']
  if (lowerTitle.includes('design') || lowerTitle.includes('ux')) return BLS_MAPPINGS['UI/UX Designer']
  if (lowerTitle.includes('project') || lowerTitle.includes('program')) return BLS_MAPPINGS['Project Manager']
  if (lowerTitle.includes('analyst')) return BLS_MAPPINGS['Business Analyst']
  
  return BLS_MAPPINGS['DEFAULT']
}

// ==================== GSA COMPETITOR DATA ====================

const GSA_COMPETITORS: GSACompetitor[] = [
  { id: '1', vendor: 'Booz Allen Hamilton', laborCategory: 'Senior Software Engineer', sin: '54151S', rate: 185.00, education: 'BS', yearsExp: 8, contractNumber: 'GS-35F-0119Y', awardYear: 2023, region: 'National' },
  { id: '2', vendor: 'Deloitte Consulting LLP', laborCategory: 'Senior Software Engineer', sin: '54151S', rate: 210.00, education: 'MS', yearsExp: 5, contractNumber: 'GS-35F-0456K', awardYear: 2024, region: 'National' },
  { id: '3', vendor: 'SAIC', laborCategory: 'Senior Software Engineer', sin: '54151S', rate: 165.00, education: 'BS', yearsExp: 6, contractNumber: 'GS-35F-0783N', awardYear: 2023, region: 'National' },
  { id: '4', vendor: 'Accenture Federal Services', laborCategory: 'Senior Software Engineer', sin: '54151S', rate: 195.00, education: 'BS', yearsExp: 8, contractNumber: 'GS-35F-0291P', awardYear: 2024, region: 'National' },
  { id: '5', vendor: 'CACI International', laborCategory: 'Technical Lead', sin: '54151S', rate: 215.00, education: 'MS', yearsExp: 10, contractNumber: 'GS-35F-0547H', awardYear: 2023, region: 'National' },
  { id: '6', vendor: 'Leidos', laborCategory: 'Technical Lead', sin: '54151S', rate: 225.00, education: 'BS', yearsExp: 12, contractNumber: 'GS-35F-0892M', awardYear: 2024, region: 'National' },
  { id: '7', vendor: 'Northrop Grumman', laborCategory: 'Technical Lead', sin: '54151S', rate: 235.00, education: 'MS', yearsExp: 15, contractNumber: 'GS-35F-0123T', awardYear: 2024, region: 'National' },
  { id: '8', vendor: 'General Dynamics IT', laborCategory: 'DevOps Engineer', sin: '54151S', rate: 145.00, education: 'BS', yearsExp: 5, contractNumber: 'GS-35F-0234L', awardYear: 2023, region: 'National' },
  { id: '9', vendor: 'ManTech', laborCategory: 'DevOps Engineer', sin: '54151S', rate: 135.00, education: 'AS', yearsExp: 4, contractNumber: 'GS-35F-0678R', awardYear: 2024, region: 'National' },
  { id: '10', vendor: 'Peraton', laborCategory: 'DevOps Engineer', sin: '54151S', rate: 155.00, education: 'BS', yearsExp: 6, contractNumber: 'GS-35F-0345Q', awardYear: 2024, region: 'National' },
  { id: '11', vendor: 'CGI Federal', laborCategory: 'Software Engineer', sin: '54151S', rate: 145.00, education: 'BS', yearsExp: 4, contractNumber: 'GS-35F-0567W', awardYear: 2023, region: 'National' },
  { id: '12', vendor: 'ICF', laborCategory: 'Software Engineer', sin: '54151S', rate: 138.00, education: 'BS', yearsExp: 3, contractNumber: 'GS-35F-0789X', awardYear: 2024, region: 'National' },
  { id: '13', vendor: 'Palantir', laborCategory: 'Data Scientist', sin: '54151S', rate: 225.00, education: 'PhD', yearsExp: 5, contractNumber: 'GS-35F-0890Z', awardYear: 2024, region: 'National' },
  { id: '14', vendor: 'Booz Allen Hamilton', laborCategory: 'Data Scientist', sin: '54151S', rate: 195.00, education: 'MS', yearsExp: 6, contractNumber: 'GS-35F-0119Y', awardYear: 2023, region: 'National' },
  { id: '15', vendor: 'CrowdStrike', laborCategory: 'Security Engineer', sin: '54151S', rate: 185.00, education: 'BS', yearsExp: 7, contractNumber: 'GS-35F-0456A', awardYear: 2024, region: 'National' },
  { id: '16', vendor: 'Palo Alto Networks', laborCategory: 'Security Engineer', sin: '54151S', rate: 175.00, education: 'BS', yearsExp: 5, contractNumber: 'GS-35F-0567B', awardYear: 2023, region: 'National' },
  { id: '17', vendor: 'Accenture Federal Services', laborCategory: 'QA Engineer', sin: '54151S', rate: 125.00, education: 'BS', yearsExp: 4, contractNumber: 'GS-35F-0291P', awardYear: 2024, region: 'National' },
  { id: '18', vendor: 'SAIC', laborCategory: 'QA Engineer', sin: '54151S', rate: 115.00, education: 'BS', yearsExp: 3, contractNumber: 'GS-35F-0783N', awardYear: 2023, region: 'National' },
  { id: '19', vendor: 'Deloitte Consulting LLP', laborCategory: 'Project Manager', sin: '54151S', rate: 195.00, education: 'MBA', yearsExp: 10, contractNumber: 'GS-35F-0456K', awardYear: 2024, region: 'National' },
  { id: '20', vendor: 'KPMG', laborCategory: 'Project Manager', sin: '54151S', rate: 185.00, education: 'BS', yearsExp: 8, contractNumber: 'GS-35F-0678C', awardYear: 2023, region: 'National' }
]

const findGSACompetitors = (roleTitle: string): GSACompetitor[] => {
  if (!roleTitle) return []
  const lowerTitle = roleTitle.toLowerCase()
  
  return GSA_COMPETITORS.filter(competitor => {
    const lowerCategory = competitor.laborCategory.toLowerCase()
    if (lowerTitle === lowerCategory) return true
    
    if (lowerTitle.includes('senior') && lowerTitle.includes('software') && lowerTitle.includes('engineer')) {
      return lowerCategory === 'senior software engineer'
    }
    if (lowerTitle.includes('software') && lowerTitle.includes('engineer') && !lowerTitle.includes('senior')) {
      return lowerCategory === 'software engineer' || lowerCategory === 'senior software engineer'
    }
    if (lowerTitle.includes('devops')) return lowerCategory === 'devops engineer'
    if (lowerTitle.includes('security') || lowerTitle.includes('cyber')) return lowerCategory === 'security engineer'
    if (lowerTitle.includes('technical lead') || lowerTitle.includes('tech lead')) return lowerCategory === 'technical lead'
    if (lowerTitle.includes('data scientist')) return lowerCategory === 'data scientist'
    if (lowerTitle.includes('qa') || lowerTitle.includes('quality')) return lowerCategory === 'qa engineer'
    if (lowerTitle.includes('project manager') || lowerTitle.includes('program manager')) return lowerCategory === 'project manager'
    if (lowerTitle.includes(lowerCategory)) return true
    
    return false
  })
}

// ==================== HELPER FUNCTIONS ====================

const calculatePercentile = (salary: number, blsData: BLSData): number => {
  if (salary <= blsData.percentile10) return 10
  if (salary <= blsData.percentile25) return 10 + ((salary - blsData.percentile10) / (blsData.percentile25 - blsData.percentile10)) * 15
  if (salary <= blsData.median) return 25 + ((salary - blsData.percentile25) / (blsData.median - blsData.percentile25)) * 25
  if (salary <= blsData.percentile75) return 50 + ((salary - blsData.median) / (blsData.percentile75 - blsData.median)) * 25
  if (salary <= blsData.percentile90) return 75 + ((salary - blsData.percentile75) / (blsData.percentile90 - blsData.percentile75)) * 15
  return 90 + Math.min(10, ((salary - blsData.percentile90) / blsData.percentile90) * 100)
}

const getPercentileStatus = (percentile: number): { 
  color: string
  barColor: string
  textColor: string
  label: string
  description: string 
} => {
  if (percentile > 90) return { 
    color: 'bg-red-50 text-red-700 border-red-200', 
    barColor: 'bg-red-500',
    textColor: 'text-red-600',
    label: 'Premium rate',
    description: 'Above 90th percentile – requires strong justification for audit defense'
  }
  if (percentile > 75) return { 
    color: 'bg-amber-50 text-amber-700 border-amber-200', 
    barColor: 'bg-amber-500',
    textColor: 'text-amber-600',
    label: 'Above market',
    description: 'Above 75th percentile – document why this rate is necessary'
  }
  if (percentile > 50) return { 
    color: 'bg-blue-50 text-blue-700 border-blue-200', 
    barColor: 'bg-blue-500',
    textColor: 'text-blue-600',
    label: 'At market',
    description: 'Between median and 75th percentile – typical market positioning'
  }
  return { 
    color: 'bg-green-50 text-green-700 border-green-200', 
    barColor: 'bg-green-500',
    textColor: 'text-green-600',
    label: 'Competitive',
    description: 'At or below median – strong position for cost-conscious evaluations'
  }
}

const getRateComparison = (myRate: number, competitorRate: number): { 
  color: string
  label: string
  icon: typeof TrendingUp
  bgColor: string
} => {
  const diff = ((myRate - competitorRate) / competitorRate) * 100
  
  if (diff > 10) return { color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', label: `${diff.toFixed(0)}% higher`, icon: TrendingUp }
  if (diff > 0) return { color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', label: `${diff.toFixed(0)}% higher`, icon: TrendingUp }
  if (diff > -10) return { color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', label: `${Math.abs(diff).toFixed(0)}% lower`, icon: TrendingDown }
  return { color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', label: `${Math.abs(diff).toFixed(0)}% lower`, icon: TrendingDown }
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

const formatFTE = (fte: number): string => {
  if (fte === Math.floor(fte)) return fte.toString()
  return Number(fte.toFixed(2)).toString()
}

const formatOrdinal = (n: number): string => {
  const rounded = Math.round(n)
  const lastTwo = rounded % 100
  const lastOne = rounded % 10
  
  if (lastTwo >= 11 && lastTwo <= 13) return `${rounded}th`
  if (lastOne === 1) return `${rounded}st`
  if (lastOne === 2) return `${rounded}nd`
  if (lastOne === 3) return `${rounded}rd`
  return `${rounded}th`
}

// ==================== JUSTIFICATION HELP TEXT ====================

const JUSTIFICATION_HELP = {
  // High rate justifications
  clearance: 'Cleared personnel typically command 15-25% higher rates in the DC market due to limited supply.',
  location: 'Cost of living adjustments: DC Metro is 30-40% above national average for tech roles.',
  keyPersonnel: 'Named individuals with proven track records can justify rates based on specific past performance.',
  nicheSkills: 'Specialized skills (e.g., mainframe modernization, specific agency systems) have limited talent pools.',
  pastPerformance: 'Incumbents with institutional knowledge reduce risk and ramp-up time.',
  // Low rate justifications
  efficiency: 'Document specific tools, processes, or automation that increase team productivity.',
  reusableAssets: 'Existing code libraries, templates, or frameworks that reduce development time.',
  volumeDiscount: 'Multi-year or high-volume commitments that justify reduced margins.',
  provenDelivery: 'Reference specific contracts where you delivered successfully at similar rates.'
}

// ==================== COMPONENT ====================

export function RateJustificationTab() {
  const context = useAppContext()
  const contextRoles = context.selectedRoles || context.teamMembers || []
  const contextSubcontractors = context.subcontractors || []
  const calculateLoadedRate = context.calculateLoadedRate
  const { rateJustifications: roleJustifications, setRateJustifications } = context

  // State
  const [activeTab, setActiveTab] = useState<string>('bls')
  const [selectedRole, setSelectedRole] = useState<RoleDisplay | null>(null)
  const [selectedGSACompetitor, setSelectedGSACompetitor] = useState<GSACompetitor | null>(null)
  const [isSlideoutOpen, setIsSlideoutOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Search/filter state
  const [blsSearchQuery, setBlsSearchQuery] = useState('')
  const [gsaSearchQuery, setGsaSearchQuery] = useState('')
  const [gsaFilterRole, setGsaFilterRole] = useState<string>('all')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Refs for focus management
  const slideoutRef = useRef<HTMLDivElement>(null)
  const slideoutCloseRef = useRef<HTMLButtonElement>(null)
  const lastFocusedElement = useRef<HTMLElement | null>(null)

  // ==================== FOCUS TRAP FOR SLIDEOUT ====================
  
  useEffect(() => {
    if (isSlideoutOpen && slideoutRef.current) {
      // Store the element that had focus before opening
      lastFocusedElement.current = document.activeElement as HTMLElement
      
      // Focus the close button when slideout opens
      setTimeout(() => {
        slideoutCloseRef.current?.focus()
      }, 100)
    } else if (!isSlideoutOpen && lastFocusedElement.current) {
      // Return focus when closing
      lastFocusedElement.current.focus()
    }
  }, [isSlideoutOpen])

  // Keyboard handler for slideout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSlideoutOpen) return
      
      if (e.key === 'Escape') {
        closeSlideout()
      }
      
      // Focus trap
      if (e.key === 'Tab' && slideoutRef.current) {
        const focusableElements = slideoutRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
        
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSlideoutOpen])

  // ==================== TRANSFORM CONTEXT DATA ====================

  const primeRoles: RoleDisplay[] = useMemo(() => {
    if (!contextRoles || !Array.isArray(contextRoles)) return []
    
    const roleMap = new Map<string, any>()
    contextRoles.filter((role: any) => role && role.id).forEach((role: any) => {
      const title = role.title || role.role || role.name || role.laborCategory || `Role ${role.id}`
      const existing = roleMap.get(title)
      
      if (existing) {
        existing.fte += (role.quantity || role.fte || role.count || 1)
      } else {
        const salary = role.baseSalary || role.salary || role.annualSalary || 0
        let hourlyRate = role.loadedRate || role.hourlyRate || role.rate || 0
        
        if (hourlyRate === 0 && salary > 0) {
          hourlyRate = calculateLoadedRate ? calculateLoadedRate(salary) : (salary / 2080) * 2.1
        }
        
        roleMap.set(title, {
          id: role.id || '',
          title,
          level: role.icLevel || role.level || role.ic_level || 'IC3',
          salary,
          hourlyRate,
          fte: role.quantity || role.fte || role.count || 1,
          isPrime: true
        })
      }
    })
    
    return Array.from(roleMap.values())
  }, [contextRoles, calculateLoadedRate])

  const subRoles: RoleDisplay[] = useMemo(() => {
    if (!contextSubcontractors || !Array.isArray(contextSubcontractors)) return []
    
    const subMap = new Map<string, any>()
    contextSubcontractors.filter((sub: any) => sub && sub.id).forEach((sub: any) => {
      const title = sub.role || sub.laborCategory || sub.title || `Sub Role ${sub.id}`
      const company = sub.companyName || sub.company || sub.vendor || ''
      const key = `${title}|${company}`
      const existing = subMap.get(key)
      
      if (existing) {
        const baseFte = sub.allocations?.base?.fte ?? sub.fte ?? sub.quantity ?? 1
        existing.fte += baseFte
      } else {
        const theirRate = sub.theirRate || sub.rate || 0
        const billedRate = sub.billedRate || sub.ourRate || theirRate
        const fte = sub.allocations?.base?.fte ?? sub.fte ?? sub.quantity ?? 1
        
        subMap.set(key, {
          id: sub.id || '',
          title,
          level: 'SUB',
          salary: 0,
          hourlyRate: theirRate,
          billedRate,
          fte,
          isPrime: false,
          companyName: company,
          theirRate,
          markupPercent: billedRate > theirRate ? ((billedRate - theirRate) / theirRate * 100) : 0
        })
      }
    })
    
    return Array.from(subMap.values())
  }, [contextSubcontractors])

  const roles: RoleDisplay[] = useMemo(() => [...primeRoles, ...subRoles], [primeRoles, subRoles])

  const relevantGSACompetitors = useMemo(() => {
    const allCompetitors: GSACompetitor[] = []
    const seenIds = new Set<string>()
    
    roles.forEach(role => {
      const competitors = findGSACompetitors(role.title)
      competitors.forEach(comp => {
        if (!seenIds.has(comp.id)) {
          seenIds.add(comp.id)
          allCompetitors.push(comp)
        }
      })
    })
    
    return allCompetitors.length === 0 ? GSA_COMPETITORS : allCompetitors
  }, [roles])

  // ==================== COMPUTED VALUES ====================

  const filteredRoles = useMemo(() => {
    if (!blsSearchQuery) return roles
    const query = blsSearchQuery.toLowerCase()
    return roles.filter(role => 
      role.title.toLowerCase().includes(query) || role.level.toLowerCase().includes(query)
    )
  }, [blsSearchQuery, roles])

  const filteredGSACompetitors = useMemo(() => {
    return relevantGSACompetitors.filter(competitor => {
      const matchesSearch = !gsaSearchQuery || 
        competitor.vendor.toLowerCase().includes(gsaSearchQuery.toLowerCase()) ||
        competitor.laborCategory.toLowerCase().includes(gsaSearchQuery.toLowerCase())
      const matchesRole = gsaFilterRole === 'all' || competitor.laborCategory === gsaFilterRole
      return matchesSearch && matchesRole
    })
  }, [gsaSearchQuery, gsaFilterRole, relevantGSACompetitors])

  const groupedGSACompetitors = useMemo(() => {
    const groups: Record<string, GSACompetitor[]> = {}
    filteredGSACompetitors.forEach(competitor => {
      if (!groups[competitor.laborCategory]) groups[competitor.laborCategory] = []
      groups[competitor.laborCategory].push(competitor)
    })
    return groups
  }, [filteredGSACompetitors])

  const uniqueLaborCategories = useMemo(() => {
    return Array.from(new Set(relevantGSACompetitors.map(c => c.laborCategory)))
  }, [relevantGSACompetitors])

  const gsaStats = useMemo(() => {
    if (filteredGSACompetitors.length === 0) return { avg: 0, min: 0, max: 0 }
    const rates = filteredGSACompetitors.map(c => c.rate)
    return {
      avg: rates.reduce((sum, rate) => sum + rate, 0) / rates.length,
      min: Math.min(...rates),
      max: Math.max(...rates)
    }
  }, [filteredGSACompetitors])

  const blsSummary = useMemo(() => {
    const rolesWithData = roles.filter(role => findBLSData(role.title) !== null)
    if (rolesWithData.length === 0) return { avgPercentile: 0, aboveMedian: 0, total: 0 }
    
    const percentiles = rolesWithData.map(role => {
      const blsData = findBLSData(role.title)!
      return calculatePercentile(role.salary, blsData)
    })
    
    const aboveMedian = rolesWithData.filter(role => {
      const blsData = findBLSData(role.title)
      return blsData && role.salary > blsData.median
    }).length

    return {
      avgPercentile: percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length,
      aboveMedian,
      total: rolesWithData.length
    }
  }, [roles])

  const justificationStats = useMemo(() => {
    const rolesWithData = roles.filter(role => findBLSData(role.title) !== null)
    const needsJustification = rolesWithData.filter(role => {
      const blsData = findBLSData(role.title)!
      const isSub = role.isPrime === false
      const percentile = isSub 
        ? calculatePercentile(role.hourlyRate * 2080 / 2.0, blsData)
        : calculatePercentile(role.salary, blsData)
      return percentile >= 75 || percentile <= 25
    })
    const hasJustification = needsJustification.filter(role => 
      roleJustifications[role.id]?.savedAt !== undefined && roleJustifications[role.id]?.savedAt !== ''
    )
    return { needed: needsJustification.length, completed: hasJustification.length }
  }, [roles, roleJustifications])

  // ==================== HANDLERS ====================

  const openRoleSlideout = (role: RoleDisplay) => {
    setSelectedRole(role)
    setSelectedGSACompetitor(null)
    setIsSlideoutOpen(true)
  }

  const openGSASlideout = (competitor: GSACompetitor) => {
    setSelectedGSACompetitor(competitor)
    setSelectedRole(null)
    setIsSlideoutOpen(true)
  }

  const closeSlideout = () => {
    setIsSlideoutOpen(false)
    setSelectedRole(null)
    setSelectedGSACompetitor(null)
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))
  }

  const refreshData = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  // ==================== RENDER ====================

  const [isHydrated, setIsHydrated] = useState(false)
  useEffect(() => { setIsHydrated(true) }, [])

  if (!isHydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ==================== HEADER ==================== */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">Rate Justification</h1>
            <Badge variant="outline" className="text-xs">
              {roles.length} Roles
            </Badge>
          </div>
          
          {/* Stats Summary - compact horizontal bar */}
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs">
           <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Prime</span>
              <span className="font-semibold text-gray-900">{primeRoles.length}</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Subs</span>
              <span className="font-semibold text-orange-600">{subRoles.length}</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Avg Market Position</span>
              <span className="font-semibold text-blue-600">{formatOrdinal(blsSummary.avgPercentile)}</span>
            </div>
            {justificationStats.needed > 0 && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Documented</span>
                  <span className={`font-semibold ${justificationStats.completed === justificationStats.needed ? 'text-green-600' : 'text-amber-600'}`}>
                    {justificationStats.completed}/{justificationStats.needed}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ==================== HORIZONTAL TABS ==================== */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-gray-100 p-1">
              <TabsTrigger value="bls" className="text-xs px-4 data-[state=active]:bg-white">
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                BLS Market Data
                <Badge variant="secondary" className="ml-1.5 text-xs px-1 py-0 h-4">
                  {roles.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="gsa" className="text-xs px-4 data-[state=active]:bg-white">
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                GSA Competitors
                <Badge variant="secondary" className="ml-1.5 text-xs px-1 py-0 h-4">
                  {relevantGSACompetitors.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </div>

          {/* ==================== BLS TAB CONTENT ==================== */}
          <TabsContent value="bls" className="space-y-4 mt-0">
            {/* Info Bar */}
            <div className="flex items-center gap-4 text-xs text-gray-600 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Shield className="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
              <span className="flex-1">
                Compare your proposed salaries to Bureau of Labor Statistics data. This helps defend your rates during cost reviews. 
                <span className="text-blue-700 font-medium"> Data as of May 2024</span>
              </span>
              <a 
                href="https://www.bls.gov/oes/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                View BLS.gov <ExternalLink className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">(opens in new tab)</span>
              </a>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <Input
                placeholder="Search roles..."
                value={blsSearchQuery}
                onChange={(e) => setBlsSearchQuery(e.target.value)}
                className="pl-9 h-9"
                aria-label="Search roles"
              />
            </div>

            {/* Role Cards */}
            {filteredRoles.length === 0 ? (
              <EmptyState
                icon={Users}
                title={roles.length === 0 ? 'No roles added to your team yet' : 'No roles match your search'}
                description={roles.length === 0 ? 'Add roles in Roles & Pricing to see market comparisons' : 'Try a different search term'}
              />
            ) : (
              <div className="space-y-3" role="list" aria-label="Roles with market position analysis">
                {filteredRoles.map((role) => {
                  const blsData = findBLSData(role.title)
                  if (!blsData) return null

                  const isSub = role.isPrime === false
                  const blsMedianHourly = blsData.median / 2080
                  const blsLoadedHourly = blsMedianHourly * 2.0
                  const compareValue = isSub ? role.hourlyRate : role.salary
                  const blsCompareValue = isSub ? blsLoadedHourly : blsData.median
                  const percentile = isSub 
                    ? calculatePercentile(role.hourlyRate * 2080 / 2.0, blsData)
                    : calculatePercentile(role.salary, blsData)
                  const status = getPercentileStatus(percentile)
                  const diffFromMedian = compareValue - blsCompareValue
                  const percentDiff = ((diffFromMedian / blsCompareValue) * 100)
                  const borderColor = isSub ? 'border-l-orange-500' : 'border-l-blue-500'
                  const hoverBorderColor = isSub ? 'hover:border-orange-300' : 'hover:border-blue-400'
                  const needsJustification = percentile >= 75 || percentile <= 25
                  const hasJustification = roleJustifications[role.id]?.savedAt !== undefined && roleJustifications[role.id]?.savedAt !== ''

                  return (
                    <div
                      key={role.id}
                      role="listitem"
                      className={`group border border-gray-200 border-l-4 rounded-lg p-4 ${hoverBorderColor} 
                                  hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all cursor-pointer bg-white ${borderColor}`}
                      onClick={() => openRoleSlideout(role)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRoleSlideout(role) } }}
                      tabIndex={0}
                      aria-label={`${role.title}, ${formatFTE(role.fte)} FTE, ${formatOrdinal(percentile)} percentile market position. ${needsJustification ? (hasJustification ? 'Documentation complete.' : 'Documentation needed.') : ''} Click for details.`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium text-sm text-gray-900">{role.title}</h4>
                            {isSub ? (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-orange-50 text-orange-700 border-orange-200">
                                Sub
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">{role.level}</Badge>
                            )}
                            {isSub && role.companyName && (
                              <span className="text-xs text-gray-500">{role.companyName}</span>
                            )}
                            {needsJustification && (
                              hasJustification ? (
                                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Documented
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                  <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Documentation needed
                                </span>
                              )
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            {formatFTE(role.fte)} FTE • ${role.hourlyRate.toFixed(2)}/hr
                            {isSub && role.markupPercent && role.markupPercent > 0 && (
                              <span className="text-gray-400"> (+{role.markupPercent.toFixed(0)}% markup)</span>
                            )}
                          </p>
                        </div>

                        <div className="text-center px-6">
                          {isSub ? (
                            <>
                              <p className="text-lg font-bold text-gray-900">${role.hourlyRate.toFixed(2)}/hr</p>
                              <p className={`text-xs font-medium ${percentDiff >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                {percentDiff >= 0 ? '+' : ''}{percentDiff.toFixed(0)}% vs ${blsLoadedHourly.toFixed(2)}/hr
                              </p>
                              <p className="text-xs text-gray-400">estimated market loaded rate</p>
                            </>
                          ) : (
                            <>
                              <p className="text-lg font-bold text-gray-900">{formatCurrency(role.salary)}</p>
                              <p className={`text-xs font-medium ${percentDiff >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                {percentDiff >= 0 ? '+' : ''}{percentDiff.toFixed(0)}% vs median
                              </p>
                            </>
                          )}
                        </div>

                     <div className="flex items-center gap-3">
                          <div className="w-24">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500">Market Position</span>
                              <span className={`text-xs font-semibold ${status.textColor}`}>{formatOrdinal(percentile)}</span>
                            </div>
                            <div 
                              className="h-2 bg-gray-100 rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={percentile}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Market position: ${formatOrdinal(percentile)} percentile`}
                            >
                              <div 
                                className={`h-full rounded-full transition-all ${status.barColor}`}
                                style={{ width: `${Math.min(percentile, 100)}%` }}
                              />
                            </div>
                          </div>
                          <Badge className={`${status.color} border text-xs px-2 py-0.5`}>{status.label}</Badge>
                          <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ==================== GSA TAB CONTENT ==================== */}
          <TabsContent value="gsa" className="space-y-4 mt-0">
            {/* Search and Filter */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <Input
                  placeholder="Search vendors, contracts..."
                  value={gsaSearchQuery}
                  onChange={(e) => setGsaSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                  aria-label="Search GSA vendors and contracts"
                />
              </div>
              <Select value={gsaFilterRole} onValueChange={setGsaFilterRole}>
                <SelectTrigger className="w-[200px] h-9" aria-label="Filter by role">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {uniqueLaborCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-6 text-xs text-gray-600 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Avg: <span className="font-semibold text-gray-900">${gsaStats.avg.toFixed(2)}/hr</span></span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-green-600" aria-hidden="true" />
                <span>Min: <span className="font-semibold text-gray-900">${gsaStats.min.toFixed(2)}/hr</span></span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                <span>Max: <span className="font-semibold text-gray-900">${gsaStats.max.toFixed(2)}/hr</span></span>
              </div>
              <a 
                href="https://calc.gsa.gov/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 ml-auto"
              >
                View GSA CALC <ExternalLink className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">(opens in new tab)</span>
              </a>
            </div>

            {/* Grouped Competitors */}
            {Object.keys(groupedGSACompetitors).length === 0 ? (
              <EmptyState
                icon={Building2}
                title={roles.length === 0 ? 'Add roles in Roles & Pricing to see competitor data' : 'No competitors match your filters'}
              />
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedGSACompetitors).map(([category, competitors]) => {
                  const isExpanded = expandedCategories[category] !== false
                  const lowerCategory = category.toLowerCase()
                  const ourRole = roles.find(r => {
                    const lowerTitle = r.title.toLowerCase()
                    if (lowerTitle === lowerCategory) return true
                    if (lowerCategory === 'senior software engineer') {
                      return lowerTitle.includes('senior') && lowerTitle.includes('software') && lowerTitle.includes('engineer')
                    }
                    if (lowerCategory === 'software engineer') {
                      return lowerTitle.includes('software') && lowerTitle.includes('engineer') && !lowerTitle.includes('senior')
                    }
                    if (lowerCategory === 'devops engineer') return lowerTitle.includes('devops')
                    if (lowerCategory === 'technical lead') return lowerTitle.includes('technical lead') || lowerTitle.includes('tech lead')
                    if (lowerCategory === 'security engineer') return lowerTitle.includes('security') || lowerTitle.includes('cyber')
                    if (lowerCategory === 'data scientist') return lowerTitle.includes('data scientist')
                    if (lowerCategory === 'qa engineer') return lowerTitle.includes('qa') || lowerTitle.includes('quality')
                    if (lowerCategory === 'project manager') return lowerTitle.includes('project manager') || lowerTitle.includes('program manager')
                    return lowerTitle.includes(lowerCategory)
                  })
                  const categoryRates = competitors.map(c => c.rate)
                  const avgRate = categoryRates.reduce((sum, r) => sum + r, 0) / categoryRates.length

                  return (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                        aria-expanded={isExpanded}
                        aria-controls={`category-${category.replace(/\s+/g, '-')}`}
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="w-4 h-4 text-purple-600" aria-hidden="true" />
                          <span className="font-medium text-sm text-gray-900">{category}</span>
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{competitors.length} vendors</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          {ourRole && (
                            <div className="text-right text-xs">
                              <span className="text-gray-500">Your rate:</span>
                              <span className="font-semibold text-gray-900 ml-1">${ourRole.hourlyRate.toFixed(2)}/hr</span>
                              <span className="text-gray-500 ml-2">vs avg</span>
                              <span className={`font-semibold ml-1 ${ourRole.hourlyRate < avgRate ? 'text-green-600' : 'text-orange-600'}`}>
                                ${avgRate.toFixed(2)}/hr
                              </span>
                            </div>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div id={`category-${category.replace(/\s+/g, '-')}`} className="divide-y divide-gray-100">
                          {competitors.map((competitor) => {
                            const comparison = ourRole ? getRateComparison(ourRole.hourlyRate, competitor.rate) : null
                            const ComparisonIcon = comparison?.icon || TrendingUp

                            return (
                              <div
                                key={competitor.id}
                                className="group px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between"
                                onClick={() => openGSASlideout(competitor)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGSASlideout(competitor) } }}
                                tabIndex={0}
                                role="button"
                                aria-label={`${competitor.vendor}, ${competitor.laborCategory}, $${competitor.rate.toFixed(2)} per hour. Click for details.`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{competitor.vendor}</p>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                    <span>{competitor.contractNumber}</span>
                                    <span>•</span>
                                    <span>{competitor.education} + {competitor.yearsExp} yrs</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6">
                                  {ourRole && (
                                    <div className="text-right">
                                      <p className="text-xs text-gray-500 uppercase">Your Rate</p>
                                      <p className="text-sm font-semibold text-blue-600">${ourRole.hourlyRate.toFixed(2)}/hr</p>
                                    </div>
                                  )}
                                  <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase">Their Rate</p>
                                    <p className="text-sm font-bold text-gray-900">${competitor.rate.toFixed(2)}/hr</p>
                                  </div>
                                  {comparison && (
                                    <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${comparison.bgColor}`}>
                                      <ComparisonIcon className="w-3 h-3" aria-hidden="true" />
                                      <span>{comparison.label}</span>
                                    </div>
                                  )}
                                  <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== BLS SLIDEOUT PANEL ==================== */}
      {isSlideoutOpen && selectedRole && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40" 
            onClick={closeSlideout}
            aria-hidden="true"
          />
          <div 
            ref={slideoutRef}
            className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto z-50 animate-in slide-in-from-right"
            role="dialog"
            aria-modal="true"
            aria-labelledby="slideout-title"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 id="slideout-title" className="text-lg font-semibold text-gray-900">{selectedRole.title}</h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {selectedRole.level} • {formatFTE(selectedRole.fte)} FTE • ${selectedRole.hourlyRate.toFixed(2)}/hr
                </p>
              </div>
              <Button 
                ref={slideoutCloseRef}
                variant="ghost" 
                size="sm" 
                onClick={closeSlideout} 
                className="h-8 w-8 p-0"
                aria-label="Close details panel"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {(() => {
                const blsData = findBLSData(selectedRole.title)
                if (!blsData) return <p className="text-sm text-gray-600">No BLS data available for this role.</p>

                const percentile = calculatePercentile(selectedRole.salary, blsData)
                const status = getPercentileStatus(percentile)
                const diffFromMedian = selectedRole.salary - blsData.median
                const percentDiff = ((diffFromMedian / blsData.median) * 100)

                return (
                  <>
                    {/* Salary Comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Your Proposed Salary</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedRole.salary)}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">BLS Median Salary</p>
                        <p className="text-2xl font-bold text-gray-600">{formatCurrency(blsData.median)}</p>
                        <p className={`text-sm mt-1 font-medium ${percentDiff >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {percentDiff >= 0 ? '+' : ''}{percentDiff.toFixed(1)}% vs median
                        </p>
                      </div>
                    </div>

                    {/* Market Position */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-900">Market Position</p>
                        <p className={`text-lg font-bold ${status.textColor}`}>{formatOrdinal(percentile)} Percentile</p>
                      </div>

                      <div 
                        className="relative h-10 bg-gradient-to-r from-green-100 via-blue-100 via-60% to-amber-100 rounded-lg overflow-hidden border border-gray-200"
                        aria-label={`Market position indicator showing ${formatOrdinal(percentile)} percentile. Scale ranges from green (below market) on left, through blue (competitive) in middle, to red (above market) on right.`}
                      >
                        <div className="absolute top-0 bottom-0 w-1 bg-gray-900" style={{ left: `${Math.min(percentile, 100)}%` }}>
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900 rounded-full border-2 border-white" />
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2 mt-3 text-center">
                        {[
                          { label: '10th', value: blsData.percentile10 },
                          { label: '25th', value: blsData.percentile25 },
                          { label: 'Median', value: blsData.median },
                          { label: '75th', value: blsData.percentile75 },
                          { label: '90th', value: blsData.percentile90 },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                            <p className={`text-sm font-medium ${label === 'Median' ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                              ${(value / 1000).toFixed(0)}k
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status Message */}
                    <div className={`p-4 rounded-lg border ${status.color}`}>
                      <div className="flex items-start gap-3">
                        {percentile >= 50 ? (
                          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        )}
                        <div>
                          <p className="text-sm font-semibold mb-1">{status.label}</p>
                          <p className="text-sm">{status.description}</p>
                        </div>
                      </div>
                    </div>

                    {/* Rate Justification Form */}
                    {(percentile >= 75 || percentile <= 25) && (
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center gap-2 mb-4">
                          <AlertTriangle className={`w-5 h-5 ${percentile >= 75 ? 'text-amber-500' : 'text-blue-500'}`} aria-hidden="true" />
                          <h4 className="text-sm font-semibold text-gray-900">
                            {percentile >= 75 ? 'Rate Documentation Needed' : 'Cost Realism Documentation Needed'}
                          </h4>
                        </div>
                        
                        <p className="text-xs text-gray-600 mb-4">
                          {percentile >= 75 
                            ? 'This role is above the 75th percentile. Document why this rate is necessary to support your position during cost reviews.'
                            : 'This role is below the 25th percentile. Document how you can deliver quality work at this rate.'
                          }
                        </p>

                        {(() => {
                          const currentJustification = roleJustifications[selectedRole.id] || {
                            roleId: selectedRole.id,
                            roleTitle: selectedRole.title,
                            percentile,
                            selectedReasons: {},
                            notes: '',
                            savedAt: ''
                          }

                          const updateJustification = (updates: Partial<RoleJustification['selectedReasons']> | { notes: string }) => {
                            setRateJustifications(prev => {
                              const existing = prev[selectedRole.id] || {
                                roleId: selectedRole.id,
                                roleTitle: selectedRole.title,
                                percentile,
                                selectedReasons: {},
                                notes: '',
                                savedAt: ''
                              }
                              return {
                                ...prev,
                                [selectedRole.id]: {
                                  ...existing,
                                  ...(('notes' in updates) ? updates : { selectedReasons: { ...existing.selectedReasons, ...updates } }),
                                  savedAt: ''
                                }
                              }
                            })
                          }

                          const saveJustification = () => {
                            setRateJustifications(prev => {
                              const existing = prev[selectedRole.id] || currentJustification
                              return { ...prev, [selectedRole.id]: { ...existing, savedAt: new Date().toISOString() } }
                            })
                          }

                          const hasJustification = currentJustification.savedAt !== ''
                          const isHighRate = percentile >= 75

                          return (
                            <div className="space-y-4">
                              {isHighRate ? (
                                <>
                                  <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                      <Checkbox 
                                        id="clearance" 
                                        checked={!!currentJustification.selectedReasons.clearance}
                                        onCheckedChange={(checked) => updateJustification({ clearance: checked ? '' : undefined })} 
                                      />
                                      <div className="flex-1">
                                        <Label htmlFor="clearance" className="text-sm font-medium cursor-pointer">Security Clearance Required</Label>
                                        <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.clearance}</p>
                                      </div>
                                    </div>
                                    {currentJustification.selectedReasons.clearance !== undefined && (
                                      <Select value={currentJustification.selectedReasons.clearance || ''} 
                                        onValueChange={(value) => updateJustification({ clearance: value })}>
                                        <SelectTrigger className="w-full h-8 text-xs ml-6" aria-label="Select clearance level"><SelectValue placeholder="Select clearance level" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Secret">Secret</SelectItem>
                                          <SelectItem value="Top Secret">Top Secret</SelectItem>
                                          <SelectItem value="TS/SCI">TS/SCI</SelectItem>
                                          <SelectItem value="TS/SCI w/ Poly">TS/SCI w/ Poly</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                      <Checkbox 
                                        id="location" 
                                        checked={!!currentJustification.selectedReasons.location}
                                        onCheckedChange={(checked) => updateJustification({ location: checked ? '' : undefined })} 
                                      />
                                      <div className="flex-1">
                                        <Label htmlFor="location" className="text-sm font-medium cursor-pointer">Geographic Location</Label>
                                        <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.location}</p>
                                      </div>
                                    </div>
                                    {currentJustification.selectedReasons.location !== undefined && (
                                      <Select value={currentJustification.selectedReasons.location || ''} 
                                        onValueChange={(value) => updateJustification({ location: value })}>
                                        <SelectTrigger className="w-full h-8 text-xs ml-6" aria-label="Select location"><SelectValue placeholder="Select location" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Washington DC Metro">Washington DC Metro</SelectItem>
                                          <SelectItem value="San Francisco Bay Area">San Francisco Bay Area</SelectItem>
                                          <SelectItem value="New York Metro">New York Metro</SelectItem>
                                          <SelectItem value="Boston Metro">Boston Metro</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <Checkbox 
                                      id="keyPersonnel" 
                                      checked={!!currentJustification.selectedReasons.keyPersonnel}
                                      onCheckedChange={(checked) => updateJustification({ keyPersonnel: !!checked })} 
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor="keyPersonnel" className="text-sm font-medium cursor-pointer">Key Personnel (Named Individual)</Label>
                                      <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.keyPersonnel}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <Checkbox 
                                      id="nicheSkills" 
                                      checked={!!currentJustification.selectedReasons.nicheSkills}
                                      onCheckedChange={(checked) => updateJustification({ nicheSkills: !!checked })} 
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor="nicheSkills" className="text-sm font-medium cursor-pointer">Specialized Skills</Label>
                                      <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.nicheSkills}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <Checkbox 
                                      id="pastPerformance" 
                                      checked={!!currentJustification.selectedReasons.pastPerformance}
                                      onCheckedChange={(checked) => updateJustification({ pastPerformance: !!checked })} 
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor="pastPerformance" className="text-sm font-medium cursor-pointer">Incumbent / Prior Experience</Label>
                                      <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.pastPerformance}</p>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-start gap-2">
                                    <Checkbox 
                                      id="efficiency" 
                                      checked={!!currentJustification.selectedReasons.efficiency}
                                      onCheckedChange={(checked) => updateJustification({ efficiency: !!checked })} 
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor="efficiency" className="text-sm font-medium cursor-pointer">Efficiency Gains / Automation</Label>
                                      <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.efficiency}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <Checkbox 
                                      id="reusableAssets" 
                                      checked={!!currentJustification.selectedReasons.reusableAssets}
                                      onCheckedChange={(checked) => updateJustification({ reusableAssets: !!checked })} 
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor="reusableAssets" className="text-sm font-medium cursor-pointer">Reusable Components</Label>
                                      <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.reusableAssets}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <Checkbox 
                                      id="volumeDiscount" 
                                      checked={!!currentJustification.selectedReasons.volumeDiscount}
                                      onCheckedChange={(checked) => updateJustification({ volumeDiscount: !!checked })} 
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor="volumeDiscount" className="text-sm font-medium cursor-pointer">Volume / Long-term Discount</Label>
                                      <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.volumeDiscount}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <Checkbox 
                                      id="provenDelivery" 
                                      checked={!!currentJustification.selectedReasons.provenDelivery}
                                      onCheckedChange={(checked) => updateJustification({ provenDelivery: !!checked })} 
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor="provenDelivery" className="text-sm font-medium cursor-pointer">Proven Delivery at This Rate</Label>
                                      <p className="text-xs text-gray-500 mt-0.5">{JUSTIFICATION_HELP.provenDelivery}</p>
                                    </div>
                                  </div>
                                </>
                              )}

                              <div className="space-y-2">
                                <Label htmlFor="notes" className="text-sm font-medium">Additional Notes</Label>
                                <Textarea
                                  id="notes"
                                  placeholder="Add any additional context that supports this rate..."
                                  value={currentJustification.notes}
                                  onChange={(e) => updateJustification({ notes: e.target.value })}
                                  className="text-sm min-h-[80px]"
                                />
                              </div>

                              <div className="flex items-center justify-between pt-2">
                                <Button onClick={saveJustification} size="sm" className="gap-2">
                                  <Save className="w-4 h-4" aria-hidden="true" />
                                  Save Documentation
                                </Button>
                                {hasJustification && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                    Saved {new Date(currentJustification.savedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* BLS Classification */}
                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold text-gray-900 mb-3">BLS Classification</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">SOC Code</span>
                          <span className="font-medium text-gray-900">{blsData.socCode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Occupation</span>
                          <span className="font-medium text-gray-900 text-right max-w-[250px]">{blsData.occupation}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Last Updated</span>
                          <span className="font-medium text-gray-900">{blsData.lastUpdated}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <Button variant="outline" className="w-full" asChild>
                <a href="https://www.bls.gov/oes/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                  View on BLS.gov
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ==================== GSA SLIDEOUT PANEL ==================== */}
      {isSlideoutOpen && selectedGSACompetitor && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40" 
            onClick={closeSlideout}
            aria-hidden="true"
          />
          <div 
            ref={slideoutRef}
            className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto z-50 animate-in slide-in-from-right"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gsa-slideout-title"
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 id="gsa-slideout-title" className="text-lg font-semibold text-gray-900">{selectedGSACompetitor.vendor}</h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {selectedGSACompetitor.laborCategory} • SIN {selectedGSACompetitor.sin}
                </p>
              </div>
              <Button 
                ref={slideoutCloseRef}
                variant="ghost" 
                size="sm" 
                onClick={closeSlideout} 
                className="h-8 w-8 p-0"
                aria-label="Close details panel"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {(() => {
                const lowerCategory = selectedGSACompetitor.laborCategory.toLowerCase()
                const ourRole = roles.find(r => {
                  const lowerTitle = r.title.toLowerCase()
                  if (lowerTitle === lowerCategory) return true
                  if (lowerCategory === 'senior software engineer') {
                    return lowerTitle.includes('senior') && lowerTitle.includes('software') && lowerTitle.includes('engineer')
                  }
                  if (lowerCategory === 'software engineer') {
                    return lowerTitle.includes('software') && lowerTitle.includes('engineer') && !lowerTitle.includes('senior')
                  }
                  if (lowerCategory === 'devops engineer') return lowerTitle.includes('devops')
                  if (lowerCategory === 'technical lead') return lowerTitle.includes('technical lead') || lowerTitle.includes('tech lead')
                  if (lowerCategory === 'security engineer') return lowerTitle.includes('security') || lowerTitle.includes('cyber')
                  if (lowerCategory === 'data scientist') return lowerTitle.includes('data scientist')
                  if (lowerCategory === 'qa engineer') return lowerTitle.includes('qa') || lowerTitle.includes('quality')
                  if (lowerCategory === 'project manager') return lowerTitle.includes('project manager')
                  return lowerTitle.includes(lowerCategory)
                })
                const comparison = ourRole ? getRateComparison(ourRole.hourlyRate, selectedGSACompetitor.rate) : null
                const ComparisonIcon = comparison?.icon || TrendingUp

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs text-gray-600 mb-1">Your Rate</p>
                        {ourRole ? (
                          <>
                            <p className="text-2xl font-bold text-blue-600">${ourRole.hourlyRate.toFixed(2)}/hr</p>
                            <p className="text-xs text-gray-500 mt-1">{ourRole.title}</p>
                          </>
                        ) : (
                          <p className="text-lg font-medium text-gray-400">No matching role</p>
                        )}
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">Competitor Rate</p>
                        <p className="text-2xl font-bold text-gray-900">${selectedGSACompetitor.rate.toFixed(2)}/hr</p>
                        <p className="text-xs text-gray-500 mt-1">{selectedGSACompetitor.vendor}</p>
                      </div>
                    </div>
                    
                    {comparison && (
                      <div className={`p-4 rounded-lg border ${comparison.bgColor}`}>
                        <div className="flex items-center gap-3">
                          <ComparisonIcon className={`w-5 h-5 ${comparison.color}`} aria-hidden="true" />
                          <div>
                            <p className={`text-sm font-semibold ${comparison.color}`}>
                              Your rate is {comparison.label} than {selectedGSACompetitor.vendor}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {comparison.color.includes('green') || comparison.color.includes('blue')
                                ? 'Your rate is competitive with this vendor.'
                                : 'Consider documenting what differentiates your offering (experience, certifications, specialized skills).'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-3">Qualifications</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-gray-500" aria-hidden="true" />
                            <p className="text-xs text-gray-600">Education</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{selectedGSACompetitor.education}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-gray-500" aria-hidden="true" />
                            <p className="text-xs text-gray-600">Experience</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{selectedGSACompetitor.yearsExp} years</p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold text-gray-900 mb-3">Contract Information</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Contract Number</span>
                          <span className="font-medium text-gray-900">{selectedGSACompetitor.contractNumber}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Award Year</span>
                          <Badge variant="secondary" className="text-xs">{selectedGSACompetitor.awardYear}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Region</span>
                          <span className="font-medium text-gray-900">{selectedGSACompetitor.region}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">SIN</span>
                          <Badge variant="outline" className="text-xs">{selectedGSACompetitor.sin}</Badge>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <Button variant="outline" className="w-full" asChild>
                <a href="https://calc.gsa.gov/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                  View on GSA CALC
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </Button>
            </div>
          </div>
        </>
      )}
    </TooltipProvider>
  )
}