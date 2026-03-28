'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useAppContext } from '@/contexts/app-context'
import { settingsApi, rolesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Check,
  AlertTriangle,
  X,
  Copy,
  ChevronDown,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ErrorAlert } from '@/components/ui/error-alert'

// ===== TYPES =====

interface SalaryLevel {
  level: string
  levelName: string
  steps: Array<{ step: number; salary: number }>
}

interface CompanyRoleFromAPI {
  id: string
  title: string
  labor_category?: string
  salary_levels?: SalaryLevel[]
}

interface CompanyRole {
  id: string
  title: string
  laborCategory?: string
  levels?: SalaryLevel[]
}

// Transform API response to internal format
function transformRole(apiRole: CompanyRoleFromAPI): CompanyRole {
  return {
    id: apiRole.id,
    title: apiRole.title,
    laborCategory: apiRole.labor_category,
    levels: apiRole.salary_levels,
  }
}

// Extract salary from role (first level, first step)
function getRoleSalary(role: CompanyRole): number | null {
  if (role.levels && role.levels.length > 0) {
    const firstLevel = role.levels[0]
    if (firstLevel.steps && firstLevel.steps.length > 0) {
      return firstLevel.steps[0].salary
    }
  }
  return null
}

// ===== COMPONENT =====

export function SubRateCalculator() {
  const { indirectRates, companyPolicy } = useAppContext()

  // Form state
  const [roleName, setRoleName] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [billRate, setBillRate] = useState<number | ''>(150)
  const [hoursMode, setHoursMode] = useState<'hours' | 'fte'>('fte')
  const [hoursInput, setHoursInput] = useState<number | ''>(1920)
  const [fteInput, setFteInput] = useState<number | ''>(1)
  const [baseSalary, setBaseSalary] = useState<number | ''>(100000)
  const [fringeRate, setFringeRate] = useState<number | ''>(21.16)
  const [overheadRate, setOverheadRate] = useState<number | ''>(34.26)
  const [gaRate, setGaRate] = useState<number | ''>(19.83)
  const [targetMargin, setTargetMargin] = useState<number>(15)
  const [showScenarios, setShowScenarios] = useState(false)

  // Data loading state
  const [companyRoles, setCompanyRoles] = useState<CompanyRole[]>([])
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [billableHoursPerYear, setBillableHoursPerYear] = useState(1920)

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsResponse = await settingsApi.get() as { settings: Record<string, unknown> | null }
        if (settingsResponse.settings) {
          const s = settingsResponse.settings
          if (typeof s.fringe_rate === 'number') setFringeRate(s.fringe_rate * 100)
          if (typeof s.overhead_rate === 'number') setOverheadRate(s.overhead_rate * 100)
          if (typeof s.ga_rate === 'number') setGaRate(s.ga_rate * 100)
          if (typeof s.billable_hours === 'number') setBillableHoursPerYear(s.billable_hours)
        }
      } catch {
        // Fallback to context values
        if (indirectRates) {
          setFringeRate(indirectRates.fringe * 100)
          setOverheadRate(indirectRates.overhead * 100)
          setGaRate(indirectRates.ga * 100)
        }
        if (companyPolicy?.targetBillableHours) {
          setBillableHoursPerYear(companyPolicy.targetBillableHours)
        }
      } finally {
        setIsLoadingPage(false)
      }
    }
    loadSettings()
  }, [indirectRates, companyPolicy])

  // Load roles on mount (separate from settings)
  useEffect(() => {
    async function loadRoles() {
      setIsLoadingRoles(true)
      setRolesError(null)
      try {
        const rolesResponse = await rolesApi.list() as { roles: CompanyRoleFromAPI[] }
        console.log('[SubRateCalculator] rolesApi.list() response:', rolesResponse)
        if (rolesResponse.roles && rolesResponse.roles.length > 0) {
          const transformedRoles = rolesResponse.roles.map(transformRole)
          console.log('[SubRateCalculator] transformed roles:', transformedRoles)
          setCompanyRoles(transformedRoles)
        } else {
          console.log('[SubRateCalculator] No roles returned or empty array')
        }
      } catch (err) {
        console.error('[SubRateCalculator] Error loading roles:', err)
        setRolesError('Could not load roles — enter manually')
      } finally {
        setIsLoadingRoles(false)
      }
    }
    loadRoles()
  }, [])

  // Handle role selection
  const handleRoleSelect = (roleId: string) => {
    setSelectedRoleId(roleId)
    const role = companyRoles.find(r => r.id === roleId)
    if (role) {
      setRoleName(role.title)
      const salary = getRoleSalary(role)
      if (salary !== null) {
        setBaseSalary(salary)
      }
    }
  }

  // Calculate hours from FTE
  const effectiveHours = useMemo(() => {
    if (hoursMode === 'hours') {
      return typeof hoursInput === 'number' ? hoursInput : 0
    }
    return typeof fteInput === 'number' ? fteInput * billableHoursPerYear : 0
  }, [hoursMode, hoursInput, fteInput, billableHoursPerYear])

  // Main calculation
  const calculation = useMemo(() => {
    const rate = typeof billRate === 'number' ? billRate : 0
    const hours = effectiveHours
    const salary = typeof baseSalary === 'number' ? baseSalary : 0
    const fringe = typeof fringeRate === 'number' ? fringeRate / 100 : 0
    const overhead = typeof overheadRate === 'number' ? overheadRate / 100 : 0
    const ga = typeof gaRate === 'number' ? gaRate / 100 : 0

    if (rate <= 0 || hours <= 0 || salary <= 0) {
      return null
    }

    // Gross revenue
    const grossRevenue = rate * hours

    // Loaded cost calculation
    const baseSalaryCost = (salary / billableHoursPerYear) * hours
    const fringeAmount = baseSalaryCost * fringe
    const overheadAmount = (baseSalaryCost + fringeAmount) * overhead
    const gaAmount = (baseSalaryCost + fringeAmount + overheadAmount) * ga
    const totalLoadedCost = baseSalaryCost + fringeAmount + overheadAmount + gaAmount

    // Profit & margin
    const profit = grossRevenue - totalLoadedCost
    const marginPercent = grossRevenue > 0 ? (profit / grossRevenue) * 100 : 0

    // Minimum viable rate
    const targetMarginDecimal = targetMargin / 100
    const minimumViableRate = hours > 0 ? (totalLoadedCost / hours) / (1 - targetMarginDecimal) : 0
    const rateGap = minimumViableRate - rate

    return {
      grossRevenue,
      baseSalaryCost,
      fringeAmount,
      fringeRate: fringe,
      overheadAmount,
      overheadRate: overhead,
      gaAmount,
      gaRate: ga,
      totalLoadedCost,
      profit,
      marginPercent,
      minimumViableRate,
      rateGap,
      targetProfit: grossRevenue * targetMarginDecimal,
    }
  }, [billRate, effectiveHours, baseSalary, fringeRate, overheadRate, gaRate, targetMargin, billableHoursPerYear])

  // Determine verdict
  const verdict = useMemo(() => {
    if (!calculation) return null
    if (calculation.marginPercent >= targetMargin) {
      return { status: 'good', label: 'Acceptable offer', color: 'bg-green-50 border-green-200 text-green-800' }
    }
    if (calculation.marginPercent >= 5) {
      return { status: 'warning', label: 'Below target margin', color: 'bg-amber-50 border-amber-200 text-amber-800' }
    }
    return { status: 'bad', label: 'Do not accept', color: 'bg-red-50 border-red-200 text-red-800' }
  }, [calculation, targetMargin])

  // Copy negotiation rate
  const handleCopyRate = () => {
    if (calculation) {
      navigator.clipboard.writeText(calculation.minimumViableRate.toFixed(2))
      toast.success('Negotiation rate copied to clipboard')
    }
  }

  if (isLoadingPage) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Sub Rate Calculator</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Evaluate a prime&apos;s offer against your indirect costs
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Inputs */}
        <div className="space-y-4">
          {/* Prime's Offer Card */}
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Prime&apos;s Offer</h3>

            {/* Role Name / Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="role-name">Role</Label>
              {rolesError && (
                <ErrorAlert variant="inline" message={rolesError} />
              )}
              {isLoadingRoles ? (
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading roles...</span>
                </div>
              ) : companyRoles.length > 0 && !rolesError ? (
                <Select value={selectedRoleId || ''} onValueChange={handleRoleSelect}>
                  <SelectTrigger id="role-name">
                    <SelectValue placeholder="Select a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companyRoles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="role-name"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g., Senior Developer"
                />
              )}
            </div>

            {/* Bill Rate */}
            <div className="space-y-2">
              <Label htmlFor="bill-rate">Bill Rate ($/hr)</Label>
              <Input
                id="bill-rate"
                type="number"
                value={billRate}
                onChange={(e) => setBillRate(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="150.00"
                step="0.01"
              />
            </div>

            {/* Hours / FTE Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Hours Offered</Label>
                <div className="flex border rounded-md overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      hoursMode === 'hours'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setHoursMode('hours')}
                  >
                    Hours
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      hoursMode === 'fte'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setHoursMode('fte')}
                  >
                    FTE
                  </button>
                </div>
              </div>
              {hoursMode === 'hours' ? (
                <Input
                  type="number"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value ? parseFloat(e.target.value) : '')}
                  placeholder="1920"
                />
              ) : (
                <div className="space-y-1">
                  <Input
                    type="number"
                    value={fteInput}
                    onChange={(e) => setFteInput(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="1.0"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground">
                    = {effectiveHours.toLocaleString()} hours
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Cost Structure Card */}
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Your Cost Structure</h3>

            {/* Base Salary */}
            <div className="space-y-2">
              <Label htmlFor="base-salary">Base Salary ($/yr)</Label>
              <Input
                id="base-salary"
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="100000"
              />
            </div>

            {/* Fringe Rate */}
            <div className="space-y-2">
              <Label htmlFor="fringe-rate">Fringe Rate (%)</Label>
              <Input
                id="fringe-rate"
                type="number"
                value={fringeRate}
                onChange={(e) => setFringeRate(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="21.16"
                step="0.01"
              />
            </div>

            {/* Overhead Rate */}
            <div className="space-y-2">
              <Label htmlFor="overhead-rate">Overhead Rate (%)</Label>
              <Input
                id="overhead-rate"
                type="number"
                value={overheadRate}
                onChange={(e) => setOverheadRate(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="34.26"
                step="0.01"
              />
            </div>

            {/* G&A Rate */}
            <div className="space-y-2">
              <Label htmlFor="ga-rate">G&A Rate (%)</Label>
              <Input
                id="ga-rate"
                type="number"
                value={gaRate}
                onChange={(e) => setGaRate(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="19.83"
                step="0.01"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Rates loaded from Account &rarr; Company Settings
            </p>
            <Link
              href="/account?tab=rates"
              className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              Update rates <ExternalLink className="w-3 h-3" />
            </Link>
          </Card>

          {/* Target Card */}
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Target</h3>
            <div className="space-y-2">
              <Label htmlFor="target-margin">Target Margin (%)</Label>
              <div className="flex items-center gap-4">
                <input
                  id="target-margin"
                  type="range"
                  min="0"
                  max="40"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                />
                <span className="text-sm font-medium w-12 text-right">{targetMargin}%</span>
              </div>
              {calculation && (
                <p className="text-xs text-muted-foreground">
                  Target profit: {formatCurrency(calculation.targetProfit)}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-4">
          {/* Verdict Card */}
          {calculation && verdict && (
            <Card className={`p-4 border ${verdict.color}`}>
              <div className="flex items-center gap-2 mb-2">
                {verdict.status === 'good' && <Check className="w-5 h-5 text-green-600" />}
                {verdict.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {verdict.status === 'bad' && <X className="w-5 h-5 text-red-600" />}
                <span className="font-semibold">{verdict.label}</span>
              </div>
              <div className="text-3xl font-bold mb-1">
                {calculation.marginPercent.toFixed(1)}%
              </div>
              <div className="text-sm opacity-80">
                {formatCurrency(calculation.profit)} profit
              </div>
            </Card>
          )}

          {/* Breakdown Table */}
          {calculation && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-muted-foreground">Prime&apos;s offer</span>
                  <span className="text-right">
                    <span className="text-xs text-muted-foreground mr-2">
                      {formatCurrency(typeof billRate === 'number' ? billRate : 0)}/hr &times; {effectiveHours.toLocaleString()}
                    </span>
                    <span className="font-medium">{formatCurrency(calculation.grossRevenue)}</span>
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Base salary cost</span>
                  <span className="font-medium">{formatCurrency(calculation.baseSalaryCost)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">+ Fringe ({(calculation.fringeRate * 100).toFixed(1)}%)</span>
                  <span className="font-medium">{formatCurrency(calculation.fringeAmount)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">+ Overhead ({(calculation.overheadRate * 100).toFixed(1)}%)</span>
                  <span className="font-medium">{formatCurrency(calculation.overheadAmount)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">+ G&A ({(calculation.gaRate * 100).toFixed(1)}%)</span>
                  <span className="font-medium">{formatCurrency(calculation.gaAmount)}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-gray-200 font-medium">
                  <span>Total loaded cost</span>
                  <span>{formatCurrency(calculation.totalLoadedCost)}</span>
                </div>
                <div className={`flex justify-between py-2 border-t border-gray-200 font-semibold ${
                  calculation.profit >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  <span>Profit</span>
                  <span>{formatCurrency(calculation.profit)}</span>
                </div>
                <div className={`flex justify-between py-2 font-semibold ${
                  calculation.profit >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  <span>Margin</span>
                  <span>{calculation.marginPercent.toFixed(1)}%</span>
                </div>
              </div>
            </Card>
          )}

          {/* Negotiation Guidance Card */}
          {calculation && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Negotiation Guidance</h3>
              {calculation.marginPercent < targetMargin ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    To hit your {targetMargin}% target, negotiate the bill rate to:
                  </p>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(calculation.minimumViableRate)}/hr
                  </div>
                  <p className="text-sm text-muted-foreground">
                    That&apos;s{' '}
                    <span className="font-medium text-amber-700">
                      {formatCurrency(calculation.rateGap)}/hr more
                    </span>{' '}
                    than the current offer
                  </p>
                  <Button variant="outline" size="sm" onClick={handleCopyRate}>
                    <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
                    Copy negotiation rate
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-green-700">
                    You have {(calculation.marginPercent - targetMargin).toFixed(1)}% headroom above your target.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You could accept as low as{' '}
                    <span className="font-medium">{formatCurrency(calculation.minimumViableRate)}/hr</span>{' '}
                    and still hit {targetMargin}%.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Scenario Comparison (Collapsible) */}
          {calculation && (
            <Collapsible open={showScenarios} onOpenChange={setShowScenarios}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  Compare scenarios
                  <ChevronDown className={`w-4 h-4 transition-transform ${showScenarios ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="p-4 mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-muted-foreground">Scenario</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-2">Current offer</td>
                        <td className="text-right font-medium">{formatCurrency(typeof billRate === 'number' ? billRate : 0)}/hr</td>
                        <td className={`text-right font-medium ${calculation.marginPercent >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {calculation.marginPercent.toFixed(1)}%
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2">Minimum viable</td>
                        <td className="text-right font-medium">{formatCurrency(calculation.minimumViableRate)}/hr</td>
                        <td className="text-right font-medium text-green-700">{targetMargin.toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="py-2">10% above minimum</td>
                        <td className="text-right font-medium">{formatCurrency(calculation.minimumViableRate * 1.1)}/hr</td>
                        <td className="text-right font-medium text-green-700">
                          {(() => {
                            const rate110 = calculation.minimumViableRate * 1.1
                            const revenue110 = rate110 * effectiveHours
                            const profit110 = revenue110 - calculation.totalLoadedCost
                            const margin110 = revenue110 > 0 ? (profit110 / revenue110) * 100 : 0
                            return margin110.toFixed(1)
                          })()}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* No calculation yet */}
          {!calculation && (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Enter the offer details to see your margin analysis
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
