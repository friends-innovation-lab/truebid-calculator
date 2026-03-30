'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAppContext, type Role } from '@/contexts/app-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/utils'
import { syncRolesFromWBS } from '@/lib/wbs-to-roles'
import {
  Users,
  Plus,
  X,
  Clock,
  LayoutGrid,
  Calendar,
  FileDown,
} from 'lucide-react'

// ==================== TYPES ====================

type ViewMode = 'pricing' | 'timeline'
type RoleFilter = 'all' | 'prime' | 'sub'

const YEAR_KEYS = ['base', 'option1', 'option2', 'option3', 'option4'] as const
const YEAR_LABELS = ['Base yr', 'OY1', 'OY2', 'OY3', 'OY4']
const YEAR_SHORT = ['BY', 'OY1', 'OY2', 'OY3', 'OY4']

// ==================== HELPERS ====================

function getActiveYears(role: Role): boolean[] {
  return [role.years.base, role.years.option1, role.years.option2, role.years.option3, role.years.option4]
}

function getHoursForYear(role: Role, yearIndex: number): number {
  const active = getActiveYears(role)
  if (!active[yearIndex]) return 0
  return role.billableHours || 1920
}

function getEscalatedRate(baseRate: number, yearIndex: number, escalation: number): number {
  return baseRate * Math.pow(1 + escalation, yearIndex)
}

function getRoleTotalCost(role: Role, billRate: number, escalation: number): number {
  let total = 0
  const active = getActiveYears(role)
  const hours = role.billableHours || 1920
  for (let i = 0; i < 5; i++) {
    if (!active[i]) continue
    const rate = getEscalatedRate(billRate, i, escalation)
    total += hours * rate * role.fte * role.quantity
  }
  return total
}

function getRoleTotalHours(role: Role): number {
  const active = getActiveYears(role)
  const hours = role.billableHours || 1920
  let total = 0
  for (let i = 0; i < 5; i++) {
    if (active[i]) total += hours * role.fte * role.quantity
  }
  return total
}

// ==================== MAIN COMPONENT ====================

