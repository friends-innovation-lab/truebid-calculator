'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppContext, TeamingPartner } from '@/contexts/app-context'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Plus,
  Trash2,
  Building2,
  Search,
  Pencil,
  X,
  CheckCircle2,
  HelpCircle,
  FileText,
  AlertTriangle,
  ExternalLink,
  Users,
  Award,
  ChevronDown,
  ChevronUp,
  Shield,
  Handshake,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

// ==================== TYPES ====================

interface TeamingPartnersTabProps {
  onContinue?: () => void
}

type FilterType = 'all' | 'active' | 'expiring' | 'needs-attention'

// ==================== CAPABILITY OPTIONS ====================

const capabilityOptions = [
  { id: 'ux-ui', label: 'UX/UI Design', category: 'Design' },
  { id: 'user-research', label: 'User Research', category: 'Design' },
  { id: 'product-management', label: 'Product Management', category: 'Management' },
  { id: 'accessibility', label: 'Accessibility (Section 508)', category: 'Compliance' },
  { id: 'software-dev', label: 'Software Development', category: 'Engineering' },
  { id: 'cloud-architecture', label: 'Cloud Architecture', category: 'Engineering' },
  { id: 'devsecops', label: 'DevSecOps', category: 'Engineering' },
  { id: 'data-analytics', label: 'Data Analytics', category: 'Data' },
  { id: 'ai-ml', label: 'AI/Machine Learning', category: 'Data' },
  { id: 'cybersecurity', label: 'Cybersecurity', category: 'Security' },
  { id: 'system-integration', label: 'System Integration', category: 'Engineering' },
  { id: 'agile-coaching', label: 'Agile Coaching', category: 'Management' },
  { id: 'change-management', label: 'Change Management', category: 'Management' },
  { id: 'technical-writing', label: 'Technical Writing', category: 'Support' },
  { id: 'training', label: 'Training & Enablement', category: 'Support' },
]

// ==================== HELPERS ====================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const getDaysUntilExpiration = (dateString: string): number => {
  if (!dateString) return Infinity
  const expirationDate = new Date(dateString)
  const today = new Date()
  const diffTime = expirationDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const getExpirationStatus = (dateString: string): 'expired' | 'warning' | 'ok' => {
  const days = getDaysUntilExpiration(dateString)
  if (days < 0) return 'expired'
  if (days <= 60) return 'warning'
  return 'ok'
}

const getSubcontractorFte = (sub: any, period: 'base' | 'option1' | 'option2'): number => {
  if (sub.allocations && sub.allocations[period]) {
    return sub.allocations[period].enabled ? sub.allocations[period].fte : 0
  }
  if (sub.years && typeof sub.years === 'object') {
    if (!sub.years[period]) return 0
  }
  return sub.fte || 0
}

const calculateSubContractorTotalCost = (
  sub: any, 
  billableHours: number,
  laborEscalation: number
): { totalCost: number; periodCosts: { base: number; opt1: number; opt2: number } } => {
  const billedRate = sub.billedRate || (sub.theirRate * (1 + (sub.markupPercent || 0) / 100))
  
  const baseFte = getSubcontractorFte(sub, 'base')
  const opt1Fte = getSubcontractorFte(sub, 'option1')
  const opt2Fte = getSubcontractorFte(sub, 'option2')
  
  const baseCost = billedRate * baseFte * billableHours
  const opt1Cost = billedRate * opt1Fte * billableHours * (1 + laborEscalation / 100)
  const opt2Cost = billedRate * opt2Fte * billableHours * Math.pow(1 + laborEscalation / 100, 2)
  
  return {
    totalCost: baseCost + opt1Cost + opt2Cost,
    periodCosts: { base: baseCost, opt1: opt1Cost, opt2: opt2Cost }
  }
}

// Plain language agreement status labels
const agreementStatusLabels: Record<string, string> = {
  'none': 'No Agreement',
  'draft': 'Draft',
  'under-review': 'Under Review',
  'signed': 'Signed',
  'executed': 'Active',
}

const agreementStatusColors: Record<string, string> = {
  'none': 'bg-gray-100 text-gray-600 border-gray-200',
  'draft': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'under-review': 'bg-blue-50 text-blue-700 border-blue-200',
  'signed': 'bg-green-50 text-green-700 border-green-200',
  'executed': 'bg-green-50 text-green-700 border-green-200',
}

// Business size - plain language
const businessSizeLabels: Record<string, string> = {
  'small': 'Small Business',
  'other-than-small': 'Large Business',
  '': 'Not Specified',
}

