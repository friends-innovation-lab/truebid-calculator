'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { proposalsApi } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface NewProposalModalProps {
  open: boolean
  onClose: () => void
}

const CONTRACT_TYPES = [
  { value: 'tm', label: 'T&M' },
  { value: 'ffp', label: 'FFP' },
  { value: 'cpff', label: 'CPFF' },
]

const SET_ASIDES = [
  '8(a) Sole Source',
  '8(a) Competitive',
  'SDVOSB',
  'WOSB',
  'HUBZone',
  'Small Business',
  'Full & Open',
]

export function NewProposalModal({ open, onClose }: NewProposalModalProps) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [solNumber, setSolNumber] = useState('')
  const [agency, setAgency] = useState('')
  const [contractType, setContractType] = useState('tm')
  const [optionYears, setOptionYears] = useState(4)
  const [setAside, setSetAside] = useState('8(a) Sole Source')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nameError, setNameError] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError(true)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await proposalsApi.create({
        title: name.trim(),
        solicitation_number: solNumber.trim() || undefined,
        agency: agency.trim() || undefined,
        status: 'draft',
        contract_type: contractType,
        total_value: 0,
        team_size: 0,
        progress: 0,
        starred: false,
        archived: false,
        working_data: {
          proposalSetup: {
            contractType,
            solicitationNumber: solNumber.trim(),
            agency: agency.trim(),
            optionYears,
            setAside,
            billableHoursPerYear: 1920,
            escalationRate: 0.03,
          },
          solicitation: {
            title: name.trim(),
            solicitationNumber: solNumber.trim(),
            clientAgency: agency.trim(),
            contractType: contractType.toUpperCase(),
            periodOfPerformance: { baseYear: true, optionYears },
            setAside: setAside.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            requiresClearance: false,
            placeOfPerformance: { type: '', locations: [], travelRequired: false },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      }) as { proposal: { id: string } }

      router.push(`/${response.proposal.id}?tab=solicitation`)
      onClose()
    } catch (error) {
      console.error('Failed to create proposal:', error)
      toast.error('Failed to create proposal')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto"
          style={{
            width: 520,
            background: '#FFFFFF',
            borderRadius: 14,
            border: '0.5px solid #E8E7E2',
            padding: 28,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111110', letterSpacing: '-0.4px' }}>
            New proposal
          </h2>
          <p style={{ fontSize: 13, color: '#9B9A95', marginTop: 4 }}>
            Set up the basics. You can change everything later.
          </p>

          <div style={{ borderTop: '0.5px solid #E8E7E2', margin: '20px 0' }} />

          {/* Fields */}
          <div className="space-y-4">
            {/* 1. Proposal Name */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>
                Proposal name
              </label>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(false) }}
                placeholder="e.g. Consular Appointment Management Platform"
                autoFocus
                className={nameError ? 'border-red-400 ring-1 ring-red-400' : ''}
              />
            </div>

            {/* 2. Solicitation Number */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>
                Solicitation number
              </label>
              <Input
                value={solNumber}
                onChange={(e) => setSolNumber(e.target.value)}
                placeholder="e.g. 19AQMM25Q0273"
                className="font-mono"
              />
              <p style={{ fontSize: 11, color: '#9B9A95', marginTop: 4 }}>Optional — add it when you have it</p>
            </div>

            {/* 3. Agency */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>
                Agency
              </label>
              <Input
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder="e.g. Dept. of State"
              />
            </div>
          </div>

          <div style={{ borderTop: '0.5px solid #E8E7E2', margin: '20px 0' }} />

          <div className="space-y-4">
            {/* 4. Contract Type */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>
                Contract type
              </label>
              <div style={{ display: 'flex', border: '0.5px solid #E8E7E2', borderRadius: 7, padding: 3, gap: 1 }}>
                {CONTRACT_TYPES.map(ct => (
                  <button
                    key={ct.value}
                    onClick={() => setContractType(ct.value)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: 12,
                      fontWeight: contractType === ct.value ? 600 : 500,
                      background: contractType === ct.value ? '#111110' : '#F4F3EF',
                      color: contractType === ct.value ? '#FFFFFF' : '#5F5E5A',
                      border: 'none',
                      borderRadius: 5,
                      cursor: 'pointer',
                    }}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Option Years */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>
                Option years
              </label>
              <p style={{ fontSize: 11, color: '#9B9A95', marginBottom: 8 }}>Beyond the base year</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setOptionYears(n)}
                    style={{
                      width: 40,
                      height: 34,
                      fontSize: 13,
                      fontWeight: 600,
                      background: optionYears === n ? '#111110' : '#F4F3EF',
                      color: optionYears === n ? '#FFFFFF' : '#5F5E5A',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
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

            {/* 6. Set-Aside */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111110', display: 'block', marginBottom: 6 }}>
                Set-aside type
              </label>
              <select
                value={setAside}
                onChange={(e) => setSetAside(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  fontSize: 13,
                  color: '#111110',
                  border: '0.5px solid #E8E7E2',
                  borderRadius: 6,
                  padding: '0 10px',
                  background: '#FFFFFF',
                }}
              >
                {SET_ASIDES.map(sa => <option key={sa} value={sa}>{sa}</option>)}
              </select>
            </div>
          </div>

          <div style={{ borderTop: '0.5px solid #E8E7E2', margin: '20px 0' }} />

          {/* Footer */}
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              style={{ fontSize: 13, fontWeight: 500, color: '#5F5E5A', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              style={{
                fontSize: 13,
                fontWeight: 600,
                background: '#111110',
                color: '#FFFFFF',
                padding: '9px 20px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                opacity: isSubmitting || !name.trim() ? 0.4 : 1,
              }}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" style={{ verticalAlign: '-3px' }} />Creating...</>
              ) : (
                'Create Proposal →'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
