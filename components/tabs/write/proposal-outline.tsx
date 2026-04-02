'use client'

import { useAppContext, type OutlineSection } from '@/contexts/app-context'
import { FileDown, Sparkles } from 'lucide-react'

// ==================== MAIN COMPONENT ====================

export function ProposalOutlinePage() {
  const { outline } = useAppContext()

  // Calculate stats from outline
  const allSections: OutlineSection[] = []
  outline?.volumes.forEach(v => {
    v.sections.forEach(s => {
      allSections.push(s)
    })
  })

  const volumeCount = outline?.volumes.length || 0
  const sectionCount = allSections.length
  const draftedCount = allSections.filter(s => s.status === 'draft').length
  const inProgressCount = allSections.filter(s => s.status === 'in_progress').length
  const notStartedCount = allSections.filter(s => s.status === 'not_started').length

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
          Write &middot; Outline
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#111110',
          letterSpacing: -0.5,
          marginBottom: 14,
        }}>
          How is this proposal structured?
        </h1>

        {/* Stats row */}
        <div className="flex items-center gap-6" style={{ paddingBottom: 14 }}>
          <StatItem value={volumeCount} label="volumes" color="#111110" />
          <Divider />
          <StatItem value={sectionCount} label="sections" color="#111110" />
          <Divider />
          <StatItem value={draftedCount} label="drafted" color="#639922" />
          <Divider />
          <StatItem value={inProgressCount} label="in progress" color="#BA7517" />
          <Divider />
          <StatItem value={notStartedCount} label="not started" color="#9B9A95" />

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 600,
                color: '#5F5E5A',
                background: 'transparent',
                border: '0.5px solid #E8E7E2',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <FileDown className="w-3.5 h-3.5" />
              Export outline
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 600,
                color: '#111110',
                background: '#F5C200',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate from Section L
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT AREA — placeholder for Prompts 2-3 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p style={{ fontSize: 13, color: '#6B6A65' }}>
            {volumeCount === 0
              ? 'No outline yet. Click "Generate from Section L" to create one from your RFP instructions.'
              : `${volumeCount} volumes, ${sectionCount} sections loaded.`
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