const businessSizeColors: Record<string, string> = {
  'small': 'bg-purple-50 text-purple-700 border-purple-200',
  'other-than-small': 'bg-gray-100 text-gray-600 border-gray-200',
  '': 'bg-gray-50 text-gray-500 border-gray-200',
}

// Filter definitions
const filterOptions: { id: FilterType; label: string; icon: typeof Building2 }[] = [
  { id: 'all', label: 'All Partners', icon: Building2 },
  { id: 'active', label: 'Active Agreements', icon: CheckCircle2 },
  { id: 'expiring', label: 'Expiring Soon', icon: Clock },
  { id: 'needs-attention', label: 'Needs Attention', icon: AlertCircle },
]

// Empty partner template
const emptyPartner: Omit<TeamingPartner, 'id' | 'createdAt' | 'updatedAt'> = {
  companyName: '',
  legalName: '',
  uei: '',
  cageCode: '',
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
  capabilities: [],
  pastPerformance: '',
  primaryContact: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
}

// FAR Tooltips
const farTooltips = {
  uei: {
    clause: 'FAR 52.204-7',
    title: 'SAM Registration',
    description: 'Contractors must be registered in SAM.gov and have a valid Unique Entity ID (UEI) to receive federal contracts.',
  },
  businessSize: {
    clause: 'FAR 19.704',
    title: 'Subcontracting Plan',
    description: 'Required for contracts over $750K ($1.5M for construction). Must include goals for SB, WOSB, SDVOSB, HUBZone, and 8(a).',
  },
  rateJustification: {
    clause: 'FAR 15.404-3',
    title: 'Subcontract Pricing',
    description: 'The contracting officer may require price analysis for subcontracts. Maintain documentation of rate reasonableness.',
  },
  limitations: {
    clause: 'FAR 52.219-14',
    title: 'Limitations on Subcontracting',
    description: 'Small business set-asides require the prime to perform at least 50% of contract work. Track partner allocations to ensure compliance.',
  },
  jointVenture: {
    clause: 'FAR 19.602-1',
    title: 'Joint Venture Agreements',
    description: 'Joint ventures allow small businesses to team for larger contracts while maintaining small business status under specific conditions.',
  },
  cageCode: {
    clause: 'DFARS 204.7202',
    title: 'Commercial and Government Entity Code',
    description: 'A 5-character identifier assigned by the DLA to entities doing business with the federal government.',
  },
}

// ==================== COMPONENT ====================

