'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'
import { proposalsApi } from '@/lib/api'

interface SetupPanelProps {
  open: boolean
  onClose: () => void
  proposalId: string
}

const CONTRACT_TYPES = [
  { value: 'tm', label: 'T&M' },
  { value: 'ffp', label: 'FFP' },
  { value: 'cpff', label: 'CPFF' },
]

const SET_ASIDES = [
  '8(a) Sole Source', '8(a) Competitive', 'SDVOSB', 'WOSB',
  'HUBZone', 'Small Business', 'Full & Open',
]

export function SetupPanel({ open, onClose, proposalId }: SetupPanelProps) {
  const { solicitation, updateSolicitation } = useAppContext()

  // Read from solicitation context (populated during creation)
  const [contractType, setContractType] = useState(
    solicitation?.contractType?.toLowerCase() === 'ffp' ? 'ffp'
    : solicitation?.contractType?.toLowerCase() === 'cpff' ? 'cpff'
    : 'tm'
  )
  const [optionYears, setOptionYears] = useState(solicitation?.periodOfPerformance?.optionYears ?? 4)
  const [setAside, setSetAside] = useState(solicitation?.setAside || '8(a) Sole Source')
  const [billableHours, setBillableHours] = useState(solicitation?.pricingSettings?.billableHours || 1920)
  const [escalation, setEscalation] = useState(solicitation?.pricingSettings?.laborEscalation || 3)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  // Sync initial values only when panel first opens (not on every solicitation change)
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (open && !hasInitialized.current) {
      hasInitialized.current = true
      const ct = solicitation?.contractType?.toLowerCase()
      if (ct === 'ffp') setContractType('ffp')
      else if (ct === 'cpff') setContractType('cpff')
      else setContractType('tm')
      setOptionYears(solicitation?.periodOfPerformance?.optionYears ?? 4)
    }
    if (!open) hasInitialized.current = false
  }, [open, solicitation])

  const save = (overrides: { ct?: string; oy?: number; sa?: string; bh?: number; esc?: number }) => {
    const ct = overrides.ct ?? contractType
    const oy = overrides.oy ?? optionYears
    const sa = overrides.sa ?? setAside
    const bh = overrides.bh ?? billableHours
    const esc = overrides.esc ?? escalation

    setSaveStatus('saving')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        const ctMap: Record<string, 'T&M' | 'FFP' | 'CPFF'> = { tm: 'T&M', ffp: 'FFP', cpff: 'CPFF' }
        updateSolicitation({
          contractType: ctMap[ct] || 'T&M',
          periodOfPerformance: { baseYear: true, optionYears: oy },
          setAside: sa as never,
          pricingSettings: {
            billableHours: bh,
            profitMargin: solicitation?.pricingSettings?.profitMargin || 8,
            escalationEnabled: true,
            laborEscalation: esc,
            odcEscalation: solicitation?.pricingSettings?.odcEscalation || 0,
          },
        })

        await proposalsApi.update(proposalId, {
          working_data: {
            proposalSetup: {
              contractType: ct,
              optionYears: oy,
              setAside: sa,
              billableHoursPerYear: bh,
              escalationRate: esc / 100,
            },
          },
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('idle')
      }
    }, 300)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[480px] bg-white z-50 flex flex-col" style={{ borderLeft: '0.5px solid #E8E7E2' }}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between" style={{ height: 48, borderBottom: '0.5px solid #E8E7E2', padding: '0 16px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111110' }}>Proposal Setup</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close">
            <X className="w-4 h-4" style={{ color: '#9B9A95' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Contract Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>Contract type</label>
            <div style={{ display: 'flex', border: '0.5px solid #E8E7E2', borderRadius: 7, padding: 3, gap: 1 }}>
              {CONTRACT_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => { setContractType(ct.value); save({ ct: ct.value }) }}
                  style={{
                    flex: 1, padding: '7px 0', fontSize: 12,
                    fontWeight: contractType === ct.value ? 600 : 500,
                    background: contractType === ct.value ? '#111110' : '#F4F3EF',
                    color: contractType === ct.value ? '#FFFFFF' : '#5F5E5A',
                    border: 'none', borderRadius: 5, cursor: 'pointer',
                  }}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Option Years */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>Option years</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => { setOptionYears(n); save({ oy: n }) }}
                  style={{
                    width: 40, height: 34, fontSize: 13, fontWeight: 600,
                    background: optionYears === n ? '#111110' : '#F4F3EF',
                    color: optionYears === n ? '#FFFFFF' : '#5F5E5A',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#9B9A95', marginTop: 6 }}>
              Base Year + {optionYears} Option Year{optionYears !== 1 ? 's' : ''} = {optionYears + 1} year contract
            </p>
          </div>

          {/* Set-Aside */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>Set-aside type</label>
            <select
              value={setAside}
              onChange={(e) => { setSetAside(e.target.value); save({ sa: e.target.value }) }}
              style={{ width: '100%', height: 38, fontSize: 13, color: '#111110', border: '0.5px solid #E8E7E2', borderRadius: 6, padding: '0 10px', background: '#FFFFFF' }}
            >
              {SET_ASIDES.map(sa => <option key={sa} value={sa}>{sa}</option>)}
            </select>
          </div>

          <div style={{ borderTop: '0.5px solid #E8E7E2', margin: '20px 0' }} />

          {/* Billable Hours */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>Billable hours per year</label>
            <Input
              type="number"
              value={billableHours}
              onChange={(e) => setBillableHours(parseInt(e.target.value) || 1920)}
              onBlur={() => save({})  /* uses current state values */}
              className="text-sm"
            />
            <p style={{ fontSize: 11, color: '#9B9A95', marginTop: 4 }}>1.0 FTE = {billableHours.toLocaleString()} hrs/yr</p>
          </div>

          {/* Escalation Rate */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>Escalation rate</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={escalation}
                onChange={(e) => setEscalation(parseFloat(e.target.value) || 3)}
                onBlur={() => save({})  /* uses current state values */}
                className="text-sm w-20"
              />
              <span style={{ fontSize: 13, color: '#5F5E5A' }}>% per year</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end" style={{ height: 52, borderTop: '0.5px solid #E8E7E2', padding: '0 16px' }}>
          {saveStatus === 'saving' && <span style={{ fontSize: 12, color: '#9B9A95', marginRight: 12 }}>Saving...</span>}
          {saveStatus === 'saved' && <span style={{ fontSize: 12, color: '#639922', marginRight: 12 }}>✓ Saved</span>}
          <button onClick={onClose} style={{ fontSize: 11, color: '#5F5E5A', background: 'none', border: '0.5px solid #E8E7E2', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </>
  )
}