export function RolesPricing() {
  const {
    selectedRoles,
    addRole,
    updateRole,
    removeRole,
    companyRoles,
    indirectRates,
    solicitation,
    uiProfitMargin,
    uiBillableHours,
    calculateLoadedRate,
    estimateWbsElements,
  } = useAppContext()

  // Compute WBS-derived role data for indicators
  const wbsRoleData = useMemo(() => {
    const wbs = estimateWbsElements as unknown as { tasks?: { role: string | null; hours: number }[]; laborEstimates?: { roleName: string; hoursByPeriod: { base: number; option1: number; option2: number; option3: number; option4: number } }[] }[]
    const synced = syncRolesFromWBS(wbs, [], null)
    const map = new Map<string, number>()
    synced.forEach(r => map.set(r.name, r.totalHoursFromWBS))
    return map
  }, [estimateWbsElements])

  const [viewMode, setViewMode] = useState<ViewMode>('pricing')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [escalation, setEscalation] = useState(
    solicitation.pricingSettings?.laborEscalation
      ? solicitation.pricingSettings.laborEscalation / 100
      : 0.03
  )
  const [editingEscalation, setEditingEscalation] = useState(false)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [detailRole, setDetailRole] = useState<Role | null>(null)
  const [editingCell, setEditingCell] = useState<{ roleId: string; yearIndex: number } | null>(null)
  const [cellValue, setCellValue] = useState('')

  // Calculate bill rates for each role
  const getRoleBillRate = useCallback((role: Role): number => {
    if (role.loadedRate) return role.loadedRate
    if (typeof calculateLoadedRate === 'function') {
      return calculateLoadedRate(role.baseSalary)
    }
    // Fallback calculation
    const hourly = role.baseSalary / 2080
    const fringe = hourly * (1 + (indirectRates.fringe || 0))
    const oh = fringe * (1 + (indirectRates.overhead || 0))
    const ga = oh * (1 + (indirectRates.ga || 0))
    return ga * (1 + (uiProfitMargin || 8) / 100)
  }, [calculateLoadedRate, indirectRates, uiProfitMargin])

  // Compute summary stats
  const stats = useMemo(() => {
    let primeCost = 0; const subCost = 0; let totalHours = 0
    selectedRoles.forEach(role => {
      const billRate = getRoleBillRate(role)
      const cost = getRoleTotalCost(role, billRate, escalation)
      const hours = getRoleTotalHours(role)
      // TODO: differentiate prime vs sub once role.type field exists
      primeCost += cost
      totalHours += hours
    })
    const odcs = solicitation.pricingSettings?.odcEscalation || 0
    return {
      totalValue: primeCost + subCost + odcs,
      primeCost,
      subCost,
      odcs,
      totalHours,
    }
  }, [selectedRoles, escalation, getRoleBillRate, solicitation.pricingSettings])

  // Filter roles
  const filteredRoles = useMemo(() => {
    // For now all roles are prime — sub filtering will work when type field is added
    return selectedRoles
  }, [selectedRoles])

  // Number of active option years from solicitation
  const activeYearCount = useMemo(() => {
    const pop = solicitation.periodOfPerformance
    return 1 + (pop?.optionYears || 2)
  }, [solicitation.periodOfPerformance])

  // Handle inline cell edit
  const handleCellClick = (roleId: string, yearIndex: number) => {
    const role = selectedRoles.find(r => r.id === roleId)
    if (!role) return
    const hours = getHoursForYear(role, yearIndex)
    setEditingCell({ roleId, yearIndex })
    setCellValue(hours > 0 ? String(hours) : '')
  }

  const handleCellSave = () => {
    if (!editingCell) return
    const hours = parseInt(cellValue) || 0
    const role = selectedRoles.find(r => r.id === editingCell.roleId)
    if (!role) return

    const yearKey = YEAR_KEYS[editingCell.yearIndex]
    const newYears = { ...role.years, [yearKey]: hours > 0 }
    updateRole(editingCell.roleId, {
      years: newYears,
      billableHours: hours > 0 ? hours : role.billableHours,
    })
    setEditingCell(null)
  }

  // Handle timeline block click (cycle: full → part → off)
  const handleTimelineClick = (roleId: string, yearIndex: number) => {
    const role = selectedRoles.find(r => r.id === roleId)
    if (!role) return

    const active = getActiveYears(role)
    const currentHours = active[yearIndex] ? (role.billableHours || 1920) : 0
    const yearKey = YEAR_KEYS[yearIndex]

    if (currentHours >= 1800) {
      // Full → Part (half time)
      updateRole(roleId, {
        years: { ...role.years, [yearKey]: true },
        billableHours: 960,
      })
    } else if (currentHours > 0) {
      // Part → Off
      updateRole(roleId, {
        years: { ...role.years, [yearKey]: false },
      })
    } else {
      // Off → Full
      updateRole(roleId, {
        years: { ...role.years, [yearKey]: true },
        billableHours: 1920,
      })
    }
  }

  // Add role from company library
  const handleAddFromLibrary = (companyRole: { id: string; title: string; salary_levels?: unknown }) => {
    addRole({
      id: `role-${crypto.randomUUID()}`,
      name: companyRole.title,
      description: '',
      icLevel: 'IC4',
      baseSalary: 120000,
      quantity: 1,
      fte: 1,
      storyPoints: 0,
      billableHours: uiBillableHours || 1920,
      years: {
        base: true,
        option1: (solicitation.periodOfPerformance?.optionYears || 0) >= 1,
        option2: (solicitation.periodOfPerformance?.optionYears || 0) >= 2,
        option3: false,
        option4: false,
      },
    })
    setShowAddPanel(false)
  }

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#FFFFFF' }}>
      {/* PAGE HEADER */}
      <div className="shrink-0" style={{ padding: '20px 24px 0', borderBottom: '0.5px solid #E8E7E2' }}>
        <div style={{ fontSize: 11, color: '#6B6A65', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 500 }}>
          Staff · Roles & Pricing
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111110', marginTop: 4 }}>
          Who does this work and what does it cost?
        </h1>

        {/* SUMMARY STRIP */}
        <div className="flex items-center gap-6" style={{ marginTop: 14, marginBottom: 14 }}>
          <SummaryItem label="Total contract value" value={formatCurrency(stats.totalValue, 0)} bold />
          <Divider />
          <SummaryItem label="Prime labor" value={formatCurrency(stats.primeCost, 0)} />
          <Divider />
          <SummaryItem label="Sub labor" value={formatCurrency(stats.subCost, 0)} color="#5F5E5A" />
          <Divider />
          <SummaryItem label="ODCs" value={formatCurrency(stats.odcs, 0)} color="#5F5E5A" />
          <Divider />
          <SummaryItem label="Total hours" value={stats.totalHours.toLocaleString()} />

          {/* VIEW TOGGLE */}
          <div className="ml-auto flex" style={{ background: '#F0EDE6', borderRadius: 5, padding: 2, gap: 1 }}>
            <ToggleSegment active={viewMode === 'pricing'} onClick={() => setViewMode('pricing')} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Pricing" />
            <ToggleSegment active={viewMode === 'timeline'} onClick={() => setViewMode('timeline')} icon={<Calendar className="w-3.5 h-3.5" />} label="Timeline" />
          </div>
        </div>

        {/* INNER TABS */}
        <div className="flex gap-0" style={{ marginBottom: -1 }}>
          <FilterTab label="All roles" count={selectedRoles.length} active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} />
          <FilterTab label="Prime only" count={selectedRoles.length} active={roleFilter === 'prime'} onClick={() => setRoleFilter('prime')} />
          <FilterTab label="Subs only" count={0} active={roleFilter === 'sub'} onClick={() => setRoleFilter('sub')} />
        </div>
      </div>

      {/* TOOLBAR */}
      <div
        className="shrink-0 flex items-center gap-2"
        style={{ background: '#FAFAF9', borderBottom: '0.5px solid #F4F3EF', padding: '8px 16px' }}
      >
        {/* Escalation */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" style={{ color: '#6B6A65' }} />
          {editingEscalation ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={Math.round(escalation * 100)}
                onChange={(e) => setEscalation(parseFloat(e.target.value) / 100 || 0)}
                className="w-16 h-6 text-xs"
                onBlur={() => setEditingEscalation(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingEscalation(false)}
                autoFocus
              />
              <span style={{ fontSize: 11, color: '#6B6A65' }}>% / yr</span>
            </div>
          ) : (
            <button
              onClick={() => setEditingEscalation(true)}
              className="hover:underline"
              style={{ fontSize: 11, color: '#6B6A65', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Escalation: {Math.round(escalation * 100)}% / yr
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs h-7">
            <FileDown className="w-3.5 h-3.5 mr-1" />
            Export BOE
          </Button>
          <Button size="sm" className="text-xs h-7" style={{ backgroundColor: '#111110' }} onClick={() => setShowAddPanel(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add role
          </Button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 min-h-0 overflow-auto">
        {filteredRoles.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title="No roles yet"
              description="Roles are added automatically when you assign them to tasks in Staff → Scope of Work. You can also add roles manually here."
              action={{ label: '+ Add manually', onClick: () => setShowAddPanel(true) }}
            />
          </div>
        ) : viewMode === 'pricing' ? (
          <PricingView
            roles={filteredRoles}
            escalation={escalation}
            activeYearCount={activeYearCount}
            getRoleBillRate={getRoleBillRate}
            editingCell={editingCell}
            cellValue={cellValue}
            onCellClick={handleCellClick}
            onCellChange={setCellValue}
            onCellSave={handleCellSave}
            onRowClick={setDetailRole}
            stats={stats}
            wbsRoleData={wbsRoleData}
          />
        ) : (
          <TimelineView
            roles={filteredRoles}
            activeYearCount={activeYearCount}
            getRoleBillRate={getRoleBillRate}
            onBlockClick={handleTimelineClick}
            onRowClick={setDetailRole}
            stats={stats}
          />
        )}
      </div>

      {/* ADD ROLE PANEL */}
      {showAddPanel && (
        <AddRolePanel
          companyRoles={companyRoles}
          onAddFromLibrary={handleAddFromLibrary}
          onClose={() => setShowAddPanel(false)}
        />
      )}

      {/* ROLE DETAIL PANEL */}
      {detailRole && (
        <RoleDetailPanel
          role={detailRole}
          onUpdate={(updates) => { updateRole(detailRole.id, updates); setDetailRole({ ...detailRole, ...updates }) }}
          onDelete={() => { removeRole(detailRole.id); setDetailRole(null) }}
          onClose={() => setDetailRole(null)}
          laborCategories={companyRoles as unknown as { title: string; salary_levels?: { level: string; level_title?: string; steps: number[] }[] }[]}
        />
      )}
    </div>
  )
}

// ==================== PRICING VIEW ====================

function PricingView({
  roles, escalation, activeYearCount, getRoleBillRate,
  editingCell, cellValue, onCellClick, onCellChange, onCellSave,
  onRowClick, stats, wbsRoleData,
}: {
  roles: Role[]
  escalation: number
  activeYearCount: number
  getRoleBillRate: (role: Role) => number
  editingCell: { roleId: string; yearIndex: number } | null
  cellValue: string
  onCellClick: (roleId: string, yearIndex: number) => void
  onCellChange: (value: string) => void
  onCellSave: () => void
  onRowClick: (role: Role) => void
  stats: { totalValue: number; primeCost: number; totalHours: number }
  wbsRoleData: Map<string, number>
}) {
  const yearCols = YEAR_LABELS.slice(0, activeYearCount)
  const gridCols = `200px 72px 90px ${yearCols.map(() => '70px').join(' ')} 120px`

  return (
    <div style={{ minWidth: 700 }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 grid"
        style={{ gridTemplateColumns: gridCols, background: '#FAFAF9', borderBottom: '0.5px solid #E8E7E2' }}
      >
        <HeaderCell>Role</HeaderCell>
        <HeaderCell>Type</HeaderCell>
        <HeaderCell align="right">Bill rate</HeaderCell>
        {yearCols.map(label => <HeaderCell key={label} align="right">{label}</HeaderCell>)}
        <HeaderCell align="right">Total cost</HeaderCell>
      </div>

      {/* Section: Prime labor */}
      <SectionHeader label="Prime labor" dotColor="#111110" />

      {roles.map(role => {
        const billRate = getRoleBillRate(role)
        const totalCost = getRoleTotalCost(role, billRate, escalation)
        return (
          <div
            key={role.id}
            className="grid cursor-pointer hover:bg-[#FAFAF8]"
            style={{ gridTemplateColumns: gridCols, borderBottom: '0.5px solid #F4F3EF' }}
            onClick={() => onRowClick(role)}
          >
            <div style={{ padding: '10px 12px' }}>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 12, fontWeight: 600, color: billRate === 0 ? '#BA7517' : '#111110' }}>{role.name}</span>
                {wbsRoleData.has(role.name) ? (
                  <span style={{ fontSize: 9, fontWeight: 500, background: '#E1F5EE', color: '#085041', border: '0.5px solid #5DCAA5', padding: '1px 5px', borderRadius: 3 }}>From WBS</span>
                ) : (
                  <span style={{ fontSize: 9, fontWeight: 500, background: '#F4F3EF', color: '#6B6A65', padding: '1px 5px', borderRadius: 3 }}>Manual</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#6B6A65' }}>
                {role.icLevel} · {role.description || 'General'}
                {wbsRoleData.has(role.name) && <span style={{ color: '#6B6A65' }}> · {wbsRoleData.get(role.name)?.toLocaleString()} hrs from WBS</span>}
              </div>
            </div>
            <div style={{ padding: '10px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ background: '#111110', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3 }}>
                Prime
              </span>
            </div>
            <div style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6A65' }}>
              {formatCurrency(billRate)}
            </div>
            {yearCols.map((_, i) => {
              const isEditing = editingCell?.roleId === role.id && editingCell.yearIndex === i
              const active = getActiveYears(role)
              const hours = active[i] ? (role.billableHours || 1920) : 0
              return (
                <div
                  key={i}
                  style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, color: hours > 0 ? '#111110' : '#C4C3BE', fontVariantNumeric: 'tabular-nums' }}
                  onClick={(e) => { e.stopPropagation(); onCellClick(role.id, i) }}
                >
                  {isEditing ? (
                    <input
                      type="number"
                      value={cellValue}
                      onChange={(e) => onCellChange(e.target.value)}
                      onBlur={onCellSave}
                      onKeyDown={(e) => e.key === 'Enter' && onCellSave()}
                      autoFocus
                      style={{ width: 54, textAlign: 'right', fontSize: 12, border: 'none', borderBottom: '1.5px solid #F5C200', outline: 'none', background: 'transparent' }}
                    />
                  ) : (
                    hours > 0 ? hours.toLocaleString() : '—'
                  )}
                </div>
              )
            })}
            <div style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#111110' }}>
              {formatCurrency(totalCost, 0)}
            </div>
          </div>
        )
      })}

      {/* Subtotal */}
      <div
        className="grid"
        style={{ gridTemplateColumns: gridCols, background: '#FAFAF9', borderTop: '0.5px solid #D4D3CE' }}
      >
        <div style={{ padding: '8px 12px', gridColumn: `1 / ${3 + activeYearCount}`, fontSize: 11, fontWeight: 600, color: '#6B6A65' }}>
          Prime subtotal
        </div>
        <div style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6B6A65' }}>
          {formatCurrency(stats.primeCost, 0)}
        </div>
      </div>

      {/* Total */}
      <div
        className="grid"
        style={{ gridTemplateColumns: gridCols, borderTop: '2px solid #111110' }}
      >
        <div style={{ padding: '12px', gridColumn: `1 / ${3 + activeYearCount}`, fontSize: 13, fontWeight: 800, color: '#111110' }}>
          Total contract value
        </div>
        <div style={{ padding: '12px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#111110' }}>
          {formatCurrency(stats.totalValue, 0)}
        </div>
      </div>
    </div>
  )
}

// ==================== TIMELINE VIEW ====================

function TimelineView({
  roles, activeYearCount, getRoleBillRate, onBlockClick, onRowClick, stats,
}: {
  roles: Role[]
  activeYearCount: number
  getRoleBillRate: (role: Role) => number
  onBlockClick: (roleId: string, yearIndex: number) => void
  onRowClick: (role: Role) => void
  stats: { totalValue: number; totalHours: number }
}) {
  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2" style={{ background: '#FAFAF9', borderBottom: '0.5px solid #F4F3EF' }}>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#111110' }} />
          <span style={{ fontSize: 12, color: '#5F5E5A' }}>Full time (1.0 FTE)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#F5C200' }} />
          <span style={{ fontSize: 12, color: '#5F5E5A' }}>Part time (&lt; 1.0 FTE)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: '#F4F3EF' }} />
          <span style={{ fontSize: 12, color: '#5F5E5A' }}>Off contract</span>
        </div>
      </div>

      {/* Section: Prime */}
      <SectionHeader label="Prime labor" dotColor="#111110" />

      {roles.map(role => {
        const billRate = getRoleBillRate(role)
        const totalHours = getRoleTotalHours(role)
        const active = getActiveYears(role)
        const hours = role.billableHours || 1920

        return (
          <div
            key={role.id}
            className="grid cursor-pointer hover:bg-[#FAFAF8]"
            style={{ gridTemplateColumns: '180px 1fr 90px', borderBottom: '0.5px solid #F4F3EF' }}
            onClick={() => onRowClick(role)}
          >
            {/* Role cell */}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111110' }}>{role.name}</div>
              <div style={{ fontSize: 10, color: '#6B6A65' }}>{formatCurrency(billRate)}/hr · Prime</div>
            </div>

            {/* Timeline blocks */}
            <div className="flex items-center gap-1 px-2 py-2">
              {Array.from({ length: activeYearCount }).map((_, i) => {
                const isActive = active[i]
                const isFullTime = isActive && hours >= 1800
                const isPartTime = isActive && hours > 0 && hours < 1800

                let bg = '#F4F3EF', fg = '#C4C3BE'
                if (isFullTime) { bg = '#111110'; fg = '#FFFFFF' }
                else if (isPartTime) { bg = '#F5C200'; fg = '#111110' }

                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-center cursor-pointer"
                    style={{ height: 28, borderRadius: 4, background: bg, color: fg }}
                    onClick={(e) => { e.stopPropagation(); onBlockClick(role.id, i) }}
                  >
                    <span style={{ fontSize: 8, fontWeight: 700 }}>{YEAR_SHORT[i]}</span>
                    <span style={{ fontSize: 7 }}>{isActive ? hours.toLocaleString() : '—'}</span>
                  </div>
                )
              })}
            </div>

            {/* Hours cell */}
            <div style={{ padding: '10px 12px', textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111110' }}>{totalHours.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: '#6B6A65' }}>{role.fte} FTE</div>
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div
        className="sticky bottom-0 flex items-center justify-between px-4 py-3"
        style={{ borderTop: '2px solid #111110', background: '#FAFAF9' }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#5F5E5A' }}>
          {roles.length} roles · {stats.totalHours.toLocaleString()} hours
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111110' }}>
          {formatCurrency(stats.totalValue, 0)}
        </span>
      </div>
    </div>
  )
}

// ==================== ADD ROLE PANEL ====================

function AddRolePanel({
  companyRoles,
  onAddFromLibrary,
  onClose,
}: {
  companyRoles: { id: string; title: string; salary_levels?: unknown }[]
  onAddFromLibrary: (role: { id: string; title: string; salary_levels?: unknown }) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[480px] bg-white z-50 flex flex-col" style={{ borderLeft: '0.5px solid #E8E7E2' }}>
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: '0.5px solid #E8E7E2' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111110' }}>Add role</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* From library */}
          {companyRoles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium" style={{ color: '#6B6A65' }}>From your labor categories</Label>
              <div className="space-y-1">
                {companyRoles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => onAddFromLibrary(role)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors"
                    style={{ fontSize: 13, color: '#111110', border: '0.5px solid #E8E7E2' }}
                  >
                    {role.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom role */}
          <div className="space-y-2" style={{ borderTop: '0.5px solid #E8E7E2', paddingTop: 16 }}>
            <Label htmlFor="custom-role-name" className="text-xs font-medium" style={{ color: '#6B6A65' }}>Or add a custom role</Label>
            <div className="flex gap-2">
              <Input
                id="custom-role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Data Analyst"
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) {
                    onAddFromLibrary({ id: `custom-${crypto.randomUUID()}`, title: name.trim() })
                    setName('')
                  }
                }}
              />
              <Button
                size="sm"
                disabled={!name.trim()}
                onClick={() => {
                  if (name.trim()) {
                    onAddFromLibrary({ id: `custom-${crypto.randomUUID()}`, title: name.trim() })
                    setName('')
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ==================== ROLE DETAIL PANEL ====================

// FFTC indirect rates (will come from Account → Company Settings later)
const INDIRECT_RATES = { fringe: 0.2116, overhead: 0.3426, ga: 0.1983, hoursPerYear: 2080 }

function RoleDetailPanel({
  role,
  onUpdate,
  onDelete,
  onClose,
  laborCategories,
}: {
  role: Role
  onUpdate: (updates: Partial<Role>) => void
  onDelete: () => void
  onClose: () => void
  laborCategories: { title: string; salary_levels?: { level: string; level_title?: string; steps: number[] }[] }[]
}) {
  const extRole = role as Role & { selectedLevel?: string; selectedStep?: number; currentSalary?: number; profitMargin?: number; type?: string; subcontractorName?: string; billRateBase?: number }

  // Find matching labor category
  const laborCat = laborCategories.find(lc => lc.title === role.name)
  const levels = laborCat?.salary_levels || []

  const [selectedLevel, setSelectedLevel] = useState(extRole.selectedLevel || 'IC3')
  const [selectedStep, setSelectedStep] = useState(extRole.selectedStep ?? 0)
  const [profit, setProfit] = useState((extRole.profitMargin ?? 0.10) * 100)
  const [roleType, setRoleType] = useState<'prime' | 'sub'>(extRole.type as 'prime' | 'sub' || 'prime')
  const [subName, setSubName] = useState(extRole.subcontractorName || '')
  const escalation = 0.03

  // Derive salary from level/step selection
  const currentLevelData = levels.find(l => l.level === selectedLevel) || levels[0]
  const salary = currentLevelData?.steps?.[selectedStep] || extRole.currentSalary || extRole.baseSalary || 0

  // Calculate breakdown from salary (always forward calc from level/step)
  const breakdown = salary > 0 ? (() => {
    const fringe = salary * INDIRECT_RATES.fringe
    const oh = salary * INDIRECT_RATES.overhead
    const loaded = salary + fringe + oh
    const gaAmt = loaded * INDIRECT_RATES.ga
    const totalCost = loaded + gaAmt
    const costPerHour = totalCost / INDIRECT_RATES.hoursPerYear
    const profitAmt = costPerHour * profit / 100
    const rate = costPerHour + profitAmt
    return { salary, fringe, oh, loaded, gaAmt, totalCost, costPerHour, profitAmt, billRate: rate }
  })() : null

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[480px] bg-white z-50 flex flex-col" style={{ borderLeft: '0.5px solid #E8E7E2' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: '0.5px solid #E8E7E2' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111110' }}>{role.name}</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close">
            <X className="w-4 h-4" style={{ color: '#6B6A65' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 1. Role name */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-name" className="text-xs font-medium">Role name</Label>
            <Input id="detail-name" value={role.name} onChange={(e) => onUpdate({ name: e.target.value })} className="text-sm" />
            {laborCat && <span style={{ fontSize: 10, color: '#6B6A65' }}>{laborCat.title}</span>}
          </div>

          {/* Level selector */}
          {levels.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Seniority level</Label>
              <div className="flex flex-wrap gap-1">
                {levels.map(l => (
                  <button
                    key={l.level}
                    onClick={() => { setSelectedLevel(l.level); setSelectedStep(0); onUpdate({ icLevel: l.level as Role['icLevel'] }) }}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      background: selectedLevel === l.level ? '#111110' : '#F4F3EF',
                      color: selectedLevel === l.level ? '#FFFFFF' : '#5F5E5A',
                    }}
                  >
                    {l.level} · {l.level_title || 'Level'}
                  </button>
                ))}
              </div>

              {/* Step selector */}
              {currentLevelData && currentLevelData.steps.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" style={{ color: '#6B6A65' }}>Step</Label>
                  <div className="flex flex-wrap gap-1">
                    {currentLevelData.steps.map((stepSalary, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedStep(i); onUpdate({ baseSalary: stepSalary }) }}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                          background: selectedStep === i ? '#111110' : '#F4F3EF',
                          color: selectedStep === i ? '#FFFFFF' : '#5F5E5A',
                        }}
                      >
                        ${stepSalary.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Salary display */}
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111110' }}>
                Annual salary: ${salary.toLocaleString()}
              </div>
            </div>
          )}

          {/* Manual salary input if no labor categories */}
          {levels.length === 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Base salary ($)</Label>
              <Input type="number" value={role.baseSalary} onChange={(e) => onUpdate({ baseSalary: parseFloat(e.target.value) || 0 })} className="text-sm font-mono" />
            </div>
          )}

          <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

          {/* 2. Prime / Sub toggle */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Type</Label>
            <div style={{ display: 'flex', border: '0.5px solid #E8E7E2', borderRadius: 6, padding: 2, gap: 1 }}>
              {(['prime', 'sub'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setRoleType(t); onUpdate({ type: t } as Partial<Role>) }}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 12,
                    fontWeight: roleType === t ? 600 : 400,
                    background: roleType === t ? (t === 'prime' ? '#111110' : '#F4F3EF') : 'transparent',
                    color: roleType === t ? (t === 'prime' ? '#FFFFFF' : '#5F5E5A') : '#6B6A65',
                    border: 'none', borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {roleType === 'sub' && (
              <div className="space-y-1.5 mt-2">
                <Label className="text-xs font-medium">Subcontractor name</Label>
                <Input
                  value={subName}
                  onChange={(e) => { setSubName(e.target.value); onUpdate({ subcontractorName: e.target.value } as Partial<Role>) }}
                  placeholder="e.g. Skybrid Solutions"
                  className="text-sm"
                />
              </div>
            )}
          </div>

          <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

          {/* 3. Rate section — calculated from level/step salary */}
          <div className="space-y-3">
            {/* Profit margin */}
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">Profit margin</Label>
              <Input type="number" step="0.5" value={profit} onChange={(e) => setProfit(parseFloat(e.target.value) || 10)} className="text-sm w-16 font-mono" />
              <span style={{ fontSize: 11, color: '#5F5E5A' }}>%</span>
            </div>

            {/* Rate breakdown */}
            {breakdown && (
              <div style={{ background: '#FAFAF9', border: '0.5px solid #E8E7E2', borderRadius: 7, padding: '12px 14px', marginTop: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#C4C3BE', marginBottom: 8 }}>Rate breakdown</div>
                <div className="space-y-1">
                  <BreakdownRow label="Base salary" value={`${fmt(breakdown.salary)}/yr`} />
                  <BreakdownRow label={`+ Fringe (${(INDIRECT_RATES.fringe * 100).toFixed(2)}%)`} value={`${fmt(breakdown.fringe)}/yr`} />
                  <BreakdownRow label={`+ Overhead (${(INDIRECT_RATES.overhead * 100).toFixed(2)}%)`} value={`${fmt(breakdown.oh)}/yr`} />
                  <div style={{ height: 0.5, background: '#E8E7E2', margin: '4px 0' }} />
                  <BreakdownRow label="Loaded cost" value={`${fmt(breakdown.loaded)}/yr`} />
                  <BreakdownRow label={`+ G&A (${(INDIRECT_RATES.ga * 100).toFixed(2)}%)`} value={`${fmt(breakdown.gaAmt)}/yr`} />
                  <div style={{ height: 0.5, background: '#E8E7E2', margin: '4px 0' }} />
                  <BreakdownRow label="Total cost" value={`${fmt(breakdown.totalCost)}/yr`} />
                  <BreakdownRow label={`÷ ${INDIRECT_RATES.hoursPerYear.toLocaleString()} hours`} value="" />
                  <BreakdownRow label="Cost per hour" value={`${fmt(breakdown.costPerHour)}/hr`} />
                  <BreakdownRow label={`+ Profit (${profit}%)`} value={`${fmt(breakdown.profitAmt)}/hr`} />
                  <div style={{ height: 0.5, background: '#E8E7E2', margin: '4px 0' }} />
                  <BreakdownRow label="Bill rate" value={`${fmt(breakdown.billRate)}/hr`} highlight />
                </div>

                {/* Option year rates */}
                <div style={{ fontSize: 11, color: '#6B6A65', marginTop: 10 }}>With {Math.round(escalation * 100)}% annual escalation:</div>
                <div className="flex gap-3 mt-1">
                  {['Base yr', 'OY1', 'OY2', 'OY3', 'OY4'].map((label, i) => {
                    const rate = breakdown.billRate * Math.pow(1 + escalation, i)
                    return (
                      <div key={label} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: i === 0 ? '#111110' : '#6B6A65' }}>
                        <div style={{ fontSize: 9, color: '#C4C3BE' }}>{label}</div>
                        {fmt(rate)}
                      </div>
                    )
                  })}
                </div>

                <div style={{ fontSize: 10, color: '#C4C3BE', marginTop: 8 }}>
                  Rates: Fringe {(INDIRECT_RATES.fringe * 100).toFixed(2)}% · Overhead {(INDIRECT_RATES.overhead * 100).toFixed(2)}% · G&A {(INDIRECT_RATES.ga * 100).toFixed(2)}%
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

          {/* 4. Hours summary */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Hours by year</Label>
            <div className="flex gap-3">
              {['Base', 'OY1', 'OY2', 'OY3', 'OY4'].map((label, i) => {
                const active = getActiveYears(role)
                const hours = active[i] ? (role.billableHours || 1920) : 0
                return (
                  <div key={label} style={{ fontSize: 11, color: hours > 0 ? '#111110' : '#C4C3BE' }}>
                    <div style={{ fontSize: 9, color: '#C4C3BE' }}>{label}</div>
                    {hours > 0 ? hours.toLocaleString() : '—'}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 flex items-center justify-between" style={{ borderTop: '0.5px solid #E8E7E2' }}>
          <button onClick={onDelete} style={{ fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
            Delete role
          </button>
          <button onClick={onClose} style={{ fontSize: 11, color: '#5F5E5A', background: 'none', border: '0.5px solid #E8E7E2', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </>
  )
}

function BreakdownRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between" style={{ padding: highlight ? '4px 6px' : '1px 0', background: highlight ? '#F5F4F0' : 'transparent', borderRadius: highlight ? 4 : 0 }}>
      <span style={{ fontSize: 11, color: '#5F5E5A' }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#111110', fontWeight: highlight ? 700 : 400 }}>{value}</span>
    </div>
  )
}

// ==================== SHARED UI ATOMS ====================

function SummaryItem({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: bold ? 20 : 16, fontWeight: 800, color: color || '#111110' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6B6A65', marginTop: 1 }}>{label}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 0.5, height: 28, background: '#E8E7E2' }} />
}

function ToggleSegment({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1 rounded"
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: active ? '#111110' : '#888',
        background: active ? '#fff' : 'transparent',
        boxShadow: active ? '0 0 0 0.5px #E8E7E2' : 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function FilterTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? '#111110' : '#6B6A65',
        borderBottom: active ? '2px solid #111110' : '2px solid transparent',
        background: 'none',
        border: 'none',
        borderBottomWidth: 2,
        borderBottomStyle: 'solid',
        borderBottomColor: active ? '#111110' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {label} <span style={{ color: '#6B6A65', fontWeight: 400 }}>{count}</span>
    </button>
  )
}

function HeaderCell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <div style={{
      padding: '8px 12px',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#C4C3BE',
      textAlign: align,
    }}>
      {children}
    </div>
  )
}

function SectionHeader({ label, dotColor }: { label: string; dotColor: string }) {
  return (
    <div style={{
      padding: '5px 10px',
      background: '#F4F3EF',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#5F5E5A' }}>
        {label}
      </span>
    </div>
  )
}
