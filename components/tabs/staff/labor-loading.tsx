'use client'

import { useState } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { LayoutGrid, Calendar } from 'lucide-react'

// ==================== MAIN COMPONENT ====================

export function LaborLoading() {
  const {
    selectedRoles,
    proposalSetup,
  } = useAppContext()

  const [viewMode, setViewMode] = useState<'role' | 'year'>('role')

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

      {/* CONTENT AREA — placeholder for Prompts 2-4 */}
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
