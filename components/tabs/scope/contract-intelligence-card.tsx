'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { proposalsApi } from '@/lib/api'
import { computePeriods } from '@/lib/types/contract-intelligence'
import type {
  ContractIntelligence,
  Confidence,
  Discipline,
  RateSource,
  ExtractedRole,
} from '@/lib/types/contract-intelligence'
import { Trash2, Plus, Info } from 'lucide-react'

// ==================== TYPES ====================

interface ContractIntelligenceCardProps {
  intelligence: ContractIntelligence
  proposalId: string
  onConfirmed: (updated: ContractIntelligence) => void
}

// ==================== CONFIDENCE PILL ====================

function ConfidencePill({ confidence }: { confidence: Confidence }) {
  if (confidence === 'high') return null

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
        confidence === 'medium'
          ? 'bg-amber-50 text-amber-600'
          : 'bg-red-50 text-red-600'
      }`}
    >
      {confidence} confidence
    </span>
  )
}

// ==================== SECTION LABEL ====================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        color: '#C4C3BE',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  )
}

// ==================== FIELD LABEL ====================

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
      {children}
    </label>
  )
}

// ==================== MAIN COMPONENT ====================

export function ContractIntelligenceCard({
  intelligence,
  proposalId,
  onConfirmed,
}: ContractIntelligenceCardProps) {
  const [data, setData] = useState<ContractIntelligence>(intelligence)
  const [isSaving, setIsSaving] = useState(false)

  // ==================== HANDLERS ====================

  const updateField = <K extends keyof ContractIntelligence>(
    field: K,
    value: ContractIntelligence[K]
  ) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  const updateDocumentType = (
    value: ContractIntelligence['documentType']['value']
  ) => {
    setData((prev) => ({
      ...prev,
      documentType: { ...prev.documentType, value },
    }))
  }

  const updateVehicle = (value: string) => {
    setData((prev) => ({
      ...prev,
      vehicle: { ...prev.vehicle, value: value || null },
    }))
  }

  const updateContractType = (
    value: ContractIntelligence['contractType']['value']
  ) => {
    setData((prev) => ({
      ...prev,
      contractType: { ...prev.contractType, value },
    }))
  }

  const updateSetAside = (value: ContractIntelligence['setAside']['value']) => {
    setData((prev) => ({
      ...prev,
      setAside: { ...prev.setAside, value },
    }))
  }

  const updateRateSource = (value: RateSource) => {
    setData((prev) => ({
      ...prev,
      rateSource: { ...prev.rateSource, value },
    }))
  }

  const updatePeriodMonths = (index: number, months: number) => {
    // Recalculate all periods from base data
    const basePeriodMonths = index === 0 ? months : data.periods[0]?.months || 12
    const optionPeriodMonths = data.periods.slice(1).map((p, i) =>
      i === index - 1 ? months : p.months
    )
    if (index === 0) {
      // If updating base period, keep options as-is
      const newPeriods = computePeriods(months, data.periods.slice(1).map((p) => p.months))
      updateField('periods', newPeriods)
    } else {
      const newOptionMonths = [...optionPeriodMonths]
      newOptionMonths[index - 1] = months
      const newPeriods = computePeriods(basePeriodMonths, newOptionMonths)
      updateField('periods', newPeriods)
    }
  }

  const addOptionPeriod = () => {
    const basePeriodMonths = data.periods[0]?.months || 12
    const optionPeriodMonths = data.periods.slice(1).map((p) => p.months)
    const newPeriods = computePeriods(basePeriodMonths, [...optionPeriodMonths, 12])
    updateField('periods', newPeriods)
  }

  const removePeriod = (index: number) => {
    if (index === 0) return // Can't remove base period
    const basePeriodMonths = data.periods[0]?.months || 12
    const optionPeriodMonths = data.periods.slice(1).map((p) => p.months)
    optionPeriodMonths.splice(index - 1, 1)
    const newPeriods = computePeriods(basePeriodMonths, optionPeriodMonths)
    updateField('periods', newPeriods)
  }

  const toggleDiscipline = (discipline: Discipline) => {
    const current = data.disciplines?.required || []
    const updated = current.includes(discipline)
      ? current.filter((d) => d !== discipline)
      : [...current, discipline]
    setData((prev) => ({
      ...prev,
      disciplines: { ...prev.disciplines, required: updated },
    }))
  }

  const updateRole = (index: number, updates: Partial<ExtractedRole>) => {
    const newRoles = [...data.roles]
    newRoles[index] = { ...newRoles[index], ...updates }

    // Auto-calculate utilization if hours changed
    if (updates.hoursPerMonth !== undefined) {
      const hours = updates.hoursPerMonth || 0
      newRoles[index].utilizationPct = hours > 0 ? Number((hours / 160).toFixed(2)) : null
    }

    updateField('roles', newRoles)
  }

  const addRole = () => {
    const newRole: ExtractedRole = {
      title: 'New Role',
      laborCategory: null,
      hoursPerMonth: 160,
      utilizationPct: 1.0,
      appearsInPeriods: data.periods.map((p) => p.name),
      confidence: 'low',
      sourceText: '',
    }
    updateField('roles', [...data.roles, newRole])
  }

  const removeRole = (index: number) => {
    const newRoles = data.roles.filter((_, i) => i !== index)
    updateField('roles', newRoles)
  }

  const handleConfirm = async () => {
    setIsSaving(true)
    try {
      const confirmed: ContractIntelligence = {
        ...data,
        confirmed: true,
        confirmedAt: new Date().toISOString(),
      }

      // Get existing working_data and merge
      const response = (await proposalsApi.get(proposalId)) as {
        proposal: { workingData?: Record<string, unknown> }
      }
      const existingWorkingData = response.proposal?.workingData || {}

      await proposalsApi.update(proposalId, {
        working_data: {
          ...existingWorkingData,
          contractIntelligence: confirmed,
        },
      })

      setData(confirmed)
      onConfirmed(confirmed)
      toast.success('Contract structure confirmed. You can now generate the WBS.')
    } catch (error) {
      console.error('Failed to save contract intelligence:', error)
      toast.error('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ==================== RENDER ====================

  const allDisciplines: Discipline[] = [
    'engineering',
    'design',
    'research',
    'product',
    'delivery',
    'program-management',
    'content',
    'accessibility',
  ]

  const disciplineLabels: Record<Discipline, string> = {
    engineering: 'Engineering',
    design: 'Design',
    research: 'Research',
    product: 'Product',
    delivery: 'Delivery',
    'program-management': 'Program Management',
    content: 'Content',
    accessibility: 'Accessibility',
  }

  return (
    <Card className="p-0 mt-4">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E8E7E2] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Contract Intelligence
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Review and confirm before generating WBS
          </p>
        </div>
        {data.confirmed ? (
          <Badge className="bg-green-50 text-green-700 border-green-200">
            Confirmed
          </Badge>
        ) : (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200">
            Needs review
          </Badge>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-6">
        {/* Section 1: Contract Type Fields (2x2 grid) */}
        <div>
          <SectionLabel>Contract Details</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            {/* Document Type */}
            <div className="flex flex-col gap-1">
              <FieldLabel>Document Type</FieldLabel>
              <select
                value={data.documentType?.value || 'unknown'}
                onChange={(e) =>
                  updateDocumentType(
                    e.target.value as ContractIntelligence['documentType']['value']
                  )
                }
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                <option value="RFP">RFP</option>
                <option value="RFQ">RFQ</option>
                <option value="SOO">SOO</option>
                <option value="PWS">PWS</option>
                <option value="SOW">SOW</option>
                <option value="task_order">Task Order</option>
                <option value="unknown">Unknown</option>
              </select>
              <ConfidencePill confidence={data.documentType?.confidence || 'low'} />
            </div>

            {/* Contract Vehicle */}
            <div className="flex flex-col gap-1">
              <FieldLabel>Contract Vehicle</FieldLabel>
              <input
                type="text"
                value={data.vehicle?.value || ''}
                onChange={(e) => updateVehicle(e.target.value)}
                placeholder="e.g. GSA MAS, Direct"
                className="text-sm border border-gray-200 rounded px-2 py-1.5"
              />
              <ConfidencePill confidence={data.vehicle?.confidence || 'low'} />
            </div>

            {/* Contract Type */}
            <div className="flex flex-col gap-1">
              <FieldLabel>Contract Type</FieldLabel>
              <select
                value={data.contractType?.value || 'unknown'}
                onChange={(e) =>
                  updateContractType(
                    e.target.value as ContractIntelligence['contractType']['value']
                  )
                }
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                <option value="FFP">FFP</option>
                <option value="T&M">T&M</option>
                <option value="IDIQ">IDIQ</option>
                <option value="BPA">BPA</option>
                <option value="CPFF">CPFF</option>
                <option value="unknown">Unknown</option>
              </select>
              <ConfidencePill confidence={data.contractType?.confidence || 'low'} />
            </div>

            {/* Set-Aside */}
            <div className="flex flex-col gap-1">
              <FieldLabel>Set-Aside</FieldLabel>
              <select
                value={data.setAside?.value || 'unknown'}
                onChange={(e) =>
                  updateSetAside(
                    e.target.value as ContractIntelligence['setAside']['value']
                  )
                }
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                <option value="8(a)">8(a)</option>
                <option value="WOSB">WOSB</option>
                <option value="SDVOSB">SDVOSB</option>
                <option value="small_business">Small Business</option>
                <option value="none">None</option>
                <option value="unknown">Unknown</option>
              </select>
              <ConfidencePill confidence={data.setAside?.confidence || 'low'} />
            </div>
          </div>

          {/* Rate Source Toggle */}
          <div className="mt-4">
            <FieldLabel>Rate Source</FieldLabel>
            <div className="flex rounded border border-gray-200 overflow-hidden text-xs mt-1">
              {(['internal', 'gsa_mas', 'sub'] as RateSource[]).map((source) => (
                <button
                  key={source}
                  onClick={() => updateRateSource(source)}
                  className={`flex-1 py-1.5 px-3 font-medium transition-colors ${
                    data.rateSource?.value === source
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {source === 'internal'
                    ? 'Internal'
                    : source === 'gsa_mas'
                    ? 'GSA MAS'
                    : 'Sub Rates'}
                </button>
              ))}
            </div>
            <ConfidencePill confidence={data.rateSource?.confidence || 'low'} />
          </div>
        </div>

        {/* Section 2: Period Structure */}
        <div>
          <SectionLabel>Period Structure</SectionLabel>
          <div className="border border-gray-200 rounded overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_80px_100px_100px_40px] bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="px-3 py-2">Period</div>
              <div className="px-3 py-2 text-center">Months</div>
              <div className="px-3 py-2 text-center">Cumulative</div>
              <div className="px-3 py-2 text-center">GSA Year</div>
              <div className="px-3 py-2" />
            </div>

            {/* Table Rows */}
            {data.periods?.map((period, index) => (
              <div
                key={period.name}
                className="grid grid-cols-[1fr_80px_100px_100px_40px] border-b border-gray-100 last:border-b-0"
              >
                <div className="px-3 py-2 text-sm text-gray-900">{period.name}</div>
                <div className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={period.months}
                    onChange={(e) =>
                      updatePeriodMonths(index, parseInt(e.target.value) || 1)
                    }
                    className="w-full text-sm text-center border border-gray-200 rounded px-1 py-0.5"
                  />
                </div>
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  {period.cumulativeMonthsEnd} mo
                </div>
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  Year {period.gsaRateYear}
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  {index > 0 && (
                    <button
                      onClick={() => removePeriod(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addOptionPeriod}
            className="mt-2 text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Option Period
          </button>
        </div>

        {/* Section 3: Disciplines */}
        <div>
          <SectionLabel>Disciplines</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {allDisciplines.map((discipline) => {
              const isActive = data.disciplines?.required?.includes(discipline)
              return (
                <button
                  key={discipline}
                  onClick={() => toggleDiscipline(discipline)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {disciplineLabels[discipline]}
                </button>
              )
            })}
          </div>
          {data.disciplines?.confidence !== 'high' && data.disciplines?.sourceText && (
            <div className="mt-3 rounded bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Extracted from:</strong> &ldquo;{data.disciplines.sourceText}&rdquo;
              </span>
            </div>
          )}
        </div>

        {/* Section 4: Roles */}
        <div>
          <SectionLabel>Roles</SectionLabel>
          {data.roles?.length === 0 ? (
            <div className="text-sm text-gray-400 italic">No roles extracted</div>
          ) : (
            <div className="border border-gray-200 rounded overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_80px_80px_40px] bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="px-3 py-2">Role Title</div>
                <div className="px-3 py-2 text-center">Hours/Mo</div>
                <div className="px-3 py-2 text-center">Util %</div>
                <div className="px-3 py-2" />
              </div>

              {/* Table Rows */}
              {data.roles?.map((role, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_80px_80px_40px] border-b border-gray-100 last:border-b-0"
                >
                  <div className="px-3 py-2">
                    <input
                      type="text"
                      value={role.title}
                      onChange={(e) => updateRole(index, { title: e.target.value })}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-0.5"
                    />
                    {role.confidence !== 'high' && (
                      <div className="mt-1">
                        <ConfidencePill confidence={role.confidence} />
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={role.hoursPerMonth || ''}
                      onChange={(e) =>
                        updateRole(index, {
                          hoursPerMonth: parseInt(e.target.value) || null,
                        })
                      }
                      className="w-full text-sm text-center border border-gray-200 rounded px-1 py-0.5"
                    />
                  </div>
                  <div className="px-3 py-2 text-sm text-gray-500 text-center">
                    {role.utilizationPct
                      ? `${Math.round(role.utilizationPct * 100)}%`
                      : '-'}
                  </div>
                  <div className="px-3 py-2 flex items-center justify-center">
                    <button
                      onClick={() => removeRole(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={addRole}
            className="mt-2 text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Role
          </button>
        </div>
      </div>

      {/* Footer with Confirm Button */}
      <div className="px-6 py-4 border-t border-[#E8E7E2]">
        <Button
          onClick={handleConfirm}
          disabled={isSaving || data.confirmed}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50"
        >
          {isSaving
            ? 'Saving...'
            : data.confirmed
            ? 'Confirmed'
            : 'Confirm Contract Intelligence'}
        </Button>
      </div>
    </Card>
  )
}

export default ContractIntelligenceCard
