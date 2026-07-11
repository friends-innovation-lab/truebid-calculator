// @ts-nocheck
'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Plus, 
  Trash2, 
  Pencil, 
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  Clock,
  Calendar,
  Building2,
  Info,
  Copy,
  Mail,
  MessageSquare,
  Search,
  Users,
  FileText,
  Check
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface NegotiationEntry {
  id: string
  date: string
  type: 'prime-offer' | 'our-counter' | 'prime-counter' | 'accepted' | 'declined' | 'lost'
  rate: number
  notes: string
}

interface YearBreakdown {
  year: number
  salary: number
  loadedRate: number
  offeredRate: number
  annualProfit: number
  isProfitable: boolean
}

interface PrimeOffer {
  id: string
  primeName: string
  roleTitle: string
  roleId: string
  level: string
  levelIndex: number
  levelName: string
  startingStep: number
  startingStepIndex: number
  startingSalary: number
  contractYears: number
  hoursPerYear: number
  // Current rate (latest in negotiation)
  offeredRate: number
  // Negotiation history
  negotiationHistory: NegotiationEntry[]
  // Calculated fields (based on current rate)
  yearBreakdowns: YearBreakdown[]
  totalProfit: number
  avgMarginPercent: number
  isProfitable: boolean
  breakEvenRate: number
  targetMarginRate: number
  // Tracking
  notes: string
  outcome: 'pending' | 'accepted' | 'countered' | 'declined' | 'lost'
  createdAt: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HOURS_PRESETS = [
  { label: '1.0 FTE', value: 1920, description: 'Full-time actual' },
  { label: '0.9 FTE', value: 1880, description: 'Reduced availability' },
  { label: '0.5 FTE', value: 960, description: 'Half-time' },
  { label: '0.25 FTE', value: 520, description: 'Quarter-time' },
]

const OUTCOME_CONFIG = {
  pending: { label: 'Pending', emoji: '⏳', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  countered: { label: 'Countered', emoji: '↩️', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  accepted: { label: 'Won', emoji: '✅', color: 'bg-green-50 text-green-700 border-green-200' },
  declined: { label: 'Passed', emoji: '❌', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  lost: { label: 'Lost', emoji: '😞', color: 'bg-red-50 text-red-700 border-red-200' },
}

const NEGOTIATION_TYPE_CONFIG = {
  'prime-offer': { label: 'Prime offered', emoji: '📥', color: 'text-gray-700' },
  'our-counter': { label: 'We countered', emoji: '📤', color: 'text-blue-700' },
  'prime-counter': { label: 'Prime countered', emoji: '📥', color: 'text-gray-700' },
  'accepted': { label: 'Accepted', emoji: '✅', color: 'text-green-700' },
  'declined': { label: 'Declined', emoji: '❌', color: 'text-gray-600' },
  'lost': { label: 'Lost', emoji: '😞', color: 'text-red-700' },
}

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

const formatRate = (rate: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate) + '/hr'

function getVerdict(offer: PrimeOffer): { text: string; description: string; color: string } {
  if (offer.isProfitable && offer.avgMarginPercent >= 8) {
    return { text: 'Good deal', description: 'Meets target margin', color: 'bg-green-50 text-green-700 border-green-200' }
  } else if (offer.isProfitable) {
    return { text: 'Below target', description: 'Covers costs but low profit', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
  } else {
    return { text: 'Loses money', description: "Doesn't cover costs", color: 'bg-red-50 text-red-700 border-red-200' }
  }
}

// ============================================================================
// OFFER CARD COMPONENT
// ============================================================================

interface OfferCardProps {
  offer: PrimeOffer
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}

function OfferCard({ offer, onClick, onEdit, onDelete }: OfferCardProps) {
  const verdict = getVerdict(offer)
  const profitableYears = offer.yearBreakdowns.filter(yb => yb.isProfitable).length
  const roundCount = offer.negotiationHistory?.length || 0
  const lastEntry = offer.negotiationHistory?.[0] // Most recent first
  
  // Format last activity date
  const formatLastActivity = () => {
    if (!lastEntry) return null
    const date = new Date(lastEntry.date)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div 
      className="group bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`${offer.primeName} offering ${formatRate(offer.offeredRate)} for ${offer.roleTitle}. ${verdict.text}.`}
    >
      {/* Status Banner - Top of card */}
      {offer.outcome !== 'pending' && (
        <div className={`px-4 py-2 border-b ${OUTCOME_CONFIG[offer.outcome].color} flex items-center justify-between`}>
          <span className="text-sm font-medium flex items-center gap-1.5">
            {OUTCOME_CONFIG[offer.outcome].emoji} {OUTCOME_CONFIG[offer.outcome].label}
          </span>
          {lastEntry && (
            <span className="text-xs opacity-75">{formatLastActivity()}</span>
          )}
        </div>
      )}

      {/* Card Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-900 truncate">{offer.primeName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{offer.roleTitle}</span>
              <span>•</span>
              <span>{offer.level} {offer.levelName}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); onEdit() }} 
              className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              aria-label="Edit offer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); onDelete() }} 
              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete offer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-4 py-3">
        {/* Verdict badge - only show if pending (otherwise status banner is visible) */}
        {offer.outcome === 'pending' && (
          <div className="flex items-center gap-2 mb-3">
            <Badge className={`text-xs px-1.5 py-0 h-5 border ${verdict.color}`}>
              {verdict.text}
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Current rate</div>
            <div className="text-sm font-semibold text-gray-900">{formatRate(offer.offeredRate)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Target</div>
            <div className={`text-sm font-semibold ${offer.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {formatRate(offer.targetMarginRate)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {offer.contractYears} yr × {offer.hoursPerYear.toLocaleString()} hrs
          </span>
          <span className={`font-semibold ${offer.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {offer.totalProfit >= 0 ? '+' : ''}{formatCurrency(offer.totalProfit)}
          </span>
        </div>
      </div>

      {/* Card Footer - Activity & Issues */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {roundCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {roundCount} {roundCount === 1 ? 'round' : 'rounds'}
            </span>
          )}
          {offer.notes && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Notes
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {profitableYears < offer.contractYears && (
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="w-3 h-3" />
              {profitableYears}/{offer.contractYears} yrs
            </span>
          )}
          {offer.hoursPerYear < 2080 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.round((offer.hoursPerYear / 2080) * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// OFFER SLIDEOUT PANEL
// ============================================================================

interface OfferSlideoutProps {
  offer: PrimeOffer
  isOpen: boolean
  onClose: () => void
  onUpdate: (updates: Partial<PrimeOffer>) => void
  onEdit: () => void
  targetMargin: number
}

function OfferSlideout({ offer, isOpen, onClose, onUpdate, onEdit, targetMargin }: OfferSlideoutProps) {
  const [activeTab, setActiveTab] = useState('analysis')
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showAddEntryDialog, setShowAddEntryDialog] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Local tracking state
  const [localNotes, setLocalNotes] = useState(offer.notes || '')
  const [localOutcome, setLocalOutcome] = useState(offer.outcome || 'pending')
  const [localHistory, setLocalHistory] = useState<NegotiationEntry[]>(offer.negotiationHistory || [])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // New entry form state
  const [newEntryType, setNewEntryType] = useState<NegotiationEntry['type']>('prime-counter')
  const [newEntryRate, setNewEntryRate] = useState('')
  const [newEntryNotes, setNewEntryNotes] = useState('')

  // Reset local state when offer changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional sync from prop to local state */
    setLocalNotes(offer.notes || '')
    setLocalOutcome(offer.outcome || 'pending')
    setLocalHistory(offer.negotiationHistory || [])
    setHasUnsavedChanges(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [offer.id, offer.notes, offer.outcome, offer.negotiationHistory])

  // Track unsaved changes
  useEffect(() => {
    const notesChanged = localNotes !== (offer.notes || '')
    const outcomeChanged = localOutcome !== (offer.outcome || 'pending')
    const historyChanged = JSON.stringify(localHistory) !== JSON.stringify(offer.negotiationHistory || [])
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state from local vs prop comparison
    setHasUnsavedChanges(notesChanged || outcomeChanged || historyChanged)
  }, [localNotes, localOutcome, localHistory, offer.notes, offer.outcome, offer.negotiationHistory])

  const verdict = getVerdict(offer)
  const profitableYears = offer.yearBreakdowns.filter(yb => yb.isProfitable).length
  const utilizationPercent = (offer.hoursPerYear / 2080) * 100

  const handleCopyRate = () => {
    navigator.clipboard.writeText(offer.targetMarginRate.toFixed(2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveTracking = () => {
    // Get latest rate from history to update offer
    const latestRate = localHistory.length > 0 ? localHistory[0].rate : offer.offeredRate
    onUpdate({ 
      notes: localNotes, 
      outcome: localOutcome,
      negotiationHistory: localHistory,
      offeredRate: latestRate
    })
    setHasUnsavedChanges(false)
  }

  const handleAddEntry = () => {
    const rate = parseFloat(newEntryRate)
    if (!rate || rate <= 0) return

    const newEntry: NegotiationEntry = {
      id: `entry-${Date.now()}`,
      date: new Date().toISOString(),
      type: newEntryType,
      rate,
      notes: newEntryNotes
    }
    
    // Add to beginning (most recent first)
    setLocalHistory([newEntry, ...localHistory])
    
    // Auto-update status based on entry type
    if (newEntryType === 'accepted') {
      setLocalOutcome('accepted')
    } else if (newEntryType === 'declined') {
      setLocalOutcome('declined')
    } else if (newEntryType === 'lost') {
      setLocalOutcome('lost')
    } else if (newEntryType === 'our-counter' || newEntryType === 'prime-counter') {
      setLocalOutcome('countered')
    }
    
    // Reset form
    setNewEntryType('prime-counter')
    setNewEntryRate('')
    setNewEntryNotes('')
    setShowAddEntryDialog(false)
  }

  const handleDeleteEntry = (entryId: string) => {
    setLocalHistory(localHistory.filter(e => e.id !== entryId))
  }

  const emailBody = `Hi,

Thank you for considering our team for the ${offer.roleTitle} position on this effort.

After reviewing the proposed rate of ${formatRate(offer.offeredRate)}, we'd like to discuss adjusting to ${formatRate(offer.targetMarginRate)} to account for our fully-loaded labor costs over the ${offer.contractYears}-year period of performance.

This rate reflects annual salary progression and ensures we can provide the continuity and quality you expect throughout the contract.

Happy to discuss at your convenience.

Best regards`

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden="true" />
      <div 
        className="fixed inset-y-0 right-0 w-[750px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideout-title"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 text-gray-400" />
                <h3 id="slideout-title" className="text-lg font-semibold text-gray-900">{offer.primeName}</h3>
                {/* Tracking status badge in header */}
                {offer.outcome !== 'pending' && (
                  <Badge className={`text-xs px-1.5 py-0 h-5 border ${OUTCOME_CONFIG[offer.outcome].color}`}>
                    {OUTCOME_CONFIG[offer.outcome].emoji} {OUTCOME_CONFIG[offer.outcome].label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs px-1.5 py-0 h-5 border ${verdict.color}`}>
                  {verdict.text}
                </Badge>
                <span className="text-sm text-gray-600">{offer.roleTitle} • {offer.level}</span>
                <span className="text-sm font-semibold text-gray-900 ml-auto">{formatRate(offer.offeredRate)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onEdit} className="h-8">
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-2xl leading-none h-8 w-8 p-0" aria-label="Close panel">
                ×
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analysis" className="text-xs">Analysis</TabsTrigger>
              <TabsTrigger value="breakdown" className="text-xs">Year Breakdown</TabsTrigger>
              <TabsTrigger value="tracking" className="text-xs">
                Tracking
                {hasUnsavedChanges ? (
                  <Badge variant="destructive" className="ml-1 text-xs px-1 py-0 h-4">•</Badge>
                ) : offer.outcome !== 'pending' ? (
                  <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
                    {OUTCOME_CONFIG[offer.outcome].emoji}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            {/* ANALYSIS TAB */}
            <TabsContent value="analysis" className="space-y-6">
              {/* Verdict Banner */}
              <div className={`p-4 rounded-lg border ${
                offer.isProfitable 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {offer.isProfitable ? (
                    <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h4 className={`text-lg font-semibold ${offer.isProfitable ? 'text-green-800' : 'text-red-800'}`}>
                      {verdict.text}
                    </h4>
                    <p className={`text-sm ${offer.isProfitable ? 'text-green-700' : 'text-red-700'}`}>
                      {offer.isProfitable 
                        ? `This offer generates ${formatCurrency(offer.totalProfit)} profit over ${offer.contractYears} years.`
                        : `This offer loses ${formatCurrency(Math.abs(offer.totalProfit))} over ${offer.contractYears} years.`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Counter Rate Recommendations */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Counter rate recommendations</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Break-even rate</div>
                    <div className="text-xl font-bold text-gray-900">{formatRate(offer.breakEvenRate)}</div>
                    <div className="text-xs text-gray-500 mt-1">Covers costs, zero profit</div>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs text-blue-600 mb-1">Recommended rate</div>
                    <div className="text-xl font-bold text-blue-700">{formatRate(offer.targetMarginRate)}</div>
                    <div className="text-xs text-blue-600 mt-1">Includes {(targetMargin * 100).toFixed(0)}% profit</div>
                  </div>
                </div>
              </div>

              {/* Advice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    {offer.offeredRate >= offer.targetMarginRate ? (
                      <>Their rate of <strong>{formatRate(offer.offeredRate)}</strong> is good — it covers your costs plus profit.</>
                    ) : offer.offeredRate >= offer.breakEvenRate ? (
                      <>Their rate of <strong>{formatRate(offer.offeredRate)}</strong> only covers costs. Ask for <strong>{formatRate(offer.targetMarginRate)}</strong> to make a profit.</>
                    ) : (
                      <>Their rate of <strong>{formatRate(offer.offeredRate)}</strong> loses you money. Ask for at least <strong>{formatRate(offer.breakEvenRate)}</strong> to break even, or <strong>{formatRate(offer.targetMarginRate)}</strong> to profit.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyRate} className="flex-1">
                  {copied ? (
                    <><Check className="w-4 h-4 mr-2 text-green-600" />Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-2" />Copy Rate</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(true)} className="flex-1">
                  <Mail className="w-4 h-4 mr-2" />
                  Draft Email
                </Button>
              </div>

              {/* Utilization Warning */}
              {utilizationPercent < 100 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Partial workload: {utilizationPercent.toFixed(0)}%</p>
                      <p className="text-xs text-blue-800 mt-1">
                        They&apos;re only buying {offer.hoursPerYear.toLocaleString()} hours/year. You&apos;ll need other work 
                        to keep this person busy the rest of the time.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Offer Details */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900">Offer details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Role</div>
                    <div className="font-medium text-gray-900">{offer.roleTitle}</div>
                    <div className="text-xs text-gray-500">{offer.level} {offer.levelName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Starting salary</div>
                    <div className="font-medium text-gray-900">{formatCurrency(offer.startingSalary)}/yr</div>
                    <div className="text-xs text-gray-500">Step {offer.startingStep}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Contract duration</div>
                    <div className="font-medium text-gray-900">{offer.contractYears} years</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Hours per year</div>
                    <div className="font-medium text-gray-900">{offer.hoursPerYear.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* BREAKDOWN TAB */}
            <TabsContent value="breakdown" className="space-y-4">
              <div className="text-xs text-gray-500 mb-2">
                Your costs go up each year as the employee gets raises. {profitableYears}/{offer.contractYears} years are profitable.
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Year</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-600">Salary</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-600">Your Cost</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-600">They Pay</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-600">You Make</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offer.yearBreakdowns.map((yb, idx) => (
                      <tr 
                        key={yb.year} 
                        className={`border-b border-gray-200 ${!yb.isProfitable ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          Year {yb.year}
                          {!yb.isProfitable && <span className="ml-1" title="Loses money">⚠️</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(yb.salary)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatRate(yb.loadedRate)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatRate(yb.offeredRate)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${yb.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                          {yb.annualProfit >= 0 ? '+' : ''}{formatCurrency(yb.annualProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-gray-900" colSpan={4}>Total</td>
                      <td className={`px-4 py-3 text-right font-bold ${offer.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                        {offer.totalProfit >= 0 ? '+' : ''}{formatCurrency(offer.totalProfit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </TabsContent>

            {/* TRACKING TAB */}
            <TabsContent value="tracking" className="space-y-6">
              {/* Unsaved changes banner */}
              {hasUnsavedChanges && (
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    You have unsaved changes
                  </div>
                  <Button size="sm" onClick={handleSaveTracking}>
                    Save Changes
                  </Button>
                </div>
              )}

              {/* Status Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Status</Label>
                </div>
                <Select value={localOutcome} onValueChange={(v) => setLocalOutcome(v as PrimeOffer['outcome'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{OUTCOME_CONFIG.pending.emoji} Pending — waiting on response</SelectItem>
                    <SelectItem value="countered">{OUTCOME_CONFIG.countered.emoji} In Negotiation</SelectItem>
                    <SelectItem value="accepted">{OUTCOME_CONFIG.accepted.emoji} Won — deal closed</SelectItem>
                    <SelectItem value="declined">{OUTCOME_CONFIG.declined.emoji} Passed — we declined</SelectItem>
                    <SelectItem value="lost">{OUTCOME_CONFIG.lost.emoji} Lost — they went elsewhere</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Negotiation History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Negotiation History</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowAddEntryDialog(true)}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Update
                  </Button>
                </div>
                
                {localHistory.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 border border-gray-200 rounded-lg">
                    <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No history yet</p>
                    <p className="text-xs text-gray-400 mt-1">Add entries as the negotiation progresses</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {localHistory.map((entry, idx) => (
                      <div 
                        key={entry.id}
                        className={`p-3 border rounded-lg ${
                          entry.type === 'accepted' ? 'bg-green-50 border-green-200' :
                          entry.type === 'declined' || entry.type === 'lost' ? 'bg-gray-50 border-gray-200' :
                          entry.type === 'our-counter' ? 'bg-blue-50 border-blue-200' :
                          'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${NEGOTIATION_TYPE_CONFIG[entry.type].color}`}>
                              {NEGOTIATION_TYPE_CONFIG[entry.type].emoji} {NEGOTIATION_TYPE_CONFIG[entry.type].label}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatRate(entry.rate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {entry.notes && (
                          <p className="text-xs text-gray-600 mt-1">{entry.notes}</p>
                        )}
                        {idx === 0 && entry.type !== 'accepted' && entry.type !== 'declined' && entry.type !== 'lost' && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <span className={`text-xs ${
                              entry.rate >= offer.targetMarginRate ? 'text-green-600' : 
                              entry.rate >= offer.breakEvenRate ? 'text-yellow-600' : 
                              'text-red-600'
                            }`}>
                              {entry.rate >= offer.targetMarginRate ? '✓ Meets target margin' : 
                               entry.rate >= offer.breakEvenRate ? '⚠ Profitable but below target' : 
                               '✗ Below break-even'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* General Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">General Notes</Label>
                <Textarea
                  id="notes"
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  placeholder="Overall notes about this opportunity..."
                  rows={3}
                />
              </div>

              {/* Save button at bottom */}
              <div className="pt-4 border-t border-gray-200">
                <Button 
                  onClick={handleSaveTracking} 
                  disabled={!hasUnsavedChanges}
                  className="w-full"
                >
                  {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Email Draft Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Counter Offer Email</DialogTitle>
            <DialogDescription>Copy this template and customize for your email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Subject</Label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                Re: {offer.roleTitle} Rate Discussion
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Body</Label>
              <Textarea
                value={emailBody}
                readOnly
                rows={12}
                className="text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Close</Button>
            <Button onClick={() => {
              navigator.clipboard.writeText(emailBody)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}>
              {copied ? <><Check className="w-4 h-4 mr-2" />Copied!</> : <><Copy className="w-4 h-4 mr-2" />Copy to Clipboard</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog open={showAddEntryDialog} onOpenChange={setShowAddEntryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Negotiation Update</DialogTitle>
            <DialogDescription>Record a rate change or negotiation milestone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">What happened?</Label>
              <Select value={newEntryType} onValueChange={(v) => setNewEntryType(v as NegotiationEntry['type'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prime-counter">📥 Prime countered with new rate</SelectItem>
                  <SelectItem value="our-counter">📤 We countered with new rate</SelectItem>
                  <SelectItem value="accepted">✅ Accepted / Deal won</SelectItem>
                  <SelectItem value="declined">❌ We declined</SelectItem>
                  <SelectItem value="lost">😞 Lost to competitor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {newEntryType === 'accepted' ? 'Final agreed rate' : 
                 newEntryType === 'our-counter' ? 'Rate we proposed' :
                 newEntryType === 'declined' || newEntryType === 'lost' ? 'Last offered rate' :
                 'Rate they offered'}
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  value={newEntryRate}
                  onChange={(e) => setNewEntryRate(e.target.value)}
                  className="pl-9 pr-12"
                  placeholder={offer.targetMarginRate.toFixed(2)}
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">/hr</span>
              </div>
              {newEntryRate && parseFloat(newEntryRate) > 0 && (
                <p className={`text-xs mt-1 ${
                  parseFloat(newEntryRate) >= offer.targetMarginRate ? 'text-green-600' : 
                  parseFloat(newEntryRate) >= offer.breakEvenRate ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {parseFloat(newEntryRate) >= offer.targetMarginRate ? '✓ Meets target margin' : 
                   parseFloat(newEntryRate) >= offer.breakEvenRate ? '⚠ Profitable but below target' : 
                   '✗ Below break-even — loses money'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes (optional)</Label>
              <Textarea
                value={newEntryNotes}
                onChange={(e) => setNewEntryNotes(e.target.value)}
                placeholder="Any context about this update..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEntryDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleAddEntry}
              disabled={!newEntryRate || parseFloat(newEntryRate) <= 0}
            >
              Add Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================================
// ADD/EDIT OFFER DIALOG
// ============================================================================

interface OfferFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (offer: PrimeOffer) => void
  editingOffer?: PrimeOffer | null
  companyRoles: any[]
  calculateOffer: (params: any) => any
}

function OfferFormDialog({ isOpen, onClose, onSave, editingOffer, companyRoles, calculateOffer }: OfferFormDialogProps) {
  const [primeName, setPrimeName] = useState('')
  const [roleId, setRoleId] = useState('')
  const [levelIndex, setLevelIndex] = useState<number | null>(null)
  const [stepIndex, setStepIndex] = useState<number | null>(null)
  const [contractYears, setContractYears] = useState(3)
  const [hoursPerYear, setHoursPerYear] = useState(1920)
  const [offeredRate, setOfferedRate] = useState(150)

  // Reset form when editing offer changes
  /* eslint-disable react-hooks/set-state-in-effect -- intentional form reset from prop */
  useEffect(() => {
    if (editingOffer) {
      setPrimeName(editingOffer.primeName)
      setRoleId(editingOffer.roleId)
      setLevelIndex(editingOffer.levelIndex)
      setStepIndex(editingOffer.startingStepIndex)
      setContractYears(editingOffer.contractYears)
      setHoursPerYear(editingOffer.hoursPerYear)
      setOfferedRate(editingOffer.offeredRate)
    } else {
      setPrimeName('')
      setRoleId('')
      setLevelIndex(null)
      setStepIndex(null)
      setContractYears(3)
      setHoursPerYear(1880)
      setOfferedRate(150)
    }
  }, [editingOffer, isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedRole = companyRoles.find((r: any) => r.id === roleId)

   
  const preview = useMemo(() => {
    if (!selectedRole || levelIndex === null || stepIndex === null) return null
    return calculateOffer({
      role: selectedRole,
      levelIndex,
      stepIndex,
      contractYears,
      hoursPerYear,
      offeredRate
    })
  }, [selectedRole, levelIndex, stepIndex, contractYears, hoursPerYear, offeredRate, calculateOffer])

  const handleSave = () => {
    if (!selectedRole || levelIndex === null || stepIndex === null || !preview) return
    
    const level = selectedRole.levels[levelIndex]
    const step = level.steps[stepIndex]
    
    // If creating new offer, add initial entry to negotiation history
    const existingHistory = editingOffer?.negotiationHistory || []
    const initialHistory: NegotiationEntry[] = existingHistory.length === 0 ? [{
      id: `entry-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'prime-offer',
      rate: offeredRate,
      notes: 'Initial offer'
    }] : existingHistory
    
    const offer: PrimeOffer = {
      id: editingOffer?.id || `offer-${Date.now()}`,
      primeName,
      roleTitle: selectedRole.title,
      roleId,
      level: level.level,
      levelIndex,
      levelName: level.levelName,
      startingStep: step.step,
      startingStepIndex: stepIndex,
      startingSalary: step.salary,
      notes: editingOffer?.notes || '',
      outcome: editingOffer?.outcome || 'pending',
      negotiationHistory: initialHistory,
      createdAt: editingOffer?.createdAt || new Date().toISOString(),
      ...preview
    }
    
    onSave(offer)
    onClose()
  }

  const canSave = primeName && selectedRole && levelIndex !== null && stepIndex !== null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingOffer ? 'Edit' : 'Analyze'} Prime Offer</DialogTitle>
          <DialogDescription>
            Enter the details of the prime contractor&apos;s offer to see if it covers your costs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section 1: Who */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Building2 className="w-4 h-4 text-gray-400" />
              Who&apos;s making the offer?
            </div>
            <div className="space-y-2">
              <Label htmlFor="prime-name">Prime contractor name <span className="text-red-500">*</span></Label>
              <Input
                id="prime-name"
                value={primeName}
                onChange={(e) => setPrimeName(e.target.value)}
                placeholder="e.g., Booz Allen Hamilton"
              />
            </div>
          </div>

          {/* Section 2: What */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Users className="w-4 h-4 text-gray-400" />
              What role are they buying?
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Role <span className="text-red-500">*</span></Label>
                <Select value={roleId} onValueChange={(v) => { setRoleId(v); setLevelIndex(null); setStepIndex(null) }}>
                  <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                  <SelectContent>
                    {companyRoles.map((role: any) => (
                      <SelectItem key={role.id} value={role.id}>{role.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Level <span className="text-red-500">*</span></Label>
                <Select 
                  value={levelIndex !== null ? String(levelIndex) : ''} 
                  onValueChange={(v) => { setLevelIndex(parseInt(v)); setStepIndex(null) }}
                  disabled={!selectedRole}
                >
                  <SelectTrigger><SelectValue placeholder="Select level..." /></SelectTrigger>
                  <SelectContent>
                    {selectedRole?.levels?.map((level: any, idx: number) => (
                      <SelectItem key={idx} value={String(idx)}>{level.level} - {level.levelName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Step <span className="text-red-500">*</span></Label>
                <Select 
                  value={stepIndex !== null ? String(stepIndex) : ''} 
                  onValueChange={(v) => setStepIndex(parseInt(v))}
                  disabled={!selectedLevel}
                >
                  <SelectTrigger><SelectValue placeholder="Select step..." /></SelectTrigger>
                  <SelectContent>
                    {selectedLevel?.steps?.map((step: any, idx: number) => (
                      <SelectItem key={idx} value={String(idx)}>
                        Step {step.step} - {formatCurrency(step.salary)}/yr
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: Contract */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Calendar className="w-4 h-4 text-gray-400" />
              Contract details
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="years">Contract length (years)</Label>
                <Input
                  id="years"
                  type="number"
                  min={1}
                  max={10}
                  value={contractYears}
                  onChange={(e) => setContractYears(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hours per year</Label>
                <div className="flex gap-1">
                  {HOURS_PRESETS.map((preset) => (
                    <Tooltip key={preset.value}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant={hoursPerYear === preset.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setHoursPerYear(preset.value)}
                          className="flex-1 text-xs"
                        >
                          {preset.label}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{preset.value.toLocaleString()} hrs — {preset.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Rate */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <DollarSign className="w-4 h-4 text-gray-400" />
              What are they offering to pay?
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Hourly rate <span className="text-red-500">*</span></Label>
              <div className="relative max-w-xs">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="rate"
                  type="number"
                  value={offeredRate}
                  onChange={(e) => setOfferedRate(parseFloat(e.target.value) || 0)}
                  className="pl-9 pr-12"
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">/hr</span>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          {preview && (
            <div className={`p-4 rounded-lg border ${preview.isProfitable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {preview.isProfitable ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-semibold ${preview.isProfitable ? 'text-green-800' : 'text-red-800'}`}>
                    {getVerdict({ ...preview, isProfitable: preview.isProfitable } as PrimeOffer).text}
                  </span>
                </div>
                <span className={`text-lg font-bold ${preview.isProfitable ? 'text-green-700' : 'text-red-700'}`}>
                  {preview.totalProfit >= 0 ? '+' : ''}{formatCurrency(preview.totalProfit)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Break-even</div>
                  <div className="font-medium">{formatRate(preview.breakEvenRate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Target</div>
                  <div className="font-medium text-blue-700">{formatRate(preview.targetMarginRate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Offered</div>
                  <div className="font-medium">{formatRate(offeredRate)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {editingOffer ? 'Save Changes' : 'Analyze Offer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SubRatesTab() {
  const {
    companyRoles,
    calculateLoadedRate,
    calculateYearSalaries,
    costMultipliers,
    profitMargin
  } = useAppContext()

  const [primeOffers, setPrimeOffers] = useState<PrimeOffer[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingOffer, setEditingOffer] = useState<PrimeOffer | null>(null)

  const targetMarginPercent = (profitMargin || 10) / 100

  // Calculate offer from form inputs
  const calculateOffer = useCallback((params: {
    role: any
    levelIndex: number
    stepIndex: number
    contractYears: number
    hoursPerYear: number
    offeredRate: number
  }) => {
    const { role, levelIndex, stepIndex, contractYears, hoursPerYear, offeredRate } = params
    
    const yearlySalaries = calculateYearSalaries(role, levelIndex, stepIndex, contractYears)
    
    const yearBreakdowns: YearBreakdown[] = yearlySalaries.map((salary, idx) => {
      // calculateLoadedRate takes annual salary and returns HOURLY loaded rate
      // (It internally divides by 2080 and applies fringe/overhead/G&A)
      const loadedHourlyRate = calculateLoadedRate(salary, false)
      
      // Annual cost = loaded hourly rate × hours worked
      const annualCost = loadedHourlyRate * hoursPerYear
      
      // Annual revenue from prime
      const annualRevenue = offeredRate * hoursPerYear
      
      // Profit = revenue - cost
      const annualProfit = annualRevenue - annualCost
      
      return {
        year: idx + 1,
        salary,
        loadedRate: loadedHourlyRate,
        offeredRate,
        annualProfit,
        isProfitable: annualProfit >= 0
      }
    })
    
    const totalProfit = yearBreakdowns.reduce((sum, yb) => sum + yb.annualProfit, 0)
    const totalRevenue = offeredRate * hoursPerYear * contractYears
    const avgMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const isProfitable = yearBreakdowns.every(yb => yb.isProfitable)
    
    // Break-even = highest loaded rate across all years (covers worst year)
    const maxLoadedRate = Math.max(...yearBreakdowns.map(yb => yb.loadedRate))
    const breakEvenRate = maxLoadedRate
    const targetMarginRate = maxLoadedRate * (1 + targetMarginPercent)
    
    return {
      contractYears,
      hoursPerYear,
      offeredRate,
      yearBreakdowns,
      totalProfit,
      avgMarginPercent,
      isProfitable,
      breakEvenRate,
      targetMarginRate
    }
  }, [calculateYearSalaries, calculateLoadedRate, targetMarginPercent])

  // Filter offers by tab
  const filteredOffers = useMemo(() => {
    let filtered = [...primeOffers]
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(o => 
        o.primeName.toLowerCase().includes(q) || 
        o.roleTitle.toLowerCase().includes(q)
      )
    }
    
    // Tab filter
    switch (activeTab) {
      case 'profitable':
        filtered = filtered.filter(o => o.isProfitable)
        break
      case 'needs-counter':
        filtered = filtered.filter(o => !o.isProfitable)
        break
    }
    
    return filtered
  }, [primeOffers, activeTab, searchQuery])

  // Stats
  const stats = useMemo(() => {
    const total = primeOffers.length
    const profitable = primeOffers.filter(o => o.isProfitable).length
    const needsCounter = total - profitable
    const totalPL = primeOffers.reduce((sum, o) => sum + o.totalProfit, 0)
    return { total, profitable, needsCounter, totalPL }
  }, [primeOffers])

  const selectedOffer = primeOffers.find(o => o.id === selectedOfferId)

  const handleSaveOffer = (offer: PrimeOffer) => {
    setPrimeOffers(prev => {
      const existing = prev.find(o => o.id === offer.id)
      if (existing) {
        return prev.map(o => o.id === offer.id ? offer : o)
      }
      return [...prev, offer]
    })
    setEditingOffer(null)
  }

  const handleDeleteOffer = (id: string) => {
    setPrimeOffers(prev => prev.filter(o => o.id !== id))
    if (selectedOfferId === id) setSelectedOfferId(null)
  }

  const handleUpdateOffer = (id: string, updates: Partial<PrimeOffer>) => {
    setPrimeOffers(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
  }

  // Handle keyboard shortcut to close slideout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedOfferId) {
        setSelectedOfferId(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedOfferId])

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">Prime Offers</h1>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs cursor-help">
                  Utility Tool
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-sm mb-2">Check if prime contractor rate offers cover your fully-loaded costs.</p>
                <p className="text-xs text-gray-500">
                  Using: Fringe {((costMultipliers?.fringe || 0) * 100).toFixed(0)}%, 
                  OH {((costMultipliers?.overhead || 0) * 100).toFixed(0)}%, 
                  G&A {((costMultipliers?.ga || 0) * 100).toFixed(0)}%, 
                  Profit {profitMargin || 10}%
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Stats Bar */}
          {stats.total > 0 && (
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Offers</span>
                <span className="font-semibold text-gray-900">{stats.total}</span>
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Profitable</span>
                <span className="font-semibold text-green-600">{stats.profitable}</span>
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Need Counter</span>
                <span className="font-semibold text-red-600">{stats.needsCounter}</span>
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Total P/L</span>
                <span className={`font-semibold ${stats.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.totalPL >= 0 ? '+' : ''}{formatCurrency(stats.totalPL)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs & Actions */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-gray-100 p-1">
              <TabsTrigger value="all" className="text-xs px-4 data-[state=active]:bg-white">
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                All Offers
                <Badge variant="secondary" className="ml-1.5 text-xs px-1 py-0 h-4">{stats.total}</Badge>
              </TabsTrigger>
              <TabsTrigger value="profitable" className="text-xs px-4 data-[state=active]:bg-white">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Profitable
                <Badge variant="secondary" className="ml-1.5 text-xs px-1 py-0 h-4 bg-green-100 text-green-700">{stats.profitable}</Badge>
              </TabsTrigger>
              <TabsTrigger value="needs-counter" className="text-xs px-4 data-[state=active]:bg-white">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Need Counter
                {stats.needsCounter > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-xs px-1 py-0 h-4">{stats.needsCounter}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <Button size="sm" onClick={() => { setEditingOffer(null); setShowAddDialog(true) }}>
              <Plus className="w-4 h-4 mr-2" />
              Analyze Offer
            </Button>
          </div>

          {/* Search */}
          {stats.total > 0 && (
            <div className="flex-1 max-w-xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Search offers..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="pl-9 h-9" 
                />
              </div>
            </div>
          )}

          {/* Content */}
          <TabsContent value={activeTab} className="mt-0">
            {filteredOffers.length === 0 ? (
              <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {stats.total === 0 ? 'No offers analyzed yet' : 'No matching offers'}
                </h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  {stats.total === 0 
                    ? 'When a prime contractor offers you a subcontract rate, analyze it here to see if it covers your fully-loaded costs.'
                    : 'Try adjusting your search or filter criteria.'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredOffers.map(offer => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    onClick={() => setSelectedOfferId(offer.id)}
                    onEdit={() => { setEditingOffer(offer); setShowAddDialog(true) }}
                    onDelete={() => handleDeleteOffer(offer.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Slideout Panel */}
        {selectedOffer && (
          <OfferSlideout
            offer={selectedOffer}
            isOpen={!!selectedOfferId}
            onClose={() => setSelectedOfferId(null)}
            onUpdate={(updates) => handleUpdateOffer(selectedOffer.id, updates)}
            onEdit={() => { setEditingOffer(selectedOffer); setShowAddDialog(true); setSelectedOfferId(null) }}
            targetMargin={targetMarginPercent}
          />
        )}

        {/* Add/Edit Dialog */}
        <OfferFormDialog
          isOpen={showAddDialog}
          onClose={() => { setShowAddDialog(false); setEditingOffer(null) }}
          onSave={handleSaveOffer}
          editingOffer={editingOffer}
          companyRoles={companyRoles}
          calculateOffer={calculateOffer}
        />
      </div>
    </TooltipProvider>
  )
}

export default SubRatesTab