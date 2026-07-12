'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { computePeriods } from '@/lib/types/contract-intelligence'
import type {
  ContractIntelligence,
  Confidence,
  Discipline,
  RateSource,
  ExtractedRole,
  ContractPeriod,
  StaffingModel,
} from '@/lib/types/contract-intelligence'
import { Trash2, Plus, Info, Edit2, Save } from 'lucide-react'

// ==================== TYPES ====================

interface IntelligenceVersion {
  id: string
  versionNumber: number
  status: 'draft' | 'confirmed' | 'superseded'
  confirmationHash: string | null
  rowVersion: number
}

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [version, setVersion] = useState<IntelligenceVersion | null>(null)

  // Load versioned intelligence on mount
  useEffect(() => {
    async function loadVersion() {
      try {
        const response = await fetch(`/api/proposals/${proposalId}/intelligence`)
        if (response.ok) {
          const result = await response.json()
          if (result.version) {
            setVersion({
              id: result.version.id,
              versionNumber: result.version.versionNumber,
              status: result.version.status,
              confirmationHash: result.version.confirmationHash,
              rowVersion: result.version.rowVersion,
            })

            // Load data from versioned tables if available
            if (result.factsJson || result.periods || result.disciplines || result.laborRequirements) {
              const loadedData: ContractIntelligence = {
                documentType: result.factsJson?.documentType || data.documentType,
                vehicle: result.factsJson?.vehicle || data.vehicle,
                contractType: result.factsJson?.contractType || data.contractType,
                setAside: result.factsJson?.setAside || data.setAside,
                rateSource: result.factsJson?.rateSource || data.rateSource,
                periods: result.periods?.map((p: { name: string; months: number; cumulativeMonthsEnd: number; gsaRateYear: 1 | 2 | 3 | 4 | 5 }) => ({
                  name: p.name,
                  months: p.months,
                  cumulativeMonthsEnd: p.cumulativeMonthsEnd,
                  gsaRateYear: p.gsaRateYear,
                })) || data.periods,
                disciplines: {
                  required: result.disciplines?.map((d: { discipline: Discipline }) => d.discipline) || data.disciplines?.required || [],
                  confidence: result.disciplines?.[0]?.confidence || data.disciplines?.confidence || 'medium',
                  sourceText: result.disciplines?.[0]?.sourceText || data.disciplines?.sourceText || '',
                },
                roles: result.laborRequirements?.map((l: {
                  title: string
                  laborCategory: string | null
                  hoursPerMonth: number | null
                  utilizationPct: number | null
                  appearsInPeriods: string[]
                  confidence: Confidence
                  sourceText: string | null
                }) => ({
                  title: l.title,
                  laborCategory: l.laborCategory,
                  hoursPerMonth: l.hoursPerMonth,
                  utilizationPct: l.utilizationPct,
                  appearsInPeriods: l.appearsInPeriods || [],
                  confidence: l.confidence,
                  sourceText: l.sourceText || '',
                })) || data.roles,
                // Phase 4B: Load staffing model from version
                staffingModel: result.version.staffingModel || data.staffingModel || 'unclear',
                confirmed: result.version.status === 'confirmed',
                confirmedAt: result.version.confirmedAt,
                extractedAt: result.version.extractedAt || data.extractedAt,
              }
              setData(loadedData)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load intelligence version:', error)
      }
    }
    loadVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId])

  // Track unsaved changes
  const markUnsaved = useCallback(() => {
    if (version?.status === 'draft') {
      setHasUnsavedChanges(true)
    }
  }, [version?.status])

  // ==================== HANDLERS ====================

  const updateField = <K extends keyof ContractIntelligence>(
    field: K,
    value: ContractIntelligence[K]
  ) => {
    setData((prev) => ({ ...prev, [field]: value }))
    markUnsaved()
  }

  const updateDocumentType = (
    value: ContractIntelligence['documentType']['value']
  ) => {
    setData((prev) => ({
      ...prev,
      documentType: { ...prev.documentType, value },
    }))
    markUnsaved()
  }

  const updateVehicle = (value: string) => {
    setData((prev) => ({
      ...prev,
      vehicle: { ...prev.vehicle, value: value || null },
    }))
    markUnsaved()
  }

  const updateContractType = (
    value: ContractIntelligence['contractType']['value']
  ) => {
    setData((prev) => ({
      ...prev,
      contractType: { ...prev.contractType, value },
    }))
    markUnsaved()
  }

  const updateSetAside = (value: ContractIntelligence['setAside']['value']) => {
    setData((prev) => ({
      ...prev,
      setAside: { ...prev.setAside, value },
    }))
    markUnsaved()
  }

  const updateRateSource = (value: RateSource) => {
    setData((prev) => ({
      ...prev,
      rateSource: { ...prev.rateSource, value },
    }))
    markUnsaved()
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
    markUnsaved()
  }

  const updateRole = (index: number, updates: Partial<ExtractedRole>) => {
    const newRoles = [...data.roles]
    newRoles[index] = { ...newRoles[index], ...updates }
    // Note: No auto-calculation - hours and utilization are independently editable
    updateField('roles', newRoles)
  }

  const updateStaffingModel = (model: StaffingModel) => {
    setData((prev) => ({ ...prev, staffingModel: model }))
    markUnsaved()
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

  // Save draft changes to versioned tables
  const handleSaveDraft = async () => {
    if (!version?.id || version.status !== 'draft') return

    setIsSaving(true)
    try {
      // Build PATCH payload
      const factsJson = {
        documentType: data.documentType,
        vehicle: data.vehicle,
        contractType: data.contractType,
        setAside: data.setAside,
        rateSource: data.rateSource,
      }

      const periods = data.periods.map((p: ContractPeriod, idx: number) => ({
        name: p.name,
        months: p.months,
        cumulativeMonthsEnd: p.cumulativeMonthsEnd,
        gsaRateYear: p.gsaRateYear,
        sortOrder: idx,
      }))

      const disciplines = (data.disciplines?.required || []).map((d: Discipline) => ({
        discipline: d,
        confidence: data.disciplines?.confidence || 'medium',
        sourceText: data.disciplines?.sourceText,
      }))

      const laborRequirements = data.roles.map((r: ExtractedRole) => ({
        title: r.title,
        laborCategory: r.laborCategory || undefined,
        hoursPerMonth: r.hoursPerMonth || undefined,
        utilizationPct: r.utilizationPct || undefined,
        appearsInPeriods: r.appearsInPeriods,
        confidence: r.confidence,
        sourceText: r.sourceText,
      }))

      const response = await fetch(`/api/proposals/${proposalId}/intelligence`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: version.id,
          expectedVersion: version.rowVersion,
          factsJson,
          contractType: data.contractType?.value,
          staffingModel: data.staffingModel, // Phase 4B: Include staffing model
          periods,
          disciplines,
          laborRequirements,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setVersion((prev) => prev ? { ...prev, rowVersion: result.version.rowVersion } : prev)
        setHasUnsavedChanges(false)
        toast.success('Changes saved')
      } else {
        const errorData = await response.json()
        if (errorData.code === 'STALE_VERSION') {
          toast.error('Someone else edited this. Please refresh and try again.')
        } else {
          toast.error(errorData.error || 'Failed to save changes')
        }
      }
    } catch (error) {
      console.error('Failed to save draft:', error)
      toast.error('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirm = async () => {
    // If there are unsaved changes, save them first
    if (hasUnsavedChanges && version?.id && version.status === 'draft') {
      await handleSaveDraft()
    }

    setIsSaving(true)
    try {
      // Confirm via versioned API
      if (version?.id && version.status === 'draft') {
        const confirmResponse = await fetch(`/api/proposals/${proposalId}/intelligence/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId: version.id }),
        })
        if (confirmResponse.ok) {
          const confirmResult = await confirmResponse.json()
          setVersion({
            id: confirmResult.version.id,
            versionNumber: version.versionNumber,
            status: 'confirmed',
            confirmationHash: confirmResult.version.confirmationHash,
            rowVersion: confirmResult.version.rowVersion,
          })

          const confirmed: ContractIntelligence = {
            ...data,
            confirmed: true,
            confirmedAt: confirmResult.version.confirmedAt,
          }
          setData(confirmed)
          onConfirmed(confirmed)
          toast.success('Contract structure confirmed. You can now generate the WBS.')
        } else {
          const errorData = await confirmResponse.json()
          toast.error(errorData.error || 'Failed to confirm')
        }
      }
    } catch (error) {
      console.error('Failed to confirm contract intelligence:', error)
      toast.error('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSupersede = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/proposals/${proposalId}/intelligence/supersede`, {
        method: 'POST',
      })
      if (response.ok) {
        const result = await response.json()
        setVersion({
          id: result.newVersion.id,
          versionNumber: result.newVersion.versionNumber,
          status: 'draft',
          confirmationHash: null,
          rowVersion: 1,
        })
        // Reset local confirmed state to allow editing
        setData((prev) => ({ ...prev, confirmed: false, confirmedAt: null }))
        setHasUnsavedChanges(false)
        toast.success('Created new draft. You can now edit the intelligence.')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to create new draft')
      }
    } catch (error) {
      console.error('Failed to supersede:', error)
      toast.error('Failed to create new draft')
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

  const isDraft = version?.status === 'draft'
  const isConfirmed = data.confirmed || version?.status === 'confirmed'

  return (
    <Card className="p-0 mt-4">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E8E7E2] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Contract Intelligence
            {version && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                v{version.versionNumber}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isConfirmed
              ? 'Confirmed - ready for WBS generation'
              : 'Review and confirm before generating WBS'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <>
              <Badge className="bg-green-50 text-green-700 border-green-200">
                Confirmed
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSupersede}
                disabled={isSaving}
                className="text-xs"
              >
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
            </>
          ) : (
            <>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                {isDraft ? 'Draft' : 'Needs review'}
              </Badge>
              {hasUnsavedChanges && isDraft && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={isSaving}
                  className="text-xs"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
              )}
            </>
          )}
        </div>
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
                disabled={isConfirmed}
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white disabled:bg-gray-50 disabled:text-gray-500"
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
                disabled={isConfirmed}
                placeholder="e.g. GSA MAS, Direct"
                className="text-sm border border-gray-200 rounded px-2 py-1.5 disabled:bg-gray-50 disabled:text-gray-500"
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
                disabled={isConfirmed}
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white disabled:bg-gray-50 disabled:text-gray-500"
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
                disabled={isConfirmed}
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white disabled:bg-gray-50 disabled:text-gray-500"
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
                  disabled={isConfirmed}
                  className={`flex-1 py-1.5 px-3 font-medium transition-colors ${
                    data.rateSource?.value === source
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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

          {/* Staffing Model Selector (Phase 4B) */}
          <div className="mt-4">
            <FieldLabel>Staffing Model</FieldLabel>
            <div className="flex rounded border border-gray-200 overflow-hidden text-xs mt-1">
              {([
                { value: 'prescribed', label: 'Prescribed', description: 'RFP specifies exact roles' },
                { value: 'offeror_proposed', label: 'Offeror Proposed', description: 'We propose team' },
                { value: 'unclear', label: 'Unclear', description: 'Needs clarification' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateStaffingModel(option.value)}
                  disabled={isConfirmed}
                  title={option.description}
                  className={`flex-1 py-1.5 px-3 font-medium transition-colors ${
                    data.staffingModel === option.value
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {data.staffingModel === 'unclear' && !isConfirmed && (
              <div className="mt-2 text-xs text-amber-600">
                Staffing model must be resolved before confirming
              </div>
            )}
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
                    disabled={isConfirmed}
                    className="w-full text-sm text-center border border-gray-200 rounded px-1 py-0.5 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  {period.cumulativeMonthsEnd} mo
                </div>
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  Year {period.gsaRateYear}
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  {index > 0 && !isConfirmed && (
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
          {!isConfirmed && (
            <button
              onClick={addOptionPeriod}
              className="mt-2 text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Option Period
            </button>
          )}
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
                  disabled={isConfirmed}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                      disabled={isConfirmed}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-0.5 disabled:bg-gray-50 disabled:text-gray-500"
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
                      disabled={isConfirmed}
                      className="w-full text-sm text-center border border-gray-200 rounded px-1 py-0.5 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={role.utilizationPct ? Math.round(role.utilizationPct * 100) : ''}
                      onChange={(e) => {
                        const pct = parseInt(e.target.value)
                        updateRole(index, {
                          utilizationPct: isNaN(pct) ? null : pct / 100,
                        })
                      }}
                      disabled={isConfirmed}
                      placeholder="-"
                      className="w-full text-sm text-center border border-gray-200 rounded px-1 py-0.5 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div className="px-3 py-2 flex items-center justify-center">
                    {!isConfirmed && (
                      <button
                        onClick={() => removeRole(index)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isConfirmed && (
            <button
              onClick={addRole}
              className="mt-2 text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Role
            </button>
          )}
        </div>
      </div>

      {/* Footer with Confirm Button */}
      <div className="px-6 py-4 border-t border-[#E8E7E2]">
        <Button
          onClick={handleConfirm}
          disabled={isSaving || isConfirmed}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50"
        >
          {isSaving
            ? 'Saving...'
            : isConfirmed
            ? 'Confirmed'
            : 'Confirm Contract Intelligence'}
        </Button>
      </div>
    </Card>
  )
}

export default ContractIntelligenceCard
