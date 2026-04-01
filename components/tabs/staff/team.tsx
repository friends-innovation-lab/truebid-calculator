'use client'

import React from 'react'
import { useAppContext } from '@/contexts/app-context'

// ==================== TYPES ====================

interface TeamStats {
  primeCount: number
  subCount: number
  partnerCount: number
  directorCount: number
  primeWorkShare: number
}

interface ComplianceRule {
  clause: string
  label: string
  rule: string
  threshold: number
}

// ==================== COMPLIANCE UTILITY ====================

function getSetAsideCompliance(setAside: string): ComplianceRule | null {
  const rules: Record<string, ComplianceRule> = {
    '8a_sole_source': {
      clause: 'FAR 52.219-14',
      label: '8(a) Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    '8a_competitive': {
      clause: 'FAR 52.219-14',
      label: '8(a) Competitive',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    '8a': {
      clause: 'FAR 52.219-14',
      label: '8(a) Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'sdvosb': {
      clause: 'FAR 52.219-27',
      label: 'SDVOSB Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'wosb': {
      clause: 'FAR 52.219-29',
      label: 'WOSB Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'edwosb': {
      clause: 'FAR 52.219-29',
      label: 'EDWOSB Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'hubzone': {
      clause: 'FAR 52.219-3',
      label: 'HUBZone Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'small_business': {
      clause: 'FAR 52.219-14',
      label: 'Small Business Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'small-business': {
      clause: 'FAR 52.219-14',
      label: 'Small Business Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    }
  }
  return rules[setAside] || null
}

// ==================== MAIN COMPONENT ====================

export function Team() {
  const { selectedRoles, proposalSetup } = useAppContext()

  // Calculate prime work share from roles
  const totalHours = selectedRoles.reduce(
    (sum, r) => sum + (r.hoursByYear?.baseYear || 0), 0
  )
  const primeHours = selectedRoles
    .filter(r => (r.type || 'prime') === 'prime')
    .reduce(
      (sum, r) => sum + (r.hoursByYear?.baseYear || 0), 0
    )
  const primeShare = totalHours > 0
    ? Math.round((primeHours / totalHours) * 100)
    : 0

  // Calculate stats
  const stats: TeamStats = {
    primeCount: selectedRoles.filter(r => (r.type || 'prime') === 'prime').length,
    subCount: selectedRoles.filter(r => r.type === 'sub').length,
    partnerCount: 0, // Will be populated from teaming partners
    directorCount: 0, // Will be populated from directors
    primeWorkShare: primeShare,
  }

  // Get compliance rule for current set-aside
  const compliance = getSetAsideCompliance(proposalSetup?.setAside || '')

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#FFFFFF' }}>
      {/* PAGE HEADER */}
      <div className="shrink-0" style={{ padding: '20px 24px 0', borderBottom: '0.5px solid #E8E7E2' }}>
        {/* Eyebrow */}
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#C4C3BE',
          letterSpacing: '0.5px',
        }}>
          Staff · Team
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#111110',
          letterSpacing: '-0.5px',
          marginTop: 4,
        }}>
          Who&apos;s on this proposal with us?
        </h1>

        {/* Stats row */}
        <div className="flex items-center gap-6" style={{ marginTop: 14, marginBottom: 14 }}>
          <StatItem value={stats.primeCount} label="prime" />
          <Divider />
          <StatItem value={stats.subCount} label="subcontractors" />
          <Divider />
          <StatItem value={stats.partnerCount} label="teaming partners" />
          <Divider />
          <StatItem value={stats.directorCount} label="directors" />
          <Divider />
          <StatItem value={`${stats.primeWorkShare}%`} label="prime work share" />
        </div>
      </div>

      {/* COMPLIANCE BANNER */}
      <ComplianceBanner compliance={compliance} primeShare={primeShare} />

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto">
        {/* TEAM MEMBERS section - placeholder for Prompt 3 */}
        <section style={{ padding: '24px' }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: '#6B6A65',
            marginBottom: 12,
          }}>
            Team Members
          </div>
          {/* Content will be added in Prompt 3 */}
        </section>

        {/* DIRECTOR REVIEW section - placeholder for Prompt 4 */}
        <section style={{ padding: '0 24px 24px' }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: '#6B6A65',
            marginBottom: 12,
          }}>
            Director Review
          </div>
          {/* Content will be added in Prompt 4 */}
        </section>
      </div>
    </div>
  )
}

// ==================== COMPLIANCE BANNER ====================

function ComplianceBanner({ compliance, primeShare }: { compliance: ComplianceRule | null; primeShare: number }) {
  // Don't render banner for Full & Open or if no set-aside configured
  if (!compliance) return null

  // Determine state
  const isCompliant = primeShare >= compliance.threshold
  const isWarning = primeShare >= 40 && primeShare < compliance.threshold
  const isDanger = primeShare < 40

  // State-based colors
  let backgroundColor: string
  let borderColor: string
  let accentColor: string

  if (isCompliant) {
    backgroundColor = '#FBF9F0'
    borderColor = '#F5C200'
    accentColor = '#639922'
  } else if (isWarning) {
    backgroundColor = '#FEF9F0'
    borderColor = '#BA7517'
    accentColor = '#BA7517'
  } else {
    backgroundColor = '#FEFCFC'
    borderColor = '#A32D2D'
    accentColor = '#A32D2D'
  }

  // Extract clause number (e.g., "52.219-14" from "FAR 52.219-14")
  const clauseNumber = compliance.clause.replace('FAR ', '')

  return (
    <div
      className="shrink-0 flex items-center gap-2.5"
      style={{
        margin: '10px 16px 0',
        padding: '10px 14px',
        background: backgroundColor,
        borderLeft: `2px solid ${borderColor}`,
        borderRadius: '0 7px 7px 0',
      }}
    >
      {/* Left icon - clause number */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          background: '#111110',
          color: '#F5C200',
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {clauseNumber}
      </div>

      {/* Middle - compliance text */}
      <div style={{ flex: 1, fontSize: 12, color: '#5F5E5A', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: '#111110' }}>{compliance.label} compliance: </span>
        {compliance.rule}. Must be documented before submission.
        {isWarning && (
          <div style={{ fontSize: 11, color: '#BA7517', marginTop: 2 }}>
            Approaching minimum — review subcontractor work allocation
          </div>
        )}
        {isDanger && (
          <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 2 }}>
            Below required minimum — this proposal may not be compliant
          </div>
        )}
      </div>

      {/* Right - percentage and progress bar */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: accentColor }}>
          {primeShare}%
        </div>
        <div style={{ fontSize: 9, color: '#6B6A65', marginBottom: 4 }}>
          FFTC prime share
        </div>
        {/* Progress bar */}
        <div style={{ width: 120, height: 4, background: '#E8E7E2', borderRadius: 2, position: 'relative' }}>
          <div
            style={{
              width: `${Math.min(primeShare, 100)}%`,
              height: '100%',
              background: accentColor,
              borderRadius: 2,
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: '#6B6A65', marginTop: 2 }}>
          Required: {compliance.threshold}%
        </div>
      </div>
    </div>
  )
}

// ==================== SHARED UI ATOMS ====================

function StatItem({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span style={{ fontSize: 20, fontWeight: 800, color: '#111110' }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: '#6B6A65' }}>
        {label}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 0.5, height: 28, background: '#E8E7E2' }} />
}
