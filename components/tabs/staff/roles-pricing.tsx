'use client'

import React, { useState, useMemo, useCallback, Fragment, useRef, useEffect } from 'react'
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
import { toast } from 'sonner'

// ==================== TYPES ====================

type ViewMode = 'pricing' | 'timeline'
type RoleFilter = 'all' | 'prime' | 'sub'

const YEAR_KEYS = ['base', 'option1', 'option2', 'option3', 'option4'] as const
const HOURS_YEAR_KEYS = ['baseYear', 'oy1', 'oy2', 'oy3', 'oy4'] as const
const YEAR_LABELS = ['Base yr', 'OY1', 'OY2', 'OY3', 'OY4']
const YEAR_SHORT = ['BY', 'OY1', 'OY2', 'OY3', 'OY4']
const ESCALATION_MULTIPLIERS = [1.0, 1.03, 1.0609, 1.0927, 1.1255]

// ==================== HELPERS ====================

function getActiveYears(role: Role): boolean[] {
  return [role.years.base, role.years.option1, role.years.option2, role.years.option3, role.years.option4]
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
    synced.forEach(r => map.set(r.name, r.totalHoursFromWBS || 0))
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

  // Compute summary stats with year-by-year breakdown
  const stats = useMemo(() => {
    let totalHours = 0
    const yearCosts = HOURS_YEAR_KEYS.map((key, i) => {
      return selectedRoles.reduce((sum, role) => {
        const hours = role.hoursByYear?.[key] || 0
        const rate = role.loadedRate || (role.baseSalary ? role.baseSalary / 2080 : 0)
        return sum + (hours * rate * ESCALATION_MULTIPLIERS[i])
      }, 0)
    })

    selectedRoles.forEach(role => {
      totalHours += getRoleTotalHours(role)
    })

    const totalValue = yearCosts.reduce((sum, c) => sum + c, 0)

    return { totalValue, yearCosts, totalHours }
  }, [selectedRoles, getRoleBillRate, escalation]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter roles
  const filteredRoles = useMemo(() => {
    if (roleFilter === 'all') return selectedRoles
    if (roleFilter === 'sub') return selectedRoles.filter(r => r.type === 'sub')
    return selectedRoles.filter(r => (r.type ?? 'prime') === 'prime')
  }, [selectedRoles, roleFilter])

  // Number of active option years from solicitation
  const activeYearCount = useMemo(() => {
    const pop = solicitation.periodOfPerformance
    return 1 + (pop?.optionYears || 2)
  }, [solicitation.periodOfPerformance])

  // Handle inline cell edit
  const handleCellClick = (roleId: string, yearIndex: number) => {
    const role = selectedRoles.find(r => r.id === roleId)
    if (!role) return
    const hourKey = HOURS_YEAR_KEYS[yearIndex]
    const hours = role.hoursByYear?.[hourKey] || 0
    setEditingCell({ roleId, yearIndex })
    setCellValue(hours > 0 ? String(hours) : '')
  }

  const handleCellSave = () => {
    if (!editingCell) return
    const hours = parseInt(cellValue) || 0
    const role = selectedRoles.find(r => r.id === editingCell.roleId)
    if (!role) return

    const yearKey = YEAR_KEYS[editingCell.yearIndex]
    const hourKey = HOURS_YEAR_KEYS[editingCell.yearIndex]
    const newHoursByYear = {
      ...(role.hoursByYear || { baseYear: 0, oy1: 0, oy2: 0, oy3: 0, oy4: 0 }),
      [hourKey]: hours,
    }
    updateRole(editingCell.roleId, {
      years: { ...role.years, [yearKey]: hours > 0 },
      hoursByYear: newHoursByYear,
      billableHours: hourKey === 'baseYear' ? hours : role.billableHours,
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
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111110' }}>{formatCurrency(stats.totalValue, 0)}</div>
            <div style={{ fontSize: 10, color: '#6B6A65', marginTop: 1 }}>Total contract value</div>
            <div style={{ fontSize: 10, color: '#9B9A95', marginTop: 1 }}>Across {activeYearCount} contract years</div>
          </div>
          <Divider />
          {HOURS_YEAR_KEYS.slice(0, activeYearCount).map((key, i) => (
            <Fragment key={key}>
              <SummaryItem label={YEAR_LABELS[i]} value={formatCurrency(stats.yearCosts[i], 0)} />
              {i < activeYearCount - 1 && <Divider />}
            </Fragment>
          ))}
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
          <FilterTab label="Prime only" count={selectedRoles.filter(r => (r.type ?? 'prime') === 'prime').length} active={roleFilter === 'prime'} onClick={() => setRoleFilter('prime')} />
          <FilterTab label="Subs only" count={selectedRoles.filter(r => r.type === 'sub').length} active={roleFilter === 'sub'} onClick={() => setRoleFilter('sub')} />
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
  stats: { totalValue: number; yearCosts: number[]; totalHours: number }
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
            <div style={{ padding: '14px 12px' }}>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 12, fontWeight: 600, color: billRate === 0 ? '#BA7517' : '#111110' }}>{role.name}</span>
              </div>
              <div style={{ fontSize: 10, color: '#6B6A65', lineHeight: 1.5, marginTop: 3 }}>
                {role.icLevel} · {role.description || 'General'}
                {wbsRoleData.has(role.name) && <span style={{ color: '#6B6A65' }}> · {wbsRoleData.get(role.name)?.toLocaleString()} hrs from WBS</span>}
              </div>
            </div>
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              {(() => {
                const isPrime = (role.type || 'prime') === 'prime'
                return (
                  <span style={{
                    background: isPrime ? '#111110' : '#F4F3EF',
                    color: isPrime ? '#fff' : '#5F5E5A',
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 3
                  }}>
                    {isPrime ? 'Prime' : 'Sub'}
                  </span>
                )
              })()}
            </div>
            <div style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6A65' }}>
              {formatCurrency(billRate)}
            </div>
            {yearCols.map((_, i) => {
              const isEditing = editingCell?.roleId === role.id && editingCell.yearIndex === i
              const hours = role.hoursByYear?.[HOURS_YEAR_KEYS[i]] || 0
              return (
                <div
                  key={i}
                  style={{ padding: '14px 8px', textAlign: 'right', fontSize: 12, color: hours > 0 ? '#111110' : '#C4C3BE', fontVariantNumeric: 'tabular-nums' }}
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
            <div style={{ padding: '14px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#111110' }}>
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
          {formatCurrency(stats.totalValue, 0)}
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
const INDIRECT = { fringe: 0.2116, overhead: 0.3426, ga: 0.1983, hoursPerYear: 2080 }

// Default IC levels with titles
const IC_LEVELS = [
  { level: 'IC1', title: 'Associate' },
  { level: 'IC2', title: 'Intermediate' },
  { level: 'IC3', title: 'Mid-Level' },
  { level: 'IC4', title: 'Senior' },
  { level: 'IC5', title: 'Staff' },
]

// Default salaries per level (used when no labor categories)
const DEFAULT_SALARIES: Record<string, number[]> = {
  IC1: [65000, 70000, 75000],
  IC2: [80000, 87000, 95000],
  IC3: [100000, 110000, 120000],
  IC4: [130000, 145000, 160000],
  IC5: [175000, 195000, 220000],
}

function calculateBillRate(salary: number, profit: number): number {
  const fringe = salary * INDIRECT.fringe
  const overhead = salary * INDIRECT.overhead
  const loaded = salary + fringe + overhead
  const ga = loaded * INDIRECT.ga
  const total = loaded + ga
  const perHour = total / INDIRECT.hoursPerYear
  return Math.round(perHour * (1 + profit) * 100) / 100
}

function RoleDetailPanel({
  role,
  onUpdate,
  onDelete,
  onClose,
  laborCategories,
  escalation = 0.03,
}: {
  role: Role
  onUpdate: (updates: Partial<Role>) => void
  onDelete: () => void
  onClose: () => void
  laborCategories: { title: string; salary_levels?: { level: string; level_title?: string; steps: number[] }[] }[]
  escalation?: number
}) {
  const extRole = role as Role & { selectedLevel?: string; selectedStep?: number; currentSalary?: number; profitMargin?: number; type?: string; subcontractorName?: string; billRateBase?: number }

  // Find matching labor category
  const laborCat = laborCategories.find(lc => lc.title === role.name)
  const hasLaborCat = laborCat && laborCat.salary_levels && laborCat.salary_levels.length > 0

  const [selectedLevel, setSelectedLevel] = useState(extRole.selectedLevel || role.icLevel || 'IC3')
  const [selectedStep, setSelectedStep] = useState(extRole.selectedStep ?? 0)
  const [profit, setProfit] = useState((extRole.profitMargin ?? 0.10) * 100)
  const [roleType, setRoleType] = useState<'prime' | 'sub'>(extRole.type as 'prime' | 'sub' || 'prime')
  const [subName, setSubName] = useState(extRole.subcontractorName || '')
  const [subRate, setSubRate] = useState(role.subRate ?? 0)
  const [subMarkup, setSubMarkup] = useState(role.subMarkup ?? 10)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  // Sync local state when role prop changes (e.g., after hydration or switching roles)
  useEffect(() => {
    setSubRate(role.subRate ?? 0)
    setSubMarkup(role.subMarkup ?? 10)
  }, [role.id, role.subRate, role.subMarkup])

  // Wrap onUpdate with a debounced "Role saved" toast
  const saveRole = (updates: Partial<Role>) => {
    onUpdate(updates)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => {
      toast.success('Role saved', { description: `${role.name} updated`, duration: 3000 })
    }, 600)
  }

  // Get steps for current level (from labor categories or defaults)
  const getStepsForLevel = (level: string): number[] => {
    if (hasLaborCat) {
      const lvl = laborCat.salary_levels?.find(l => l.level === level)
      return lvl?.steps || []
    }
    return DEFAULT_SALARIES[level] || DEFAULT_SALARIES.IC3
  }

  const currentSteps = getStepsForLevel(selectedLevel)
  const salary = currentSteps[selectedStep] ?? extRole.currentSalary ?? extRole.baseSalary ?? 0

  // Calculate breakdown from salary
  const breakdown = salary > 0 ? (() => {
    const fringe = salary * INDIRECT.fringe
    const oh = salary * INDIRECT.overhead
    const loaded = salary + fringe + oh
    const gaAmt = loaded * INDIRECT.ga
    const totalCost = loaded + gaAmt
    const costPerHour = totalCost / INDIRECT.hoursPerYear
    const profitAmt = costPerHour * (profit / 100)
    const billRate = costPerHour + profitAmt
    return { salary, fringe, oh, loaded, gaAmt, totalCost, costPerHour, profitAmt, billRate }
  })() : null

  // Sync calculated rate back to role so table row stays in sync
  // Skip on first render so we don't overwrite stored bill rate on panel open
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!breakdown) return
    onUpdate({
      loadedRate: breakdown.billRate,
      currentSalary: breakdown.salary,
      selectedLevel,
      selectedStep,
      billRateBase: breakdown.billRate
    })
  }, [selectedLevel, selectedStep]) // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Handle level change
  const handleLevelChange = (level: string) => {
    setSelectedLevel(level)
    setSelectedStep(0)
    const newSteps = getStepsForLevel(level)
    const newSalary = newSteps[0] || salary
    saveRole({ icLevel: level as Role['icLevel'], baseSalary: newSalary })
  }

  // Handle step change
  const handleStepChange = (stepIndex: number) => {
    setSelectedStep(stepIndex)
    const newSalary = currentSteps[stepIndex] || salary
    saveRole({ baseSalary: newSalary })
  }

  // Update bill rate when profit changes
  const handleProfitChange = (newProfit: number) => {
    setProfit(newProfit)
    if (salary > 0) {
      const newBillRate = calculateBillRate(salary, newProfit / 100)
      saveRole({ loadedRate: newBillRate } as Partial<Role>)
    }
  }

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
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B6A65', letterSpacing: '1px' }}>Role name</div>
            <Input value={role.name} onChange={(e) => saveRole({ name: e.target.value })} className="text-sm" />
            {laborCat && <span style={{ fontSize: 10, color: '#6B6A65' }}>Labor category: {laborCat.title}</span>}
          </div>

          <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

          {/* Prime / Sub toggle */}
          <div className="space-y-2">
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B6A65', letterSpacing: '1px' }}>Type</div>
            <div style={{ display: 'flex', border: '0.5px solid #E8E7E2', borderRadius: 6, padding: 2, gap: 1 }}>
              {(['prime', 'sub'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setRoleType(t); saveRole({ type: t } as Partial<Role>) }}
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
              <div className="space-y-3 mt-2">
                <div className="space-y-1.5">
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B6A65', letterSpacing: '1px' }}>Subcontractor name</div>
                  <Input
                    value={subName}
                    onChange={(e) => { setSubName(e.target.value); saveRole({ subcontractorName: e.target.value } as Partial<Role>) }}
                    placeholder="e.g. Skybrid Solutions"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B6A65', letterSpacing: '1px' }}>Sub cost rate</div>
                  <div style={{ fontSize: 10, color: '#9B9A95' }}>What you pay the subcontractor per hour</div>
                  <Input
                    type="number"
                    value={subRate || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      setSubRate(val)
                      const billRate = val * (1 + subMarkup / 100)
                      saveRole({ subRate: val, loadedRate: billRate })
                    }}
                    placeholder="0.00"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B6A65', letterSpacing: '1px' }}>Markup</div>
                  <div style={{ fontSize: 10, color: '#9B9A95' }}>Your margin on this subcontractor</div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={subMarkup}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0
                        setSubMarkup(val)
                        const billRate = subRate * (1 + val / 100)
                        saveRole({ subMarkup: val, loadedRate: billRate })
                      }}
                      className="text-sm w-20"
                    />
                    <span style={{ fontSize: 11, color: '#5F5E5A' }}>%</span>
                  </div>
                </div>

                {subRate > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111110' }}>
                      Bill rate: {fmt(subRate * (1 + subMarkup / 100))}/hr
                    </div>
                    <div style={{ background: '#FAFAF9', border: '0.5px solid #E8E7E2', borderRadius: 7, padding: '12px 14px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6B6A65', marginBottom: 10 }}>Sub rate breakdown</div>
                      <div className="space-y-1">
                        <BreakdownRow label="Their rate" value={`${fmt(subRate)}/hr`} />
                        <BreakdownRow label={`+ Markup (${subMarkup.toFixed(0)}%)`} value={`+${fmt(subRate * subMarkup / 100)}/hr`} />
                        <div style={{ height: 0.5, background: '#E8E7E2', margin: '3px 0' }} />
                        <BreakdownRow label="Bill rate" value={`${fmt(subRate * (1 + subMarkup / 100))}/hr`} highlight />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {roleType === 'prime' && (
            <>
              <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

              {/* SECTION 1 — LEVEL BUTTONS */}
              <div className="space-y-2">
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B6A65', letterSpacing: '1px' }}>Seniority level</div>
                <div className="flex gap-1">
                  {IC_LEVELS.map(({ level, title }) => (
                    <button
                      key={level}
                      onClick={() => handleLevelChange(level)}
                      className="flex flex-col items-center"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 5,
                        border: 'none',
                        cursor: 'pointer',
                        background: selectedLevel === level ? '#111110' : '#F4F3EF',
                        color: selectedLevel === level ? '#FFFFFF' : '#5F5E5A',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{level}</span>
                      <span style={{ fontSize: 9, opacity: 0.8 }}>{title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 2 — STEP BUTTONS */}
              {currentSteps.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B6A65', letterSpacing: '1px' }}>Step</div>
                    <div style={{ fontSize: 11, color: '#9B9A95' }}>Salary increments within this level</div>
                  </div>
                  <div className="flex gap-1">
                    {currentSteps.map((stepSalary, i) => (
                      <button
                        key={i}
                        onClick={() => handleStepChange(i)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '6px 10px',
                          borderRadius: 5,
                          border: 'none',
                          cursor: 'pointer',
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

              <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

              {/* SECTION 3 — RATE BREAKDOWN TABLE */}
              {breakdown && (
                <div style={{ background: '#FAFAF9', border: '0.5px solid #E8E7E2', borderRadius: 7, padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6B6A65', marginBottom: 10 }}>Bill rate calculation</div>
                  <div className="space-y-1">
                    <BreakdownRow label="Base salary" value={`${fmt(breakdown.salary)}/yr`} />
                    <BreakdownRow label={`+ Fringe (${(INDIRECT.fringe * 100).toFixed(2)}%)`} value={`${fmt(breakdown.fringe)}/yr`} />
                    <BreakdownRow label={`+ Overhead (${(INDIRECT.overhead * 100).toFixed(2)}%)`} value={`${fmt(breakdown.oh)}/yr`} />
                    <div style={{ height: 0.5, background: '#E8E7E2', margin: '3px 0' }} />
                    <BreakdownRow label="Loaded cost" value={`${fmt(breakdown.loaded)}/yr`} />
                    <BreakdownRow label={`+ G&A (${(INDIRECT.ga * 100).toFixed(2)}%)`} value={`${fmt(breakdown.gaAmt)}/yr`} />
                    <div style={{ height: 0.5, background: '#E8E7E2', margin: '3px 0' }} />
                    <BreakdownRow label="Total cost" value={`${fmt(breakdown.totalCost)}/yr`} />
                    <BreakdownRow label={`÷ ${INDIRECT.hoursPerYear.toLocaleString()} hours`} value="─────────────" muted />
                    <BreakdownRow label="Cost per hour" value={`${fmt(breakdown.costPerHour)}/hr`} />
                    <BreakdownRow label={`+ Profit (${profit.toFixed(0)}%)`} value={`${fmt(breakdown.profitAmt)}/hr`} />
                    <div style={{ height: 0.5, background: '#E8E7E2', margin: '3px 0' }} />
                    <BreakdownRow label="Bill rate" value={`${fmt(breakdown.billRate)}/hr`} highlight />
                  </div>
                </div>
              )}

              {/* SECTION 4 — PROFIT MARGIN */}
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: '#5F5E5A' }}>Profit margin:</span>
                <input
                  type="number"
                  step="0.5"
                  value={profit}
                  onChange={(e) => handleProfitChange(parseFloat(e.target.value) || 10)}
                  style={{
                    width: 50,
                    height: 28,
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace',
                    textAlign: 'center',
                    border: '0.5px solid #E8E7E2',
                    borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: 11, color: '#5F5E5A' }}>%</span>
              </div>

              {/* SECTION 5 — OPTION YEAR RATES */}
              {breakdown && (
                <div>
                  <div style={{ fontSize: 11, color: '#9B9A95', marginBottom: 6 }}>
                    With {Math.round(escalation * 100)}% annual escalation:
                  </div>
                  <div className="flex gap-4">
                    {['Base yr', 'OY1', 'OY2', 'OY3', 'OY4'].map((label, i) => {
                      const rate = breakdown.billRate * Math.pow(1 + escalation, i)
                      return (
                        <div key={label}>
                          <div style={{ fontSize: 9, color: '#9B9A95', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: i === 0 ? '#111110' : '#9B9A95' }}>
                            {fmt(rate)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

          {/* Hours summary */}
          <div className="space-y-1.5">
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B6A65', letterSpacing: '1px' }}>Hours by year</div>
            <div className="flex gap-4">
              {['Base', 'OY1', 'OY2', 'OY3', 'OY4'].map((label, i) => {
                const active = getActiveYears(role)
                const hours = active[i] ? (role.billableHours || 1920) : 0
                return (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: '#9B9A95', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: hours > 0 ? '#111110' : '#C4C3BE' }}>
                      {hours > 0 ? hours.toLocaleString() : '—'}
                    </div>
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

function BreakdownRow({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between" style={{ padding: highlight ? '4px 6px' : '1px 0', background: highlight ? '#F5F4F0' : 'transparent', borderRadius: highlight ? 4 : 0 }}>
      <span style={{ fontSize: 11, color: '#5F5E5A' }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: muted ? '#C4C3BE' : '#111110', fontWeight: highlight ? 700 : 400, textAlign: 'right' }}>{value}</span>
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
