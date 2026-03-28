// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import { useAppContext, Subcontractor, ODCItem, PerDiemCalculation, Role } from '@/contexts/app-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Plus,
  Check,
  Trash2,
  Calculator,
  DollarSign,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Settings2,
  Plane,
  Package,
  Pencil,
  CheckCircle2,
  Building2,
  AlertTriangle,
  MapPin,
  Shield,
  Award,
  FileText,
Clock,
BarChart3,
} from 'lucide-react'

// ==================== LOCAL TYPES ====================

interface TeamRole {
  id: string
  title: string
  icLevel: string
  quantity: number
  ftePerPerson: number
  baseSalary: number
  hourlyRate: number
  hoursPerYear: number
  years: string[]
  storyPoints?: number
}

interface RateBreakdown {
  baseSalary: number
  directRate: number
  fringeAmount: number
  overheadAmount: number
  gaAmount: number
  fullyLoadedRate: number
  profitAmount: number
  billedRate: number
}
// WBS Hours data structure (mock - will integrate with Estimate tab)
interface WBSRoleHours {
roleId: string
roleName: string
hoursByPeriod: {
base: number
option1?: number
option2?: number
option3?: number
option4?: number
}
wbsBreakdown: Array<{
wbsNumber: string
wbsTitle: string
hours: number
}>
totalHours: number
suggestedFte: number
}



// ==================== HELPER FUNCTIONS ====================


// Convert AppContext year object to string array
const yearsObjectToArray = (years: { base: boolean; option1: boolean; option2: boolean; option3: boolean; option4: boolean }): string[] => {
  const result: string[] = []
  if (years.base) result.push('base')
  if (years.option1) result.push('option1')
  if (years.option2) result.push('option2')
  if (years.option3) result.push('option3')
  if (years.option4) result.push('option4')
  return result
}

// Convert string array to AppContext year object
const yearsArrayToObject = (years: string[]): { base: boolean; option1: boolean; option2: boolean; option3: boolean; option4: boolean } => ({
  base: years.includes('base'),
  option1: years.includes('option1'),
  option2: years.includes('option2'),
  option3: years.includes('option3'),
  option4: years.includes('option4'),
})

// Format ordinal numbers (1st, 2nd, 3rd, etc.)
function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ODC Category labels
const odcCategoryLabels: Record<string, string> = {
  'travel': 'Travel',
  'materials': 'Materials',
  'equipment': 'Equipment',
  'software': 'Software',
  'other': 'Other',
}

// icLevelOptions is now derived dynamically inside the component from icLevelRates
const fteOptions = [0.25, 0.5, 0.75, 1.0]

// ==================== BLS DATA FOR RATE JUSTIFICATION ====================

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
}

// BLS salary data by role (May 2024 OEWS)
const BLS_MAPPINGS: Record<string, BLSData> = {
  'Technical Lead': {
    socCode: '11-3021',
    occupation: 'Computer and Information Systems Managers',
    percentile10: 98890, percentile25: 128230, median: 169510, percentile75: 217200, percentile90: 267620, mean: 179780,
    lastUpdated: '2024-05-01'
  },
  'Solutions Architect': {
    socCode: '15-1299',
    occupation: 'Computer Occupations, All Other',
    percentile10: 62480, percentile25: 88450, median: 118370, percentile75: 153050, percentile90: 189170, mean: 121370,
    lastUpdated: '2024-05-01'
  },
  'Senior Software Engineer': {
    socCode: '15-1252',
    occupation: 'Software Developers',
    percentile10: 77020, percentile25: 103690, median: 132270, percentile75: 168570, percentile90: 208620, mean: 139380,
    lastUpdated: '2024-05-01'
  },
  'Software Engineer': {
    socCode: '15-1252',
    occupation: 'Software Developers',
    percentile10: 77020, percentile25: 103690, median: 132270, percentile75: 168570, percentile90: 208620, mean: 139380,
    lastUpdated: '2024-05-01'
  },
  'DevOps Engineer': {
    socCode: '15-1252',
    occupation: 'Software Developers',
    percentile10: 77020, percentile25: 103690, median: 132270, percentile75: 168570, percentile90: 208620, mean: 139380,
    lastUpdated: '2024-05-01'
  },
  'Cloud Engineer': {
    socCode: '15-1252',
    occupation: 'Software Developers',
    percentile10: 77020, percentile25: 103690, median: 132270, percentile75: 168570, percentile90: 208620, mean: 139380,
    lastUpdated: '2024-05-01'
  },
  'Data Scientist': {
    socCode: '15-2051',
    occupation: 'Data Scientists',
    percentile10: 61090, percentile25: 85560, median: 108020, percentile75: 141330, percentile90: 178440, mean: 113310,
    lastUpdated: '2024-05-01'
  },
  'Security Engineer': {
    socCode: '15-1212',
    occupation: 'Information Security Analysts',
    percentile10: 64280, percentile25: 84100, median: 120360, percentile75: 156230, percentile90: 188150, mean: 125750,
    lastUpdated: '2024-05-01'
  },
  'QA Engineer': {
    socCode: '15-1253',
    occupation: 'Software Quality Assurance Analysts and Testers',
    percentile10: 51350, percentile25: 71290, median: 101800, percentile75: 130870, percentile90: 158830, mean: 104090,
    lastUpdated: '2024-05-01'
  },
  'UI/UX Designer': {
    socCode: '15-1255',
    occupation: 'Web and Digital Interface Designers',
    percentile10: 41810, percentile25: 57220, median: 80730, percentile75: 109890, percentile90: 142980, mean: 85560,
    lastUpdated: '2024-05-01'
  },
  'Project Manager': {
    socCode: '11-9199',
    occupation: 'Managers, All Other',
    percentile10: 62610, percentile25: 89030, median: 125540, percentile75: 172770, percentile90: 224080, mean: 135960,
    lastUpdated: '2024-05-01'
  },
  'Business Analyst': {
    socCode: '13-1111',
    occupation: 'Management Analysts',
    percentile10: 52250, percentile25: 71500, median: 99410, percentile75: 137160, percentile90: 175080, mean: 107640,
    lastUpdated: '2024-05-01'
  },
  'DEFAULT': {
    socCode: '15-1299',
    occupation: 'Computer Occupations, All Other',
    percentile10: 62480, percentile25: 88450, median: 118370, percentile75: 153050, percentile90: 189170, mean: 121370,
    lastUpdated: '2024-05-01'
  }
}

// Find best BLS match for a role title
function findBLSData(roleTitle: string): BLSData | null {
  if (!roleTitle) return null
  
  // Direct match
  if (BLS_MAPPINGS[roleTitle]) return BLS_MAPPINGS[roleTitle]
  
  // Partial match
  const lowerTitle = roleTitle.toLowerCase()
  for (const [key, data] of Object.entries(BLS_MAPPINGS)) {
    if (key !== 'DEFAULT' && lowerTitle.includes(key.toLowerCase())) {
      return data
    }
  }
  
  // Keyword matching
  if (lowerTitle.includes('engineer') && lowerTitle.includes('software')) return BLS_MAPPINGS['Software Engineer']
  if (lowerTitle.includes('lead') || lowerTitle.includes('architect')) return BLS_MAPPINGS['Technical Lead']
  if (lowerTitle.includes('devops') || lowerTitle.includes('cloud')) return BLS_MAPPINGS['DevOps Engineer']
  if (lowerTitle.includes('security') || lowerTitle.includes('cyber')) return BLS_MAPPINGS['Security Engineer']
  if (lowerTitle.includes('data') && lowerTitle.includes('scien')) return BLS_MAPPINGS['Data Scientist']
  if (lowerTitle.includes('qa') || lowerTitle.includes('test') || lowerTitle.includes('quality')) return BLS_MAPPINGS['QA Engineer']
  if (lowerTitle.includes('design') || lowerTitle.includes('ux') || lowerTitle.includes('ui')) return BLS_MAPPINGS['UI/UX Designer']
  if (lowerTitle.includes('project') || lowerTitle.includes('program')) return BLS_MAPPINGS['Project Manager']
  if (lowerTitle.includes('analyst')) return BLS_MAPPINGS['Business Analyst']
  
  return BLS_MAPPINGS['DEFAULT']
}

// Calculate percentile position for a salary against BLS data
function calculateBLSPercentile(salary: number, blsData: BLSData): number {
  if (salary <= blsData.percentile10) return 10
  if (salary <= blsData.percentile25) return 10 + ((salary - blsData.percentile10) / (blsData.percentile25 - blsData.percentile10)) * 15
  if (salary <= blsData.median) return 25 + ((salary - blsData.percentile25) / (blsData.median - blsData.percentile25)) * 25
  if (salary <= blsData.percentile75) return 50 + ((salary - blsData.median) / (blsData.percentile75 - blsData.median)) * 25
  if (salary <= blsData.percentile90) return 75 + ((salary - blsData.percentile75) / (blsData.percentile90 - blsData.percentile75)) * 15
  return 90 + Math.min(10, ((salary - blsData.percentile90) / blsData.percentile90) * 100)
}

// ==================== MAIN COMPONENT ====================

