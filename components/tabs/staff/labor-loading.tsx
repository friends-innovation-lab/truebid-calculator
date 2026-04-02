'use client'

import { useState } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { LayoutGrid, Calendar } from 'lucide-react'

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

      {/* CONTENT AREA — placeholder for Prompts 3-4 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-center py-16">
          <p style={{ fontSize: 13, color: '#6B6A65' }}>
            {rolesWithHours.length === 0
              ? 'No roles with hours assigned yet. Generate a WBS and roles first.'
              : `${rolesWithHours.length} roles loaded. Content coming in next prompts.`
            }
          </p>
        </div>
      </div>
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