export function TeamingPartnersTab({}: TeamingPartnersTabProps) {
  const { 
    teamingPartners: partners,
    addTeamingPartner,
    updateTeamingPartner,
    removeTeamingPartner,
    subcontractors,
    uiBillableHours,
    uiLaborEscalation,
  } = useAppContext()

  const billableHours = uiBillableHours ?? 1920
  const laborEscalation = uiLaborEscalation ?? 2

  // UI State
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [isLoading, setIsLoading] = useState(false)
  
  // Panel State
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyPartner)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formJV, setFormJV] = useState(false)
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([])
  
  // Delete confirmation state (replaces window.confirm)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  
  // Accordion state for form sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    company: true,
    certifications: true,
    capabilities: false,
    agreements: true,
    rates: false,
    contact: false,
  })

  // Refs for focus management
  const slideoutRef = useRef<HTMLDivElement>(null)
  const slideoutCloseRef = useRef<HTMLButtonElement>(null)
  const lastFocusedElement = useRef<HTMLElement | null>(null)

  // ==================== FOCUS TRAP FOR SLIDEOUT ====================
  
  useEffect(() => {
    if (isPanelOpen && slideoutRef.current) {
      lastFocusedElement.current = document.activeElement as HTMLElement
      setTimeout(() => {
        slideoutCloseRef.current?.focus()
      }, 100)
    } else if (!isPanelOpen && lastFocusedElement.current) {
      lastFocusedElement.current.focus()
    }
  }, [isPanelOpen])

  const closePanel = () => {
    setIsPanelOpen(false)
    setEditingId(null)
    setFormData(emptyPartner)
    setFormJV(false)
    setSelectedCapabilities([])
    setFormErrors({})
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPanelOpen) return
      
      if (e.key === 'Escape') {
        closePanel()
      }
      
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
  }, [isPanelOpen])

  // ==================== CALCULATIONS ====================

  const partnersWithRoles = partners.map(partner => {
    const partnerSubs = subcontractors.filter(s => 
      s.partnerId === partner.id || 
      s.companyName.toLowerCase() === partner.companyName.toLowerCase()
    )
    
    let totalContractCost = 0
    let totalBaseFte = 0
    
    partnerSubs.forEach(sub => {
      const costCalc = calculateSubContractorTotalCost(sub, billableHours, laborEscalation)
      totalContractCost += costCalc.totalCost
      totalBaseFte += getSubcontractorFte(sub, 'base')
    })
    
    const hasNoAgreement = partner.teamingAgreementStatus === 'none'
    const hasExpiredAgreement = partner.teamingAgreementExpiration && getExpirationStatus(partner.teamingAgreementExpiration) === 'expired'
    const needsAttention = hasNoAgreement || hasExpiredAgreement
    
    return {
      ...partner,
      roles: partnerSubs,
      roleCount: partnerSubs.length,
      totalBaseFte,
      totalContractCost,
      needsAttention,
    }
  })

  const filterCounts = {
    all: partners.length,
    active: partners.filter(p => p.teamingAgreementStatus === 'signed' || p.teamingAgreementStatus === 'executed').length,
    expiring: partners.filter(p => p.teamingAgreementExpiration && getExpirationStatus(p.teamingAgreementExpiration) === 'warning').length,
    'needs-attention': partnersWithRoles.filter(p => p.needsAttention).length,
  }

  // Certification counts for stats
  const certificationCounts = {
    sb: partners.filter(p => p.certifications.sb || p.businessSize === 'small').length,
    wosb: partners.filter(p => p.certifications.wosb).length,
    sdvosb: partners.filter(p => p.certifications.sdvosb).length,
    hubzone: partners.filter(p => p.certifications.hubzone).length,
    eightA: partners.filter(p => p.certifications.eightA).length,
  }

  const totalSubFte = partnersWithRoles.reduce((sum, p) => sum + p.totalBaseFte, 0)
  const totalSubContractCost = partnersWithRoles.reduce((sum, p) => sum + p.totalContractCost, 0)

  // ==================== FILTERING ====================

  const filteredPartners = partnersWithRoles
    .filter(partner => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          partner.companyName.toLowerCase().includes(query) ||
          (partner.legalName && partner.legalName.toLowerCase().includes(query)) ||
          (partner.uei && partner.uei.toLowerCase().includes(query))
        )
      }
      return true
    })
    .filter(partner => {
      switch (activeFilter) {
        case 'active':
          return partner.teamingAgreementStatus === 'signed' || partner.teamingAgreementStatus === 'executed'
        case 'expiring':
          return partner.teamingAgreementExpiration && getExpirationStatus(partner.teamingAgreementExpiration) === 'warning'
        case 'needs-attention':
          return partner.needsAttention
        default:
          return true
      }
    })

  // ==================== HANDLERS ====================

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleCapability = (capId: string) => {
    setSelectedCapabilities(prev => 
      prev.includes(capId) 
        ? prev.filter(c => c !== capId)
        : [...prev, capId]
    )
  }

  const openAddPanel = () => {
    setEditingId(null)
    setFormData(emptyPartner)
    setFormJV(false)
    setSelectedCapabilities([])
    setFormErrors({})
    setExpandedSections({ company: true, certifications: true, capabilities: false, agreements: true, rates: false, contact: false })
    setIsPanelOpen(true)
  }

  const openEditPanel = (partnerId: string) => {
    const partner = partners.find(p => p.id === partnerId)
    if (!partner) return

    setEditingId(partnerId)
    setFormData({
      companyName: partner.companyName,
      legalName: partner.legalName || '',
      uei: partner.uei || '',
      cageCode: partner.cageCode || '',
      businessSize: partner.businessSize,
      certifications: { ...partner.certifications },
      teamingAgreementStatus: partner.teamingAgreementStatus,
      teamingAgreementExpiration: partner.teamingAgreementExpiration || '',
      ndaStatus: partner.ndaStatus,
      ndaExpiration: partner.ndaExpiration || '',
      defaultRate: partner.defaultRate,
      rateSource: partner.rateSource,
      quoteDate: partner.quoteDate || '',
      quoteReference: partner.quoteReference || '',
      capabilities: partner.capabilities || [],
      pastPerformance: partner.pastPerformance || '',
      primaryContact: partner.primaryContact || '',
      contactEmail: partner.contactEmail || '',
      contactPhone: partner.contactPhone || '',
      notes: partner.notes || '',
    })
    setSelectedCapabilities(partner.capabilities || [])
    setFormJV((partner as any).isJointVenture || false)
    setFormErrors({})
    setIsPanelOpen(true)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.companyName.trim()) {
      errors.companyName = 'Company name is required'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (!validateForm()) return

    const now = new Date().toISOString()
    const dataToSave = {
      ...formData,
      capabilities: selectedCapabilities,
      isJointVenture: formJV,
    }

    if (editingId) {
      updateTeamingPartner(editingId, dataToSave)
    } else {
      const newPartner: TeamingPartner = {
        id: `partner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...dataToSave,
        createdAt: now,
        updatedAt: now,
      }
      addTeamingPartner(newPartner)
    }

    closePanel()
  }

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirmId(id)
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      removeTeamingPartner(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null)
  }

  const refreshData = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  // Build aria-label for partner cards
  const getPartnerAriaLabel = (partner: typeof partnersWithRoles[0]) => {
    const parts = [partner.companyName]
    
    if (partner.businessSize) {
      parts.push(businessSizeLabels[partner.businessSize])
    }
    
    const status = agreementStatusLabels[partner.teamingAgreementStatus]
    parts.push(`Agreement: ${status}`)
    
    if (partner.roleCount > 0) {
      parts.push(`${partner.roleCount} role${partner.roleCount !== 1 ? 's' : ''} assigned`)
    } else {
      parts.push('No roles assigned')
    }
    
    if (partner.needsAttention) {
      parts.push('Needs attention')
    }
    
    parts.push('Click to edit')
    
    return parts.join('. ')
  }

  // ==================== RENDER ====================

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ==================== HEADER ==================== */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">Teaming Partners</h1>
            <Badge variant="outline" className="text-xs">
              {partners.length} Partner{partners.length !== 1 ? 's' : ''}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Learn about FAR limitations on subcontracting">
                  <Shield className="w-4 h-4 text-gray-400 hover:text-blue-600" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs font-medium mb-1">{farTooltips.limitations.clause}: {farTooltips.limitations.title}</p>
                <p className="text-xs">{farTooltips.limitations.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Stats Summary */}
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs">
          <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Active</span>
              <span className="font-semibold text-green-600">{filterCounts.active}</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Roles</span>
              <span className="font-semibold text-gray-900">{subcontractors.length}</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Base FTE</span>
              <span className="font-semibold text-gray-900">{totalSubFte.toFixed(1)}</span>
            </div>
            {totalSubContractCost > 0 && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Total Value</span>
                  <span className="font-semibold text-green-600">{formatCurrency(totalSubContractCost)}</span>
                </div>
              </>
            )}
            {filterCounts['needs-attention'] > 0 && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
                  <span className="font-semibold text-red-600">{filterCounts['needs-attention']} need attention</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ==================== FILTER TABS + ACTIONS ==================== */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Filter partners">
            {filterOptions.map((filter) => {
              const Icon = filter.icon
              const count = filterCounts[filter.id]
              const isActive = activeFilter === filter.id
              
              return (
                <button
                  key={filter.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="partner-list"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${isActive 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className={`w-3.5 h-3.5 ${
                    isActive && filter.id === 'needs-attention' ? 'text-red-500' :
                    isActive && filter.id === 'active' ? 'text-green-500' :
                    isActive && filter.id === 'expiring' ? 'text-orange-500' :
                    ''
                  }`} aria-hidden="true" />
                  {filter.label}
                  {count > 0 && (
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] px-1.5 py-0 h-4 ml-1 ${
                        filter.id === 'needs-attention' && count > 0 
                          ? 'bg-red-100 text-red-700' 
                          : ''
                      }`}
                    >
                      {count}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
            <Button size="sm" onClick={openAddPanel}>
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Add Partner
            </Button>
          </div>
        </div>

        {/* ==================== SEARCH ==================== */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <Input
            placeholder="Search by company name, UEI, or legal name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            aria-label="Search partners"
          />
        </div>

        {/* ==================== CERTIFICATION SUMMARY (Collapsible) ==================== */}
        {partners.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-600 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <Award className="w-4 h-4 text-purple-600 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium text-purple-700">Small Business Certifications:</span>
            <div className="flex items-center gap-3">
              <span>SB: <strong>{certificationCounts.sb}</strong></span>
              <span>WOSB: <strong>{certificationCounts.wosb}</strong></span>
              <span>SDVOSB: <strong>{certificationCounts.sdvosb}</strong></span>
              <span>HUBZone: <strong>{certificationCounts.hubzone}</strong></span>
              <span>8(a): <strong>{certificationCounts.eightA}</strong></span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Learn about subcontracting plan requirements">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400 hover:text-purple-600 ml-auto" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs font-medium mb-1">{farTooltips.businessSize.clause}: {farTooltips.businessSize.title}</p>
                <p className="text-xs">{farTooltips.businessSize.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* ==================== PARTNER CARDS ==================== */}
        <div id="partner-list" role="tabpanel" aria-label="Partner list">
          {filteredPartners.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={searchQuery
                ? 'No partners match your search'
                : activeFilter !== 'all'
                  ? `No partners match the "${filterOptions.find(f => f.id === activeFilter)?.label}" filter`
                  : 'No teaming partners added yet'}
              description={searchQuery
                ? 'Try a different search term'
                : 'Add partner companies to track compliance and agreements'}
              action={!searchQuery && activeFilter === 'all' ? { label: 'Add Your First Partner', onClick: openAddPanel, variant: 'outline' } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list" aria-label="Teaming partners">
              {filteredPartners.map(partner => {
                const taExpStatus = partner.teamingAgreementExpiration 
                  ? getExpirationStatus(partner.teamingAgreementExpiration)
                  : null
                const daysUntilExp = partner.teamingAgreementExpiration 
                  ? getDaysUntilExpiration(partner.teamingAgreementExpiration)
                  : null

                const getCardAccent = () => {
                  if (partner.needsAttention) return 'border-l-red-500'
                  if (taExpStatus === 'warning') return 'border-l-orange-500'
                  if (partner.teamingAgreementStatus === 'executed' || partner.teamingAgreementStatus === 'signed') return 'border-l-green-500'
                  return 'border-l-orange-300'
                }

                const isDeleting = deleteConfirmId === partner.id

                return (
                  <div
                    key={partner.id}
                    role="listitem"
                    className={`
                      group relative border border-gray-200 border-l-4 rounded-lg p-4 
                      hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] 
                      transition-all cursor-pointer bg-white min-h-[180px]
                      ${getCardAccent()}
                    `}
                    onClick={() => !isDeleting && openEditPanel(partner.id)}
                    onKeyDown={(e) => e.key === 'Enter' && !isDeleting && openEditPanel(partner.id)}
                    tabIndex={0}
                    aria-label={getPartnerAriaLabel(partner)}
                  >
                    {/* Delete Confirmation Overlay */}
                    {isDeleting && (
                      <div className="absolute inset-0 bg-white/95 rounded-lg flex items-center justify-center z-10" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center p-4">
                          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" aria-hidden="true" />
                          <p className="text-sm font-medium text-gray-900 mb-1">Remove {partner.companyName}?</p>
                          <p className="text-xs text-gray-500 mb-3">This will also unlink any assigned roles.</p>
                          <div className="flex gap-2 justify-center">
                            <Button variant="outline" size="sm" onClick={handleDeleteCancel}>
                              Cancel
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDeleteConfirm}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm text-gray-900 truncate">{partner.companyName}</h4>
                          {partner.businessSize && (
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] px-1.5 py-0 h-5 ${businessSizeColors[partner.businessSize]}`}
                            >
                              {partner.businessSize === 'small' ? 'SB' : 'Large'}
                            </Badge>
                          )}
                          {partner.needsAttention && (
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-hidden="true" />
                          )}
                        </div>
                        {partner.uei && (
                          <p className="text-[11px] text-gray-500 mt-0.5">UEI: {partner.uei}</p>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-0.5 ml-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openEditPanel(partner.id); }}
                          aria-label={`Edit ${partner.companyName}`}
                          className="text-gray-400 hover:text-orange-600 hover:bg-orange-50 h-7 w-7 p-0"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteClick(partner.id, e)}
                          aria-label={`Remove ${partner.companyName}`}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>

                    {/* Certifications + Agreement Row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {partner.certifications.wosb && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200">WOSB</Badge>
                      )}
                      {partner.certifications.sdvosb && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200">SDVOSB</Badge>
                      )}
                      {partner.certifications.hubzone && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200">HUBZone</Badge>
                      )}
                      {partner.certifications.eightA && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-50 text-purple-700 border-purple-200">8(a)</Badge>
                      )}
                      {(partner as any).isJointVenture && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 border-blue-200">JV</Badge>
                      )}
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 h-5 ${agreementStatusColors[partner.teamingAgreementStatus]}`}
                      >
                        {agreementStatusLabels[partner.teamingAgreementStatus]}
                      </Badge>
                      {partner.ndaStatus === 'signed' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-green-50 text-green-700 border-green-200">NDA</Badge>
                      )}
                    </div>

                    {/* Expiration Warning */}
                    {taExpStatus && taExpStatus !== 'ok' && daysUntilExp !== null && (
                      <div className={`flex items-center gap-1.5 text-[11px] mb-2 px-2 py-1 rounded ${
                        taExpStatus === 'expired' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
                      }`}>
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        <span>{taExpStatus === 'expired' ? 'Expired' : `Expires in ${daysUntilExp}d`}</span>
                      </div>
                    )}

                    {/* Capabilities (compact) */}
                    {partner.capabilities && partner.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {partner.capabilities.slice(0, 2).map(capId => {
                          const cap = capabilityOptions.find(c => c.id === capId)
                          return cap ? (
                            <Badge key={capId} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-orange-50 text-orange-700 border-0">
                              {cap.label}
                            </Badge>
                          ) : null
                        })}
                        {partner.capabilities.length > 2 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-gray-100 text-gray-600 border-0">
                            +{partner.capabilities.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Footer: Roles Summary */}
                    <div className="pt-2 mt-auto border-t border-gray-100">
                      {partner.roles.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">No roles assigned</p>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-600">
                            {partner.roleCount} role{partner.roleCount !== 1 ? 's' : ''} · {partner.totalBaseFte.toFixed(1)} FTE
                          </span>
                          <span className="text-xs font-semibold text-gray-900">
                            {formatCurrency(partner.totalContractCost)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ==================== SLIDE-OUT PANEL ==================== */}
      {isPanelOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={closePanel}
            aria-hidden="true"
          />

          <div 
            ref={slideoutRef}
            className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto z-50 animate-in slide-in-from-right"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 id="panel-title" className="text-lg font-semibold text-gray-900">
                  {editingId ? 'Edit Partner' : 'Add Partner'}
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  {editingId ? 'Update partner information and agreements' : 'Enter partner company details'}
                </p>
              </div>
              <Button 
                ref={slideoutCloseRef}
                variant="ghost" 
                size="sm"
                onClick={closePanel}
                aria-label="Close panel"
                className="h-8 w-8 p-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-4">
              
              {/* ===== Company Information Section ===== */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('company')}
                  aria-expanded={expandedSections.company}
                  aria-controls="section-company"
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    <span className="font-medium text-sm text-gray-900">Company Information</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-red-100 text-red-700">Required</Badge>
                  </div>
                  {expandedSections.company ? <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />}
                </button>
                
                {expandedSections.company && (
                  <div id="section-company" className="p-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">
                        Company Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="companyName"
                        placeholder="e.g., Acme Consulting LLC"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className={formErrors.companyName ? 'border-red-500' : ''}
                      />
                      {formErrors.companyName && (
                        <p className="text-xs text-red-500">{formErrors.companyName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="legalName">Legal Name (if different)</Label>
                      <Input
                        id="legalName"
                        placeholder="Full legal entity name"
                        value={formData.legalName}
                        onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="uei">UEI (Unique Entity ID)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Learn about UEI requirements">
                                <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs font-medium mb-1">{farTooltips.uei.clause}: {farTooltips.uei.title}</p>
                              <p className="text-xs">{farTooltips.uei.description}</p>
                              <a href="https://sam.gov" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                                Verify on SAM.gov <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                <span className="sr-only">(opens in new tab)</span>
                              </a>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="uei"
                          placeholder="12-character UEI"
                          value={formData.uei}
                          onChange={(e) => setFormData({ ...formData, uei: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="cageCode">CAGE Code</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Learn about CAGE codes">
                                <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs font-medium mb-1">{farTooltips.cageCode.clause}: {farTooltips.cageCode.title}</p>
                              <p className="text-xs">{farTooltips.cageCode.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="cageCode"
                          placeholder="5-character code"
                          value={formData.cageCode}
                          onChange={(e) => setFormData({ ...formData, cageCode: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label>Business Size</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" aria-label="Learn about business size standards">
                              <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs font-medium mb-1">{farTooltips.businessSize.clause}: {farTooltips.businessSize.title}</p>
                            <p className="text-xs">{farTooltips.businessSize.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select 
                        value={formData.businessSize} 
                        onValueChange={(v: 'small' | 'other-than-small' | '') => setFormData({ ...formData, businessSize: v })}
                      >
                        <SelectTrigger aria-label="Select business size">
                          <SelectValue placeholder="Select business size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small Business</SelectItem>
                          <SelectItem value="other-than-small">Large Business</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Certifications Section ===== */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('certifications')}
                  aria-expanded={expandedSections.certifications}
                  aria-controls="section-certifications"
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-600" aria-hidden="true" />
                    <span className="font-medium text-sm text-gray-900">Small Business Certifications</span>
                  </div>
                  {expandedSections.certifications ? <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />}
                </button>
                
                {expandedSections.certifications && (
                  <div id="section-certifications" className="p-4 space-y-3">
                    <p className="text-xs text-gray-500 mb-2">
                      Select certifications this partner holds. These count toward your subcontracting plan goals.
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="cert-sb"
                        checked={formData.certifications.sb}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, certifications: { ...formData.certifications, sb: checked as boolean } })
                        }
                      />
                      <Label htmlFor="cert-sb" className="text-sm font-normal cursor-pointer">
                        Small Business (SB)
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="cert-wosb"
                        checked={formData.certifications.wosb}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, certifications: { ...formData.certifications, wosb: checked as boolean } })
                        }
                      />
                      <Label htmlFor="cert-wosb" className="text-sm font-normal cursor-pointer">
                        Woman-Owned Small Business (WOSB)
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="cert-sdvosb"
                        checked={formData.certifications.sdvosb}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, certifications: { ...formData.certifications, sdvosb: checked as boolean } })
                        }
                      />
                      <Label htmlFor="cert-sdvosb" className="text-sm font-normal cursor-pointer">
                        Service-Disabled Veteran-Owned SB (SDVOSB)
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="cert-hubzone"
                        checked={formData.certifications.hubzone}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, certifications: { ...formData.certifications, hubzone: checked as boolean } })
                        }
                      />
                      <Label htmlFor="cert-hubzone" className="text-sm font-normal cursor-pointer">
                        HUBZone
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="cert-8a"
                        checked={formData.certifications.eightA}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, certifications: { ...formData.certifications, eightA: checked as boolean } })
                        }
                      />
                      <Label htmlFor="cert-8a" className="text-sm font-normal cursor-pointer">
                        8(a) Business Development Program
                      </Label>
                    </div>

                    {/* Joint Venture */}
                    <div className="pt-3 mt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="cert-jv"
                          checked={formJV}
                          onCheckedChange={(checked) => setFormJV(checked as boolean)}
                        />
                        <Label htmlFor="cert-jv" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                          <Handshake className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                          Joint Venture (JV) Partner
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" aria-label="Learn about joint ventures">
                              <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs font-medium mb-1">{farTooltips.jointVenture.clause}: {farTooltips.jointVenture.title}</p>
                            <p className="text-xs">{farTooltips.jointVenture.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Agreements Section ===== */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('agreements')}
                  aria-expanded={expandedSections.agreements}
                  aria-controls="section-agreements"
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    <span className="font-medium text-sm text-gray-900">Agreements</span>
                  </div>
                  {expandedSections.agreements ? <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />}
                </button>
                
                {expandedSections.agreements && (
                  <div id="section-agreements" className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Teaming Agreement</Label>
                        <Select 
                          value={formData.teamingAgreementStatus} 
                          onValueChange={(v: TeamingPartner['teamingAgreementStatus']) => setFormData({ ...formData, teamingAgreementStatus: v })}
                        >
                          <SelectTrigger aria-label="Select teaming agreement status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Agreement</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="under-review">Under Review</SelectItem>
                            <SelectItem value="signed">Signed</SelectItem>
                            <SelectItem value="executed">Active</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="taExpiration">Expiration Date</Label>
                        <Input
                          id="taExpiration"
                          type="date"
                          value={formData.teamingAgreementExpiration || ''}
                          onChange={(e) => setFormData({ ...formData, teamingAgreementExpiration: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>NDA Status</Label>
                        <Select 
                          value={formData.ndaStatus} 
                          onValueChange={(v: TeamingPartner['ndaStatus']) => setFormData({ ...formData, ndaStatus: v })}
                        >
                          <SelectTrigger aria-label="Select NDA status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No NDA</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="signed">Signed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ndaExpiration">NDA Expiration</Label>
                        <Input
                          id="ndaExpiration"
                          type="date"
                          value={formData.ndaExpiration || ''}
                          onChange={(e) => setFormData({ ...formData, ndaExpiration: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Capabilities Section ===== */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('capabilities')}
                  aria-expanded={expandedSections.capabilities}
                  aria-controls="section-capabilities"
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-orange-600" aria-hidden="true" />
                    <span className="font-medium text-sm text-gray-900">Capabilities</span>
                    {selectedCapabilities.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        {selectedCapabilities.length} selected
                      </Badge>
                    )}
                  </div>
                  {expandedSections.capabilities ? <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />}
                </button>
                
                {expandedSections.capabilities && (
                  <div id="section-capabilities" className="p-4 space-y-4">
                    <p className="text-xs text-gray-500">
                      Select capabilities relevant to IT services (NAICS 541511/541512/541519)
                    </p>
                    
                    {['Design', 'Engineering', 'Management', 'Data', 'Security', 'Compliance', 'Support'].map(category => {
                      const categoryCapabilities = capabilityOptions.filter(c => c.category === category)
                      if (categoryCapabilities.length === 0) return null
                      
                      return (
                        <div key={category} className="space-y-2">
                          <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">{category}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {categoryCapabilities.map(cap => (
                              <div key={cap.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`cap-${cap.id}`}
                                  checked={selectedCapabilities.includes(cap.id)}
                                  onCheckedChange={() => toggleCapability(cap.id)}
                                />
                                <Label htmlFor={`cap-${cap.id}`} className="text-sm font-normal cursor-pointer">
                                  {cap.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ===== Rate Information Section ===== */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('rates')}
                  aria-expanded={expandedSections.rates}
                  aria-controls="section-rates"
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    <span className="font-medium text-sm text-gray-900">Rate History</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span onClick={(e) => e.stopPropagation()} className="cursor-help">
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs font-medium mb-1">{farTooltips.rateJustification.clause}: {farTooltips.rateJustification.title}</p>
                        <p className="text-xs">{farTooltips.rateJustification.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {expandedSections.rates ? <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />}
                </button>
                
                {expandedSections.rates && (
                  <div id="section-rates" className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="defaultRate">Default Hourly Rate ($)</Label>
                        <Input
                          id="defaultRate"
                          type="number"
                          placeholder="150.00"
                          value={formData.defaultRate || ''}
                          onChange={(e) => setFormData({ ...formData, defaultRate: parseFloat(e.target.value) || undefined })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate Source</Label>
                        <Select 
                          value={formData.rateSource} 
                          onValueChange={(v: TeamingPartner['rateSource']) => setFormData({ ...formData, rateSource: v })}
                        >
                          <SelectTrigger aria-label="Select rate source">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quote">Direct Quote</SelectItem>
                            <SelectItem value="prior-agreement">Prior Agreement</SelectItem>
                            <SelectItem value="gsa-schedule">GSA Schedule</SelectItem>
                            <SelectItem value="market-research">Market Research</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quoteDate">Quote Date</Label>
                        <Input
                          id="quoteDate"
                          type="date"
                          value={formData.quoteDate || ''}
                          onChange={(e) => setFormData({ ...formData, quoteDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quoteReference">Quote Reference</Label>
                        <Input
                          id="quoteReference"
                          placeholder="e.g., Q-2024-001"
                          value={formData.quoteReference || ''}
                          onChange={(e) => setFormData({ ...formData, quoteReference: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Contact Information Section ===== */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('contact')}
                  aria-expanded={expandedSections.contact}
                  aria-controls="section-contact"
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    <span className="font-medium text-sm text-gray-900">Contact & Notes</span>
                  </div>
                  {expandedSections.contact ? <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />}
                </button>
                
                {expandedSections.contact && (
                  <div id="section-contact" className="p-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryContact">Primary Contact</Label>
                      <Input
                        id="primaryContact"
                        placeholder="Contact name"
                        value={formData.primaryContact || ''}
                        onChange={(e) => setFormData({ ...formData, primaryContact: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contactEmail">Email</Label>
                        <Input
                          id="contactEmail"
                          type="email"
                          placeholder="email@company.com"
                          value={formData.contactEmail || ''}
                          onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contactPhone">Phone</Label>
                        <Input
                          id="contactPhone"
                          placeholder="(555) 123-4567"
                          value={formData.contactPhone || ''}
                          onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pastPerformance">Past Performance Notes</Label>
                      <Textarea
                        id="pastPerformance"
                        placeholder="Describe partner's relevant past performance and contract history..."
                        value={formData.pastPerformance || ''}
                        onChange={(e) => setFormData({ ...formData, pastPerformance: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Internal Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any additional notes about this partner..."
                        value={formData.notes || ''}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
              <Button variant="outline" onClick={closePanel} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1">
                {editingId ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" aria-hidden="true" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                    Add Partner
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </TooltipProvider>
  )
}

export default TeamingPartnersTab