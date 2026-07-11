'use client'

import { useState } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { LayoutGrid, Calendar, Users } from 'lucide-react'
import type { Role } from '@/contexts/app-context'

// ==================== MAIN COMPONENT ====================

type YearFilter = 'base' | 'oy1' | 'oy2' | 'oy3' | 'oy4' | 'all'

export function LaborLoading() {
  const {
    selectedRoles,
    proposalSetup,
  } = useAppContext()

  const [viewMode, setViewMode] = useState<'role' | 'year'>('role')
  const [selectedYear, setSelectedYear] = useState<YearFilter>('base')

  const billableHrs = proposalSetup?.billableHoursPerYear || 1920

  const rolesWithHours = selectedRoles.filter(
    r => (r.hoursByYear?.baseYear || 0) > 0
  )

  const overAllocated = rolesWithHours.filter(
    r => (r.hoursByYear?.baseYear || 0) > billableHrs
  )

  // nearFull kept for future use in Prompt 2-4 content
  const _nearFull = rolesWithHours.filter(r => {
    const hrs = r.hoursByYear?.baseYear || 0
    const fte = hrs / billableHrs
    return fte >= 0.8 && fte <= 1.0
  })
  void _nearFull

  const underAllocated = rolesWithHours.filter(
    r => (r.hoursByYear?.baseYear || 0) < billableHrs * 0.5
  )

  const atCapacity = rolesWithHours.length - overAllocated.length - underAllocated.length

  // Year pills based on contract periods
  const optionYears = proposalSetup?.optionYears ?? 4
  const yearPills: { key: YearFilter; label: string }[] = [
    { key: 'base', label: 'Base yr' },
    ...(optionYears >= 1 ? [{ key: 'oy1' as const, label: 'OY1' }] : []),
    ...(optionYears >= 2 ? [{ key: 'oy2' as const, label: 'OY2' }] : []),
    ...(optionYears >= 3 ? [{ key: 'oy3' as const, label: 'OY3' }] : []),
    ...(optionYears >= 4 ? [{ key: 'oy4' as const, label: 'OY4' }] : []),
    { key: 'all', label: 'All years' },
  ]

  // Over-allocated role names for banner
  const overNames = overAllocated.map(r => r.name)

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#FFFFFF' }}>
      {/* PAGE HEADER */}
      <div className="shrink-0" style={{ padding: '20px 24px 0', borderBottom: '0.5px solid #E8E7E2' }}>
        {/* Eyebrow */}
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: '#C4C3BE',
          marginBottom: 6,
        }}>
          Staff &middot; Labor Loading
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#111110',
          letterSpacing: -0.5,
          marginBottom: 14,
        }}>
          Can we actually deliver this?
        </h1>

        {/* Stats row */}
        <div className="flex items-center gap-6" style={{ paddingBottom: 14 }}>
          <StatItem value={rolesWithHours.length} label="roles total" color="#111110" />
          <Divider />
          <StatItem value={atCapacity} label="at capacity" color="#639922" />
          <Divider />
          <StatItem
            value={overAllocated.length}
            label="over 1.0 FTE"
            color={overAllocated.length > 0 ? '#A32D2D' : '#9B9A95'}
          />
          <Divider />
          <StatItem value={underAllocated.length} label="under-allocated" color="#6B6A65" />

          {/* View toggle */}
          <div className="ml-auto flex" style={{ background: '#F0EDE6', borderRadius: 5, padding: 2, gap: 1 }}>
            <ToggleSegment
              active={viewMode === 'role'}
              onClick={() => setViewMode('role')}
              icon={<LayoutGrid className="w-3.5 h-3.5" />}
              label="By role"
            />
            <ToggleSegment
              active={viewMode === 'year'}
              onClick={() => setViewMode('year')}
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="By year"
            />
          </div>
        </div>
      </div>

      {/* ALERT BANNER — over-allocation warning */}
      {overAllocated.length > 0 && (
        <div
          className="shrink-0 flex items-center gap-2.5"
          style={{
            margin: '10px 16px 0',
            padding: '10px 14px',
            background: '#FEFCFC',
            border: '0.5px solid #F09595',
            borderLeft: '2px solid #A32D2D',
            borderRadius: '0 7px 7px 0',
          }}
        >
          {/* Exclamation icon */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#A32D2D',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            !
          </div>

          {/* Message */}
          <div style={{ flex: 1, fontSize: 12, color: '#5F5E5A', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: '#A32D2D' }}>
              {overAllocated.length} role{overAllocated.length === 1 ? '' : 's'} exceed{overAllocated.length === 1 ? 's' : ''} 1.0 FTE in the base year.
            </span>
            {' '}{overNames.join(' and ')}.
            {' '}Consider adding headcount or reducing hours in Roles &amp; Pricing.
          </div>

          {/* Link to Roles & Pricing */}
          <button
            onClick={() => {
              // Navigate by setting the view — uses the same SPA navigation
              const el = document.querySelector('[data-view-id="roles-pricing"]') as HTMLElement
              if (el) el.click()
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: '#A32D2D',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Go to Roles &amp; Pricing &rarr;
          </button>
        </div>
      )}

      {/* TOOLBAR — year filter + legend */}
      <div
        className="shrink-0 flex items-center gap-3"
        style={{
          background: '#FAFAF9',
          borderBottom: '0.5px solid #F4F3EF',
          padding: '10px 20px',
        }}
      >
        {/* Label */}
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C4C3BE' }}>
          Viewing:
        </span>

        {/* Year pills */}
        <div className="flex gap-1">
          {yearPills.map(pill => (
            <button
              key={pill.key}
              onClick={() => setSelectedYear(pill.key)}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: selectedYear === pill.key ? '#111110' : '#F4F3EF',
                color: selectedYear === pill.key ? '#FFFFFF' : '#5F5E5A',
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto" style={{ fontSize: 10, color: '#6B6A65' }}>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#639922' }} />
            <span>&le;1.0 FTE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#BA7517' }} />
            <span>0.8&ndash;1.0 FTE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#A32D2D' }} />
            <span>&gt;1.0 FTE</span>
          </div>
        </div>
      </div>

      {/* CAPACITY TABLE */}
      {rolesWithHours.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Users className="w-7 h-7" style={{ color: '#C4C3BE' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111110' }}>No roles to analyze</div>
          <div style={{ fontSize: 12, color: '#6B6A65' }}>Add roles in Roles &amp; Pricing to see capacity loading.</div>
          <button
            onClick={() => {
              const el = document.querySelector('[data-view-id="roles-pricing"]') as HTMLElement
              if (el) el.click()
            }}
            style={{
              marginTop: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: '#111110',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Go to Roles &amp; Pricing &rarr;
          </button>
        </div>
      ) : viewMode === 'role' ? (
        <CapacityTable
          roles={rolesWithHours}
          billableHrs={billableHrs}
          selectedYear={selectedYear}
        />
      ) : (
        <TimelineView
          roles={rolesWithHours}
          billableHrs={billableHrs}
          optionYears={optionYears}
        />
      )}
    </div>
  )
}

// ==================== CAPACITY TABLE ====================

const YEAR_KEY_MAP: Record<YearFilter, keyof NonNullable<Role['hoursByYear']> | 'all'> = {
  base: 'baseYear',
  oy1: 'oy1',
  oy2: 'oy2',
  oy3: 'oy3',
  oy4: 'oy4',
  all: 'all',
}

function getRoleHours(role: Role, yearFilter: YearFilter, billableHrs: number): number {
  const h = role.hoursByYear
  if (!h) return 0
  if (yearFilter === 'all') {
    return h.baseYear + (h.oy1 || 0) + (h.oy2 || 0) + (h.oy3 || 0) + (h.oy4 || 0)
  }
  const key = YEAR_KEY_MAP[yearFilter]
  if (key === 'all') return 0
  return h[key] || 0
}

function getFteColor(fte: number): string {
  if (fte > 1.0) return '#A32D2D'
  if (fte >= 0.8) return '#BA7517'
  return '#639922'
}

function getBarColor(fte: number): string {
  if (fte > 1.0) return '#A32D2D'
  if (fte >= 0.8) return '#F5C200'
  return '#639922'
}

function getStatusBadge(fte: number): { label: string; bg: string; text: string } {
  if (fte > 1.0) return { label: 'Over 1.0 FTE', bg: '#FCEBEB', text: '#501313' }
  if (fte === 1.0) return { label: 'Full time', bg: '#EAF3DE', text: '#27500A' }
  if (fte >= 0.8) return { label: 'Near full', bg: '#FAEEDA', text: '#412402' }
  if (fte >= 0.5) return { label: 'On track', bg: '#EAF3DE', text: '#27500A' }
  return { label: 'Part-time', bg: '#F4F3EF', text: '#5F5E5A' }
}

function CapacityTable({ roles, billableHrs, selectedYear }: { roles: Role[]; billableHrs: number; selectedYear: YearFilter }) {
  // Split by type and sort by FTE descending
  const sortByFte = (a: Role, b: Role) => {
    const fteA = getRoleHours(a, selectedYear, billableHrs) / billableHrs
    const fteB = getRoleHours(b, selectedYear, billableHrs) / billableHrs
    return fteB - fteA
  }

  const primeRoles = roles.filter(r => (r.type || 'prime') === 'prime').sort(sortByFte)
  const subRoles = roles.filter(r => r.type === 'sub').sort(sortByFte)

  const gridCols = '220px 100px 80px 160px 100px 1fr'

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div
        className="grid sticky top-0 z-10"
        style={{ gridTemplateColumns: gridCols, background: '#FAFAF9', borderBottom: '0.5px solid #E8E7E2' }}
      >
        <HeaderCell first>Role</HeaderCell>
        <HeaderCell right>Hours/yr</HeaderCell>
        <HeaderCell right>Capacity</HeaderCell>
        <HeaderCell center>FTE loading</HeaderCell>
        <HeaderCell center>Status</HeaderCell>
        <HeaderCell right>Available hrs</HeaderCell>
      </div>

      {/* Prime section */}
      {primeRoles.length > 0 && (
        <>
          <SectionHeader label="Prime labor" color="#111110" gridCols={gridCols} />
          {primeRoles.map(role => (
            <RoleRow key={role.id} role={role} billableHrs={billableHrs} selectedYear={selectedYear} gridCols={gridCols} />
          ))}
        </>
      )}

      {/* Sub section */}
      {subRoles.length > 0 && (
        <>
          <SectionHeader label="Subcontractor labor" color="#6B6A65" gridCols={gridCols} />
          {subRoles.map(role => (
            <RoleRow key={role.id} role={role} billableHrs={billableHrs} selectedYear={selectedYear} gridCols={gridCols} />
          ))}
        </>
      )}
    </div>
  )
}

function RoleRow({ role, billableHrs, selectedYear, gridCols }: { role: Role; billableHrs: number; selectedYear: YearFilter; gridCols: string }) {
  const hrs = getRoleHours(role, selectedYear, billableHrs)
  const capacity = selectedYear === 'all' ? billableHrs * 5 : billableHrs
  const fte = capacity > 0 ? hrs / capacity : 0
  const available = capacity - hrs
  const status = getStatusBadge(fte)

  const hrsColor = fte > 1.0 ? '#A32D2D' : fte >= 0.8 ? '#BA7517' : '#111110'
  const hrsWeight = fte > 1.0 ? 700 : 400

  return (
    <div
      className="grid items-center hover:bg-gray-50 transition-colors"
      style={{ gridTemplateColumns: gridCols, borderBottom: '0.5px solid #F4F3EF' }}
    >
      {/* Role */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111110' }}>{role.name}</div>
        <div style={{ fontSize: 10, color: '#6B6A65' }}>
          {role.selectedLevel || role.icLevel || 'IC3'} &middot; {(role.type || 'prime') === 'prime' ? 'Prime' : 'Sub'}
        </div>
      </div>

      {/* Hours/yr */}
      <div style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: hrsWeight, color: hrsColor }}>
        {hrs.toLocaleString()}
      </div>

      {/* Capacity */}
      <div style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#6B6A65' }}>
        {capacity.toLocaleString()}
      </div>

      {/* FTE loading */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {/* Bar */}
        <div style={{ width: 120, height: 6, background: '#F4F3EF', borderRadius: 3, position: 'relative' }}>
          <div
            style={{
              width: `${Math.min(fte * 100, 100)}%`,
              height: 6,
              borderRadius: 3,
              background: getBarColor(fte),
            }}
          />
          {/* 1.0 FTE marker */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: -3,
              width: 1,
              height: 12,
              background: '#D4D3CE',
            }}
          />
        </div>
        {/* Value */}
        <span style={{ minWidth: 32, textAlign: 'right', fontSize: 11, fontWeight: 700, color: getFteColor(fte) }}>
          {fte.toFixed(2)}
        </span>
      </div>

      {/* Status */}
      <div style={{ padding: '10px 12px', textAlign: 'center' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 3,
            background: status.bg,
            color: status.text,
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Available hrs */}
      <div style={{
        padding: '10px 12px',
        textAlign: 'right',
        fontSize: 13,
        color: available < 0 ? '#A32D2D' : '#6B6A65',
        fontWeight: available < 0 ? 600 : 400,
      }}>
        {available < 0 ? `\u2212${Math.abs(available).toLocaleString()} hrs` : `${available.toLocaleString()} hrs`}
      </div>
    </div>
  )
}

// ==================== TIMELINE VIEW ====================

function TimelineView({ roles, billableHrs, optionYears }: { roles: Role[]; billableHrs: number; optionYears: number }) {
  const yearCols: { key: keyof NonNullable<Role['hoursByYear']>; label: string }[] = [
    { key: 'baseYear', label: 'Base yr' },
    ...(optionYears >= 1 ? [{ key: 'oy1' as const, label: 'OY1' }] : []),
    ...(optionYears >= 2 ? [{ key: 'oy2' as const, label: 'OY2' }] : []),
    ...(optionYears >= 3 ? [{ key: 'oy3' as const, label: 'OY3' }] : []),
    ...(optionYears >= 4 ? [{ key: 'oy4' as const, label: 'OY4' }] : []),
  ]

  const gridCols = `200px ${yearCols.map(() => '1fr').join(' ')}`

  // Sort by base year FTE descending
  const sorted = [...roles].sort((a, b) => {
    const fteA = (a.hoursByYear?.baseYear || 0) / billableHrs
    const fteB = (b.hoursByYear?.baseYear || 0) / billableHrs
    return fteB - fteA
  })

  const primeRoles = sorted.filter(r => (r.type || 'prime') === 'prime')
  const subRoles = sorted.filter(r => r.type === 'sub')

  // Total FTE per year
  const yearTotals = yearCols.map(col => {
    const total = roles.reduce((sum, r) => sum + ((r.hoursByYear?.[col.key] || 0) / billableHrs), 0)
    return total
  })

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div
          className="grid sticky top-0 z-10"
          style={{ gridTemplateColumns: gridCols, background: '#FAFAF9', borderBottom: '0.5px solid #E8E7E2' }}
        >
          <div style={{ padding: '8px 12px 8px 20px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#C4C3BE' }}>
            Role
          </div>
          {yearCols.map(col => (
            <div key={col.key} style={{ padding: '8px 12px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#C4C3BE', textAlign: 'center' }}>
              {col.label}
            </div>
          ))}
        </div>

        {/* Prime section */}
        {primeRoles.length > 0 && (
          <>
            <SectionHeader label="Prime labor" color="#111110" gridCols={gridCols} />
            {primeRoles.map(role => (
              <TimelineRow key={role.id} role={role} yearCols={yearCols} billableHrs={billableHrs} gridCols={gridCols} />
            ))}
          </>
        )}

        {/* Sub section */}
        {subRoles.length > 0 && (
          <>
            <SectionHeader label="Subcontractor labor" color="#6B6A65" gridCols={gridCols} />
            {subRoles.map(role => (
              <TimelineRow key={role.id} role={role} yearCols={yearCols} billableHrs={billableHrs} gridCols={gridCols} />
            ))}
          </>
        )}
      </div>

      {/* Footer — Total FTE */}
      <div
        className="grid shrink-0"
        style={{ gridTemplateColumns: gridCols, borderTop: '2px solid #111110', background: '#FAFAF9' }}
      >
        <div style={{ padding: '10px 12px 10px 20px', fontSize: 11, fontWeight: 700, color: '#111110' }}>
          Total FTE
        </div>
        {yearTotals.map((total, i) => (
          <div key={i} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#111110' }}>
            {total.toFixed(2)} FTE
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineRow({ role, yearCols, billableHrs, gridCols }: {
  role: Role
  yearCols: { key: keyof NonNullable<Role['hoursByYear']>; label: string }[]
  billableHrs: number
  gridCols: string
}) {
  return (
    <div
      className="grid items-center"
      style={{ gridTemplateColumns: gridCols, borderBottom: '0.5px solid #F4F3EF' }}
    >
      {/* Role name */}
      <div style={{ padding: '10px 12px 10px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111110' }}>{role.name}</div>
        <div style={{ fontSize: 10, color: '#6B6A65' }}>
          {role.selectedLevel || role.icLevel || 'IC3'} &middot; {(role.type || 'prime') === 'prime' ? 'Prime' : 'Sub'}
        </div>
      </div>

      {/* Year cells */}
      {yearCols.map(col => {
        const hrs = role.hoursByYear?.[col.key] || 0
        const fte = hrs / billableHrs

        let bg: string
        let textColor: string
        let label: string

        if (hrs === 0) {
          bg = '#FAFAF9'
          textColor = '#C4C3BE'
          label = '\u2014'
        } else if (fte > 1.0) {
          bg = '#FCEBEB'
          textColor = '#A32D2D'
          label = `${fte.toFixed(2)}x FTE`
        } else if (fte >= 0.8) {
          bg = '#FAEEDA'
          textColor = '#BA7517'
          label = `${fte.toFixed(2)}x FTE`
        } else if (fte >= 0.5) {
          bg = '#EAF3DE'
          textColor = '#27500A'
          label = `${fte.toFixed(2)}x FTE`
        } else {
          bg = '#F4F3EF'
          textColor = '#5F5E5A'
          label = `${fte.toFixed(2)}x FTE`
        }

        return (
          <div
            key={col.key}
            style={{
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: bg,
              fontSize: 11,
              fontWeight: 700,
              color: textColor,
              margin: '0 1px',
            }}
          >
            {label}
          </div>
        )
      })}
    </div>
  )
}

function HeaderCell({ children, first, right, center }: { children: React.ReactNode; first?: boolean; right?: boolean; center?: boolean }) {
  return (
    <div style={{
      padding: '8px 12px',
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
      color: '#C4C3BE',
      textAlign: right ? 'right' : center ? 'center' : 'left',
      paddingLeft: first ? 20 : 12,
    }}>
      {children}
    </div>
  )
}

function SectionHeader({ label, color, gridCols }: { label: string; color: string; gridCols: string }) {
  return (
    <div style={{ background: '#F4F3EF', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#5F5E5A' }}>{label}</span>
    </div>
  )
}

// ==================== HELPER COMPONENTS ====================

function StatItem({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span style={{ fontSize: 18, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 11, color: '#6B6A65' }}>{label}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 0.5, height: 20, background: '#E8E7E2' }} />
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
