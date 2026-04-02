'use client'

// Estimate tab - WBS, Requirements, Labor, Charge Codes
import React, { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { useParams } from 'next/navigation'
import { wbsApi, requirementsApi } from '@/lib/api'
import {
  Search, Plus, ChevronDown, ChevronUp, Info, HelpCircle,
  Calendar, AlertTriangle, Link2, Pencil, Trash2, X, Check,
  FileText, Users, Lightbulb,
  Shield, ArrowRight, CheckCircle2, XCircle,
  Layers, Grid3X3,
  List, Table2, Building2, Hash, Filter,
  ClipboardCheck, GitMerge, PieChart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SettingsCallout } from '@/components/shared/settings-callout'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { DecomposeButton } from '@/components/task-decomposition'
import { Loader2, Wand2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAppContext } from '@/contexts/app-context'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type PeriodKey = 'base' | 'option1' | 'option2' | 'option3' | 'option4'

interface PeriodHours {
  base: number
  option1: number
  option2: number
  option3: number
  option4: number
}

type EstimateMethod = 'historical' | 'parametric' | 'firm-quote' | 'level-of-effort' | 'engineering'

interface ChargeCode {
  id: string
  chargeNumber: string
  projectName: string
  client: string
  dateRange: string
  totalHours: number
  description: string
  roles: string[]
}

type RequirementType = 'shall' | 'should' | 'may' | 'will'
type RequirementCategory = 'functional' | 'technical' | 'compliance' | 'performance' | 'security' | 'management' | 'other'

interface SOORequirement {
  id: string
  referenceNumber: string
  title: string
  description: string
  type: RequirementType
  category: RequirementCategory
  priority: 'critical' | 'high' | 'medium' | 'low'
  source: string
  linkedWbsIds: string[]
  notes: string
  isAIExtracted: boolean
  reference_number?: string  // Optional: snake_case alias from API
}

interface HistoricalReference {
  chargeCodeId: string
  chargeNumber: string
  projectName: string
  dateRange: string
  actualHours: number
  notes: string
}

interface EnhancedLaborEstimate {
  id: string
  roleId: string
  roleName: string
  hoursByPeriod: PeriodHours
  rationale: string
  confidence: 'high' | 'medium' | 'low'
  isAISuggested: boolean
  isOrphaned?: boolean
}

interface WBSRisk {
  id: string
  description: string
  probability: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  mitigation: string
  status: 'open' | 'mitigated' | 'accepted' | 'closed'
}

interface WBSDependency {
  id: string
  predecessorWbsId: string
  predecessorWbsNumber: string
  type: 'FS' | 'SS' | 'FF' | 'SF'
  lagDays: number
}

interface EnhancedWBSElement {
  id: string
  wbsNumber: string
  title: string
  sowReference: string
  clin?: string
  periodOfPerformance: { startDate: string; endDate: string }
  why: string
  what: string
  notIncluded: string
  assumptions: string[]
  estimateMethod: EstimateMethod
  historicalReference?: HistoricalReference
  engineeringBasis?: {
    similarWork: string
    expertSource: string
    assumptions: string
    confidenceNotes: string
  }
  complexityFactor: number
  complexityJustification: string
  laborEstimates: EnhancedLaborEstimate[]
  risks: WBSRisk[]
  dependencies: WBSDependency[]
  qualityGrade: 'blue' | 'green' | 'yellow' | 'red'
  qualityScore: number
  qualityIssues: string[]
  isAIGenerated: boolean
  aiConfidence: number
}

interface SelectedRole {
  id: string
  name: string
  category: string
  baseRate: number
}

type ViewMode = 'grid' | 'table'
// ============================================================================
// CONSTANTS & LABELS
// ============================================================================

const ESTIMATE_METHOD_LABELS: Record<EstimateMethod, { label: string; description: string; icon: string }> = {
  'historical': { label: 'Historical', description: 'Based on actual hours from similar completed projects', icon: '📊' },
  'parametric': { label: 'Parametric', description: 'Calculated using known metrics (e.g., hours per screen)', icon: '📐' },
  'firm-quote': { label: 'Firm Quote', description: 'Based on quotes from subcontractors or vendors', icon: '📋' },
  'level-of-effort': { label: 'Level of Effort', description: 'Ongoing support without specific deliverables', icon: '🔄' },
  'engineering': { label: 'Engineering Judgment', description: 'Expert assessment based on team experience', icon: '🧠' },
}

const PROBABILITY_LABELS: Record<number, string> = { 1: 'Very unlikely', 2: 'Unlikely', 3: 'Possible', 4: 'Likely', 5: 'Very likely' }
const IMPACT_LABELS: Record<number, string> = { 1: 'Minimal', 2: 'Minor', 3: 'Moderate', 4: 'Significant', 5: 'Severe' }

const QUALITY_GRADE_CONFIG: Record<string, { label: string; description: string; bgColor: string; textColor: string; borderColor: string }> = {
  'blue': { label: 'Audit-Ready', description: 'Historical basis with charge number', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-100' },
  'green': { label: 'Complete', description: 'Well-documented estimate', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
  'yellow': { label: 'Needs Review', description: 'Missing some documentation', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
  'red': { label: 'Incomplete', description: 'Critical information missing', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
}

const DEPENDENCY_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  'FS': { label: 'Finish-to-Start', description: 'B starts after A finishes' },
  'SS': { label: 'Start-to-Start', description: 'B starts when A starts' },
  'FF': { label: 'Finish-to-Finish', description: 'B finishes when A finishes' },
  'SF': { label: 'Start-to-Finish', description: 'B finishes when A starts' },
}

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string }> = {
  'high': { label: 'High', color: 'text-green-600' },
  'medium': { label: 'Medium', color: 'text-yellow-600' },
  'low': { label: 'Low', color: 'text-red-600' },
}

const REQUIREMENT_TYPE_CONFIG: Record<RequirementType, { label: string; description: string; color: string }> = {
  'shall': { label: 'Shall', description: 'Mandatory requirement - must be met', color: 'text-gray-700 bg-gray-100 border-gray-200' },
  'should': { label: 'Should', description: 'Expected requirement - strongly recommended', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  'will': { label: 'Will', description: 'Government action or statement of fact', color: 'text-blue-700 bg-blue-50 border-blue-100' },
  'may': { label: 'May', description: 'Optional - at contractor discretion', color: 'text-gray-600 bg-gray-50 border-gray-100' },
}

const RISK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  'open': { label: 'Open', color: 'bg-red-100 text-red-700' },
  'mitigated': { label: 'Mitigated', color: 'bg-blue-100 text-blue-700' },
  'accepted': { label: 'Accepted', color: 'bg-yellow-100 text-yellow-700' },
  'closed': { label: 'Closed', color: 'bg-green-100 text-green-700' },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function getTotalHours(hoursByPeriod: PeriodHours): number {
  return Object.values(hoursByPeriod).reduce((sum, h) => sum + h, 0)
}

function getElementTotalHours(element: EnhancedWBSElement): number {
  return element.laborEstimates.reduce((sum, labor) => sum + getTotalHours(labor.hoursByPeriod), 0)
}

function getRiskScore(risk: WBSRisk): number {
  return risk.probability * risk.impact
}

function getRiskColor(score: number): string {
  if (score >= 12) return 'border-l-red-500'
  if (score >= 6) return 'border-l-yellow-500'
  return 'border-l-green-500'
}

function formatDateShort(dateString: string): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function calculateQualityScore(element: EnhancedWBSElement): { score: number; grade: 'blue' | 'green' | 'yellow' | 'red'; issues: string[] } {
  let score = 100
  const issues: string[] = []
  
  if (!element.sowReference) { score -= 15; issues.push('Add SOW/SOO reference for traceability') }
  if (!element.periodOfPerformance.startDate || !element.periodOfPerformance.endDate) { score -= 10; issues.push('Add start and end dates') }
  if (!element.why || element.why.length < 20) { score -= 10; issues.push('Expand "Why" to explain business purpose (20+ chars)') }
  if (!element.what || element.what.length < 20) { score -= 10; issues.push('Expand "What" to describe deliverables (20+ chars)') }
  
  if (element.estimateMethod === 'engineering') {
    const basis = element.engineeringBasis
    const hasGoodBasis = basis && ((basis.similarWork && basis.similarWork.length > 20) || (basis.expertSource && basis.assumptions && basis.assumptions.length > 20))
    if (hasGoodBasis) { score -= 5; issues.push('Engineering judgment documented - consider adding historical reference') }
    else { score -= 15; issues.push('Engineering judgment: Add similar work examples or expert source') }
  } else if (element.estimateMethod === 'level-of-effort') { 
    score -= 5; 
    issues.push('LOE: Justify the staffing level (e.g., coverage hours, historical demand)')
  }
  
  if (element.estimateMethod === 'historical' && !element.historicalReference?.chargeNumber) { score -= 20; issues.push('Historical method selected: Add charge code reference') }
  if (element.complexityFactor !== 1.0 && !element.complexityJustification) { score -= 10; issues.push('Complexity factor changed: Add justification') }
  
  if (element.laborEstimates.length === 0) { score -= 25; issues.push('Add labor estimates (roles and hours)') }
  else {
    const missingRationale = element.laborEstimates.filter(l => !l.rationale || l.rationale.length < 10)
    if (missingRationale.length > 0) { score -= 10; issues.push(`Add rationale for ${missingRationale.length} role(s)`) }
    const orphanedRoles = element.laborEstimates.filter(l => l.isOrphaned)
    if (orphanedRoles.length > 0) { score -= 10; issues.push(`${orphanedRoles.length} role(s) not in team - add to Roles & Pricing`) }
  }
  
  let grade: 'blue' | 'green' | 'yellow' | 'red'
  if (score >= 90 && element.estimateMethod === 'historical' && element.historicalReference?.chargeNumber) grade = 'blue'
  else if (score >= 75) grade = 'green'
  else if (score >= 50) grade = 'yellow'
  else grade = 'red'
  
  return { score: Math.max(0, score), grade, issues }
}

// Smart WBS number suggestion
function getNextWbsNumber(elements: EnhancedWBSElement[], parentPrefix?: string): string {
  if (!elements.length) return '1.1'
  
  if (parentPrefix) {
    // Looking for children of a specific parent (e.g., "1.3.x" under "1.3")
    const childNumbers = elements
      .map(el => el.wbsNumber)
      .filter(num => 
        num.startsWith(parentPrefix + '.') && 
        num.split('.').length === parentPrefix.split('.').length + 1
      )
      .map(num => {
        const parts = num.split('.')
        return parseInt(parts[parts.length - 1]) || 0
      })
    
    const nextChild = childNumbers.length > 0 ? Math.max(...childNumbers) + 1 : 1
    return `${parentPrefix}.${nextChild}`
  } else {
    // Find the highest top-level number and next sibling
    const topLevelNumbers = elements
      .map(el => el.wbsNumber)
      .filter(num => num.split('.').length === 2) // Only "X.Y" format
      .map(num => {
        const parts = num.split('.')
        return { major: parseInt(parts[0]) || 1, minor: parseInt(parts[1]) || 0 }
      })
    
    if (topLevelNumbers.length === 0) return '1.1'
    
    // Get the highest major number
    const maxMajor = Math.max(...topLevelNumbers.map(n => n.major))
    
    // Get the highest minor number for that major
    const minorsForMaxMajor = topLevelNumbers
      .filter(n => n.major === maxMajor)
      .map(n => n.minor)
    
    const nextMinor = Math.max(...minorsForMaxMajor) + 1
    return `${maxMajor}.${nextMinor}`
  }
}

// ============================================================================
// ROLE LIBRARY
// ============================================================================

const ROLE_LIBRARY: SelectedRole[] = [
  { id: 'role-dm', name: 'Delivery Manager', category: 'Management', baseRate: 185 },
  { id: 'role-pm', name: 'Product Manager', category: 'Management', baseRate: 170 },
  { id: 'role-tl', name: 'Technical Lead', category: 'Engineering', baseRate: 195 },
  { id: 'role-sa', name: 'Solutions Architect', category: 'Engineering', baseRate: 205 },
  { id: 'role-dl', name: 'Design Lead', category: 'Design', baseRate: 160 },
  { id: 'role-uxr', name: 'UX Researcher', category: 'Design', baseRate: 145 },
  { id: 'role-fe', name: 'Frontend Engineer', category: 'Engineering', baseRate: 155 },
  { id: 'role-be', name: 'Backend Engineer', category: 'Engineering', baseRate: 155 },
  { id: 'role-fse', name: 'Full Stack Engineer', category: 'Engineering', baseRate: 160 },
  { id: 'role-devops', name: 'DevOps Engineer', category: 'Engineering', baseRate: 165 },
  { id: 'role-qa', name: 'QA Engineer', category: 'Engineering', baseRate: 135 },
]

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_CHARGE_CODES: ChargeCode[] = [
  { id: 'cc-1', chargeNumber: 'TT-2024-0892', projectName: 'VA Transition Support', client: 'Department of Veterans Affairs', dateRange: 'Jan 2024 - Mar 2024', totalHours: 2400, description: 'Transition-in support for legacy system migration', roles: ['Delivery Manager', 'Technical Lead', 'DevOps Engineer'] },
  { id: 'cc-2', chargeNumber: 'DOS-2023-1547', projectName: 'Consular Scheduling MVP', client: 'Department of State', dateRange: 'Jun 2023 - Dec 2023', totalHours: 14500, description: 'Public-facing appointment scheduling system', roles: ['Product Manager', 'Frontend Engineer', 'Backend Engineer', 'QA Engineer'] },
]

// ============================================================================
// LABOR SUMMARY COMPONENT
// ============================================================================

function LaborSummary({ wbsElements, billableHoursPerYear, onNavigateToRoles }: { 
  wbsElements: EnhancedWBSElement[]
  billableHoursPerYear: number
  onNavigateToRoles: () => void 
}) {
  // Aggregate hours by role from all WBS elements
  const laborRollup = useMemo(() => {
    const roleMap = new Map<string, { roleName: string; totalHours: number; wbsCount: number; wbsElements: string[] }>()
    
    wbsElements.forEach(element => {
      element.laborEstimates.forEach(labor => {
        const totalHours = getTotalHours(labor.hoursByPeriod)
        const existing = roleMap.get(labor.roleName)
        if (existing) {
          existing.totalHours += totalHours
          existing.wbsCount++
          existing.wbsElements.push(element.wbsNumber)
        } else {
          roleMap.set(labor.roleName, { 
            roleName: labor.roleName, 
            totalHours, 
            wbsCount: 1,
            wbsElements: [element.wbsNumber]
          })
        }
      })
    })
    
    return Array.from(roleMap.values()).sort((a, b) => b.totalHours - a.totalHours)
  }, [wbsElements])
  
  const totals = useMemo(() => {
    const totalHours = laborRollup.reduce((sum, r) => sum + r.totalHours, 0)
    const totalFTE = billableHoursPerYear > 0 ? totalHours / billableHoursPerYear : 0
    return { totalHours, totalFTE }
  }, [laborRollup, billableHoursPerYear])
  
  const calculateFTE = (hours: number) => {
    if (billableHoursPerYear <= 0) return 0
    return hours / billableHoursPerYear
  }
  
  return (
    <div className="space-y-6" role="region" aria-label="Labor estimate summary">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-semibold text-gray-900">Labor Summary</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">Roll-up of all labor estimates from your WBS elements. Use this to see total hours and estimated FTE before assigning roles in Roles & Pricing.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-gray-600">Total hours and FTE from your WBS estimates</p>
        </div>
        <Button variant="outline" size="sm" onClick={onNavigateToRoles} aria-label="Go to Roles & Pricing tab">
          <ArrowRight className="w-4 h-4 mr-2" aria-hidden="true" />
          Continue to Roles & Pricing
        </Button>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-600 mb-1">Total Hours</div>
          <div className="text-2xl font-semibold text-gray-900">
            {totals.totalHours.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Across all WBS elements</div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-600 mb-1">Estimated FTE</div>
          <div className="text-2xl font-semibold text-gray-900">
            {totals.totalFTE.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Based on {billableHoursPerYear.toLocaleString()} hrs/year</div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-600 mb-1">Roles</div>
          <div className="text-2xl font-semibold text-gray-900">
            {laborRollup.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Unique roles in estimates</div>
        </div>
      </div>
      
      {/* Role Breakdown Table */}
      {laborRollup.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm" role="table" aria-label="Labor hours by role">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-gray-600">Role</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-medium text-gray-600">WBS Elements</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-gray-600">Total Hours</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-gray-600">~FTE</th>
              </tr>
            </thead>
            <tbody>
              {laborRollup.map((row, idx) => (
                <tr 
                  key={row.roleName} 
                  className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{row.roleName}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-gray-600 cursor-help">{row.wbsCount}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{row.wbsElements.join(', ')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {row.totalHours.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {calculateFTE(row.totalHours).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-600">{wbsElements.length} WBS</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{totals.totalHours.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{totals.totalFTE.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-700 mb-1">No labor estimates yet</p>
          <p className="text-xs text-gray-500 mb-4">Add labor estimates to your WBS elements to see the roll-up here.</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// VIEW MODE TOGGLE & CARD/LIST/TABLE VIEWS
// ============================================================================

function ViewModeToggle({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  return (
    <div className="flex gap-1 border border-gray-100 rounded-lg p-0.5 bg-white">
      {[{ mode: 'grid', icon: Grid3X3, label: 'Card view' }, { mode: 'table', icon: Table2, label: 'Table view' }].map(({ mode, icon: Icon, label }) => (
        <Tooltip key={mode}>
          <TooltipTrigger asChild>
            <Button variant={viewMode === mode ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode(mode as ViewMode)} className="px-2 h-8">
              <Icon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

function WBSCard({ element, onClick, onDelete }: { element: EnhancedWBSElement; onClick: () => void; onEdit: () => void; onDelete: () => void }) {
  const totalHours = getElementTotalHours(element)
  const gradeConfig = QUALITY_GRADE_CONFIG[element.qualityGrade]
  const methodConfig = ESTIMATE_METHOD_LABELS[element.estimateMethod]
  
  return (
    <div className="group bg-white border border-gray-100 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer" onClick={onClick}>
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">{element.wbsNumber}</span>
              <h3 className="text-sm font-medium text-gray-900 truncate">{element.title}</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {element.sowReference && <span>{element.sowReference}</span>}
              {element.sowReference && <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />}
              <span>{formatDateShort(element.periodOfPerformance.startDate)} – {formatDateShort(element.periodOfPerformance.endDate)}</span>
            </div>
          </div>
          <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClick(); }} className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Why/What Preview - NEW */}
      {(element.why || element.what) && (
        <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
          {element.why && (
            <p className="text-xs text-gray-600 line-clamp-1">
              <span className="font-medium text-gray-700">Why:</span> {element.why}
            </p>
          )}
          {element.what && (
            <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">
              <span className="font-medium text-gray-700">What:</span> {element.what}
            </p>
          )}
        </div>
      )}
      
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Badge className={`${gradeConfig.bgColor} ${gradeConfig.textColor} border ${gradeConfig.borderColor} text-[10px] px-1.5 py-0 h-5`}>{gradeConfig.label}</Badge>
          <span className="text-xs text-gray-500">{methodConfig.icon} {methodConfig.label}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-600">{element.laborEstimates.length} roles</span>
          <span className="text-sm font-semibold text-gray-900">{totalHours.toLocaleString()} hrs</span>
        </div>
        <div className="space-y-1.5">
          {element.laborEstimates.slice(0, 2).map((labor) => (
            <div key={labor.id} className="flex items-center justify-between text-xs">
              <span className={labor.isOrphaned ? 'text-red-600' : 'text-gray-600'}>{labor.roleName}</span>
              <span className="text-gray-900">{getTotalHours(labor.hoursByPeriod).toLocaleString()}</span>
            </div>
          ))}
          {element.laborEstimates.length > 2 && <span className="text-[10px] text-gray-400">+{element.laborEstimates.length - 2} more</span>}
        </div>
      </div>
      
      {(element.risks.length > 0 || element.dependencies.length > 0 || element.qualityIssues.length > 0) && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
          {element.risks.length > 0 && <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{element.risks.length}</span>}
          {element.dependencies.length > 0 && <span className="flex items-center gap-1"><Link2 className="w-3 h-3" />{element.dependencies.map(d => d.predecessorWbsNumber).join(', ')}</span>}
          {element.qualityIssues.length > 0 && <span className="flex items-center gap-1 text-yellow-600"><AlertTriangle className="w-3 h-3" />{element.qualityIssues.length} issues</span>}
        </div>
      )}
    </div>
  )
}

function WBSTableView({ elements, onElementClick, onDelete, contractPeriods }: { elements: EnhancedWBSElement[]; onElementClick: (id: string) => void; onEdit: (el: EnhancedWBSElement) => void; onDelete: (id: string) => void; contractPeriods: { key: PeriodKey; label: string }[] }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">WBS</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Title</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">SOW</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Quality</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Method</th>
            {contractPeriods.slice(0, 3).map(period => <th key={period.key} className="text-right px-4 py-3 text-xs font-medium text-gray-600">{period.label}</th>)}
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-600">Total</th>
            <th className="w-20"></th>
          </tr>
        </thead>
        <tbody>
          {elements.map((element, idx) => {
            const totalHours = getElementTotalHours(element)
            const gradeConfig = QUALITY_GRADE_CONFIG[element.qualityGrade]
            return (
              <tr key={element.id} className={`group border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`} onClick={() => onElementClick(element.id)}>
                <td className="px-4 py-3 font-semibold text-gray-900">{element.wbsNumber}</td>
                <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">{element.title}</td>
                <td className="px-4 py-3 text-gray-500">{element.sowReference || '—'}</td>
                <td className="px-4 py-3"><Badge className={`${gradeConfig.bgColor} ${gradeConfig.textColor} border ${gradeConfig.borderColor} text-[10px] px-1.5 py-0 h-5`}>{gradeConfig.label}</Badge></td>
                <td className="px-4 py-3 text-gray-600">{ESTIMATE_METHOD_LABELS[element.estimateMethod].label}</td>
                {contractPeriods.slice(0, 3).map(period => {
                  const periodTotal = element.laborEstimates.reduce((sum, l) => sum + l.hoursByPeriod[period.key], 0)
                  return <td key={period.key} className="px-4 py-3 text-right text-gray-900">{periodTotal > 0 ? periodTotal.toLocaleString() : '—'}</td>
                })}
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalHours.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onElementClick(element.id); }} className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></Button>                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(element.id); }} className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// HELP BANNER & OTHER HELPER COMPONENTS
// ============================================================================

function HelpBanner() {
  const [isExpanded, setIsExpanded] = useState(false)
  return (
    <div className="mb-6">
      <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
        <Info className="w-4 h-4" /><span>Understanding quality grades & estimate methods</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isExpanded && (
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Quality Grades</h4>
            <div className="space-y-2">
              {Object.entries(QUALITY_GRADE_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${config.bgColor} border ${config.borderColor}`} />
                  <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
                  <span className="text-xs text-gray-500">— {config.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Estimate Methods</h4>
            <div className="space-y-2">
              {Object.entries(ESTIMATE_METHOD_LABELS).map(([key, config]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-sm">{config.icon}</span>
                  <div><span className="text-sm font-medium text-gray-900">{config.label}</span><span className="text-xs text-gray-500 ml-2">— {config.description}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChargeCodeLibrary({ chargeCodes, onAdd, onEdit, onDelete }: { chargeCodes: ChargeCode[]; onAdd: (cc: ChargeCode) => void; onEdit: (cc: ChargeCode) => void; onDelete: (id: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const filteredCodes = chargeCodes.filter(cc => cc.chargeNumber.toLowerCase().includes(searchQuery.toLowerCase()) || cc.projectName.toLowerCase().includes(searchQuery.toLowerCase()))
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Charge Code Library</h2>
          <p className="text-xs text-gray-600 mt-1">Reference past projects to support historical estimates.</p>
        </div>
        <Button size="sm" onClick={() => onAdd({ id: `cc-${Date.now()}`, chargeNumber: '', projectName: '', client: '', dateRange: '', totalHours: 0, description: '', roles: [] })}><Plus className="w-4 h-4 mr-2" />Add Charge Code</Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search charge codes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCodes.map(cc => (
          <div key={cc.id} className="group bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1"><Hash className="w-4 h-4 text-blue-600" /><span className="font-mono text-sm font-semibold text-gray-900">{cc.chargeNumber}</span></div>
                <h3 className="text-sm font-medium text-gray-900">{cc.projectName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{cc.totalHours.toLocaleString()} hrs</Badge>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => onEdit(cc)} aria-label="Edit charge code"><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(cc.id)} aria-label="Delete charge code"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><Building2 className="w-3 h-3" /><span>{cc.client}</span><span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" /><Calendar className="w-3 h-3" /><span>{cc.dateRange}</span></div>
            <p className="text-xs text-gray-600 mb-2">{cc.description}</p>
            <div className="flex flex-wrap gap-1">{cc.roles.map(role => <Badge key={role} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{role}</Badge>)}</div>
          </div>
        ))}
      </div>
      {filteredCodes.length === 0 && (
        <div className="text-center py-12">
          <Hash className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-2">{chargeCodes.length === 0 ? 'No charge codes yet' : 'No charge codes match your search'}</p>
          <p className="text-xs text-gray-500 mb-4">Add charge codes to reference past projects in your estimates.</p>
          {chargeCodes.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => onAdd({ id: `cc-${Date.now()}`, chargeNumber: '', projectName: '', client: '', dateRange: '', totalHours: 0, description: '', roles: [] })}>
              <Plus className="w-4 h-4 mr-2" />Add First Charge Code
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function RequirementsSection({
  requirements,
  wbsElements,
  onAdd,
  onEdit,
  onDelete,
  onDeleteAll,
  onLinkWbs,
  onUnlinkWbs,
  selectedRequirements,
  onToggleSelection,
  onSelectAllUnmapped,
  onClearSelection,
  onBulkGenerate,
  isGenerating
}: {
  requirements: SOORequirement[];
  wbsElements: EnhancedWBSElement[];
  onAdd: (req: SOORequirement) => void;
  onEdit: (req: SOORequirement) => void;
  onDelete: (id: string) => void | Promise<void>;
  onDeleteAll: () => void | Promise<void>;
  onLinkWbs: (reqId: string, wbsId: string) => void;
  onUnlinkWbs: (reqId: string, wbsId: string) => void;
  selectedRequirements: Set<string>;
  onToggleSelection: (reqId: string) => void;
  onSelectAllUnmapped: () => void;
  onClearSelection: () => void;
  onBulkGenerate: () => void;
  isGenerating: boolean;
}) {
  const [viewMode, setViewMode] = useState<'list' | 'gaps'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const filteredRequirements = useMemo(() => {
    let filtered = requirements
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(req => 
        req.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
        req.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Sort: unmapped first, then mapped
    return [...filtered].sort((a, b) => {
      const aUnmapped = a.linkedWbsIds.length === 0 ? 0 : 1
      const bUnmapped = b.linkedWbsIds.length === 0 ? 0 : 1
      return aUnmapped - bUnmapped
    })
  }, [requirements, searchQuery])
  
  const stats = useMemo(() => {
    const total = requirements.length
    const mapped = requirements.filter(r => r.linkedWbsIds.length > 0).length
    const shallCount = requirements.filter(r => r.type === 'shall').length
    const shallMapped = requirements.filter(r => r.type === 'shall' && r.linkedWbsIds.length > 0).length
    return { 
      total, 
      mapped, 
      unmapped: total - mapped, 
      coverage: total > 0 ? Math.round((mapped / total) * 100) : 0, 
      shallCoverage: shallCount > 0 ? Math.round((shallMapped / shallCount) * 100) : 0 
    }
  }, [requirements])
  
  const unmappedRequirements = requirements.filter(r => r.linkedWbsIds.length === 0)
  const getLinkedWbsElements = (wbsIds: string[]) => wbsElements.filter(el => wbsIds.includes(el.id))
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Requirements & Traceability</h2>
          <p className="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
            <span>{stats.total} requirements</span>
            <span className="w-1 h-1 rounded-full bg-gray-400" aria-hidden="true" />
            <span>{stats.mapped} mapped</span>
            <span className="w-1 h-1 rounded-full bg-gray-400" aria-hidden="true" />
            <span>{stats.shallCoverage}% &quot;shall&quot; covered</span>
            {stats.unmapped > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-red-400" aria-hidden="true" />
                <span className="text-red-600">{stats.unmapped} gaps</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <List className="w-4 h-4 inline mr-1.5" />List
            </button>
            <button
              onClick={() => setViewMode('gaps')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors relative ${viewMode === 'gaps' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-1.5" />Gaps
              {stats.unmapped > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] bg-red-500 text-white rounded-full flex items-center justify-center">
                  {stats.unmapped}
                </span>
              )}
            </button>
          </div>

          {/* Add button */}
          <Button
            size="sm"
            onClick={() => onAdd({
              id: `req-${Date.now()}`,
              referenceNumber: '',
              title: '',
              description: '',
              type: 'shall',
              category: 'functional',
              priority: 'medium',
              source: '',
              linkedWbsIds: [],
              notes: '',
              isAIExtracted: false
            })}
          >
            <Plus className="w-4 h-4 mr-1" />Add
          </Button>
        </div>
      </div>

      {/* Quick Actions - Select All Unmapped */}
      {stats.unmapped > 0 && selectedRequirements.size === 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{stats.unmapped} unmapped requirement{stats.unmapped !== 1 ? 's' : ''}</span>
          <span>·</span>
          <button
            onClick={onSelectAllUnmapped}
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Select all unmapped
          </button>
        </div>
      )}
      
      {/* List View */}
      {viewMode === 'list' && (
        <>
          {requirements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No requirements yet</h3>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                Upload an RFP to extract requirements automatically, or add them manually.
              </p>
              <Button
                size="sm"
                onClick={() => onAdd({
                  id: `req-${Date.now()}`,
                  referenceNumber: '',
                  title: '',
                  description: '',
                  type: 'shall',
                  category: 'functional',
                  priority: 'medium',
                  source: '',
                  linkedWbsIds: [],
                  notes: '',
                  isAIExtracted: false
                })}
              >
                <Plus className="w-4 h-4 mr-1" />Add Requirement
              </Button>
            </div>
          ) : (
            <>
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <div className="space-y-4">
                {filteredRequirements.map((req, idx) => {
              const typeConfig = REQUIREMENT_TYPE_CONFIG[req.type]
              const linkedWbs = getLinkedWbsElements(req.linkedWbsIds)
              const isMapped = linkedWbs.length > 0
              const displayNumber = req.referenceNumber.startsWith('p.') || req.referenceNumber.startsWith('SOO')
                ? req.referenceNumber
                : `REQ-${String(idx + 1).padStart(3, '0')}`

              return (
                <div
                  key={req.id}
                  className={`group bg-white shadow-sm rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${isMapped ? 'border-l-4 border-l-emerald-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleSelection(req.id) }}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedRequirements.has(req.id)
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {selectedRequirements.has(req.id) && <Check className="w-3 h-3" />}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-[10px] px-1.5 py-0 h-5 border ${typeConfig.color}`}>{typeConfig.label}</Badge>
                            <span className="font-mono text-xs text-gray-500">{displayNumber}</span>
                            <span className="text-sm font-medium text-gray-900 truncate">{req.title || 'Untitled'}</span>
                          </div>
                          {req.description && (
                            <p className="text-xs text-gray-600 line-clamp-2 mb-1.5">{req.description}</p>
                          )}
                          {req.source && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{req.source}</span>
                          )}
                          <div className="flex items-center gap-1 flex-wrap mt-1.5">
                            {linkedWbs.map(wbs => (
                              <Badge 
                                key={wbs.id} 
                                variant="secondary" 
                                className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-red-100" 
                                onClick={() => onUnlinkWbs(req.id, wbs.id)}
                              >
                                {wbs.wbsNumber} ×
                              </Badge>
                            ))}
                            <Select onValueChange={(wbsId) => onLinkWbs(req.id, wbsId)}>
                              <SelectTrigger className="h-5 w-auto px-2 text-[10px] text-emerald-600 border-none bg-transparent hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span>+ Link WBS</span>
                              </SelectTrigger>
                              <SelectContent position="popper" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto">
                                {wbsElements.filter(wbs => !req.linkedWbsIds.includes(wbs.id)).map(wbs => (
                                  <SelectItem key={wbs.id} value={wbs.id} className="text-xs">
                                    {wbs.wbsNumber} - {wbs.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50" 
                            onClick={() => onEdit(req)} 
                            aria-label="Edit requirement"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50" 
                            onClick={() => onDelete(req.id)} 
                            aria-label="Delete requirement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
              </div>
            </>
          )}
        </>
      )}

      {/* Gaps View */}
      {viewMode === 'gaps' && (
        <div className="space-y-4">
          {unmappedRequirements.length === 0 ? (
            <div className="text-center py-12 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-green-800">All Requirements Mapped!</p>
            </div>
          ) : (
            <>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">{unmappedRequirements.length} Unmapped Requirement{unmappedRequirements.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="space-y-2">
                {unmappedRequirements.map(req => {
                  const typeConfig = REQUIREMENT_TYPE_CONFIG[req.type]
                  return (
                    <div key={req.id} className="group bg-white border border-l-4 border-l-red-400 border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-[10px] px-1.5 py-0 h-5 border ${typeConfig.color}`}>{typeConfig.label}</Badge>
                            <span className="font-mono text-sm font-medium text-gray-900">{req.referenceNumber}</span>
                          </div>
                          <p className="text-sm text-gray-700">{req.title}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select onValueChange={(wbsId) => onLinkWbs(req.id, wbsId)}>
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                              <SelectValue placeholder="Link to WBS..." />
                            </SelectTrigger>
                            <SelectContent>
                              {wbsElements.map(wbs => (
                                <SelectItem key={wbs.id} value={wbs.id}>{wbs.wbsNumber} - {wbs.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50" 
                              onClick={() => onEdit(req)} 
                              aria-label="Edit requirement"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                          </div>
            </>
          )}
        </div>
      )}

      {/* Floating Selection Bar */}
      {selectedRequirements.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex flex-col items-center gap-2">
            {/* Large batch warning */}
            {selectedRequirements.size > 15 && (
              <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                Large batch selected. Consider generating in smaller groups for better results.
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-xs font-semibold text-emerald-700">{selectedRequirements.size}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">selected</span>
              </div>
              <div className="w-px h-5 bg-gray-200" />
              <button
                onClick={onClearSelection}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear
              </button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
              <Button
                size="sm"
                onClick={onBulkGenerate}
                disabled={isGenerating}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-1.5" />
                )}
                Generate WBS
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Permanently delete all {requirements.length} requirements?
            </DialogTitle>
            <DialogDescription>
              You&apos;ll need to upload your RFP again to start over.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteAll()
                setShowDeleteConfirm(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// WBS SLIDEOUT PANEL WITH RISKS & DEPENDENCIES
// 


interface WBSSlideoutProps {
  element: EnhancedWBSElement
  isOpen: boolean
  onClose: () => void
  onUpdate: (id: string, updates: Partial<EnhancedWBSElement>) => void
  contractPeriods: { key: PeriodKey; label: string }[]
  selectedRoles: SelectedRole[]
  allWbsElements: EnhancedWBSElement[]
  chargeCodes: ChargeCode[]
  onOpenLaborDialog: (labor?: EnhancedLaborEstimate) => void
  onDeleteLabor: (laborId: string) => void
}

function WBSSlideout({ element, isOpen, onClose, onUpdate, contractPeriods, allWbsElements, chargeCodes, onOpenLaborDialog, onDeleteLabor }: Omit<WBSSlideoutProps, 'onOpenEditElement'>) {
  const [activeTab, setActiveTab] = useState('details')
  const [showRiskDialog, setShowRiskDialog] = useState(false)
  const [editingRisk, setEditingRisk] = useState<WBSRisk | null>(null)
  const [riskForm, setRiskForm] = useState<Partial<WBSRisk>>({ description: '', probability: 3, impact: 3, mitigation: '', status: 'open' })
  const [showDepDialog, setShowDepDialog] = useState(false)
  const [depForm, setDepForm] = useState<Partial<WBSDependency>>({ predecessorWbsId: '', type: 'FS', lagDays: 0 })
  
  // Editable fields state
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleBuffer, setTitleBuffer] = useState('')
  
  // State for editing estimation basis
  const [showHistoricalDialog, setShowHistoricalDialog] = useState(false)
  const [historicalForm, setHistoricalForm] = useState<Partial<HistoricalReference>>({
    chargeCodeId: '', chargeNumber: '', projectName: '', dateRange: '', actualHours: 0, notes: ''
  })
  const [showEngineeringDialog, setShowEngineeringDialog] = useState(false)
  const [engineeringForm, setEngineeringForm] = useState({
    similarWork: '', expertSource: '', assumptions: '', confidenceNotes: ''
  })
  
  if (!isOpen) return null
  
  const gradeConfig = QUALITY_GRADE_CONFIG[element.qualityGrade]
  const totalHours = getElementTotalHours(element)
  const methodConfig = ESTIMATE_METHOD_LABELS[element.estimateMethod]
  
  // Inline edit handlers
  const handleStartEditTitle = () => {
    setTitleBuffer(element.title)
    setEditingTitle(true)
  }
  
  const handleSaveTitle = () => {
    if (titleBuffer.trim()) {
      onUpdate(element.id, { title: titleBuffer.trim() })
    }
    setEditingTitle(false)
  }
  
  const handleFieldChange = (field: keyof EnhancedWBSElement, value: string | number) => {
    onUpdate(element.id, { [field]: value })
  }
  
  const handlePeriodChange = (field: 'startDate' | 'endDate', value: string) => {
    onUpdate(element.id, { 
      periodOfPerformance: { 
        ...element.periodOfPerformance, 
        [field]: value 
      } 
    })
  }
  
  const handleOpenRiskDialog = (risk?: WBSRisk) => {
    if (risk) { setEditingRisk(risk); setRiskForm({ description: risk.description, probability: risk.probability, impact: risk.impact, mitigation: risk.mitigation, status: risk.status }) }
    else { setEditingRisk(null); setRiskForm({ description: '', probability: 3, impact: 3, mitigation: '', status: 'open' }) }
    setShowRiskDialog(true)
  }
  
  const handleSaveRisk = () => {
    if (!riskForm.description) return
    if (editingRisk) { onUpdate(element.id, { risks: element.risks.map(r => r.id !== editingRisk.id ? r : { ...r, ...riskForm }) }) }
    else { onUpdate(element.id, { risks: [...element.risks, { id: generateId(), description: riskForm.description || '', probability: (riskForm.probability || 3) as 1|2|3|4|5, impact: (riskForm.impact || 3) as 1|2|3|4|5, mitigation: riskForm.mitigation || '', status: (riskForm.status || 'open') as 'open'|'mitigated'|'accepted'|'closed' }] }) }
    setShowRiskDialog(false)
  }
  
  const handleSaveDependency = () => {
    if (!depForm.predecessorWbsId) return
    const predecessor = allWbsElements.find(el => el.id === depForm.predecessorWbsId)
    if (!predecessor) return
    onUpdate(element.id, { dependencies: [...element.dependencies, { id: generateId(), predecessorWbsId: depForm.predecessorWbsId, predecessorWbsNumber: predecessor.wbsNumber, type: (depForm.type || 'FS') as 'FS'|'SS'|'FF'|'SF', lagDays: depForm.lagDays || 0 }] })
    setShowDepDialog(false); setDepForm({ predecessorWbsId: '', type: 'FS', lagDays: 0 })
  }
  
  // Historical Reference handlers
  const handleOpenHistoricalDialog = () => {
    if (element.historicalReference) {
      setHistoricalForm({ ...element.historicalReference })
    } else {
      setHistoricalForm({ chargeCodeId: '', chargeNumber: '', projectName: '', dateRange: '', actualHours: 0, notes: '' })
    }
    setShowHistoricalDialog(true)
  }
  
  const handleSelectChargeCode = (chargeCodeId: string) => {
    const cc = chargeCodes.find(c => c.id === chargeCodeId)
    if (cc) {
      setHistoricalForm({
        chargeCodeId: cc.id,
        chargeNumber: cc.chargeNumber,
        projectName: cc.projectName,
        dateRange: cc.dateRange,
        actualHours: cc.totalHours,
        notes: historicalForm.notes || ''
      })
    }
  }
  
  const handleSaveHistoricalReference = () => {
    if (!historicalForm.chargeNumber) return
    onUpdate(element.id, { 
      historicalReference: {
        chargeCodeId: historicalForm.chargeCodeId || '',
        chargeNumber: historicalForm.chargeNumber || '',
        projectName: historicalForm.projectName || '',
        dateRange: historicalForm.dateRange || '',
        actualHours: historicalForm.actualHours || 0,
        notes: historicalForm.notes || ''
      }
    })
    setShowHistoricalDialog(false)
  }
  
  const handleClearHistoricalReference = () => {
    onUpdate(element.id, { historicalReference: undefined })
    setShowHistoricalDialog(false)
  }
  
  // Engineering Basis handlers
  const handleOpenEngineeringDialog = () => {
    if (element.engineeringBasis) {
      setEngineeringForm({ ...element.engineeringBasis })
    } else {
      setEngineeringForm({ similarWork: '', expertSource: '', assumptions: '', confidenceNotes: '' })
    }
    setShowEngineeringDialog(true)
  }
  
  const handleSaveEngineeringBasis = () => {
    onUpdate(element.id, { 
      engineeringBasis: {
        similarWork: engineeringForm.similarWork,
        expertSource: engineeringForm.expertSource,
        assumptions: engineeringForm.assumptions,
        confidenceNotes: engineeringForm.confidenceNotes
      }
    })
    setShowEngineeringDialog(false)
  }
  
  const handleClearEngineeringBasis = () => {
    onUpdate(element.id, { engineeringBasis: undefined })
    setShowEngineeringDialog(false)
  }
  
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-semibold text-gray-900">{element.wbsNumber}</span>
                {editingTitle ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={titleBuffer}
                      onChange={(e) => setTitleBuffer(e.target.value)}
                      className="h-8 text-lg font-semibold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle()
                        if (e.key === 'Escape') setEditingTitle(false)
                      }}
                    />
                    <Button size="sm" variant="ghost" onClick={handleSaveTitle} className="h-7 w-7 p-0">
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)} className="h-7 w-7 p-0">
                      <X className="w-4 h-4 text-gray-400" />
                    </Button>
                  </div>
                ) : (
                  <h3 
                    id="slideout-title" 
                    className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 truncate"
                    onClick={handleStartEditTitle}
                    title="Click to edit"
                  >
                    {element.title}
                  </h3>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${gradeConfig.bgColor} ${gradeConfig.textColor} border ${gradeConfig.borderColor} text-[10px] px-1.5 py-0 h-5`}>
                  {gradeConfig.label} ({element.qualityScore}%)
                </Badge>
                {element.sowReference && <>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                  <span className="text-sm text-gray-600">{element.sowReference}</span>
                </>}
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-auto" aria-hidden="true" />
                <span className="text-sm font-semibold text-gray-900">{totalHours.toLocaleString()} hrs</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-2xl leading-none h-8 w-8 p-0 ml-4" aria-label="Close panel">
              ×
            </Button>
          </div>
        </div>
        
        {/* Quality Issues Banner */}
        {element.qualityIssues.length > 0 && (
          <div className="flex-shrink-0 px-6 py-2 bg-yellow-50 border-b border-yellow-200" role="alert">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span className="font-medium">{element.qualityIssues.length} issue{element.qualityIssues.length !== 1 ? 's' : ''} to address:</span>
              <span>{element.qualityIssues.join(' • ')}</span>
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
              <TabsTrigger value="labor" className="text-xs">
                Labor
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{element.laborEstimates.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="risks" className="text-xs">
                Risks
                {element.risks.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{element.risks.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="dependencies" className="text-xs">
                Dependencies
                {element.dependencies.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{element.dependencies.length}</Badge>}
              </TabsTrigger>
            </TabsList>
            
            {/* DETAILS TAB - Now Editable */}
            <TabsContent value="details" className="space-y-6">
              {/* Reference Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">SOW Reference</Label>
                  <Input 
                    value={element.sowReference || ''} 
                    onChange={(e) => handleFieldChange('sowReference', e.target.value)}
                    placeholder="e.g., SOW 3.2.1"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">CLIN</Label>
                  <Input 
                    value={element.clin || ''} 
                    onChange={(e) => handleFieldChange('clin', e.target.value)}
                    placeholder="e.g., 0001"
                    className="h-9"
                  />
                </div>
              </div>
              
              {/* Period of Performance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Start Date</Label>
                  <Input 
                    type="date"
                    value={element.periodOfPerformance.startDate || ''} 
                    onChange={(e) => handlePeriodChange('startDate', e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">End Date</Label>
                  <Input 
                    type="date"
                    value={element.periodOfPerformance.endDate || ''} 
                    onChange={(e) => handlePeriodChange('endDate', e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              
              {/* Why - Critical BD-to-Delivery field */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-700">Why (Purpose)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">Explain the business purpose. This helps delivery teams understand the intent behind the work.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea 
                  value={element.why || ''} 
                  onChange={(e) => handleFieldChange('why', e.target.value)}
                  placeholder="Why is this work needed? What problem does it solve?"
                  rows={2}
                  className="resize-none"
                />
              </div>
              
              {/* What - Critical BD-to-Delivery field */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-700">What (Deliverables)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">Describe the specific deliverables. Be concrete about what will be produced.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea 
                  value={element.what || ''} 
                  onChange={(e) => handleFieldChange('what', e.target.value)}
                  placeholder="What specific work products or outcomes will be delivered?"
                  rows={2}
                  className="resize-none"
                />
              </div>
              
              {/* Not Included - Critical BD-to-Delivery field */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-700">Not Included</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">Explicitly state what&apos;s out of scope. This prevents scope creep and sets clear boundaries.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea 
                  value={element.notIncluded || ''} 
                  onChange={(e) => handleFieldChange('notIncluded', e.target.value)}
                  placeholder="What is explicitly NOT part of this work?"
                  rows={2}
                  className="resize-none"
                />
              </div>
              
              {/* Assumptions */}
              {element.assumptions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Assumptions</h4>
                  <ul className="space-y-1">
                    {element.assumptions.map((a, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-gray-400" aria-hidden="true">•</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Estimate Method Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-xs text-gray-500">Estimate Method</Label>
                      <Select value={element.estimateMethod} onValueChange={(v) => handleFieldChange('estimateMethod', v)}>
                        <SelectTrigger className="w-[200px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTIMATE_METHOD_LABELS).map(([key, { label, icon }]) => (
                            <SelectItem key={key} value={key}>{icon} {label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {element.complexityFactor !== 1.0 && (
                      <Badge variant="outline" className="text-[10px]">{element.complexityFactor}x complexity</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600">{methodConfig.description}</p>
                
                {/* Complexity Factor */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Complexity Factor</Label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      min="0.5" 
                      max="3.0" 
                      value={element.complexityFactor} 
                      onChange={(e) => handleFieldChange('complexityFactor', parseFloat(e.target.value) || 1.0)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Justification</Label>
                    <Input 
                      value={element.complexityJustification || ''} 
                      onChange={(e) => handleFieldChange('complexityJustification', e.target.value)}
                      placeholder="Why factor differs from 1.0..."
                      className="h-9"
                    />
                  </div>
                </div>
                
                {/* Historical Reference - Editable */}
                {element.estimateMethod === 'historical' && (
                  <div className="mt-3">
                    {element.historicalReference ? (
                      <div className="group p-3 bg-blue-50 border border-blue-200 rounded-lg relative">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleOpenHistoricalDialog}
                          className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:bg-blue-100"
                          aria-label="Edit historical reference"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <div className="flex items-center gap-2 mb-2">
                          <Hash className="w-4 h-4 text-blue-600" aria-hidden="true" />
                          <span className="font-mono text-sm font-semibold text-blue-900">{element.historicalReference.chargeNumber}</span>
                        </div>
                        <div className="text-sm text-blue-800 mb-1">{element.historicalReference.projectName}</div>
                        <div className="flex items-center gap-2 text-xs text-blue-600">
                        <span>{element.historicalReference.dateRange}</span>
                        <span className="w-1 h-1 rounded-full bg-blue-400" aria-hidden="true" />
                       <span>{element.historicalReference.actualHours.toLocaleString()} actual hours</span>
                      </div>
                        {element.historicalReference.notes && (
                          <p className="text-xs text-blue-700 mt-2 italic">{element.historicalReference.notes}</p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleOpenHistoricalDialog}
                        className="w-full p-3 border-2 border-dashed border-blue-300 rounded-lg text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        <Hash className="w-5 h-5 text-blue-400 mx-auto mb-1" aria-hidden="true" />
                        <p className="text-sm font-medium text-blue-600">Add historical reference</p>
                        <p className="text-xs text-blue-500">Link to a past project charge code</p>
                      </button>
                    )}
                  </div>
                )}
                
                {/* Engineering/Parametric Basis - Editable */}
                {(element.estimateMethod === 'engineering' || element.estimateMethod === 'parametric') && (
                  <div className="mt-3">
                    {element.engineeringBasis && (element.engineeringBasis.similarWork || element.engineeringBasis.expertSource || element.engineeringBasis.assumptions) ? (
                      <div className="group p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2 relative">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleOpenEngineeringDialog}
                          className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-purple-600 hover:bg-purple-100"
                          aria-label="Edit estimation basis"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <h5 className="text-xs font-medium text-purple-800 uppercase tracking-wide">Estimation Basis</h5>
                        {element.engineeringBasis.similarWork && (
                          <div>
                            <span className="text-xs font-medium text-purple-700">Similar Work: </span>
                            <span className="text-xs text-purple-900">{element.engineeringBasis.similarWork}</span>
                          </div>
                        )}
                        {element.engineeringBasis.expertSource && (
                          <div>
                            <span className="text-xs font-medium text-purple-700">Expert Source: </span>
                            <span className="text-xs text-purple-900">{element.engineeringBasis.expertSource}</span>
                          </div>
                        )}
                        {element.engineeringBasis.assumptions && (
                          <div>
                            <span className="text-xs font-medium text-purple-700">Assumptions: </span>
                            <span className="text-xs text-purple-900">{element.engineeringBasis.assumptions}</span>
                          </div>
                        )}
                        {element.engineeringBasis.confidenceNotes && (
                          <div>
                            <span className="text-xs font-medium text-purple-700">Confidence: </span>
                            <span className="text-xs text-purple-900">{element.engineeringBasis.confidenceNotes}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={handleOpenEngineeringDialog}
                        className="w-full p-3 border-2 border-dashed border-purple-300 rounded-lg text-center hover:border-purple-400 hover:bg-purple-50 transition-colors"
                      >
                        <Lightbulb className="w-5 h-5 text-purple-400 mx-auto mb-1" aria-hidden="true" />
                        <p className="text-sm font-medium text-purple-600">Add estimation basis</p>
                        <p className="text-xs text-purple-500">Document similar work, expert sources, and assumptions</p>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* LABOR TAB */}
            <TabsContent value="labor" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-gray-900">Labor Estimates</h4>
                <Button size="sm" variant="outline" onClick={() => onOpenLaborDialog()}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                  Add Role
                </Button>
              </div>
              {element.laborEstimates.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-700 mb-1">No labor estimates yet</p>
                  <p className="text-xs text-gray-500 mb-3">Add roles and hours to build your estimate</p>
                  <Button size="sm" variant="outline" onClick={() => onOpenLaborDialog()}>
                    <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                    Add First Role
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {element.laborEstimates.map(labor => (
                    <div key={labor.id} className={`group border rounded-lg p-4 ${labor.isOrphaned ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'} transition-colors`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={labor.roleName || ''}
                            onChange={(e) => {
                              const updatedEstimates = element.laborEstimates.map(le =>
                                le.id === labor.id ? { ...le, roleName: e.target.value } : le
                              )
                              onUpdate(element.id, { laborEstimates: updatedEstimates })
                            }}
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: labor.isOrphaned ? '#FEF2F2' : '#F4F3EF',
                              color: labor.isOrphaned ? '#B91C1C' : '#5F5E5A',
                              border: '0.5px solid #E8E7E2',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">Select role...</option>
                            <option value="Back-end Developer">Back-end Developer</option>
                            <option value="Front-end Developer">Front-end Developer</option>
                            <option value="DevOps Engineer">DevOps Engineer</option>
                            <option value="QA Engineer">QA Engineer</option>
                            <option value="Product Manager">Product Manager</option>
                            <option value="Product Designer">Product Designer</option>
                            <option value="UX Researcher">UX Researcher</option>
                            <option value="Content/UX Writer">Content/UX Writer</option>
                            <option value="Delivery Manager">Delivery Manager</option>
                            <option value="Technical Lead">Technical Lead</option>
                            <option value="Design Lead">Design Lead</option>
                          </select>
                          {labor.isOrphaned && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Not in team</Badge>}
                          <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_CONFIG[labor.confidence].color}`}>{CONFIDENCE_CONFIG[labor.confidence].label}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{getTotalHours(labor.hoursByPeriod).toLocaleString()} hrs</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onOpenLaborDialog(labor)} aria-label={`Edit ${labor.roleName}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50" onClick={() => onDeleteLabor(labor.id)} aria-label={`Delete ${labor.roleName}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-2 mb-2 text-xs">
                        {contractPeriods.map(period => (
                          <div key={period.key} className="text-center">
                            <div className="text-gray-500">{period.label}</div>
                            <div className="font-semibold text-gray-900">{labor.hoursByPeriod[period.key].toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                      {labor.rationale && (
                        <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                          <span className="font-semibold text-gray-700">Rationale:</span> {labor.rationale}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            {/* RISKS TAB */}
            <TabsContent value="risks" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-gray-900">Risk Register</h4>
                <Button size="sm" variant="outline" onClick={() => handleOpenRiskDialog()}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                  Add Risk
                </Button>
              </div>
              {element.risks.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                  <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-700 mb-1">No risks identified</p>
                  <p className="text-xs text-gray-500 mb-3">Document risks that could affect this work</p>
                  <Button size="sm" variant="outline" onClick={() => handleOpenRiskDialog()}>
                    <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                    Add First Risk
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {element.risks.map(risk => {
                    const riskScore = getRiskScore(risk)
                    const statusConfig = RISK_STATUS_CONFIG[risk.status]
                    return (
                      <div key={risk.id} className={`group border-l-4 ${getRiskColor(riskScore)} border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] ${statusConfig.color}`}>{statusConfig.label}</Badge>
                            <span className="text-xs text-gray-500">Likelihood: {risk.probability} × Impact: {risk.impact} = {riskScore}</span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenRiskDialog(risk)} aria-label="Edit risk">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50" onClick={() => onUpdate(element.id, { risks: element.risks.filter(r => r.id !== risk.id) })} aria-label="Delete risk">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-900 mb-2">{risk.description}</p>
                        {risk.mitigation && (
                          <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                            <span className="font-semibold text-gray-700">Mitigation:</span> {risk.mitigation}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
            
            {/* DEPENDENCIES TAB */}
            <TabsContent value="dependencies" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-gray-900">Dependencies</h4>
                <Button size="sm" variant="outline" onClick={() => setShowDepDialog(true)}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                  Add Dependency
                </Button>
              </div>
              {element.dependencies.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                  <GitMerge className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-700 mb-1">No dependencies defined</p>
                  <p className="text-xs text-gray-500 mb-3">Link work that must happen before or alongside this element</p>
                  <Button size="sm" variant="outline" onClick={() => setShowDepDialog(true)}>
                    <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                    Add First Dependency
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {element.dependencies.map(dep => {
                    const typeConfig = DEPENDENCY_TYPE_LABELS[dep.type]
                    const predecessor = allWbsElements.find(el => el.id === dep.predecessorWbsId)
                    return (
                      <div key={dep.id} className="group flex items-center gap-4 border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">{dep.predecessorWbsNumber}</Badge>
                          <ArrowRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
                          <Badge variant="secondary" className="text-xs font-mono">{element.wbsNumber}</Badge>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-900">{predecessor?.title || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{typeConfig.label}{dep.lagDays > 0 && ` + ${dep.lagDays} days`}</div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={() => onUpdate(element.id, { dependencies: element.dependencies.filter(d => d.id !== dep.id) })}
                          aria-label="Remove dependency"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Decompose into tasks */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <DecomposeButton
              epic={{
                id: element.id,
                title: element.title,
                description: element.why || element.what || '',
                pwsReferences: element.sowReference ? [element.sowReference] : [],
              }}
              onApplyTasks={(tasks) => {
                // Add decomposed tasks as labor estimates on this WBS element
                const newLabor = tasks.map(t => ({
                  id: `labor-${crypto.randomUUID()}`,
                  roleId: t.roleId || '',
                  roleName: t.roleName,
                  hoursByPeriod: { base: t.hours, option1: 0, option2: 0, option3: 0, option4: 0 },
                  rationale: `${t.name}: ${t.rationale}`,
                  confidence: (t.confidence || 'medium') as 'high' | 'medium' | 'low',
                  isAISuggested: true,
                  isOrphaned: false,
                }))
                onUpdate(element.id, {
                  laborEstimates: [...element.laborEstimates, ...newLabor],
                })
              }}
            />
          </div>
        </div>
      </div>

      {/* Risk Dialog */}
      <Dialog open={showRiskDialog} onOpenChange={setShowRiskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRisk ? 'Edit' : 'Add'} Risk</DialogTitle>
            <DialogDescription>Document a risk that could affect this work element.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="risk-description">Description <span className="text-red-500">*</span></Label>
              <Textarea 
                id="risk-description"
                value={riskForm.description || ''} 
                onChange={(e) => setRiskForm(prev => ({ ...prev, description: e.target.value }))} 
                rows={2} 
                placeholder="What could go wrong?" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="risk-probability">Likelihood (1-5)</Label>
                <Select value={String(riskForm.probability || 3)} onValueChange={(v) => setRiskForm(prev => ({ ...prev, probability: parseInt(v) as 1|2|3|4|5 }))}>
                  <SelectTrigger id="risk-probability"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} - {PROBABILITY_LABELS[n]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-impact">Impact (1-5)</Label>
                <Select value={String(riskForm.impact || 3)} onValueChange={(v) => setRiskForm(prev => ({ ...prev, impact: parseInt(v) as 1|2|3|4|5 }))}>
                  <SelectTrigger id="risk-impact"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} - {IMPACT_LABELS[n]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-status">Status</Label>
              <Select value={riskForm.status || 'open'} onValueChange={(v) => setRiskForm(prev => ({ ...prev, status: v as 'open'|'mitigated'|'accepted'|'closed' }))}>
                <SelectTrigger id="risk-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="mitigated">Mitigated</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-mitigation">Mitigation Strategy</Label>
              <Textarea 
                id="risk-mitigation"
                value={riskForm.mitigation || ''} 
                onChange={(e) => setRiskForm(prev => ({ ...prev, mitigation: e.target.value }))} 
                rows={2} 
                placeholder="How will you reduce this risk?" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRiskDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveRisk} disabled={!riskForm.description}>{editingRisk ? 'Save Changes' : 'Add Risk'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dependency Dialog */}
      <Dialog open={showDepDialog} onOpenChange={setShowDepDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Dependency</DialogTitle>
            <DialogDescription>Link another WBS element that must complete before this one starts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dep-predecessor">Predecessor WBS <span className="text-red-500">*</span></Label>
              <Select value={depForm.predecessorWbsId || ''} onValueChange={(v) => setDepForm(prev => ({ ...prev, predecessorWbsId: v }))}>
                <SelectTrigger id="dep-predecessor"><SelectValue placeholder="Select predecessor..." /></SelectTrigger>
                <SelectContent>
                  {allWbsElements.filter(el => el.id !== element.id).filter(el => !element.dependencies.some(d => d.predecessorWbsId === el.id)).map(el => (
                    <SelectItem key={el.id} value={el.id}>{el.wbsNumber} - {el.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dep-type">Dependency Type</Label>
                <Select value={depForm.type || 'FS'} onValueChange={(v) => setDepForm(prev => ({ ...prev, type: v as 'FS'|'SS'|'FF'|'SF' }))}>
                  <SelectTrigger id="dep-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEPENDENCY_TYPE_LABELS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{key} - {config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dep-lag">Lag Days</Label>
                <Input 
                  id="dep-lag"
                  type="number" 
                  min="0" 
                  value={depForm.lagDays || 0} 
                  onChange={(e) => setDepForm(prev => ({ ...prev, lagDays: parseInt(e.target.value) || 0 }))} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveDependency} disabled={!depForm.predecessorWbsId}>Add Dependency</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Historical Reference Dialog */}
      <Dialog open={showHistoricalDialog} onOpenChange={setShowHistoricalDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{element.historicalReference ? 'Edit' : 'Add'} Historical Reference</DialogTitle>
            <DialogDescription>Link a past project to support your estimate. This strengthens audit defensibility.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {chargeCodes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="historical-select">Select from Charge Code Library</Label>
                <Select value={historicalForm.chargeCodeId || ''} onValueChange={handleSelectChargeCode}>
                  <SelectTrigger id="historical-select"><SelectValue placeholder="Choose a past project..." /></SelectTrigger>
                  <SelectContent>
                    {chargeCodes.map(cc => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.chargeNumber} - {cc.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="text-xs text-gray-500 text-center">— or enter manually —</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="historical-charge">Charge Number <span className="text-red-500">*</span></Label>
                <Input 
                  id="historical-charge"
                  value={historicalForm.chargeNumber || ''} 
                  onChange={(e) => setHistoricalForm(prev => ({ ...prev, chargeNumber: e.target.value }))} 
                  placeholder="e.g., TT-2024-0892"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="historical-hours">Actual Hours</Label>
                <Input 
                  id="historical-hours"
                  type="number" 
                  min="0"
                  value={historicalForm.actualHours || ''} 
                  onChange={(e) => setHistoricalForm(prev => ({ ...prev, actualHours: parseInt(e.target.value) || 0 }))} 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="historical-project">Project Name</Label>
              <Input 
                id="historical-project"
                value={historicalForm.projectName || ''} 
                onChange={(e) => setHistoricalForm(prev => ({ ...prev, projectName: e.target.value }))} 
                placeholder="e.g., VA Transition Support"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="historical-dates">Date Range</Label>
              <Input 
                id="historical-dates"
                value={historicalForm.dateRange || ''} 
                onChange={(e) => setHistoricalForm(prev => ({ ...prev, dateRange: e.target.value }))} 
                placeholder="e.g., Jan 2024 - Mar 2024"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="historical-notes">Notes</Label>
              <Textarea 
                id="historical-notes"
                value={historicalForm.notes || ''} 
                onChange={(e) => setHistoricalForm(prev => ({ ...prev, notes: e.target.value }))} 
                rows={2}
                placeholder="How does this reference support your estimate?"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <div>
              {element.historicalReference && (
                <Button variant="ghost" onClick={handleClearHistoricalReference} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  Remove Reference
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowHistoricalDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveHistoricalReference} disabled={!historicalForm.chargeNumber}>
                {element.historicalReference ? 'Save Changes' : 'Add Reference'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Engineering Basis Dialog */}
      <Dialog open={showEngineeringDialog} onOpenChange={setShowEngineeringDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{element.engineeringBasis ? 'Edit' : 'Add'} Estimation Basis</DialogTitle>
            <DialogDescription>Document how you arrived at this estimate. Good documentation improves quality scores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="eng-similar">Similar Work</Label>
              <Textarea 
                id="eng-similar"
                value={engineeringForm.similarWork || ''} 
                onChange={(e) => setEngineeringForm(prev => ({ ...prev, similarWork: e.target.value }))} 
                rows={2}
                placeholder="Describe similar work this estimate is based on"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="eng-expert">Expert Source</Label>
              <Input 
                id="eng-expert"
                value={engineeringForm.expertSource || ''} 
                onChange={(e) => setEngineeringForm(prev => ({ ...prev, expertSource: e.target.value }))} 
                placeholder="Who provided the estimate? e.g., Technical Lead (J. Smith)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="eng-assumptions">Assumptions</Label>
              <Textarea 
                id="eng-assumptions"
                value={engineeringForm.assumptions || ''} 
                onChange={(e) => setEngineeringForm(prev => ({ ...prev, assumptions: e.target.value }))} 
                rows={2}
                placeholder="Key assumptions that affect the estimate"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="eng-confidence">Confidence Notes</Label>
              <Textarea 
                id="eng-confidence"
                value={engineeringForm.confidenceNotes || ''} 
                onChange={(e) => setEngineeringForm(prev => ({ ...prev, confidenceNotes: e.target.value }))} 
                rows={2}
                placeholder="How confident are you in this estimate and why?"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <div>
              {element.engineeringBasis && (
                <Button variant="ghost" onClick={handleClearEngineeringBasis} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  Clear Basis
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEngineeringDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveEngineeringBasis}>
                {element.engineeringBasis ? 'Save Changes' : 'Add Basis'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================================
// MAIN ESTIMATE TAB COMPONENT
// ============================================================================
function BulkGenerateDialog({
  isOpen,
  onClose,
  isGenerating,
  progress,
  generatedWbs,
  error,
  onAccept,
  onDiscard,
  selectedCount
}: {
  isOpen: boolean
  onClose: () => void
  isGenerating: boolean
  progress: number
  generatedWbs: EnhancedWBSElement[]
  error: string | null
  onAccept: () => void
  onDiscard: () => void
  selectedCount: number
}) {
  if (!isOpen) return null
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-emerald-600" />
            AI WBS Generation
          </DialogTitle>
          <DialogDescription>
            {isGenerating 
              ? `Generating WBS elements for ${selectedCount} requirement${selectedCount !== 1 ? 's' : ''}...`
              : error 
                ? 'Generation failed'
                : `Generated ${generatedWbs.length} WBS element${generatedWbs.length !== 1 ? 's' : ''}`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-4">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
              <p className="text-sm text-gray-600 mb-2">Analyzing requirements and generating WBS...</p>
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">{progress}%</p>
            </div>
          )}
          
          {error && (
            <div className="flex flex-col items-center justify-center py-12">
              <XCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-sm font-medium text-red-700 mb-2">Generation Failed</p>
              <p className="text-sm text-gray-600 text-center max-w-md">{error}</p>
            </div>
          )}
          
          {!isGenerating && !error && generatedWbs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5" />
                <span>Successfully generated {generatedWbs.length} WBS element{generatedWbs.length !== 1 ? 's' : ''}. Review below and accept to add them.</span>
              </div>
              
              {generatedWbs.map((wbs) => (
                <div key={wbs.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-semibold text-gray-900">{wbs.wbsNumber}</span>
                        <span className="font-medium text-gray-900">{wbs.title}</span>
                      </div>
                      {wbs.sowReference && (
                        <span className="text-xs text-gray-500">{wbs.sowReference}</span>
                      )}
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">AI Generated</Badge>
                  </div>
                  
                  {wbs.why && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Why:</span> {wbs.why}
                    </p>
                  )}
                  
                  {wbs.what && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">What:</span> {wbs.what}
                    </p>
                  )}
                  
                  {wbs.laborEstimates.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">Labor Estimates:</p>
                      <div className="flex flex-wrap gap-2">
                        {wbs.laborEstimates.map(labor => (
                          <Badge key={labor.id} variant="outline" className="text-xs">
                            {labor.roleName}: {getTotalHours(labor.hoursByPeriod)} hrs
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter className="border-t pt-4">
          {error ? (
            <Button variant="outline" onClick={onClose}>Close</Button>
          ) : !isGenerating && generatedWbs.length > 0 ? (
            <>
              <Button variant="outline" onClick={onDiscard}>Discard All</Button>
              <Button onClick={onAccept} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-2" />
                Accept & Add ({generatedWbs.length})
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EstimateTab() {
  // ==========================================================================
  // CONTEXT - Use shared state for WBS elements (flows to Roles & Pricing tab)
  // ==========================================================================
   const {
    solicitation,
    updateSolicitation,
    setExtractedRequirements,
    uiBillableHours,
    setActiveMainTab,
    // Shared WBS elements state - this is the key change!
    estimateWbsElements,
    setEstimateWbsElements,
    // Company roles from Account Center
    companyRoles,
    // Extracted requirements from AI analysis
    extractedRequirements,
  } = useAppContext()

  // Get proposal ID from URL for API calls
  const params = useParams()
  const proposalId = params?.id as string | undefined

  // Use context state for WBS elements (shared with Roles & Pricing tab)
  // Type assertion needed because context uses simpler type, but EnhancedWBSElement is compatible
  const wbsElements = estimateWbsElements as unknown as EnhancedWBSElement[]
  const setWbsElements = setEstimateWbsElements as unknown as (elements: EnhancedWBSElement[]) => void
  
  // Derive available roles from Account Center labor categories, fallback to mock data
  const selectedRoles: SelectedRole[] = useMemo(() => {
    if (companyRoles.length > 0) {
      return companyRoles.map(role => {
        // Get IC4 (Senior) salary as default, or first available level
        const ic4Level = role.levels.find(l => l.level === 'IC4')
        const firstLevel = role.levels[0]
        const level = ic4Level || firstLevel
        const baseSalary = level?.steps[0]?.salary || 120000
        const baseRate = Math.round(baseSalary / 2080) // Convert to hourly
        
        return {
          id: role.id,
          name: role.title,
          category: role.laborCategory || 'General',
          baseRate,
        }
      })
    }
    // Fallback to mock data if no company roles defined
    return ROLE_LIBRARY
  }, [companyRoles])
  
  const contractPeriods = useMemo(() => {
    const periods: { key: PeriodKey; label: string }[] = []
    if (solicitation.periodOfPerformance.baseYear) periods.push({ key: 'base', label: 'Base' })
    for (let i = 1; i <= solicitation.periodOfPerformance.optionYears; i++) periods.push({ key: `option${i}` as PeriodKey, label: `Opt ${i}` })
    if (periods.length === 0) periods.push({ key: 'base', label: 'Base' })
    return periods
  }, [solicitation.periodOfPerformance])
  
  const [chargeCodes, setChargeCodes] = useState<ChargeCode[]>(MOCK_CHARGE_CODES)
  // Map extracted requirements to SOORequirement format, return empty array if none
 const initialRequirements = useMemo((): SOORequirement[] => {
  if (extractedRequirements && extractedRequirements.length > 0) {
    const categoryMap: Record<string, RequirementCategory> = {
      'delivery': 'functional', 'reporting': 'management', 'staffing': 'management',
      'compliance': 'compliance', 'governance': 'management', 'transition': 'management', 'other': 'other',
    }
    return extractedRequirements.map((req) => ({
      id: req.id,
      referenceNumber: req.reference_number || (req.pageNumber ? `p.${req.pageNumber}` : req.id),
      title: req.title,
      description: req.description || req.text,
      type: 'shall' as RequirementType,
      category: categoryMap[req.type] || 'other',
      priority: 'medium' as const,
      source: req.source || req.sourceSection,
      linkedWbsIds: [],
      notes: '',
      isAIExtracted: true,
    }))
  }
  return []
}, [extractedRequirements])
  
  const [requirements, setRequirements] = useState<SOORequirement[]>(initialRequirements)
  
  // Update requirements when extracted requirements change
  useEffect(() => {
    if (extractedRequirements && extractedRequirements.length > 0) {
      const mapped = extractedRequirements.map((req) => {
        const categoryMap: Record<string, RequirementCategory> = {
          'delivery': 'functional', 'reporting': 'management', 'staffing': 'management',
          'compliance': 'compliance', 'governance': 'management', 'transition': 'management', 'other': 'other',
        }
    return {
  id: req.id,
  referenceNumber: req.reference_number || (req.pageNumber ? `p.${req.pageNumber}` : req.id),
  title: req.title,
  description: req.description || req.text,
  type: 'shall' as RequirementType,
  category: categoryMap[req.type] || 'other',
  priority: 'medium' as const,
  source: req.source || req.sourceSection,
  linkedWbsIds: [],
  notes: '',
  isAIExtracted: true,
}
      })
      setRequirements(mapped)
    }
  }, [extractedRequirements]) 
// Initialize WBS elements with mock data if context is empty
// This runs once when component mounts and context has no data 
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('wbs')
  const [activeSection, setActiveSection] = useState('requirements')
  const [showAddElement, setShowAddElement] = useState(false)
  const [newElement, setNewElement] = useState<Partial<EnhancedWBSElement> & { linkedRequirementId?: string }>({ 
  wbsNumber: '', 
  title: '', 
  sowReference: '', 
  estimateMethod: 'engineering', 
  complexityFactor: 1.0,
  linkedRequirementId: ''
  })  
  const [showLaborDialog, setShowLaborDialog] = useState(false)
  const [editingLabor, setEditingLabor] = useState<EnhancedLaborEstimate | null>(null)
  const [laborForm, setLaborForm] = useState<{ roleId: string; rationale: string; confidence: 'high' | 'medium' | 'low'; hoursByPeriod: PeriodHours }>({ roleId: '', rationale: '', confidence: 'medium', hoursByPeriod: { base: 0, option1: 0, option2: 0, option3: 0, option4: 0 } })
  
  // State for editing requirements
  const [showReqDialog, setShowReqDialog] = useState(false)
  const [editingReq, setEditingReq] = useState<SOORequirement | null>(null)
  const [reqForm, setReqForm] = useState<Partial<SOORequirement>>({ referenceNumber: '', title: '', description: '', type: 'shall', category: 'functional', priority: 'medium', source: '', notes: '' })
  
  // State for editing charge codes
  const [showChargeCodeDialog, setShowChargeCodeDialog] = useState(false)
  const [editingChargeCode, setEditingChargeCode] = useState<ChargeCode | null>(null)
  const [chargeCodeForm, setChargeCodeForm] = useState<Partial<ChargeCode>>({ chargeNumber: '', projectName: '', client: '', dateRange: '', totalHours: 0, description: '', roles: [] })
  const [newRole, setNewRole] = useState('')
  // State for bulk WBS generation
  const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(new Set())
  const [showBulkGenerateDialog, setShowBulkGenerateDialog] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generatedWbs, setGeneratedWbs] = useState<EnhancedWBSElement[]>([])
  const [generationError, setGenerationError] = useState<string | null>(null)
  
// Bulk WBS generation handlers
  const handleToggleRequirementSelection = (reqId: string) => {
    setSelectedRequirements(prev => {
      const next = new Set(prev)
      if (next.has(reqId)) {
        next.delete(reqId)
      } else {
        next.add(reqId)
      }
      return next
    })
  }

  const handleSelectAllUnmapped = () => {
    const unmapped = requirements.filter(r => r.linkedWbsIds.length === 0)
    setSelectedRequirements(new Set(unmapped.map(r => r.id)))
  }

  const handleClearSelection = () => {
    setSelectedRequirements(new Set())
  }

  const handleBulkGenerateWBS = async () => {
    if (selectedRequirements.size === 0) return
    
    // Limit to 10 requirements per batch for optimal AI performance
    const MAX_REQUIREMENTS = 5
    if (selectedRequirements.size > MAX_REQUIREMENTS) {
      toast.warning(`Please select ${MAX_REQUIREMENTS} or fewer requirements at a time for best results. You have ${selectedRequirements.size} selected. Generate in batches for higher quality WBS elements.`)
      return
    }
    
    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationError(null)
    setGeneratedWbs([])
    setShowBulkGenerateDialog(true)
    
    try {
      const selectedReqs = requirements.filter(r => selectedRequirements.has(r.id))
      
      const payload = {
        requirements: selectedReqs.map(r => ({
          id: r.id,
          referenceNumber: r.referenceNumber,
          title: r.title,
          description: r.description,
          type: r.type,
          category: r.category,
          source: r.source,
        })),
        availableRoles: companyRoles.length > 0 
          ? companyRoles.map(r => ({
              id: r.id,
              name: r.title,
              description: r.description || `${r.laborCategory || 'General'} role`,
              category: r.laborCategory || 'technical',
            }))
        : selectedRoles.map(r => ({
              id: r.id,
              name: r.name,
              description: `${r.category} role`,
              category: r.category || 'technical',
            })),

        existingWbsNumbers: wbsElements.map(el => el.wbsNumber),
        contractContext: {
          title: solicitation.title || 'Government Contract',
          agency: solicitation.clientAgency || 'Federal Agency',
          contractType: solicitation.contractType || 'tm',
          periodOfPerformance: {
            baseYear: solicitation.periodOfPerformance.baseYear,
            optionYears: solicitation.periodOfPerformance.optionYears,
          }
        }
      }
      
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 5, 85))
      }, 500)
      
      const response = await fetch('/api/generate-wbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      clearInterval(progressInterval)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', response.status, errorData)
        throw new Error(errorData.error || errorData.message || `Generation failed (${response.status})`)
  }
      
      const data = await response.json()
      setGenerationProgress(100)

      const newElements: EnhancedWBSElement[] = data.wbsElements.map((el: any) => {
        // Look up the linked requirement to get the correct source
        const linkedReq = requirements.find(r => r.id === el.linkedRequirementId)
        const element: EnhancedWBSElement = {
          id: generateId(),
          wbsNumber: el.wbsNumber,
          title: el.title,
          sowReference: linkedReq?.source || linkedReq?.reference_number || linkedReq?.referenceNumber || el.sowReference || '',
          clin: '',
          periodOfPerformance: { startDate: '', endDate: '' },
          why: el.why || '',
          what: el.what || '',
          notIncluded: el.notIncluded || '',
          assumptions: el.assumptions || [],
          estimateMethod: el.estimateMethod || 'engineering',
          complexityFactor: 1.0,
          complexityJustification: '',
          laborEstimates: (el.laborEstimates || []).map((labor: any) => ({
            id: generateId(),
            roleId: labor.roleId,
            roleName: labor.roleName,
            hoursByPeriod: labor.hoursByPeriod || { base: 0, option1: 0, option2: 0, option3: 0, option4: 0 },
            rationale: labor.rationale || '',
            confidence: labor.confidence || 'medium',
            isAISuggested: true,
            isOrphaned: !selectedRoles.some(r => r.id === labor.roleId),
          })),
          risks: [],
          dependencies: [],
          qualityGrade: 'yellow',
          qualityScore: 0,
          qualityIssues: [],
          isAIGenerated: true,
          aiConfidence: 0.8,
        }
        
        const { score, grade, issues } = calculateQualityScore(element)
        element.qualityScore = score
        element.qualityGrade = grade
        element.qualityIssues = issues
        
        // Store linked requirement ID for later
        ;(element as any)._linkedRequirementId = el.linkedRequirementId
        
        return element
      })
      
      setGeneratedWbs(newElements)
      
    } catch (error) {
      console.error('Generation error:', error)
      setGenerationError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsGenerating(false)
    }
  }

 const handleAcceptGeneratedWbs = async () => {
  // Track mapping from AI's linkedRequirementId to wbsNumber (so we can map to DB UUIDs later)
  const wbsNumberToReqId: Record<string, string> = {}
  generatedWbs.forEach(el => {
    const linkedReqId = (el as any)._linkedRequirementId
    if (linkedReqId && el.wbsNumber) {
      wbsNumberToReqId[el.wbsNumber] = linkedReqId
    }
  })

  // Prepare data for API - save FIRST to get real UUIDs
  const wbsToSave = generatedWbs.map(el => ({
    wbs_number: el.wbsNumber,
    title: el.title,
    description: el.what || '',
    hours: el.laborEstimates?.reduce((sum, l) =>
      sum + (l.hoursByPeriod?.base || 0) + (l.hoursByPeriod?.option1 || 0) + (l.hoursByPeriod?.option2 || 0), 0
    ) || 0,
    labor_cost: 0,
  }))

  let elementsWithDbIds: EnhancedWBSElement[] = []
  const elementMapping: { reqId: string; wbsId: string }[] = []

  if (proposalId) {
    try {
      const response = await wbsApi.create(proposalId, wbsToSave) as { wbsElements: Array<{ id: string; wbs_number: string; title: string; description: string; hours: number }> }
      console.log('[Estimate] Saved WBS elements to API, got UUIDs:', response.wbsElements?.map(e => e.id))

      // Build local elements using the DB-generated UUIDs
      elementsWithDbIds = response.wbsElements.map(dbEl => {
        // Find the original generated element by wbs_number to get full data
        const originalEl = generatedWbs.find(g => g.wbsNumber === dbEl.wbs_number) || {} as any
        const element: EnhancedWBSElement = {
          id: dbEl.id, // Use the real UUID from database
          wbsNumber: dbEl.wbs_number,
          title: dbEl.title,
          sowReference: originalEl.sowReference || '',
          clin: '',
          periodOfPerformance: { startDate: '', endDate: '' },
          why: originalEl.why || '',
          what: originalEl.what || dbEl.description || '',
          notIncluded: originalEl.notIncluded || '',
          assumptions: originalEl.assumptions || [],
          estimateMethod: originalEl.estimateMethod || 'engineering',
          complexityFactor: 1.0,
          complexityJustification: '',
          laborEstimates: originalEl.laborEstimates || [],
          risks: [],
          dependencies: [],
          qualityGrade: 'yellow',
          qualityScore: 0,
          qualityIssues: [],
          isAIGenerated: true,
          aiConfidence: 0.8,
        }
        const { score, grade, issues } = calculateQualityScore(element)
        element.qualityScore = score
        element.qualityGrade = grade
        element.qualityIssues = issues

        // Build element mapping using the REAL UUID
        const linkedReqId = wbsNumberToReqId[dbEl.wbs_number]
        if (linkedReqId) {
          elementMapping.push({ reqId: linkedReqId, wbsId: dbEl.id })
        }

        return element
      })
    } catch (error) {
      console.warn('[Estimate] Failed to save WBS elements to API:', error)
      // Fallback to local IDs if API fails
      elementsWithDbIds = generatedWbs.map(el => {
        const { _linkedRequirementId, ...cleanElement } = el as any
        const localId = generateId()
        if (_linkedRequirementId) {
          elementMapping.push({ reqId: _linkedRequirementId, wbsId: localId })
        }
        return { ...cleanElement, id: localId } as EnhancedWBSElement
      })
    }
  } else {
    // No proposalId - use local IDs
    elementsWithDbIds = generatedWbs.map(el => {
      const { _linkedRequirementId, ...cleanElement } = el as any
      const localId = generateId()
      if (_linkedRequirementId) {
        elementMapping.push({ reqId: _linkedRequirementId, wbsId: localId })
      }
      return { ...cleanElement, id: localId } as EnhancedWBSElement
    })
  }

  // Add WBS elements to state with real UUIDs
  setWbsElements([...wbsElements, ...elementsWithDbIds])

  // Auto-link requirements using the real UUIDs
  if (elementMapping.length > 0) {
    console.log('[Auto-link] Element mapping with DB UUIDs:', elementMapping)
    console.log('[Auto-link] Requirement IDs in state:', requirements.map(r => r.id))

    setRequirements(prev => {
      return prev.map(r => {
        const wbsIdsToLink = elementMapping
          .filter(m => m.reqId === r.id)
          .map(m => m.wbsId)

        if (wbsIdsToLink.length === 0) return r

        const newLinkedIds = [...r.linkedWbsIds]
        wbsIdsToLink.forEach(wbsId => {
          if (!newLinkedIds.includes(wbsId)) {
            newLinkedIds.push(wbsId)
          }
        })

        return { ...r, linkedWbsIds: newLinkedIds }
      })
    })
  }

  // Clear selection and close dialog
  setSelectedRequirements(new Set())
  setShowBulkGenerateDialog(false)
  setGeneratedWbs([])
  setActiveSection('wbs')
}

  const handleDiscardGeneratedWbs = () => {
    setShowBulkGenerateDialog(false)
    setGeneratedWbs([])
    setGenerationError(null)
  }

  const handleOpenLaborDialog = (labor?: EnhancedLaborEstimate) => {
    if (labor) { setEditingLabor(labor); setLaborForm({ roleId: labor.roleId, rationale: labor.rationale, confidence: labor.confidence, hoursByPeriod: { ...labor.hoursByPeriod } }) }
    else { setEditingLabor(null); setLaborForm({ roleId: '', rationale: '', confidence: 'medium', hoursByPeriod: { base: 0, option1: 0, option2: 0, option3: 0, option4: 0 } }) }
    setShowLaborDialog(true)
  }
  
  const handleUpdateElement = (id: string, updates: Partial<EnhancedWBSElement>) => {
  setWbsElements(wbsElements.map(el => {
    if (el.id !== id) return el
    const updated = { ...el, ...updates }
    const { score, grade, issues } = calculateQualityScore(updated)
    return { ...updated, qualityScore: score, qualityGrade: grade, qualityIssues: issues }
  }))
}

const handleDeleteElement = (id: string) => {
  setWbsElements(wbsElements.filter(el => el.id !== id))
  if (selectedElementId === id) setSelectedElementId(null)
}

const handleDeleteLabor = (laborId: string) => {
  if (!selectedElementId) return
  setWbsElements(wbsElements.map(el => {
    if (el.id !== selectedElementId) return el
    return { ...el, laborEstimates: el.laborEstimates.filter(l => l.id !== laborId) }
  }))
}

const handleSaveLabor = () => {
  if (!laborForm.roleId || !selectedElementId) return
  const role = selectedRoles.find(r => r.id === laborForm.roleId)
  if (!role) return
  
  if (editingLabor) {
    handleUpdateElement(selectedElementId, {
      laborEstimates: wbsElements.find(el => el.id === selectedElementId)?.laborEstimates.map(l => 
        l.id !== editingLabor.id ? l : { ...l, hoursByPeriod: laborForm.hoursByPeriod, rationale: laborForm.rationale, confidence: laborForm.confidence }
      ) || []
    })
  } else {
    const newLabor: EnhancedLaborEstimate = {
      id: generateId(),
      roleId: laborForm.roleId,
      roleName: role.name,
      hoursByPeriod: laborForm.hoursByPeriod,
      rationale: laborForm.rationale,
      confidence: laborForm.confidence,
      isAISuggested: false,
      isOrphaned: false,
    }
    handleUpdateElement(selectedElementId, {
      laborEstimates: [...(wbsElements.find(el => el.id === selectedElementId)?.laborEstimates || []), newLabor]
    })
  }
  setShowLaborDialog(false)
}

// Handle requirement selection in Add WBS dialog
const handleRequirementSelect = (reqId: string) => {
  if (!reqId) {
    setNewElement(prev => ({ 
      ...prev, 
      linkedRequirementId: '',
    }))
    return
  }
  
  const req = requirements.find(r => r.id === reqId)
  if (req) {
    setNewElement(prev => ({ 
      ...prev, 
      linkedRequirementId: reqId,
      title: req.title || prev.title,
      sowReference: req.source || req.reference_number || req.referenceNumber || prev.sowReference,
    }))
  }
}

const handleAddElement = async () => {
  if (!newElement.wbsNumber || !newElement.title) return

  const linkedReqId = newElement.linkedRequirementId

  // Build the element data (without ID yet)
  const elementData = {
    wbsNumber: newElement.wbsNumber!,
    title: newElement.title!,
    sowReference: newElement.sowReference || '',
    clin: newElement.clin,
    periodOfPerformance: newElement.periodOfPerformance || { startDate: '', endDate: '' },
    why: newElement.why || '',
    what: newElement.what || '',
    notIncluded: newElement.notIncluded || '',
    assumptions: newElement.assumptions || [],
    estimateMethod: newElement.estimateMethod || 'engineering',
    complexityFactor: newElement.complexityFactor || 1.0,
    complexityJustification: newElement.complexityJustification || '',
    laborEstimates: [],
    risks: [],
    dependencies: [],
    qualityGrade: 'red' as const,
    qualityScore: 0,
    qualityIssues: [] as string[],
    isAIGenerated: false,
    aiConfidence: 0,
  }

  let elementId: string

  // Save to API first to get real UUID
  if (proposalId) {
    try {
      const response = await wbsApi.create(proposalId, [{
        wbs_number: elementData.wbsNumber,
        title: elementData.title,
        description: elementData.what,
        hours: 0,
        labor_cost: 0,
      }]) as { wbsElements: Array<{ id: string }> }
      elementId = response.wbsElements[0].id
      console.log('[Estimate] Created WBS element with UUID:', elementId)
    } catch (error) {
      console.warn('[Estimate] Failed to save WBS element to API, using local ID:', error)
      elementId = generateId()
    }
  } else {
    elementId = generateId()
  }

  const element: EnhancedWBSElement = {
    id: elementId,
    ...elementData,
  }

  const { score, grade, issues } = calculateQualityScore(element)
  element.qualityScore = score
  element.qualityGrade = grade
  element.qualityIssues = issues

  setWbsElements([...wbsElements, element])

  // Auto-link to requirement if one was selected (now with real UUID)
  if (linkedReqId) {
    handleLinkWbs(linkedReqId, elementId)
  }

  setShowAddElement(false)
  setNewElement({
    wbsNumber: '',
    title: '',
    sowReference: '',
    estimateMethod: 'engineering',
    complexityFactor: 1.0,
    linkedRequirementId: ''
  })
  setSelectedElementId(elementId)
}
  const handleLinkWbs = async (reqId: string, wbsId: string) => {
    // Update local state
    setRequirements(prev => prev.map(r => (r.id !== reqId || r.linkedWbsIds.includes(wbsId)) ? r : { ...r, linkedWbsIds: [...r.linkedWbsIds, wbsId] }))
    // Persist to API only if both IDs are valid UUIDs (not local IDs like "1768089020449-x7itlewfs")
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (proposalId && uuidRegex.test(reqId) && uuidRegex.test(wbsId)) {
      try {
        await requirementsApi.update(proposalId, { reqId, linked_wbs_id: wbsId })
      } catch (error) {
        console.warn('[Estimate] Failed to persist WBS link:', error)
      }
    }
  }
  const handleUnlinkWbs = async (reqId: string, wbsId: string) => {
    // Update local state
    const req = requirements.find(r => r.id === reqId)
    const remainingIds = req?.linkedWbsIds.filter(id => id !== wbsId) || []
    setRequirements(prev => prev.map(r => r.id !== reqId ? r : { ...r, linkedWbsIds: remainingIds }))
    // Persist to API only if reqId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const firstRemainingUuid = remainingIds.find(id => uuidRegex.test(id))
    if (proposalId && uuidRegex.test(reqId)) {
      try {
        await requirementsApi.update(proposalId, { reqId, linked_wbs_id: firstRemainingUuid || null })
      } catch (error) {
        console.warn('[Estimate] Failed to persist WBS unlink:', error)
      }
    }
  }
const handleNavigateToRoles = () => { setActiveMainTab('roles') }
  
  // Requirement handlers
  const handleOpenReqDialog = (req?: SOORequirement) => {
    if (req) {
      setEditingReq(req)
      setReqForm({ referenceNumber: req.referenceNumber, title: req.title, description: req.description, type: req.type, category: req.category, priority: req.priority, source: req.source, notes: req.notes })
    } else {
      setEditingReq(null)
      setReqForm({ referenceNumber: '', title: '', description: '', type: 'shall', category: 'functional', priority: 'medium', source: '', notes: '' })
    }
    setShowReqDialog(true)
  }
  
  const handleSaveReq = () => {
    if (!reqForm.referenceNumber || !reqForm.title) return
    if (editingReq) {
      setRequirements(prev => prev.map(r => r.id !== editingReq.id ? r : { ...r, ...reqForm } as SOORequirement))
    } else {
      setRequirements(prev => [...prev, { id: `req-${Date.now()}`, ...reqForm, linkedWbsIds: [], isAIExtracted: false } as SOORequirement])
    }
    setShowReqDialog(false)
    setEditingReq(null)
  }
  
  // Charge code handlers
  const handleOpenChargeCodeDialog = (cc?: ChargeCode) => {
    if (cc) {
      setEditingChargeCode(cc)
      setChargeCodeForm({ chargeNumber: cc.chargeNumber, projectName: cc.projectName, client: cc.client, dateRange: cc.dateRange, totalHours: cc.totalHours, description: cc.description, roles: [...cc.roles] })
    } else {
      setEditingChargeCode(null)
      setChargeCodeForm({ chargeNumber: '', projectName: '', client: '', dateRange: '', totalHours: 0, description: '', roles: [] })
    }
    setNewRole('')
    setShowChargeCodeDialog(true)
  }
  
  const handleSaveChargeCode = () => {
    if (!chargeCodeForm.chargeNumber || !chargeCodeForm.projectName) return
    if (editingChargeCode) {
      setChargeCodes(prev => prev.map(c => c.id !== editingChargeCode.id ? c : { ...c, ...chargeCodeForm } as ChargeCode))
    } else {
      setChargeCodes(prev => [...prev, { id: `cc-${Date.now()}`, ...chargeCodeForm } as ChargeCode])
    }
    setShowChargeCodeDialog(false)
    setEditingChargeCode(null)
  }
  
  const handleAddRoleToChargeCode = () => {
    if (!newRole.trim()) return
    setChargeCodeForm(prev => ({ ...prev, roles: [...(prev.roles || []), newRole.trim()] }))
    setNewRole('')
  }
  
  const handleRemoveRoleFromChargeCode = (role: string) => {
    setChargeCodeForm(prev => ({ ...prev, roles: (prev.roles || []).filter(r => r !== role) }))
  }
  
  const stats = useMemo(() => {
    const totalHours = wbsElements.reduce((sum, el) => sum + getElementTotalHours(el), 0)
    const avgQuality = wbsElements.length > 0 ? Math.round(wbsElements.reduce((sum, el) => sum + el.qualityScore, 0) / wbsElements.length) : 0
    const issueCount = wbsElements.reduce((sum, el) => sum + el.qualityIssues.length, 0)
    const totalReqs = requirements.length; const mappedReqs = requirements.filter(r => r.linkedWbsIds.length > 0).length
    const requirementsCoverage = totalReqs > 0 ? Math.round((mappedReqs / totalReqs) * 100) : 100
    return { totalHours, avgQuality, issueCount, requirementsCoverage, unmappedRequirements: totalReqs - mappedReqs }
  }, [wbsElements, requirements])
  
  const filteredElements = useMemo(() => {
    let filtered = [...wbsElements]
    if (searchQuery) { const query = searchQuery.toLowerCase(); filtered = filtered.filter(el => el.title.toLowerCase().includes(query) || el.wbsNumber.toLowerCase().includes(query) || el.sowReference?.toLowerCase().includes(query)) }
    if (filterGrade !== 'all') filtered = filtered.filter(el => el.qualityGrade === filterGrade)
    switch (sortBy) { case 'wbs': filtered.sort((a, b) => a.wbsNumber.localeCompare(b.wbsNumber, undefined, { numeric: true })); break; case 'quality': filtered.sort((a, b) => b.qualityScore - a.qualityScore); break; case 'hours': filtered.sort((a, b) => getElementTotalHours(b) - getElementTotalHours(a)); break }
    return filtered
  }, [wbsElements, searchQuery, filterGrade, sortBy])
  
  const selectedElement = wbsElements.find(el => el.id === selectedElementId)

  // Show skeleton while proposal data is loading (brief flash on mount)
  const [isHydrated, setIsHydrated] = useState(false)
  useEffect(() => { setIsHydrated(true) }, [])

  if (!isHydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <SettingsCallout proposalId={solicitation?.solicitationNumber} />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><h1 className="text-xl font-semibold text-gray-900">Estimate</h1><Badge variant="outline" className="text-xs">{wbsElements.length} WBS</Badge></div>
         <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs">
         <div className="flex items-center gap-1.5"><span className="text-gray-500">Hours</span><span className="font-semibold text-gray-900">{stats.totalHours.toLocaleString()}</span></div>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
         <div className="flex items-center gap-1.5"><span className="text-gray-500">Quality</span><span className="font-semibold text-gray-900">{stats.avgQuality}%</span></div>
         <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
         <div className="flex items-center gap-1.5"><span className="text-gray-500">Reqs</span><span className={`font-semibold ${stats.requirementsCoverage === 100 ? 'text-green-600' : 'text-yellow-600'}`}>{stats.requirementsCoverage}%</span></div>
           {stats.issueCount > 0 && <><span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" /><div className="flex items-center gap-1.5"><span className="text-yellow-600">Issues</span><span className="font-semibold text-yellow-600">{stats.issueCount}</span></div></>}
        </div>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-gray-100 p-1">
              <TabsTrigger value="requirements" className="text-xs px-4 data-[state=active]:bg-white"><ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />Requirements{stats.unmappedRequirements > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0 h-4">{stats.unmappedRequirements}</Badge>}</TabsTrigger>
              <TabsTrigger value="wbs" className="text-xs px-4 data-[state=active]:bg-white"><Layers className="w-3.5 h-3.5 mr-1.5" />WBS Elements<Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 h-4">{wbsElements.length}</Badge></TabsTrigger>
              <TabsTrigger value="labor" className="text-xs px-4 data-[state=active]:bg-white"><PieChart className="w-3.5 h-3.5 mr-1.5" />Labor Summary</TabsTrigger>
              <TabsTrigger value="charges" className="text-xs px-4 data-[state=active]:bg-white"><Hash className="w-3.5 h-3.5 mr-1.5" />Charge Codes</TabsTrigger>
            </TabsList>
            {activeSection === 'wbs' && <div className="flex gap-2"><Button size="sm" onClick={() => setShowAddElement(true)}><Plus className="w-4 h-4 mr-2" />Add Element</Button></div>}
          </div>
          
          {/* WBS Tab */}
          <TabsContent value="wbs" className="space-y-4 mt-0">
            <HelpBanner />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[200px]"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="Search WBS..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" /></div></div>
              <Select value={filterGrade} onValueChange={setFilterGrade}><SelectTrigger className="w-[140px] h-9"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All Grades</SelectItem><SelectItem value="blue">Audit-Ready</SelectItem><SelectItem value="green">Complete</SelectItem><SelectItem value="yellow">Needs Review</SelectItem><SelectItem value="red">Incomplete</SelectItem></SelectContent></Select>
              <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="wbs">By WBS #</SelectItem><SelectItem value="quality">By Quality</SelectItem><SelectItem value="hours">By Hours</SelectItem></SelectContent></Select>
              <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
            </div>
            
           {filteredElements.length === 0 ? (
              <EmptyState icon={Layers} title="No WBS elements found" action={{ label: 'Add First Element', onClick: () => setShowAddElement(true), variant: 'outline' }} />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{filteredElements.map(element => <WBSCard key={element.id} element={element} onClick={() => setSelectedElementId(element.id)} onEdit={() => setSelectedElementId(element.id)} onDelete={() => handleDeleteElement(element.id)} />)}</div>
            ) : (
              <WBSTableView elements={filteredElements} onElementClick={setSelectedElementId} onEdit={(el) => setSelectedElementId(el.id)} onDelete={handleDeleteElement} contractPeriods={contractPeriods} />
            )}
          </TabsContent>
          
       <TabsContent value="requirements" className="mt-0">
          <RequirementsSection
          requirements={requirements}
          wbsElements={wbsElements}
          onAdd={() => handleOpenReqDialog()}
          onEdit={handleOpenReqDialog}
          onDelete={async (id) => {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (proposalId && uuidRegex.test(id)) {
              try {
                await requirementsApi.delete(proposalId, id)
              } catch (error) {
                console.error('[Estimate] Failed to delete requirement from database:', error)
              }
            }
            setRequirements(prev => prev.filter(r => r.id !== id))
          }}
          onDeleteAll={async () => {
            if (proposalId) {
              try {
                await requirementsApi.deleteAll(proposalId)
              } catch (error) {
                console.error('[Estimate] Failed to delete requirements from database:', error)
              }
            }
            // Clear local state
            setRequirements([])
            setSelectedRequirements(new Set())
            // Reset context state so Upload tab shows initial state
            setExtractedRequirements([])
            // Only clear the analyzed document flag, preserve proposal metadata (title, agency, etc.)
            updateSolicitation({ analyzedFromDocument: undefined })
          }}
          onLinkWbs={handleLinkWbs}
          onUnlinkWbs={handleUnlinkWbs}
          selectedRequirements={selectedRequirements}
          onToggleSelection={handleToggleRequirementSelection}
          onSelectAllUnmapped={handleSelectAllUnmapped}
          onClearSelection={handleClearSelection}
          onBulkGenerate={handleBulkGenerateWBS}
          isGenerating={isGenerating}
        />
</TabsContent>
          <TabsContent value="labor" className="mt-0"><LaborSummary wbsElements={wbsElements} billableHoursPerYear={uiBillableHours} onNavigateToRoles={handleNavigateToRoles} /></TabsContent>
          <TabsContent value="charges" className="mt-0"><ChargeCodeLibrary chargeCodes={chargeCodes} onAdd={() => handleOpenChargeCodeDialog()} onEdit={handleOpenChargeCodeDialog} onDelete={(id) => setChargeCodes(prev => prev.filter(c => c.id !== id))} /></TabsContent>
        </Tabs>
        
        {/* Slideout */}
        {selectedElement && <WBSSlideout element={selectedElement} isOpen={!!selectedElementId} onClose={() => setSelectedElementId(null)} onUpdate={handleUpdateElement} contractPeriods={contractPeriods} selectedRoles={selectedRoles} allWbsElements={wbsElements} chargeCodes={chargeCodes} onOpenLaborDialog={handleOpenLaborDialog} onDeleteLabor={handleDeleteLabor} />}
        
 {/* Add Element Dialog */}
<Dialog open={showAddElement} onOpenChange={setShowAddElement}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Add WBS Element</DialogTitle>
      <DialogDescription>Create a new Work Breakdown Structure element to address a requirement</DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      {/* Requirement Selector - NEW! */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="linked-requirement">Linked Requirement <span className="text-red-500" aria-label="required">*</span></Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">Select a requirement to auto-fill the title and create traceability. Unmapped requirements are shown first.</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-red-500 ml-auto" aria-label="required">*</span>
        </div>
        <Select 
          value={newElement.linkedRequirementId || ''} 
          onValueChange={handleRequirementSelect}
        >
          <SelectTrigger id="linked-requirement" className="w-full">
            <SelectValue placeholder="Select a requirement to address..." />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {/* Show unmapped requirements first with a visual indicator */}
            {requirements.filter(r => r.linkedWbsIds.length === 0).length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50">
                  Unmapped Requirements ({requirements.filter(r => r.linkedWbsIds.length === 0).length})
                </div>
                {requirements
                  .filter(r => r.linkedWbsIds.length === 0)
                  .map((req, idx) => (
                    <SelectItem key={req.id} value={req.id} className="py-2">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] px-1 py-0 h-4 bg-red-100 text-red-700 border-red-200">
                          REQ-{String(idx + 1).padStart(3, '0')}
                        </Badge>
                        <span className="truncate max-w-[300px]">{req.title || 'Untitled'}</span>
                      </div>
                    </SelectItem>
                  ))
                }
              </>
            )}
            {/* Show already-mapped requirements */}
            {requirements.filter(r => r.linkedWbsIds.length > 0).length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-t">
                  Already Mapped ({requirements.filter(r => r.linkedWbsIds.length > 0).length})
                </div>
                {requirements
                  .filter(r => r.linkedWbsIds.length > 0)
                  .map((req, idx) => {
                    const unmappedCount = requirements.filter(r => r.linkedWbsIds.length === 0).length
                    return (
                      <SelectItem key={req.id} value={req.id} className="py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            REQ-{String(unmappedCount + idx + 1).padStart(3, '0')}
                          </Badge>
                          <span className="truncate max-w-[300px] text-gray-600">{req.title || 'Untitled'}</span>
                          <span className="text-[10px] text-gray-400">({req.linkedWbsIds.length} WBS)</span>
                        </div>
                      </SelectItem>
                    )
                  })
                }
              </>
            )}
            {requirements.length === 0 && (
              <div className="px-2 py-4 text-sm text-gray-500 text-center">
                No requirements extracted yet. Upload an RFP first.
              </div>
            )}
          </SelectContent>
        </Select>
        {newElement.linkedRequirementId && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            WBS will be linked to this requirement on save
          </p>
        )}
      </div>

     {/* WBS Number with Smart Picker */}
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Label htmlFor="wbs-number">WBS Number <span className="text-red-500" aria-label="required">*</span></Label>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">Hierarchical work breakdown number. Use the suggested number or pick a parent to create a sub-element.</p>
      </TooltipContent>
    </Tooltip>
  </div>
  
  <div className="flex gap-2">
    <Input 
      id="wbs-number"
      value={newElement.wbsNumber || ''} 
      onChange={(e) => setNewElement(prev => ({ ...prev, wbsNumber: e.target.value }))} 
      placeholder="e.g., 1.4" 
      aria-required="true"
      className="flex-1"
    />
    
    {/* Quick-fill button with next number */}
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          className="h-9 px-3 text-xs whitespace-nowrap font-mono"
          onClick={() => setNewElement(prev => ({ ...prev, wbsNumber: getNextWbsNumber(wbsElements) }))}
        >
          → {getNextWbsNumber(wbsElements)}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">Use the next available number</p>
      </TooltipContent>
    </Tooltip>
    
    {/* Parent selector for creating child elements */}
    {wbsElements.length > 0 && (
      <Select 
        value="" 
        onValueChange={(parentWbs) => {
          const nextChild = getNextWbsNumber(wbsElements, parentWbs)
          setNewElement(prev => ({ ...prev, wbsNumber: nextChild }))
        }}
      >
        <SelectTrigger className="w-[130px] h-9 text-xs">
          <span className="text-gray-500">Add under...</span>
        </SelectTrigger>
       <SelectContent position="popper" sideOffset={4}>
          {wbsElements
            .slice()
            .sort((a, b) => a.wbsNumber.localeCompare(b.wbsNumber, undefined, { numeric: true }))
            .map(el => (
              <SelectItem key={el.id} value={el.wbsNumber} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{el.wbsNumber}</span>
                  <span className="text-gray-500 truncate max-w-[150px]">{el.title}</span>
                </div>
              </SelectItem>
            ))
          }
        </SelectContent>
      </Select>
    )}
  </div>
  
  {/* Show existing WBS numbers as context */}
  {wbsElements.length > 0 && (
    <p className="text-xs text-gray-500">
      Existing: {wbsElements
        .map(el => el.wbsNumber)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .join(', ')}
    </p>
  )}
</div>

{/* Title */}
<div className="space-y-2">
  <Label htmlFor="wbs-title">Title <span className="text-red-500" aria-label="required">*</span></Label>
  <Input 
    id="wbs-title"
    value={newElement.title || ''} 
    onChange={(e) => setNewElement(prev => ({ ...prev, title: e.target.value }))} 
    placeholder={newElement.linkedRequirementId ? "Auto-filled from requirement" : "e.g., User Authentication Module"}
    aria-required="true"
  />
  {newElement.linkedRequirementId && newElement.title && (
    <p className="text-xs text-gray-500">
      Feel free to edit the title to better describe the work
    </p>
  )}
</div>

      {/* SOW Reference and CLIN */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sow-ref">SOW/SOO Reference</Label>
          <Input 
            id="sow-ref"
            value={newElement.sowReference || ''} 
            onChange={(e) => setNewElement(prev => ({ ...prev, sowReference: e.target.value }))} 
            placeholder={newElement.linkedRequirementId ? "Auto-filled from requirement" : "e.g., SOO 3.2.1"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clin">CLIN</Label>
          <Input 
            id="clin"
            value={newElement.clin || ''} 
            onChange={(e) => setNewElement(prev => ({ ...prev, clin: e.target.value }))} 
            placeholder="e.g., 0001" 
          />
        </div>
      </div>

      {/* Period of Performance */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date</Label>
          <Input 
            id="start-date"
            type="date" 
            value={newElement.periodOfPerformance?.startDate || ''} 
            onChange={(e) => setNewElement(prev => ({ 
              ...prev, 
              periodOfPerformance: { 
                startDate: e.target.value, 
                endDate: prev.periodOfPerformance?.endDate || '' 
              } 
            }))} 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">End Date</Label>
          <Input 
            id="end-date"
            type="date" 
            value={newElement.periodOfPerformance?.endDate || ''} 
            onChange={(e) => setNewElement(prev => ({ 
              ...prev, 
              periodOfPerformance: { 
                startDate: prev.periodOfPerformance?.startDate || '', 
                endDate: e.target.value 
              } 
            }))} 
          />
        </div>
      </div>

      {/* Estimate Method */}
      <div className="space-y-2">
        <Label htmlFor="estimate-method">Estimate Method</Label>
        <Select 
          value={newElement.estimateMethod || 'engineering'} 
          onValueChange={(v) => setNewElement(prev => ({ ...prev, estimateMethod: v as EstimateMethod }))}
        >
          <SelectTrigger id="estimate-method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ESTIMATE_METHOD_LABELS).map(([key, { label, icon }]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowAddElement(false)}>Cancel</Button>
      <Button 
        onClick={handleAddElement} 
        disabled={!newElement.wbsNumber || !newElement.title || !newElement.linkedRequirementId}
      >
        <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
        Add Element
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
        
        {/* Labor Dialog */}
        <Dialog open={showLaborDialog} onOpenChange={setShowLaborDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingLabor ? 'Edit' : 'Add'} Labor Estimate</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Role <span className="text-red-500">*</span></Label><Select value={laborForm.roleId} onValueChange={(v) => setLaborForm(prev => ({ ...prev, roleId: v }))} disabled={!!editingLabor}><SelectTrigger><SelectValue placeholder="Select a role..." /></SelectTrigger><SelectContent>{selectedRoles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Hours by Period</Label><div className="grid grid-cols-5 gap-2">{contractPeriods.map(period => <div key={period.key}><Label className="text-xs text-gray-500">{period.label}</Label><Input type="number" min="0" value={laborForm.hoursByPeriod[period.key] || ''} onChange={(e) => setLaborForm(prev => ({ ...prev, hoursByPeriod: { ...prev.hoursByPeriod, [period.key]: parseInt(e.target.value) || 0 } }))} /></div>)}</div></div>
              <div className="space-y-2"><Label>Confidence Level</Label><Select value={laborForm.confidence} onValueChange={(v) => setLaborForm(prev => ({ ...prev, confidence: v as 'high'|'medium'|'low' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Rationale</Label><Textarea value={laborForm.rationale} onChange={(e) => setLaborForm(prev => ({ ...prev, rationale: e.target.value }))} rows={3} placeholder="Explain how you determined these hours..." /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowLaborDialog(false)}>Cancel</Button><Button onClick={handleSaveLabor} disabled={!laborForm.roleId}>{editingLabor ? 'Save Changes' : 'Add Labor'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Requirement Dialog */}
        <Dialog open={showReqDialog} onOpenChange={setShowReqDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingReq ? 'Edit' : 'Add'} Requirement</DialogTitle>
              <DialogDescription>Track SOW/SOO requirements and link them to WBS elements.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="req-ref">Reference # <span className="text-red-500">*</span></Label>
                  <Input id="req-ref" value={reqForm.referenceNumber || ''} onChange={(e) => setReqForm(prev => ({ ...prev, referenceNumber: e.target.value }))} placeholder="SOO 3.1.1" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="req-title">Title <span className="text-red-500">*</span></Label>
                  <Input id="req-title" value={reqForm.title || ''} onChange={(e) => setReqForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Requirement title" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-desc">Description</Label>
                <Textarea id="req-desc" value={reqForm.description || ''} onChange={(e) => setReqForm(prev => ({ ...prev, description: e.target.value }))} rows={2} placeholder="Full requirement text..." />
              </div>
              <div className="grid grid-cols-3 gap-8">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={reqForm.type || 'shall'} onValueChange={(v) => setReqForm(prev => ({ ...prev, type: v as RequirementType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shall">Shall (mandatory)</SelectItem>
                      <SelectItem value="should">Should (expected)</SelectItem>
                      <SelectItem value="may">May (optional)</SelectItem>
                      <SelectItem value="will">Will (statement)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={reqForm.category || 'functional'} onValueChange={(v) => setReqForm(prev => ({ ...prev, category: v as RequirementCategory }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="functional">Functional</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={reqForm.priority || 'medium'} onValueChange={(v) => setReqForm(prev => ({ ...prev, priority: v as 'critical' | 'high' | 'medium' | 'low' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-source">Source</Label>
                <Input id="req-source" value={reqForm.source || ''} onChange={(e) => setReqForm(prev => ({ ...prev, source: e.target.value }))} placeholder="e.g., SOO Section 3.1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-notes">Notes</Label>
                <Textarea id="req-notes" value={reqForm.notes || ''} onChange={(e) => setReqForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} placeholder="Internal notes about this requirement..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReqDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveReq} disabled={!reqForm.referenceNumber || !reqForm.title}>{editingReq ? 'Save Changes' : 'Add Requirement'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Charge Code Dialog */}
        <Dialog open={showChargeCodeDialog} onOpenChange={setShowChargeCodeDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingChargeCode ? 'Edit' : 'Add'} Charge Code</DialogTitle>
              <DialogDescription>Add past projects to reference in historical estimates.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc-number">Charge Number <span className="text-red-500">*</span></Label>
                  <Input id="cc-number" value={chargeCodeForm.chargeNumber || ''} onChange={(e) => setChargeCodeForm(prev => ({ ...prev, chargeNumber: e.target.value }))} placeholder="TT-2024-0892" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-hours">Total Hours</Label>
                  <Input id="cc-hours" type="number" min="0" value={chargeCodeForm.totalHours || ''} onChange={(e) => setChargeCodeForm(prev => ({ ...prev, totalHours: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-project">Project Name <span className="text-red-500">*</span></Label>
                <Input id="cc-project" value={chargeCodeForm.projectName || ''} onChange={(e) => setChargeCodeForm(prev => ({ ...prev, projectName: e.target.value }))} placeholder="VA Transition Support" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc-client">Client</Label>
                  <Input id="cc-client" value={chargeCodeForm.client || ''} onChange={(e) => setChargeCodeForm(prev => ({ ...prev, client: e.target.value }))} placeholder="Department of Veterans Affairs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-dates">Date Range</Label>
                  <Input id="cc-dates" value={chargeCodeForm.dateRange || ''} onChange={(e) => setChargeCodeForm(prev => ({ ...prev, dateRange: e.target.value }))} placeholder="Jan 2024 - Mar 2024" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-desc">Description</Label>
                <Textarea id="cc-desc" value={chargeCodeForm.description || ''} onChange={(e) => setChargeCodeForm(prev => ({ ...prev, description: e.target.value }))} rows={2} placeholder="Describe the work performed..." />
              </div>
              <div className="space-y-2">
                <Label>Roles Used</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(chargeCodeForm.roles || []).map(role => (
                    <Badge key={role} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-red-100" onClick={() => handleRemoveRoleFromChargeCode(role)}>
                      {role} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Add a role..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRoleToChargeCode() } }} />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddRoleToChargeCode} disabled={!newRole.trim()}>Add</Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChargeCodeDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveChargeCode} disabled={!chargeCodeForm.chargeNumber || !chargeCodeForm.projectName}>{editingChargeCode ? 'Save Changes' : 'Add Charge Code'}</Button>
            </DialogFooter>
          </DialogContent>
       </Dialog>
      </div>
   
      {/* Bulk Generate Dialog */}
      <BulkGenerateDialog
        isOpen={showBulkGenerateDialog}
        onClose={() => setShowBulkGenerateDialog(false)}
        isGenerating={isGenerating}
        progress={generationProgress}
        generatedWbs={generatedWbs}
        error={generationError}
        onAccept={handleAcceptGeneratedWbs}
        onDiscard={handleDiscardGeneratedWbs}
        selectedCount={selectedRequirements.size}
      />
    </TooltipProvider>
  )
}

export default EstimateTab