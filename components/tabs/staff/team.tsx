'use client'

import React from 'react'

// ==================== TYPES ====================

// Placeholder stats - will be computed from context in Prompt 2+
interface TeamStats {
  primeCount: number
  subCount: number
  partnerCount: number
  directorCount: number
  primeWorkShare: number
}

// ==================== MAIN COMPONENT ====================

export function Team() {
  // Placeholder stats for scaffold
  const stats: TeamStats = {
    primeCount: 0,
    subCount: 0,
    partnerCount: 0,
    directorCount: 0,
    primeWorkShare: 0,
  }

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

      {/* COMPLIANCE BANNER - placeholder for Prompt 2 */}
      <div className="shrink-0" />

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