export function RolesAndPricingTab() {
  const {
    solicitation,
    indirectRates,
    // Subcontractors from context
    subcontractors,
    addSubcontractor,
    updateSubcontractor,
    removeSubcontractor,
    // Teaming Partners from context
    teamingPartners,
    getOrCreatePartnerByName,
    // ODCs from context
    odcs,
    addODC,
    updateODC,
    removeODC,
    // Per Diem from context
    perDiem,
    addPerDiem,
    updatePerDiem,
    removePerDiem,
    // Selected Roles from context
    selectedRoles,
    addRole,
    updateRole,
    removeRole,
    // Solicitation pricing settings & editor
    getPricingSettings,
    openSolicitationEditor,
    // Rate Justifications
    rateJustifications,
    // Tab Navigation
    navigateToRateJustification,
    // WBS Data from Estimate tab (replaces scopingData)
  estimateWbsElements,
  // Labor categories from Account Center
  getIcLevelSalaries,
} = useAppContext()
  
  // Get pricing settings from solicitation (centralized source of truth)
  const pricingSettings = getPricingSettings()
  
  const billableHours = pricingSettings.billableHours
  const profitMargin = pricingSettings.profitMargin
  const laborEscalation = pricingSettings.laborEscalation
  const odcEscalation = pricingSettings.odcEscalation
  const showEscalation = pricingSettings.escalationEnabled

  // ==================== IC LEVEL RATES (from Account Center) ====================
  
   const icLevelRates = useMemo(() => {
    return getIcLevelSalaries()
  }, [getIcLevelSalaries])

  // Derive IC level options from actual company data
  const icLevelOptions = useMemo(() => {
    const levels = Object.keys(icLevelRates)
    return levels.length > 0 ? levels.sort() : ['IC3', 'IC4', 'IC5'] // Fallback if no company data
  }, [icLevelRates])

  // ==================== DERIVED VALUES (needed early) ====================

  // Normalize indirect rates (handle decimal vs percentage)
  const normalizeRate = (rate: number | undefined, defaultVal: number): number => {
    if (rate === undefined) return defaultVal
    return rate < 1 ? rate * 100 : rate
  }
  
  const rates = {
    fringe: normalizeRate(indirectRates?.fringe, 21.16),
    overhead: normalizeRate(indirectRates?.overhead, 34.26),
    gAndA: normalizeRate(indirectRates?.ga, 19.83),
  }
  
// ==================== WBS HOURS FROM CONTEXT ====================
  // Build WBS hours data from scopingData.epics instead of mock data
  
// ==================== WBS HOURS FROM ESTIMATE TAB ====================
// Build WBS hours data from estimateWbsElements (shared via AppContext)

const wbsHoursByRole = useMemo((): WBSRoleHours[] => {
  // Debug logging - remove after confirming data flow works
  console.log('DEBUG estimateWbsElements:', {
    hasData: !!estimateWbsElements,
    count: estimateWbsElements?.length || 0,
    firstElement: estimateWbsElements?.[0] ? {
      title: estimateWbsElements[0].title,
      wbsNumber: estimateWbsElements[0].wbsNumber,
      laborEstimatesCount: estimateWbsElements[0].laborEstimates?.length || 0
    } : null
  })
  
  // If no estimate data, return empty array
  if (!estimateWbsElements || estimateWbsElements.length === 0) {
    return []
  }
  
  // Group hours by role across all WBS elements
  const roleHoursMap: Record<string, {
    roleId: string
    roleName: string
    totalHours: number
    hoursByPeriod: {
      base: number
      option1: number
      option2: number
      option3: number
      option4: number
    }
    wbsBreakdown: Array<{ wbsNumber: string; wbsTitle: string; hours: number }>
  }> = {}
  
  estimateWbsElements.forEach((element) => {
    // Skip if no labor estimates
    if (!element.laborEstimates || !Array.isArray(element.laborEstimates)) return
    
    element.laborEstimates.forEach(labor => {
      if (!labor.roleName) return // Skip if no role name
      
      // Normalize key for matching (case-insensitive)
      const key = labor.roleName.toLowerCase().trim()
      
      if (!roleHoursMap[key]) {
        roleHoursMap[key] = {
          roleId: labor.roleId || `role-${key.replace(/\s+/g, '-')}`,
          roleName: labor.roleName,
          totalHours: 0,
          hoursByPeriod: {
            base: 0,
            option1: 0,
            option2: 0,
            option3: 0,
            option4: 0
          },
          wbsBreakdown: []
        }
      }
      
      // Sum hours by period
      const periods = labor.hoursByPeriod || {}
      roleHoursMap[key].hoursByPeriod.base += periods.base || 0
      roleHoursMap[key].hoursByPeriod.option1 += periods.option1 || 0
      roleHoursMap[key].hoursByPeriod.option2 += periods.option2 || 0
      roleHoursMap[key].hoursByPeriod.option3 += periods.option3 || 0
      roleHoursMap[key].hoursByPeriod.option4 += periods.option4 || 0
      
      // Calculate total hours for this labor estimate
      const laborTotal = 
        (periods.base || 0) + 
        (periods.option1 || 0) + 
        (periods.option2 || 0) +
        (periods.option3 || 0) +
        (periods.option4 || 0)
      
      roleHoursMap[key].totalHours += laborTotal
      
      // Add to WBS breakdown
      roleHoursMap[key].wbsBreakdown.push({
        wbsNumber: element.wbsNumber,
        wbsTitle: element.title,
        hours: laborTotal
      })
    })
  })
  
  // Convert to WBSRoleHours array
  return Object.values(roleHoursMap).map(data => ({
    roleId: data.roleId,
    roleName: data.roleName,
    hoursByPeriod: data.hoursByPeriod,
    wbsBreakdown: data.wbsBreakdown,
    totalHours: data.totalHours,
    suggestedFte: Math.round((data.totalHours / (billableHours || 1920)) * 100) / 100
  }))
}, [estimateWbsElements, billableHours])
      
  
  // Panel states
  const [selectedRoleForBreakdown, setSelectedRoleForBreakdown] = useState<TeamRole | null>(null)
  const [showSubsExpanded, setShowSubsExpanded] = useState(false)
  const [showOdcExpanded, setShowOdcExpanded] = useState(false)
  const [showTravelExpanded, setShowTravelExpanded] = useState(false)
// WBS expansion state for Column 1 role cards
const [expandedWbsRoles, setExpandedWbsRoles] = useState<Record<string, boolean>>({})
const toggleWbsExpanded = (roleId: string) => {
setExpandedWbsRoles(prev => ({ ...prev, [roleId]: !prev[roleId] }))
}
  
  // Role edit dialog
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<TeamRole | null>(null)
  const [roleFormData, setRoleFormData] = useState({
    title: '',
    icLevel: 'IC4',
    quantity: 1,
    ftePerPerson: 1,
    baseSalary: 120000,
    hoursPerYear: billableHours,
    years: [] as string[],
  })
  
  // ODC dialog
  const [odcDialogOpen, setOdcDialogOpen] = useState(false)
  const [editingOdc, setEditingOdc] = useState<ODCItem | null>(null)
  const [odcFormData, setOdcFormData] = useState({
    description: '',
    category: 'software' as ODCItem['category'],
    quantity: 1,
    unitCost: 0,
    years: [] as string[],
  })
  
  // Per Diem (Travel) dialog
  const [travelDialogOpen, setTravelDialogOpen] = useState(false)
  const [editingTravel, setEditingTravel] = useState<PerDiemCalculation | null>(null)
  const [travelFormData, setTravelFormData] = useState({
    location: '',
    ratePerDay: 0,
    numberOfDays: 1,
    numberOfPeople: 1,
    years: [] as string[],
  })
  
  // Subcontractor dialog
  const [subDialogOpen, setSubDialogOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<Subcontractor | null>(null)
  const [subFormData, setSubFormData] = useState({
    partnerId: '',
    newPartnerName: '',
    companyName: '',
    role: '',
    laborCategory: '',
    theirRate: 0,
    markupPercent: 10,
    allocations: {
      base: { enabled: true, fte: 1, hours: billableHours },
      option1: { enabled: true, fte: 1, hours: billableHours },
      option2: { enabled: true, fte: 1, hours: billableHours },
      option3: { enabled: false, fte: 0, hours: 0 },
      option4: { enabled: false, fte: 0, hours: 0 },
    } as Record<string, { enabled: boolean; fte: number }>,
  })
  
  // Assign Role to Sub dialog (for recommended roles)
  const [assignSubDialogOpen, setAssignSubDialogOpen] = useState(false)
  const [assigningRole, setAssigningRole] = useState<Role | null>(null)
  const [assignSubFormData, setAssignSubFormData] = useState({
    partnerId: '' as string,
    newPartnerName: '',
    theirRate: 0,
    markupPercent: 10,
    quantity: 1,
    ftePerPerson: 1,
    years: [] as string[],
  })
  
  // Manual Add Role dialog (with destination choice)
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false)
  const [addRoleDestination, setAddRoleDestination] = useState<'prime' | 'sub'>('prime')
  const [addRoleFormData, setAddRoleFormData] = useState({
    title: '',
    icLevel: 'IC4' as Role['icLevel'],
    quantity: 1,
    storyPoints: 20,
    ftePerPerson: 1,
    baseSalary: 120000,
    partnerId: '',
    newPartnerName: '',
    theirRate: 0,
    markupPercent: 10,
    years: [] as string[],
  })

  // ==================== DERIVED VALUES ====================
  
  // Static rate calculation (doesn't depend on state) - defined first so useMemo can use it
  const calculateRateBreakdownStatic = (
    baseSalary: number, 
    ratesObj: { fringe: number; overhead: number; gAndA: number },
    profit: number
  ): RateBreakdown => {
    const standardHours = 2080
    const directRate = baseSalary / standardHours
    const fringeAmount = directRate * (ratesObj.fringe / 100)
    const withFringe = directRate + fringeAmount
    const overheadAmount = withFringe * (ratesObj.overhead / 100)
    const withOverhead = withFringe + overheadAmount
    const gaAmount = withOverhead * (ratesObj.gAndA / 100)
    const fullyLoadedRate = withOverhead + gaAmount
    const profitAmount = fullyLoadedRate * (profit / 100)
    const billedRate = fullyLoadedRate + profitAmount
    return { baseSalary, directRate, fringeAmount, overheadAmount, gaAmount, fullyLoadedRate, profitAmount, billedRate }
  }
  
  // Convert AppContext Role to local TeamRole format for display
  const teamRoles: TeamRole[] = useMemo(() => {
    return selectedRoles.map(role => {
      const baseSalary = role.baseSalary || icLevelRates[role.icLevel] || 100000
      const breakdown = calculateRateBreakdownStatic(baseSalary, rates, profitMargin)
      return {
        id: role.id,
        title: role.name,
        icLevel: role.icLevel,
        quantity: role.quantity,
        ftePerPerson: role.fte,
        baseSalary,
        hourlyRate: breakdown.billedRate,
        hoursPerYear: role.billableHours || billableHours,
        years: yearsObjectToArray(role.years),
      }
    })
  }, [selectedRoles, rates, profitMargin, billableHours, icLevelRates])

  // Contract years from solicitation
  const contractYears = useMemo(() => {
    const years: { id: string; label: string; index: number }[] = []
    if (solicitation?.periodOfPerformance?.baseYear !== false) {
      years.push({ id: 'base', label: 'Base', index: 0 })
    }
    const optionYears = solicitation?.periodOfPerformance?.optionYears || 2
    for (let i = 1; i <= optionYears; i++) {
      years.push({ id: `option${i}`, label: `Opt ${i}`, index: i })
    }
    return years
  }, [solicitation])

  // ==================== CALCULATION FUNCTIONS ====================

  const calculateRateBreakdown = (baseSalary: number): RateBreakdown => {
    const standardHours = 2080
    const directRate = baseSalary / standardHours
    
    const fringeAmount = directRate * (rates.fringe / 100)
    const withFringe = directRate + fringeAmount
    
    const overheadAmount = withFringe * (rates.overhead / 100)
    const withOverhead = withFringe + overheadAmount
    
    const gaAmount = withOverhead * (rates.gAndA / 100)
    const fullyLoadedRate = withOverhead + gaAmount
    
    const profitAmount = fullyLoadedRate * (profitMargin / 100)
    const billedRate = fullyLoadedRate + profitAmount
    
    return { baseSalary, directRate, fringeAmount, overheadAmount, gaAmount, fullyLoadedRate, profitAmount, billedRate }
  }

  const calculateHourlyRate = (icLevel: string, customSalary?: number): number => {
    const baseSalary = customSalary || icLevelRates[icLevel] || 100000
    return calculateRateBreakdown(baseSalary).billedRate
  }

  // ==================== AGGREGATE CALCULATIONS ====================

  const calculations = useMemo(() => {
    const yearCosts: Record<string, { labor: number; subs: number; odcs: number; travel: number; total: number }> = {}
    
    const getEscMult = (yearIndex: number, rate: number): number => {
      if (!showEscalation || yearIndex === 0) return 1
      return Math.pow(1 + rate / 100, yearIndex)
    }
    
    contractYears.forEach((year) => {
      const laborEscMult = getEscMult(year.index, laborEscalation)
      const odcEscMult = getEscMult(year.index, odcEscalation)
      
      // Labor costs
      let laborTotal = 0
      teamRoles.forEach(role => {
        if (role.years.includes(year.id)) {
          const escalatedRate = role.hourlyRate * laborEscMult
          const annualCost = escalatedRate * role.hoursPerYear * role.quantity * role.ftePerPerson
          laborTotal += annualCost
        }
      })
      
      // Subcontractor costs
      let subsTotal = 0
      subcontractors.forEach(sub => {
        if (sub.allocations) {
          const allocation = sub.allocations[year.id as keyof typeof sub.allocations]
          if (allocation?.enabled && allocation.fte > 0) {
            const annualBilled = sub.billedRate * allocation.fte * billableHours
            subsTotal += annualBilled * laborEscMult
          }
        } else {
          const subYears = yearsObjectToArray(sub.years)
          if (subYears.includes(year.id)) {
            const annualBilled = sub.billedRate * sub.fte * billableHours
            subsTotal += annualBilled * laborEscMult
          }
        }
      })
      
      // ODC costs
      let odcsTotal = 0
      odcs.forEach(odc => {
        const odcYears = yearsObjectToArray(odc.years)
        if (odcYears.includes(year.id)) {
          const baseCost = odc.totalCost || (odc.quantity || 1) * (odc.unitCost || 0)
          odcsTotal += baseCost * odcEscMult
        }
      })
      
      // Per Diem (Travel) costs
      let travelTotal = 0
      perDiem.forEach(pd => {
        const pdYears = yearsObjectToArray(pd.years)
        if (pdYears.includes(year.id)) {
          const baseCost = pd.totalCost || pd.ratePerDay * pd.numberOfDays * pd.numberOfPeople
          travelTotal += baseCost * odcEscMult
        }
      })
      
      yearCosts[year.id] = {
        labor: laborTotal,
        subs: subsTotal,
        odcs: odcsTotal,
        travel: travelTotal,
        total: laborTotal + subsTotal + odcsTotal + travelTotal,
      }
    })
    
    const laborTotal = Object.values(yearCosts).reduce((sum, y) => sum + y.labor, 0)
    const subsTotal = Object.values(yearCosts).reduce((sum, y) => sum + y.subs, 0)
    const odcsTotal = Object.values(yearCosts).reduce((sum, y) => sum + y.odcs, 0)
    const travelTotal = Object.values(yearCosts).reduce((sum, y) => sum + y.travel, 0)
    const totalContract = laborTotal + subsTotal + odcsTotal + travelTotal
    
    const totalFTE = teamRoles.reduce((sum, r) => sum + (r.quantity * r.ftePerPerson), 0)
    const avgRate = teamRoles.length > 0
      ? teamRoles.reduce((sum, r) => sum + r.hourlyRate, 0) / teamRoles.length
      : 0
    
    return {
      yearCosts,
      laborTotal,
      subsTotal,
      odcsTotal,
      travelTotal,
      totalContract,
      totalFTE,
      avgRate,
      roleCount: teamRoles.length,
    }
  }, [teamRoles, contractYears, laborEscalation, odcEscalation, showEscalation, subcontractors, odcs, perDiem, billableHours])

  // Helper to calculate sub total contract cost with escalation
  const calculateSubTotalContractCost = (sub: Subcontractor): number => {
    const getEscMult = (yearIndex: number): number => {
      if (!showEscalation || yearIndex === 0) return 1
      return Math.pow(1 + laborEscalation / 100, yearIndex)
    }
    
    let total = 0
    contractYears.forEach((year) => {
      let fte = 0
      if (sub.allocations) {
        const alloc = sub.allocations[year.id as keyof typeof sub.allocations]
        fte = alloc?.enabled ? alloc.fte : 0
      } else {
        const subYears = yearsObjectToArray(sub.years)
        fte = subYears.includes(year.id) ? sub.fte : 0
      }
      total += sub.billedRate * fte * billableHours * getEscMult(year.index)
    })
    return total
  }

  const groupedSubcontractors = useMemo(() => {
    const groups: Record<string, { 
      partnerId: string;
      companyName: string; 
      roles: Subcontractor[]; 
      totalContractCost: number;
      baseFte: number;
      avgMarkup: number;
    }> = {}
    
    subcontractors.forEach(sub => {
      const key = sub.partnerId || sub.companyName.toLowerCase()
      if (!groups[key]) {
        groups[key] = {
          partnerId: sub.partnerId || '',
          companyName: sub.companyName,
          roles: [],
          totalContractCost: 0,
          baseFte: 0,
          avgMarkup: 0,
        }
      }
      groups[key].roles.push(sub)
      groups[key].totalContractCost += calculateSubTotalContractCost(sub)
      const baseFte = sub.allocations?.base?.enabled ? sub.allocations.base.fte : sub.fte
      groups[key].baseFte += baseFte
    })
    
    Object.values(groups).forEach(group => {
      if (group.roles.length > 0) {
        group.avgMarkup = group.roles.reduce((sum, r) => sum + r.markupPercent, 0) / group.roles.length
      }
    })
    
    return Object.values(groups)
  }, [subcontractors, contractYears, showEscalation, laborEscalation, billableHours, calculateSubTotalContractCost])

  const [expandedPartnerGroups, setExpandedPartnerGroups] = useState<Record<string, boolean>>({})

  const togglePartnerGroup = (partnerId: string) => {
    setExpandedPartnerGroups(prev => ({ ...prev, [partnerId]: !prev[partnerId] }))
  }

  // ==================== ROLE HANDLERS ====================

  const handleAddToTeam = (recRole: Role) => {
    const baseSalary = recRole.baseSalary || icLevelRates[recRole.icLevel] || 100000
    const defaultYears = contractYears.length > 0
      ? contractYears.map(y => y.id)
      : ['base', 'option1', 'option2']

    addRole({
      id: `role-${crypto.randomUUID()}`,
      name: recRole.name,
      description: recRole.description,
      icLevel: recRole.icLevel as 'IC1' | 'IC2' | 'IC3' | 'IC4' | 'IC5' | 'IC6',
      baseSalary,
      quantity: recRole.quantity,
      fte: 1,
      storyPoints: recRole.storyPoints,
      years: yearsArrayToObject(defaultYears),
      billableHours: billableHours,
      isKeyPersonnel: recRole.isKeyPersonnel,
    })
  }

  const handleRemoveFromTeam = (roleId: string) => {
    removeRole(roleId)
    if (selectedRoleForBreakdown?.id === roleId) {
      setSelectedRoleForBreakdown(null)
    }
  }

  const handleEditRole = (role: TeamRole) => {
    setEditingRole(role)
    setRoleFormData({
      title: role.title,
      icLevel: role.icLevel,
      quantity: role.quantity,
      ftePerPerson: role.ftePerPerson,
      baseSalary: role.baseSalary,
      hoursPerYear: role.hoursPerYear,
      years: [...role.years],
    })
    setEditRoleDialogOpen(true)
  }

  const handleSaveRole = () => {
    if (!editingRole) return
    
    updateRole(editingRole.id, {
      name: roleFormData.title,
      icLevel: roleFormData.icLevel as 'IC1' | 'IC2' | 'IC3' | 'IC4' | 'IC5' | 'IC6',
      baseSalary: roleFormData.baseSalary,
      quantity: roleFormData.quantity,
      fte: roleFormData.ftePerPerson,
      years: yearsArrayToObject(roleFormData.years),
      billableHours: roleFormData.hoursPerYear,
    })
    
    setEditRoleDialogOpen(false)
    setEditingRole(null)
  }

  const toggleRoleFormYear = (yearId: string) => {
    setRoleFormData(prev => ({
      ...prev,
      years: prev.years.includes(yearId)
        ? prev.years.filter(y => y !== yearId)
        : [...prev.years, yearId]
    }))
  }

  const getRoleAssignment = (name: string): 'prime' | 'sub' | null => {
    if (teamRoles.some(r => r.title === name)) return 'prime'
    if (subcontractors.some(s => s.role === name)) return 'sub'
    return null
  }

  const toggleRoleYear = (roleId: string, yearId: string) => {
    const role = teamRoles.find(r => r.id === roleId)
    if (!role) return
    
    const newYears = role.years.includes(yearId)
      ? role.years.filter(y => y !== yearId)
      : [...role.years, yearId]
    
    updateRole(roleId, {
      years: yearsArrayToObject(newYears),
    })
  }

  // ==================== ODC HANDLERS ====================

  const handleAddOdc = () => {
    setEditingOdc(null)
    const defaultYears = contractYears.length > 0 
      ? contractYears.map(y => y.id) 
      : ['base', 'option1', 'option2']
    setOdcFormData({
      description: '',
      category: 'software',
      quantity: 1,
      unitCost: 0,
      years: defaultYears,
    })
    setOdcDialogOpen(true)
  }

  const handleEditOdc = (odc: ODCItem) => {
    setEditingOdc(odc)
    setOdcFormData({
      description: odc.description,
      category: odc.category,
      quantity: odc.quantity,
      unitCost: odc.unitCost,
      years: yearsObjectToArray(odc.years),
    })
    setOdcDialogOpen(true)
  }

  const handleSaveOdc = () => {
    const totalCost = odcFormData.quantity * odcFormData.unitCost
    if (editingOdc) {
      updateODC(editingOdc.id, {
        description: odcFormData.description,
        category: odcFormData.category,
        quantity: odcFormData.quantity,
        unitCost: odcFormData.unitCost,
        totalCost,
        years: yearsArrayToObject(odcFormData.years),
      })
    } else {
      addODC({
        id: `odc-${Date.now()}`,
        description: odcFormData.description,
        category: odcFormData.category,
        quantity: odcFormData.quantity,
        unitCost: odcFormData.unitCost,
        totalCost,
        years: yearsArrayToObject(odcFormData.years),
      })
    }
    setOdcDialogOpen(false)
    setEditingOdc(null)
  }

  const handleDeleteOdc = (odcId: string) => removeODC(odcId)

  const toggleOdcFormYear = (yearId: string) => {
    setOdcFormData(prev => ({
      ...prev,
      years: prev.years.includes(yearId)
        ? prev.years.filter(y => y !== yearId)
        : [...prev.years, yearId]
    }))
  }

  // ==================== TRAVEL HANDLERS ====================

  const handleAddTravel = () => {
    setEditingTravel(null)
    const defaultYears = contractYears.length > 0 
      ? contractYears.map(y => y.id) 
      : ['base', 'option1', 'option2']
    setTravelFormData({
      location: '',
      ratePerDay: 0,
      numberOfDays: 1,
      numberOfPeople: 1,
      years: defaultYears,
    })
    setTravelDialogOpen(true)
  }

  const handleEditTravel = (pd: PerDiemCalculation) => {
    setEditingTravel(pd)
    setTravelFormData({
      location: pd.location,
      ratePerDay: pd.ratePerDay,
      numberOfDays: pd.numberOfDays,
      numberOfPeople: pd.numberOfPeople,
      years: yearsObjectToArray(pd.years),
    })
    setTravelDialogOpen(true)
  }

  const handleSaveTravel = () => {
    const totalCost = travelFormData.ratePerDay * travelFormData.numberOfDays * travelFormData.numberOfPeople
    if (editingTravel) {
      updatePerDiem(editingTravel.id, {
        location: travelFormData.location,
        ratePerDay: travelFormData.ratePerDay,
        numberOfDays: travelFormData.numberOfDays,
        numberOfPeople: travelFormData.numberOfPeople,
        totalCost,
        years: yearsArrayToObject(travelFormData.years),
      })
    } else {
      addPerDiem({
        id: `pd-${Date.now()}`,
        location: travelFormData.location,
        ratePerDay: travelFormData.ratePerDay,
        numberOfDays: travelFormData.numberOfDays,
        numberOfPeople: travelFormData.numberOfPeople,
        totalCost,
        years: yearsArrayToObject(travelFormData.years),
      })
    }
    setTravelDialogOpen(false)
    setEditingTravel(null)
  }

  const handleDeleteTravel = (pdId: string) => removePerDiem(pdId)

  const toggleTravelFormYear = (yearId: string) => {
    setTravelFormData(prev => ({
      ...prev,
      years: prev.years.includes(yearId)
        ? prev.years.filter(y => y !== yearId)
        : [...prev.years, yearId]
    }))
  }

  // ==================== SUBCONTRACTOR HANDLERS ====================

  const handleEditSub = (sub: Subcontractor) => {
    setEditingSub(sub)
    const existingPartner = teamingPartners.find(p => 
      p.id === sub.partnerId || p.companyName.toLowerCase() === sub.companyName.toLowerCase()
    )
    
    let allocations: Record<string, { enabled: boolean; fte: number }>
    if (sub.allocations) {
      allocations = { ...sub.allocations }
    } else {
      const subYears = yearsObjectToArray(sub.years)
      allocations = {
        base: { enabled: subYears.includes('base'), fte: sub.fte },
        option1: { enabled: subYears.includes('option1'), fte: sub.fte },
        option2: { enabled: subYears.includes('option2'), fte: sub.fte },
        option3: { enabled: subYears.includes('option3'), fte: sub.fte },
        option4: { enabled: subYears.includes('option4'), fte: sub.fte },
      }
    }
    
    setSubFormData({
      partnerId: existingPartner?.id || '',
      newPartnerName: '',
      companyName: sub.companyName,
      role: sub.role,
      laborCategory: sub.laborCategory || '',
      theirRate: sub.theirRate,
      markupPercent: sub.markupPercent,
      allocations,
    })
    setSubDialogOpen(true)
  }

  const handleSaveSub = () => {
    let companyName = subFormData.companyName
    let partnerId = subFormData.partnerId
    
    if (subFormData.partnerId === 'new' && subFormData.newPartnerName) {
      const newPartner = getOrCreatePartnerByName(subFormData.newPartnerName)
      companyName = subFormData.newPartnerName
      partnerId = newPartner.id
    } else if (subFormData.partnerId && subFormData.partnerId !== 'new') {
      const existingPartner = teamingPartners.find(p => p.id === subFormData.partnerId)
      if (existingPartner) {
        companyName = existingPartner.companyName
        partnerId = existingPartner.id
      }
    }
    
    const billedRate = subFormData.theirRate * (1 + subFormData.markupPercent / 100)

    const enabledAllocations = Object.values(subFormData.allocations).filter(a => a.enabled)
    const legacyFte = enabledAllocations.length > 0
      ? enabledAllocations.reduce((sum, a) => sum + a.fte, 0) / enabledAllocations.length
      : 1

    const legacyYears = {
      base: subFormData.allocations.base?.enabled ?? false,
      option1: subFormData.allocations.option1?.enabled ?? false,
      option2: subFormData.allocations.option2?.enabled ?? false,
      option3: subFormData.allocations.option3?.enabled ?? false,
      option4: subFormData.allocations.option4?.enabled ?? false,
    }

    if (editingSub) {
      updateSubcontractor(editingSub.id, {
        companyName,
        role: subFormData.role,
        laborCategory: subFormData.laborCategory,
        theirRate: subFormData.theirRate,
        markupPercent: subFormData.markupPercent,
        billedRate,
        fte: legacyFte,
        years: legacyYears,
        allocations: subFormData.allocations,
        partnerId,
      })
    } else {
      addSubcontractor({
        id: `sub-${Date.now()}`,
        companyName,
        role: subFormData.role,
        laborCategory: subFormData.laborCategory,
        theirRate: subFormData.theirRate,
        markupPercent: subFormData.markupPercent,
        billedRate,
        fte: legacyFte,
        years: legacyYears,
        allocations: subFormData.allocations,
        partnerId,
      })
    }
    setSubDialogOpen(false)
    setEditingSub(null)
  }

  const handleDeleteSub = (subId: string) => removeSubcontractor(subId)

  const toggleSubYear = (subId: string, yearId: string) => {
    const sub = subcontractors.find(s => s.id === subId)
    if (!sub) return

    if (sub.allocations) {
      const currentAlloc = sub.allocations[yearId as keyof typeof sub.allocations]
      const updatedAllocations = {
        ...sub.allocations,
        [yearId]: {
          ...currentAlloc,
          enabled: !currentAlloc.enabled,
          fte: !currentAlloc.enabled ? (currentAlloc.fte || 1) : currentAlloc.fte
        }
      }
      updateSubcontractor(subId, { allocations: updatedAllocations })
    } else {
      const currentYears = yearsObjectToArray(sub.years)
      const newEnabled = !currentYears.includes(yearId)
      
      const allocations = {
        base: { enabled: currentYears.includes('base'), fte: sub.fte },
        option1: { enabled: currentYears.includes('option1'), fte: sub.fte },
        option2: { enabled: currentYears.includes('option2'), fte: sub.fte },
        option3: { enabled: currentYears.includes('option3'), fte: sub.fte },
        option4: { enabled: currentYears.includes('option4'), fte: sub.fte },
      }
      
      allocations[yearId as keyof typeof allocations] = {
        enabled: newEnabled,
        fte: sub.fte
      }
      
      updateSubcontractor(subId, { allocations })
    }
  }

  // ==================== ASSIGN ROLE TO SUB HANDLERS ====================

  const handleAssignToSub = (role: Role) => {
    setAssigningRole(role)
    const defaultYears = contractYears.length > 0 
      ? contractYears.map(y => y.id) 
      : ['base', 'option1', 'option2']
    setAssignSubFormData({
      partnerId: '',
      newPartnerName: '',
      theirRate: 0,
      markupPercent: 10,
      quantity: role.quantity,
      ftePerPerson: 1,
      years: defaultYears,
    })
    setAssignSubDialogOpen(true)
  }

  const handleSaveAssignSub = () => {
    if (!assigningRole) return
    
    let partnerName = ''
    let partnerId = assignSubFormData.partnerId
    
    if (assignSubFormData.partnerId === 'new' && assignSubFormData.newPartnerName) {
      const newPartner = getOrCreatePartnerByName(assignSubFormData.newPartnerName)
      partnerName = assignSubFormData.newPartnerName
      partnerId = newPartner.id
    } else if (assignSubFormData.partnerId) {
      const existingPartner = teamingPartners.find(p => p.id === assignSubFormData.partnerId)
      partnerName = existingPartner?.companyName || ''
    }
    
    if (!partnerName) return
    
    const billedRate = assignSubFormData.theirRate * (1 + assignSubFormData.markupPercent / 100)
    const totalFte = assignSubFormData.quantity * assignSubFormData.ftePerPerson
    
    addSubcontractor({
      id: `sub-${Date.now()}`,
      companyName: partnerName,
      role: assigningRole.name,
      laborCategory: assigningRole.icLevel,
      theirRate: assignSubFormData.theirRate,
      markupPercent: assignSubFormData.markupPercent,
      billedRate,
      fte: totalFte,
      years: yearsArrayToObject(assignSubFormData.years),
      partnerId,
    })
    
    setAssignSubDialogOpen(false)
    setAssigningRole(null)
  }

  const toggleAssignSubYear = (yearId: string) => {
    setAssignSubFormData(prev => ({
      ...prev,
      years: prev.years.includes(yearId)
        ? prev.years.filter(y => y !== yearId)
        : [...prev.years, yearId]
    }))
  }

  // ==================== MANUAL ADD ROLE HANDLERS ====================

  const handleOpenAddRole = () => {
    const defaultYears = contractYears.length > 0 
      ? contractYears.map(y => y.id) 
      : ['base', 'option1', 'option2']
    setAddRoleDestination('prime')
    setAddRoleFormData({
      title: '',
      icLevel: 'IC4',
      quantity: 1,
      storyPoints: 20,
      ftePerPerson: 1,
      baseSalary: 120000,
      partnerId: '',
      newPartnerName: '',
      theirRate: 0,
      markupPercent: 10,
      years: defaultYears,
    })
    setAddRoleDialogOpen(true)
  }

  const handleSaveAddRole = () => {
    if (!addRoleFormData.title) return
    
    const defaultYears = addRoleFormData.years.length > 0 ? addRoleFormData.years : contractYears.map(y => y.id)
    
    if (addRoleDestination === 'prime') {
      addRole({
        id: `role-${Date.now()}`,
        name: addRoleFormData.title,
        description: '',
        icLevel: addRoleFormData.icLevel,
        baseSalary: addRoleFormData.baseSalary,
        quantity: addRoleFormData.quantity,
        fte: addRoleFormData.ftePerPerson,
        storyPoints: addRoleFormData.storyPoints,
        years: yearsArrayToObject(defaultYears),
        billableHours: billableHours,
      })
    } else {
      let partnerName = ''
      let partnerId = addRoleFormData.partnerId
      
      if (addRoleFormData.partnerId === 'new' && addRoleFormData.newPartnerName) {
        const newPartner = getOrCreatePartnerByName(addRoleFormData.newPartnerName)
        partnerName = addRoleFormData.newPartnerName
        partnerId = newPartner.id
      } else if (addRoleFormData.partnerId) {
        const existingPartner = teamingPartners.find(p => p.id === addRoleFormData.partnerId)
        partnerName = existingPartner?.companyName || ''
      }
      
      if (!partnerName) return
      
      const billedRate = addRoleFormData.theirRate * (1 + addRoleFormData.markupPercent / 100)
      const totalFte = addRoleFormData.quantity * addRoleFormData.ftePerPerson
      
      addSubcontractor({
        id: `sub-${Date.now()}`,
        companyName: partnerName,
        role: addRoleFormData.title,
        laborCategory: addRoleFormData.icLevel,
        theirRate: addRoleFormData.theirRate,
        markupPercent: addRoleFormData.markupPercent,
        billedRate,
        fte: totalFte,
        years: yearsArrayToObject(defaultYears),
        partnerId,
      })
    }
    
    setAddRoleDialogOpen(false)
  }

  const toggleAddRoleYear = (yearId: string) => {
    setAddRoleFormData(prev => ({
      ...prev,
      years: prev.years.includes(yearId)
        ? prev.years.filter(y => y !== yearId)
        : [...prev.years, yearId]
    }))
  }

  // ==================== UTILITY FUNCTIONS ====================

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const contractType = solicitation?.contractType || 'T&M'

  // ==================== RENDER ====================

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header - Clean with summary pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">Roles & Pricing</h1>
            <Badge variant="outline" className="text-xs">{contractType}</Badge>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Summary Pill */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 transition-colors"
                  onClick={() => openSolicitationEditor()}
                  aria-label={`Edit pricing settings: ${profitMargin}% profit margin, ${billableHours.toLocaleString()} billable hours per year, ${showEscalation ? `${laborEscalation}% labor and ${odcEscalation}% ODC annual increases` : 'no annual increases'}`}
                >
                  <span>{profitMargin}%</span>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                  <span>{billableHours.toLocaleString()} hrs</span>
                  {showEscalation && laborEscalation > 0 && (
                  <>
                  <span className="text-gray-300" aria-hidden="true">·</span>
          <span>+{laborEscalation}%/yr</span>
  </>
)}
                  <Settings2 className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Click to edit pricing settings</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Three column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Roles From Estimate */}
          <div className="border border-gray-100 rounded-lg bg-white flex flex-col max-h-[calc(100vh-220px)]">
            <div className="flex-shrink-0 p-4 border-b border-gray-100">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    <h2 className="font-medium text-gray-900">Roles From Estimate</h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleOpenAddRole} className="h-7 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Role
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">Hours from WBS · Assign to Prime or Sub</p>
              </div>

                <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{wbsHoursByRole.reduce((sum, r) => sum + r.suggestedFte, 0).toFixed(1)}</span>
                  <span className="text-gray-500">FTE from WBS</span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {wbsHoursByRole.length === 0 ? (
                  <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
                    <BarChart3 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No roles in Estimate yet</p>
                    <p className="text-xs text-gray-500 mt-1">Add WBS elements with labor hours in the Estimate tab</p>
                  </div>
                ) : (
                  wbsHoursByRole.map((wbsRole) => {
                    const assignment = getRoleAssignment(wbsRole.roleName)
                    const isExpanded = expandedWbsRoles[wbsRole.roleId]
                    
                    // Create a mock Role object for the handlers
                    const mockRole: Role = {
                      id: wbsRole.roleId,
                      name: wbsRole.roleName,
                      description: `${wbsRole.totalHours.toLocaleString()} hours across ${wbsRole.wbsBreakdown.length} WBS elements`,
                      icLevel: 'IC4',
                      baseSalary: 120000,
                      quantity: Math.max(1, Math.round(wbsRole.suggestedFte)),
                      fte: 1,
                      storyPoints: 0,
                      years: { base: true, option1: true, option2: true, option3: false, option4: false },
                    }
                    
                    return (
                      <div
                        key={wbsRole.roleId}
                        className={`border rounded-lg p-3 transition-all ${
                          assignment ? 'border-gray-100 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm text-gray-900">{wbsRole.roleName}</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {wbsRole.wbsBreakdown.length} WBS element{wbsRole.wbsBreakdown.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        {/* WBS Hours Display */}
                        <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleWbsExpanded(wbsRole.roleId)
                            }}
                            className="w-full flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-blue-500" />
                              <span className="font-semibold text-blue-700">{wbsRole.totalHours.toLocaleString()} hrs</span>
                              <span className="text-gray-400">·</span>
                              <span className="text-gray-600">~{wbsRole.suggestedFte} FTE</span>
                            </div>
                            {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                          </button>
                          
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
                              {wbsRole.wbsBreakdown.map((wbs, idx) => (
                                <div key={idx} className="flex justify-between text-[10px]">
                                  <span className="text-gray-600">{wbs.wbsNumber} {wbs.wbsTitle}</span>
                                  <span className="text-gray-800 font-medium">{wbs.hours.toLocaleString()} hrs</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {assignment ? (
                          <div className={`flex items-center justify-center gap-2 py-1.5 text-sm rounded-md ${
                            assignment === 'prime' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50'
                          }`}>
                            <Check className="w-4 h-4" />
                            {assignment === 'prime' ? 'Added to Prime' : 'Assigned to Sub'}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => handleAddToTeam(mockRole)} 
                              variant="outline"
                              className="flex-1 h-8 text-sm border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
                            >
                              <Building2 className="w-3.5 h-3.5 mr-1.5" />
                              Prime
                            </Button>
                            <Button 
                              onClick={() => handleAssignToSub(mockRole)} 
                              variant="outline"
                              className="flex-1 h-8 text-sm border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300"
                            >
                              <Users className="w-3.5 h-3.5 mr-1.5" />
                              Sub
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Team Summary */}
          <div className="border border-gray-100 rounded-lg bg-white flex flex-col max-h-[calc(100vh-220px)]">
            <div className="flex-shrink-0 p-4 border-b border-gray-100">
              <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <h2 className="font-medium text-gray-900">Team Summary</h2>
              </div>

              <div className="text-sm text-gray-500">
                {(calculations.totalFTE + subcontractors.reduce((sum, s) => sum + s.fte, 0)).toFixed(2)} FTE · {calculations.roleCount + subcontractors.length} roles
              </div>

              {/* Prime/Sub Split - FAR 52.219-14 Compliance */}
              {(calculations.laborTotal > 0 || calculations.subsTotal > 0) && (
                <div className="space-y-1.5">
                  {(() => {
                    const totalLaborCost = calculations.laborTotal + calculations.subsTotal
                    const primePercent = totalLaborCost > 0 ? (calculations.laborTotal / totalLaborCost) * 100 : 0
                    const subPercent = 100 - primePercent
                    const isCompliant = primePercent >= 50
                    
                    return (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Prime: <span className="font-medium">{primePercent.toFixed(0)}%</span></span>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-600">Sub: <span className="font-medium">{subPercent.toFixed(0)}%</span></span>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                isCompliant 
                                  ? 'bg-green-50 text-green-700' 
                                  : 'bg-red-50 text-red-700'
                              }`}>
                                {isCompliant ? (
                                  <><Check className="w-3 h-3" /> Compliant</>
                                ) : (
                                  <><AlertTriangle className="w-3 h-3" /> Under 50%</>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs font-medium mb-1">FAR 52.219-14: Limitations on Subcontracting</p>
                              <p className="text-xs">For small business set-asides, the prime contractor must perform at least 50% of the cost of contract performance.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${isCompliant ? 'bg-blue-500' : 'bg-red-400'}`}
                            style={{ width: `${primePercent}%` }}
                          />
                      </div>
                    </>
                  )
                })()}
              </div>
              )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
              {/* Prime Labor Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-500 rounded-full" />
                    <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">Prime Labor</span>
                  </div>
                  <span className="text-xs text-gray-500">{calculations.totalFTE.toFixed(2)} FTE</span>
                </div>

                {teamRoles.length === 0 ? (
                  <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
                    <Users className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No prime roles added yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamRoles.map((role) => (
                      <div
                        key={role.id}
                        className="group border border-blue-100 rounded-lg p-3 bg-blue-50/50 hover:border-blue-200 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm text-gray-900">{role.title}</span>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{role.icLevel}</Badge>
                              <span>×{role.quantity}</span>
                              <span>·</span>
                              <span>{role.ftePerPerson} FTE</span>
                              <span>·</span>
                              <span className="font-medium text-gray-700">{formatCurrency(role.hourlyRate)}/hr</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditRole(role)}
                                  className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Edit role</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedRoleForBreakdown(role)}
                                  className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                >
                                  <Calculator className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">View rate breakdown</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveFromTeam(role.id)}
                                  className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Remove role</p></TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {contractYears.map((year) => {
                            const isActive = role.years.includes(year.id)
                            return (
                              <button
                                key={year.id}
                                onClick={() => toggleRoleYear(role.id, year.id)}
                                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                              >
                                {year.label}
                              </button>
                            )
                          })}
                        </div>
                        
                        {/* Rate Justification Indicator (simplified) */}
                        {(() => {
                          const justification = rateJustifications[role.id]
                          const hasJustification = justification?.savedAt && justification.savedAt !== ''
                          
                          // Calculate BLS percentile
                          const blsData = findBLSData(role.title)
                          const percentile = blsData ? calculateBLSPercentile(role.baseSalary, blsData) : null
                          
                          const getPercentileColor = (p: number) => {
                            if (p >= 75) return 'text-red-600'
                            if (p >= 50) return 'text-blue-600'
                            if (p >= 25) return 'text-green-600'
                            return 'text-amber-600'
                          }
                          
                          return (
                            <div className="mt-2 pt-2 border-t border-blue-100 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">Rate Justification</span>
                                {hasJustification ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Documented
                                  </span>
                                ) : percentile !== null && percentile >= 75 ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Needs justification
                                  </span>
                                ) : null}
                              </div>
                              {percentile !== null && (
                                <span className={`text-[10px] font-medium ${getPercentileColor(percentile)}`}>
                                 {formatOrdinal(Math.round(percentile))} %ile
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subcontractors Section */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-orange-500 rounded-full" />
                    <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">Subcontractors</span>
                  </div>
                  <span className="text-xs text-gray-500">{subcontractors.reduce((sum, s) => sum + s.fte, 0).toFixed(2)} FTE</span>
                </div>

                {subcontractors.length === 0 ? (
                  <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
                    <Building2 className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-600 mb-1">No subcontractors assigned</p>
                    <p className="text-xs text-gray-500">Use &quot;Sub&quot; on a role to assign it</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subcontractors.map((sub) => {
                      const getAllocation = (yearId: string) => {
                        if (sub.allocations) {
                          return sub.allocations[yearId as keyof typeof sub.allocations]
                        }
                        const subYears = yearsObjectToArray(sub.years)
                        return { enabled: subYears.includes(yearId), fte: sub.fte }
                      }
                      
                      const avgFtePerYear = sub.allocations
                        ? Object.values(sub.allocations).filter(a => a.enabled).reduce((sum, a) => sum + a.fte, 0) / Math.max(Object.values(sub.allocations).filter(a => a.enabled).length, 1)
                        : sub.fte

                      return (
                        <div
                          key={sub.id}
                          className="group border border-orange-100 rounded-lg p-3 bg-orange-50/50 hover:border-orange-200 transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900">{sub.role}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 border-orange-200">
                                  Sub
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <span className="text-orange-700">{sub.companyName}</span>
                                <span>·</span>
                                <span>{avgFtePerYear.toFixed(2)} FTE</span>
                                <span>·</span>
                                <span className="font-medium text-gray-700">${sub.billedRate.toFixed(2)}/hr</span>
                                <span className="text-green-600">(+{sub.markupPercent}%)</span>
                              </div>
                            </div>
                            
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditSub(sub)}
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Edit subcontractor</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSub(sub.id)}
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Remove subcontractor</p></TooltipContent>
                              </Tooltip>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {contractYears.map((year) => {
                              const allocation = getAllocation(year.id)
                              const isActive = allocation?.enabled ?? false
                              const fte = allocation?.fte ?? 0
                              
                              return (
                                <button
                                  key={year.id}
                                  onClick={() => toggleSubYear(sub.id, year.id)}
                                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                                    isActive ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  }`}
                                >
                                  {year.label}{isActive && fte ? ` · ${fte}` : ''}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
           </div>

         {/* Column 3: Contract Value */}
          <div className="border border-gray-100 rounded-lg bg-white flex flex-col max-h-[calc(100vh-220px)]">
            <div className="flex-shrink-0 p-4 border-b border-gray-100">
              <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <h2 className="font-medium text-gray-900">Contract Value</h2>
              </div>

              <p className="text-sm text-gray-500">
                {showEscalation 
                  ? `With escalation: ${laborEscalation}% labor, ${odcEscalation}% ODCs`
                  : 'Fixed pricing across all years'
                }
              </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
              {/* Year breakdown */}
              <div className="space-y-1">
                {contractYears.map((year) => {
                  const yearData = calculations.yearCosts[year.id] || { total: 0 }
                  const laborEsc = showEscalation && year.index > 0 ? `+${(laborEscalation * year.index).toFixed(1)}%` : ''
                  return (
                    <div key={year.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {year.id === 'base' ? 'Base Year' : `Option Year ${year.id.replace('option', '')}`}:
                        </span>
                        {laborEsc && <span className="text-xs text-gray-500">({laborEsc})</span>}
                      </div>
                      <span className="font-medium text-gray-900">{formatCurrency(yearData.total)}</span>
                    </div>
                  )
                })}
              </div>

              {/* Labor Subtotal */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <span className="text-sm text-gray-600">Labor Subtotal:</span>
                <span className="font-medium text-gray-900">{formatCurrency(calculations.laborTotal)}</span>
              </div>

              {/* Subcontractors - Collapsible */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => setShowSubsExpanded(!showSubsExpanded)}
                  className="w-full flex items-center justify-between py-1 hover:bg-gray-50 rounded -mx-1 px-1"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-700">+ Subcontractors</span>
                    {groupedSubcontractors.length > 0 && (
                      <span className="text-xs text-gray-400">
                        ({groupedSubcontractors.length} partner{groupedSubcontractors.length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatCurrency(calculations.subsTotal)}</span>
                    {showSubsExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>
                
                {showSubsExpanded && (
                  <div className="mt-2 ml-5 space-y-2">
                    {groupedSubcontractors.map((group) => {
                      const isExpanded = expandedPartnerGroups[group.partnerId || group.companyName]
                      return (
                        <div key={group.partnerId || group.companyName} className="text-xs">
                          <button
                            onClick={() => togglePartnerGroup(group.partnerId || group.companyName)}
                            className="w-full flex items-center justify-between py-1 hover:bg-gray-50 rounded -mx-1 px-1"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700 font-medium">{group.companyName}</span>
                              <span className="text-gray-400">
                                ({group.roles.length} role{group.roles.length !== 1 ? 's' : ''})
                              </span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                +{Math.round(group.avgMarkup)}%
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 font-medium">{formatCurrency(group.totalContractCost)}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-3">
                              {group.roles.map((sub) => {
                                const baseFte = sub.allocations?.base?.enabled ? sub.allocations.base.fte : sub.fte
                                const subTotalCost = calculateSubTotalContractCost(sub)
                                const fteDisplay = baseFte === Math.floor(baseFte) ? baseFte.toString() : Number(baseFte.toFixed(2)).toString()
                                
                                return (
                                  <div key={sub.id} className="group flex items-center justify-between py-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-600">{sub.role}</span>
                                      <span className="text-gray-400">
                                        {fteDisplay} FTE · ${sub.theirRate.toFixed(0)}/hr
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-700">{formatCurrency(subTotalCost)} total</span>
                                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleEditSub(sub)} 
                                          className="h-5 w-5 p-0 text-gray-500 hover:text-blue-600"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleDeleteSub(sub.id)} 
                                          className="h-5 w-5 p-0 text-gray-500 hover:text-red-600"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
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
              </div>

              {/* ODCs - Collapsible */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => setShowOdcExpanded(!showOdcExpanded)}
                  className="w-full flex items-center justify-between py-1 hover:bg-gray-50 rounded -mx-1 px-1"
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-700">+ ODCs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatCurrency(calculations.odcsTotal)}</span>
                    {showOdcExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>
                
                {showOdcExpanded && (
                  <div className="mt-2 ml-5 space-y-1.5">
                    {odcs.map((odc) => (
                      <div key={odc.id} className="group flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">{odc.description}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{odcCategoryLabels[odc.category]}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">
                            {odc.quantity > 1 ? `${odc.quantity} × ` : ''}{formatCurrency(odc.unitCost)}/yr
                          </span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditOdc(odc)} 
                              className="h-5 w-5 p-0 text-gray-500 hover:text-blue-600"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteOdc(odc.id)} 
                              className="h-5 w-5 p-0 text-gray-500 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={handleAddOdc} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2">
                      <Plus className="w-3 h-3" />
                      Add ODC
                    </button>
                  </div>
                )}
              </div>

              {/* Travel - Collapsible */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => setShowTravelExpanded(!showTravelExpanded)}
                  className="w-full flex items-center justify-between py-1 hover:bg-gray-50 rounded -mx-1 px-1"
                >
                  <div className="flex items-center gap-2">
                    <Plane className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-700">+ Travel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatCurrency(calculations.travelTotal)}</span>
                    {showTravelExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>
                
                {showTravelExpanded && (
                  <div className="mt-2 ml-5 space-y-2">
                    {perDiem.map((pd) => (
                      <div key={pd.id} className="group text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700 font-medium">{pd.location}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 font-medium">{formatCurrency(pd.totalCost)}/yr</span>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditTravel(pd)} 
                                className="h-5 w-5 p-0 text-gray-500 hover:text-blue-600"
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteTravel(pd.id)} 
                                className="h-5 w-5 p-0 text-gray-500 hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mt-0.5">
                          {pd.numberOfPeople} people × {pd.numberOfDays} days × {formatCurrency(pd.ratePerDay)}/day
                        </div>
                      </div>
                    ))}
                    <button onClick={handleAddTravel} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2">
                      <Plus className="w-3 h-3" />
                      Add Travel
                    </button>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Total Contract:</span>
                  <span className={`text-2xl font-semibold ${calculations.totalContract > 0 ? 'text-green-600' : 'text-gray-400'}`}>{formatCurrency(calculations.totalContract)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Labor + Subs + ODCs + Travel (with escalation)</p>
              </div>

              {/* Summary */}
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total FTE:</span>
                    <span className="font-medium text-gray-900">{calculations.totalFTE.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Avg Rate:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(calculations.avgRate)}/hr</span>
                  </div>
                </div>
              </div>

              {/* Profit insight */}
              {calculations.totalContract > 0 && (
                <div className="p-3 bg-green-50 border-l-2 border-l-green-500 rounded-r-lg">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-green-800">Estimated Profit at {profitMargin}%</p>
                      <p className="text-sm font-semibold text-green-700 mt-0.5">
                        {formatCurrency(calculations.laborTotal * (profitMargin / 100) / (1 + profitMargin / 100))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
             </div>
              </div>
            </div>
          </div>

        {/* ==================== DIALOGS ==================== */}

        {/* Edit Role Dialog */}
        <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
              <DialogDescription>Modify role details and year allocations</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role-title">Role Name</Label>
                <Input
                  id="role-title"
                  value={roleFormData.title}
                  onChange={(e) => setRoleFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role-ic-level">IC Level</Label>
                  <select
                    id="role-ic-level"
                    value={roleFormData.icLevel}
                    onChange={(e) => {
                      const newLevel = e.target.value
                      setRoleFormData(prev => ({
                        ...prev,
                        icLevel: newLevel,
                        baseSalary: icLevelRates[newLevel] || prev.baseSalary,
                      }))
                    }}
                    className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm"
                  >
                    {icLevelOptions.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-salary">Base Salary</Label>
                  <Input
                    id="role-salary"
                    type="number"
                    value={roleFormData.baseSalary}
                    onChange={(e) => setRoleFormData(prev => ({ ...prev, baseSalary: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role-quantity">Quantity</Label>
                  <Input
                    id="role-quantity"
                    type="number"
                    min={1}
                    value={roleFormData.quantity}
                    onChange={(e) => setRoleFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-fte">FTE per Person</Label>
                  <select
                    id="role-fte"
                    value={roleFormData.ftePerPerson}
                    onChange={(e) => setRoleFormData(prev => ({ ...prev, ftePerPerson: Number(e.target.value) }))}
                    className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm"
                  >
                    {fteOptions.map(fte => (
                      <option key={fte} value={fte}>{fte}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Year Allocations</Label>
                <div className="flex flex-wrap gap-2">
                  {contractYears.map((year) => {
                    const isActive = roleFormData.years.includes(year.id)
                    return (
                      <button
                        key={year.id}
                        type="button"
                        onClick={() => toggleRoleFormYear(year.id)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                          isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {year.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-900">Calculated Billed Rate:</span>
                  <span className="text-lg font-semibold text-blue-600">
                    {formatCurrency(calculateHourlyRate(roleFormData.icLevel, roleFormData.baseSalary))}/hr
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveRole}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ODC Dialog */}
        <Dialog open={odcDialogOpen} onOpenChange={setOdcDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingOdc ? 'Edit ODC' : 'Add ODC'}</DialogTitle>
              <DialogDescription>Other Direct Costs directly attributable to the contract</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="odc-desc">Description <span className="text-red-500">*</span></Label>
                <Input
                  id="odc-desc"
                  placeholder="e.g., AWS Cloud Services"
                  value={odcFormData.description}
                  onChange={(e) => setOdcFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="odc-category">Category</Label>
                  <select
                    id="odc-category"
                    value={odcFormData.category}
                    onChange={(e) => setOdcFormData(prev => ({ ...prev, category: e.target.value as ODCItem['category'] }))}
                    className="w-full h-9 px-3 rounded-md border border-gray-200 bg-white text-sm"
                  >
                    {Object.entries(odcCategoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="odc-qty">Quantity</Label>
                  <Input
                    id="odc-qty"
                    type="number"
                    min={1}
                    value={odcFormData.quantity}
                    onChange={(e) => setOdcFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="odc-cost">Unit Cost (per year) <span className="text-red-500">*</span></Label>
                <Input
                  id="odc-cost"
                  type="number"
                  min={0}
                  placeholder="0.00"
                  value={odcFormData.unitCost || ''}
                  onChange={(e) => setOdcFormData(prev => ({ ...prev, unitCost: Number(e.target.value) }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Applicable Years</Label>
                <div className="flex flex-wrap gap-2">
                  {contractYears.map((year) => {
                    const isActive = odcFormData.years.includes(year.id)
                    return (
                      <button
                        key={year.id}
                        type="button"
                        onClick={() => toggleOdcFormYear(year.id)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                          isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {year.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {odcFormData.unitCost > 0 && odcFormData.years.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Total: {odcFormData.quantity} × {formatCurrency(odcFormData.unitCost)} × {odcFormData.years.length} years</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(odcFormData.quantity * odcFormData.unitCost * odcFormData.years.length)}</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOdcDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveOdc} disabled={!odcFormData.description || odcFormData.unitCost <= 0}>
                {editingOdc ? <><CheckCircle2 className="w-4 h-4 mr-2" />Save Changes</> : <><Plus className="w-4 h-4 mr-2" />Add ODC</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Travel Dialog */}
        <Dialog open={travelDialogOpen} onOpenChange={setTravelDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTravel ? 'Edit Travel' : 'Add Travel'}</DialogTitle>
              <DialogDescription>Per diem travel costs per FAR 31.205-46</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="travel-location">Location <span className="text-red-500">*</span></Label>
                <Input
                  id="travel-location"
                  placeholder="e.g., Washington, DC"
                  value={travelFormData.location}
                  onChange={(e) => setTravelFormData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="travel-rate">Rate/Day</Label>
                  <Input
                    id="travel-rate"
                    type="number"
                    min={0}
                    placeholder="0.00"
                    value={travelFormData.ratePerDay || ''}
                    onChange={(e) => setTravelFormData(prev => ({ ...prev, ratePerDay: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="travel-days">Days</Label>
                  <Input
                    id="travel-days"
                    type="number"
                    min={1}
                    value={travelFormData.numberOfDays}
                    onChange={(e) => setTravelFormData(prev => ({ ...prev, numberOfDays: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="travel-people">People</Label>
                  <Input
                    id="travel-people"
                    type="number"
                    min={1}
                    value={travelFormData.numberOfPeople}
                    onChange={(e) => setTravelFormData(prev => ({ ...prev, numberOfPeople: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Applicable Years</Label>
                <div className="flex flex-wrap gap-2">
                  {contractYears.map((year) => {
                    const isActive = travelFormData.years.includes(year.id)
                    return (
                      <button
                        key={year.id}
                        type="button"
                        onClick={() => toggleTravelFormYear(year.id)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                          isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {year.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {travelFormData.ratePerDay > 0 && travelFormData.years.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      {travelFormData.numberOfPeople} × {travelFormData.numberOfDays}d × {formatCurrency(travelFormData.ratePerDay)} × {travelFormData.years.length}yr
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(travelFormData.ratePerDay * travelFormData.numberOfDays * travelFormData.numberOfPeople * travelFormData.years.length)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setTravelDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveTravel} disabled={!travelFormData.location || travelFormData.ratePerDay <= 0}>
                {editingTravel ? <><CheckCircle2 className="w-4 h-4 mr-2" />Save Changes</> : <><Plus className="w-4 h-4 mr-2" />Add Travel</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Subcontractor Dialog */}
        <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSub ? 'Edit Subcontractor' : 'Add Subcontractor'}</DialogTitle>
              <DialogDescription>Subcontractor labor with pass-through markup</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Teaming Partner <span className="text-red-500">*</span></Label>
                <Select 
                  value={subFormData.partnerId} 
                  onValueChange={(v) => {
                    if (v === 'new') {
                      setSubFormData(prev => ({ ...prev, partnerId: v, newPartnerName: '', companyName: '' }))
                    } else {
                      const partner = teamingPartners.find(p => p.id === v)
                      setSubFormData(prev => ({ 
                        ...prev, 
                        partnerId: v, 
                        companyName: partner?.companyName || '',
                        newPartnerName: '' 
                      }))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a teaming partner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      <span className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5" />
                        Add New Partner
                      </span>
                    </SelectItem>
                    {teamingPartners.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-t">
                          Existing Partners
                        </div>
                        {teamingPartners.map(partner => (
                          <SelectItem key={partner.id} value={partner.id}>
                            <span className="flex items-center gap-2">
                              {partner.companyName}
                              {partner.businessSize === 'small' && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">SB</Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {subFormData.partnerId === 'new' && (
                <div className="space-y-2">
                  <Label htmlFor="sub-new-partner">Company Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="sub-new-partner"
                    placeholder="e.g., TechPartners LLC"
                    value={subFormData.newPartnerName}
                    onChange={(e) => setSubFormData(prev => ({ ...prev, newPartnerName: e.target.value, companyName: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500">This will create a new teaming partner</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sub-role">Role <span className="text-red-500">*</span></Label>
                <Input
                  id="sub-role"
                  placeholder="e.g., Senior Cloud Architect"
                  value={subFormData.role}
                  onChange={(e) => setSubFormData(prev => ({ ...prev, role: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sub-lcat">Labor Category (Optional)</Label>
                <Input
                  id="sub-lcat"
                  placeholder="e.g., Subject Matter Expert III"
                  value={subFormData.laborCategory}
                  onChange={(e) => setSubFormData(prev => ({ ...prev, laborCategory: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sub-rate">Their Rate/hr <span className="text-red-500">*</span></Label>
                  <Input
                    id="sub-rate"
                    type="number"
                    min={0}
                    placeholder="0.00"
                    value={subFormData.theirRate || ''}
                    onChange={(e) => setSubFormData(prev => ({ ...prev, theirRate: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sub-markup">Markup %</Label>
                  <Input
                    id="sub-markup"
                    type="number"
                    min={0}
                    max={100}
                    value={subFormData.markupPercent}
                    onChange={(e) => setSubFormData(prev => ({ ...prev, markupPercent: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Year Allocations</Label>
                <div className="space-y-2">
                  {contractYears.map((year) => {
                    const allocation = subFormData.allocations[year.id] || { enabled: false, fte: 1 }
                    return (
                      <div key={year.id} className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSubFormData(prev => ({
                              ...prev,
                              allocations: {
                                ...prev.allocations,
                                [year.id]: {
                                  ...allocation,
                                  enabled: !allocation.enabled,
                                  fte: !allocation.enabled ? (allocation.fte || 1) : allocation.fte
                                }
                              }
                            }))
                          }}
                          className={`w-16 px-2 py-1.5 text-sm font-medium rounded-md transition-all ${
                            allocation.enabled ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {year.label}
                        </button>
                      
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`sub-fte-${year.id}`} className="text-xs text-gray-500">FTE:</Label>
                          <Input
                            id={`sub-fte-${year.id}`}
                            type="number"
                            min={0.25}
                            max={10}
                            step={0.25}
                            value={allocation.fte}
                            onChange={(e) => {
                              setSubFormData(prev => ({
                                ...prev,
                                allocations: {
                                  ...prev.allocations,
                                  [year.id]: {
                                    ...allocation,
                                    fte: Number(e.target.value)
                                  }
                                }
                              }))
                            }}
                            className="w-20 h-8 text-sm"
                          />
                          <span className="text-xs text-gray-400">({(allocation.fte * billableHours).toLocaleString()} hrs)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {subFormData.theirRate > 0 && Object.values(subFormData.allocations).some(a => a.enabled) && (
                <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Their Rate:</span>
                    <span className="text-gray-900">{formatCurrency(subFormData.theirRate)}/hr</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Billed Rate (+{subFormData.markupPercent}%):</span>
                    <span className="text-gray-900">{formatCurrency(subFormData.theirRate * (1 + subFormData.markupPercent / 100))}/hr</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Annual Cost by Period ({billableHours.toLocaleString()} hrs)</p>
                    {contractYears.map(year => {
                      const allocation = subFormData.allocations[year.id]
                      if (!allocation?.enabled) return null
                      const theirCost = subFormData.theirRate * allocation.fte * billableHours
                      const billedCost = subFormData.theirRate * (1 + subFormData.markupPercent / 100) * allocation.fte * billableHours
                      return (
                        <div key={year.id} className="flex justify-between text-xs">
                          <span className="text-gray-600">{year.label} ({allocation.fte} FTE):</span>
                          <div className="text-right">
                            <span className="text-gray-500">{formatCurrency(theirCost)}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="font-medium text-gray-900">{formatCurrency(billedCost)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSaveSub} 
                disabled={
                  !subFormData.role || 
                  subFormData.theirRate <= 0 ||
                  (!subFormData.partnerId || (subFormData.partnerId === 'new' && !subFormData.newPartnerName))
                }
              >
                {editingSub ? <><CheckCircle2 className="w-4 h-4 mr-2" />Save Changes</> : <><Plus className="w-4 h-4 mr-2" />Add Sub</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Role to Sub Dialog */}
        <Dialog open={assignSubDialogOpen} onOpenChange={setAssignSubDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Role to Subcontractor</DialogTitle>
              <DialogDescription>Select a teaming partner to fill this role</DialogDescription>
            </DialogHeader>

            {assigningRole && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">{assigningRole.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{assigningRole.icLevel}</Badge>
                  </div>
                  <p className="text-xs text-gray-600">
                    {assigningRole.quantity} position{assigningRole.quantity !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Teaming Partner <span className="text-red-500">*</span></Label>
                  <Select 
                    value={assignSubFormData.partnerId} 
                    onValueChange={(v) => setAssignSubFormData(prev => ({ ...prev, partnerId: v, newPartnerName: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a teaming partner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">
                        <span className="flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5" />
                          Add New Partner
                        </span>
                      </SelectItem>
                      {teamingPartners.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-t">
                            Existing Partners
                          </div>
                          {teamingPartners.map(partner => (
                            <SelectItem key={partner.id} value={partner.id}>
                              <span className="flex items-center gap-2">
                                {partner.companyName}
                                {partner.businessSize === 'small' && (
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">SB</Badge>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {assignSubFormData.partnerId === 'new' && (
                  <div className="space-y-2">
                    <Label htmlFor="new-partner-name">Company Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="new-partner-name"
                      placeholder="e.g., TechPartners LLC"
                      value={assignSubFormData.newPartnerName}
                      onChange={(e) => setAssignSubFormData(prev => ({ ...prev, newPartnerName: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500">This will create a new teaming partner</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assign-qty">Quantity</Label>
                    <Input
                      id="assign-qty"
                      type="number"
                      min={1}
                      value={assignSubFormData.quantity}
                      onChange={(e) => setAssignSubFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assign-fte">FTE per Person</Label>
                    <Input
                      id="assign-fte"
                      type="number"
                      min={0.25}
                      max={1}
                      step={0.25}
                      value={assignSubFormData.ftePerPerson}
                      onChange={(e) => setAssignSubFormData(prev => ({ ...prev, ftePerPerson: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assign-rate">Their Rate/hr <span className="text-red-500">*</span></Label>
                    <Input
                      id="assign-rate"
                      type="number"
                      min={0}
                      placeholder="0.00"
                      value={assignSubFormData.theirRate || ''}
                      onChange={(e) => setAssignSubFormData(prev => ({ ...prev, theirRate: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assign-markup">Your Markup %</Label>
                    <Input
                      id="assign-markup"
                      type="number"
                      min={0}
                      max={100}
                      value={assignSubFormData.markupPercent}
                      onChange={(e) => setAssignSubFormData(prev => ({ ...prev, markupPercent: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Applicable Years</Label>
                  <div className="flex flex-wrap gap-2">
                    {contractYears.map((year) => {
                      const isActive = assignSubFormData.years.includes(year.id)
                      return (
                        <button
                          key={year.id}
                          type="button"
                          onClick={() => toggleAssignSubYear(year.id)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                            isActive ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {year.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {assignSubFormData.theirRate > 0 && assignSubFormData.years.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Billed Rate:</span>
                      <span className="text-gray-900">{formatCurrency(assignSubFormData.theirRate * (1 + assignSubFormData.markupPercent / 100))}/hr</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total FTE:</span>
                      <span className="text-gray-900">{(assignSubFormData.quantity * assignSubFormData.ftePerPerson).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Annual Cost:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(assignSubFormData.theirRate * (1 + assignSubFormData.markupPercent / 100) * assignSubFormData.quantity * assignSubFormData.ftePerPerson * billableHours)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignSubDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSaveAssignSub} 
                disabled={
                  !assignSubFormData.theirRate || 
                  assignSubFormData.years.length === 0 ||
                  (!assignSubFormData.partnerId || (assignSubFormData.partnerId === 'new' && !assignSubFormData.newPartnerName))
                }
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Users className="w-4 h-4 mr-2" />
                Assign to Sub
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Add Role Dialog */}
        <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Role</DialogTitle>
              <DialogDescription>Add a role that wasn&apos;t identified by AI analysis</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-role-title">Role Title <span className="text-red-500">*</span></Label>
                <Input
                  id="add-role-title"
                  placeholder="e.g., Security Analyst"
                  value={addRoleFormData.title}
                  onChange={(e) => setAddRoleFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>IC Level</Label>
                  <Select 
                    value={addRoleFormData.icLevel} 
                    onValueChange={(v: Role['icLevel']) => setAddRoleFormData(prev => ({ ...prev, icLevel: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IC1">IC1</SelectItem>
                      <SelectItem value="IC2">IC2</SelectItem>
                      <SelectItem value="IC3">IC3</SelectItem>
                      <SelectItem value="IC4">IC4</SelectItem>
                      <SelectItem value="IC5">IC5</SelectItem>
                      <SelectItem value="IC6">IC6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-role-qty">Quantity</Label>
                  <Input
                    id="add-role-qty"
                    type="number"
                    min={1}
                    value={addRoleFormData.quantity}
                    onChange={(e) => setAddRoleFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign to</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAddRoleDestination('prime')}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      addRoleDestination === 'prime' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        addRoleDestination === 'prime' ? 'border-blue-500' : 'border-gray-300'
                      }`}>
                        {addRoleDestination === 'prime' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </div>
                      <span className="font-medium text-sm text-gray-900">Prime Labor</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">Your team staffs this role</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddRoleDestination('sub')}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      addRoleDestination === 'sub' 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        addRoleDestination === 'sub' ? 'border-orange-500' : 'border-gray-300'
                      }`}>
                        {addRoleDestination === 'sub' && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                      </div>
                      <span className="font-medium text-sm text-gray-900">Subcontractor</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">A partner fills this role</p>
                  </button>
                </div>
              </div>

              {addRoleDestination === 'prime' && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-role-salary">Base Salary</Label>
                      <Input
                        id="add-role-salary"
                        type="number"
                        min={0}
                        value={addRoleFormData.baseSalary}
                        onChange={(e) => setAddRoleFormData(prev => ({ ...prev, baseSalary: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-role-fte-prime">FTE per Person</Label>
                      <Input
                        id="add-role-fte-prime"
                        type="number"
                        min={0.25}
                        max={1}
                        step={0.25}
                        value={addRoleFormData.ftePerPerson}
                        onChange={(e) => setAddRoleFormData(prev => ({ ...prev, ftePerPerson: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {addRoleDestination === 'sub' && (
                <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="space-y-2">
                    <Label>Teaming Partner <span className="text-red-500">*</span></Label>
                    <Select 
                      value={addRoleFormData.partnerId} 
                      onValueChange={(v) => setAddRoleFormData(prev => ({ ...prev, partnerId: v, newPartnerName: '' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a teaming partner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">
                          <span className="flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" />
                            Add New Partner
                          </span>
                        </SelectItem>
                        {teamingPartners.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-t">
                              Existing Partners
                            </div>
                            {teamingPartners.map(partner => (
                              <SelectItem key={partner.id} value={partner.id}>
                                {partner.companyName}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {addRoleFormData.partnerId === 'new' && (
                    <div className="space-y-2">
                      <Label htmlFor="add-role-new-partner">Company Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="add-role-new-partner"
                        placeholder="e.g., TechPartners LLC"
                        value={addRoleFormData.newPartnerName}
                        onChange={(e) => setAddRoleFormData(prev => ({ ...prev, newPartnerName: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-role-rate">Their Rate/hr <span className="text-red-500">*</span></Label>
                      <Input
                        id="add-role-rate"
                        type="number"
                        min={0}
                        placeholder="0.00"
                        value={addRoleFormData.theirRate || ''}
                        onChange={(e) => setAddRoleFormData(prev => ({ ...prev, theirRate: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-role-markup">Markup %</Label>
                      <Input
                        id="add-role-markup"
                        type="number"
                        min={0}
                        max={100}
                        value={addRoleFormData.markupPercent}
                        onChange={(e) => setAddRoleFormData(prev => ({ ...prev, markupPercent: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-role-fte-sub">FTE/Person</Label>
                      <Input
                        id="add-role-fte-sub"
                        type="number"
                        min={0.25}
                        max={1}
                        step={0.25}
                        value={addRoleFormData.ftePerPerson}
                        onChange={(e) => setAddRoleFormData(prev => ({ ...prev, ftePerPerson: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Applicable Years</Label>
                <div className="flex flex-wrap gap-2">
                  {contractYears.map((year) => {
                    const isActive = addRoleFormData.years.includes(year.id)
                    return (
                      <button
                        key={year.id}
                        type="button"
                        onClick={() => toggleAddRoleYear(year.id)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                          isActive 
                            ? addRoleDestination === 'prime' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {year.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddRoleDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSaveAddRole} 
                disabled={
                  !addRoleFormData.title ||
                  addRoleFormData.years.length === 0 ||
                  (addRoleDestination === 'sub' && (
                    !addRoleFormData.theirRate ||
                    !addRoleFormData.partnerId ||
                    (addRoleFormData.partnerId === 'new' && !addRoleFormData.newPartnerName)
                  ))
                }
                className={addRoleDestination === 'prime' ? '' : 'bg-orange-600 hover:bg-orange-700'}
              >
                {addRoleDestination === 'prime' ? (
                  <><Building2 className="w-4 h-4 mr-2" />Add to Prime</>
                ) : (
                  <><Users className="w-4 h-4 mr-2" />Assign to Sub</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rate Breakdown Slide-out Panel */}
        {selectedRoleForBreakdown && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedRoleForBreakdown(null)} />
            <div className="fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto z-50 animate-in slide-in-from-right">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Rate Breakdown</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedRoleForBreakdown.title}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRoleForBreakdown(null)} className="h-8 w-8 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6 space-y-6">
                {(() => {
                  const breakdown = calculateRateBreakdown(selectedRoleForBreakdown.baseSalary)
                  return (
                    <>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Base Salary:</span>
                          <span className="font-medium text-gray-900">{formatCurrency(breakdown.baseSalary)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">÷ Standard Hours:</span>
                          <span className="font-medium text-gray-900">2,080</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                          <span className="text-sm font-medium text-gray-900">Direct Rate:</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(breakdown.directRate)}/hr</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Indirect Rates</h4>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">+ Fringe ({rates.fringe.toFixed(2)}%):</span>
                          <span className="font-medium text-gray-900">{formatCurrency(breakdown.fringeAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">+ Overhead ({rates.overhead.toFixed(2)}%):</span>
                          <span className="font-medium text-gray-900">{formatCurrency(breakdown.overheadAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">+ G&A ({rates.gAndA.toFixed(2)}%):</span>
                          <span className="font-medium text-gray-900">{formatCurrency(breakdown.gaAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                          <span className="text-sm font-medium text-gray-900">Fully Loaded Rate:</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(breakdown.fullyLoadedRate)}/hr</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profit</h4>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">+ Profit ({profitMargin}%):</span>
                          <span className="font-medium text-gray-900">{formatCurrency(breakdown.profitAmount)}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-blue-900">Billed Rate:</span>
                          <span className="text-xl font-bold text-blue-600">{formatCurrency(breakdown.billedRate)}/hr</span>
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Annual Cost (Base Year)</h4>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Billable Hours:</span>
                          <span className="font-medium text-gray-900">{billableHours.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">× Quantity:</span>
                          <span className="font-medium text-gray-900">{selectedRoleForBreakdown.quantity}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">× FTE:</span>
                          <span className="font-medium text-gray-900">{selectedRoleForBreakdown.ftePerPerson}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                          <span className="text-sm font-medium text-gray-900">Annual Cost:</span>
                          <span className="font-semibold text-green-600">
                            {formatCurrency(
                              breakdown.billedRate * 
                              selectedRoleForBreakdown.hoursPerYear * 
                              selectedRoleForBreakdown.quantity * 
                              selectedRoleForBreakdown.ftePerPerson
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600">
                          {contractType === 'T&M' ? (
                            <><span className="font-medium">T&M Contract:</span> This billed rate is what you charge the government per hour.</>
                          ) : contractType === 'FFP' ? (
                            <><span className="font-medium">FFP Contract:</span> This rate is for internal cost estimation. The government pays a fixed total price.</>
                          ) : (
                            <><span className="font-medium">Tip:</span> Use this rate to estimate labor costs and ensure profitability.</>
                          )}
                        </p>
                      </div>
                      
                      {/* ================================================================ */}
                      {/* RATE JUSTIFICATION SECTION (Read-Only Summary)                  */}
                      {/* ================================================================ */}
                      <div className="space-y-3 pt-4 border-t border-gray-100">
                        {(() => {
                          const roleId = selectedRoleForBreakdown.id
                          const justification = rateJustifications[roleId]
                          const hasJustification = justification?.savedAt && justification.savedAt !== ''
                          
                          // Calculate BLS percentile for this role
                          const blsData = findBLSData(selectedRoleForBreakdown.title)
                          const salary = selectedRoleForBreakdown.baseSalary
                          const percentile = blsData && salary > 0 ? calculateBLSPercentile(salary, blsData) : null
                          
                          // Determine status based on percentile
                          const getPercentileColor = (p: number) => {
                            if (p >= 75) return 'text-red-600 bg-red-50'
                            if (p >= 50) return 'text-blue-600 bg-blue-50'
                            if (p >= 25) return 'text-green-600 bg-green-50'
                            return 'text-amber-600 bg-amber-50'
                          }
                          
                          const getPercentileLabel = (p: number) => {
                            if (p >= 75) return 'Premium Rate'
                            if (p >= 50) return 'Competitive'
                            if (p >= 25) return 'Market Rate'
                            return 'Below Market'
                          }
                          
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rate Justification</h4>
                                {hasJustification ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Documented
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                                    Not started
                                  </span>
                                )}
                              </div>
                              
                              {/* BLS Market Position */}
                              {blsData && percentile !== null ? (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <TrendingUp className="w-4 h-4 text-gray-400" />
                                      <span className="text-xs font-medium text-gray-700">BLS Market Position</span>
                                    </div>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getPercentileColor(percentile)}`}>
                                      {formatOrdinal(Math.round(percentile))} percentile
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-gray-600">
                                    <span>{getPercentileLabel(percentile)}</span>
                                    <span>vs ${(blsData.median / 1000).toFixed(0)}k median</span>
                                  </div>
                                  {/* Mini percentile bar */}
                                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        percentile >= 75 ? 'bg-red-500' :
                                        percentile >= 50 ? 'bg-blue-500' :
                                        percentile >= 25 ? 'bg-green-500' :
                                        'bg-amber-500'
                                      }`}
                                      style={{ width: `${Math.min(percentile, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                  <p className="text-xs text-gray-500">
                                    No BLS data available for this role title.
                                  </p>
                                </div>
                              )}
                              
                              {/* Summary of existing justification */}
                              {hasJustification && justification && (
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                  <p className="text-xs font-medium text-blue-800 mb-1">Justification Summary</p>
                                  {justification.selectedReasons && Object.keys(justification.selectedReasons).filter(k => justification.selectedReasons?.[k]).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {justification.selectedReasons.clearance && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                                          <Shield className="w-2.5 h-2.5" />
                                          {justification.selectedReasons.clearance}
                                        </span>
                                      )}
                                      {justification.selectedReasons.location && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                                          <MapPin className="w-2.5 h-2.5" />
                                          {justification.selectedReasons.location}
                                        </span>
                                      )}
                                      {justification.selectedReasons.experience && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                                          <Award className="w-2.5 h-2.5" />
                                          {justification.selectedReasons.experience}
                                        </span>
                                      )}
                                      {justification.selectedReasons.keyPersonnel && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                                          Key Personnel
                                        </span>
                                      )}
                                      {justification.selectedReasons.nicheSkills && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                                          Niche Skills
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {justification.notes && (
                                    <p className="text-[10px] text-blue-700 line-clamp-2">{justification.notes}</p>
                                  )}
                                  <p className="text-[10px] text-blue-600 mt-1">
                                    Last updated {new Date(justification.savedAt).toLocaleDateString()}
                                  </p>
                                </div>
                              )}
                              
                              {/* Link to Rate Justification tab */}
                              <button
                                onClick={() => {
                                  // Close slideout and navigate to Rate Justification tab
                                  setSelectedRoleForBreakdown(null)
                                  navigateToRateJustification(roleId)
                                }}
                                className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                                  <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">
                                    {hasJustification ? 'Edit in Rate Justification' : 'Add Rate Justification'}
                                  </span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                              </button>
                              
                              {/* Warning for high percentile without justification */}
                              {percentile !== null && percentile >= 75 && !hasJustification && (
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs font-medium text-amber-800">Premium rate needs justification</p>
                                      <p className="text-[10px] text-amber-700 mt-0.5">
                                        This rate is above the 75th percentile. Document justification for DCAA audit defense.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </>
         )}
      </div>
    </TooltipProvider>
  )
}