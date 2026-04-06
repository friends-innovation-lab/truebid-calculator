'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { publicBoeApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorAlert } from '@/components/ui/error-alert'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'

// ===== TYPES =====

interface WBSElement {
  id: string
  wbsNumber: string
  title: string
  description?: string
  laborEstimates: {
    roleId: string
    roleName: string
    hours: number
    rate?: number
    hoursByPeriod?: Record<string, number>
  }[]
  totalHours: number
  totalCost: number
}

interface Role {
  id: string
  name: string
  rate?: number
  laborCategory?: string
  hoursByYear?: Record<string, number>
  years?: Record<string, boolean>
}

interface BOEData {
  proposal: {
    title: string
    agency: string
    contractType: string
    solicitationNumber: string
    totalValue: number
    optionYears?: number
  }
  wbsElements: WBSElement[]
  roles: Role[]
  indirectRates: {
    fringe?: number
    overhead?: number
    ga?: number
  } | null
  linkInfo: {
    expiresAt: string | null
    viewCount: number
    approvalStatus?: string | null
  }
}

// ===== CONSTANTS =====

const FRINGE_RATE = 0.2116
const OVERHEAD_RATE = 0.3426
const GA_RATE = 0.1983

// ===== MAIN PAGE =====

export default function PublicBOEPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<BOEData | null>(null)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'summary' | 'indirect'>('summary')

  // Approve / corrections state
  const [showCorrections, setShowCorrections] = useState(false)
  const [correctionNote, setCorrectionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<'approved' | 'corrections' | null>(null)

  const loadData = useCallback(async () => {
    try {
      const response = await publicBoeApi.get(token) as BOEData
      setData(response)
      setError(null)
      if (response.linkInfo.approvalStatus === 'approved') {
        setSubmitted('approved')
      } else if (response.linkInfo.approvalStatus === 'corrections_requested') {
        setSubmitted('corrections')
      }
    } catch (e) {
      if (e instanceof Error) {
        const msg = e.message
        if (msg.includes('invalid') || msg.includes('Invalid') || msg.includes('expired')) {
          setError({ message: 'This link is invalid or has expired.', status: 404 })
        } else if (msg.includes('deactivated')) {
          setError({ message: 'This link has been deactivated by the owner.', status: 410 })
        } else {
          setError({ message: msg, status: 500 })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/boe/${token}/approve`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to approve')
      setSubmitted('approved')
    } catch {
      alert('Failed to approve BOE')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitCorrections = async () => {
    if (!correctionNote.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/boe/${token}/corrections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: correctionNote.trim() }),
      })
      if (!res.ok) throw new Error('Failed to submit corrections')
      setSubmitted('corrections')
      setShowCorrections(false)
    } catch {
      alert('Failed to submit corrections')
    } finally {
      setSubmitting(false)
    }
  }

  // ===== LOADING STATE =====
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <div className="h-14 border-b border-[#E8E7E2] px-6 flex items-center">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="h-11 border-b border-[#E8E7E2] px-6 flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
        <div className="h-16 border-t border-[#E8E7E2] px-6 flex items-center justify-end gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    )
  }

  // ===== ERROR STATE =====
  if (error) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full px-6">
          <ErrorAlert variant="page" title="Unable to load BOE" message={error.message} />
        </div>
        <Toaster />
      </div>
    )
  }

  if (!data) return null

  const { proposal, roles, indirectRates } = data
  const optionYears = proposal.optionYears || 0

  // Build year labels
  const yearLabels = ['Base Year']
  for (let i = 1; i <= optionYears; i++) yearLabels.push(`Year ${i}`)

  // Build role rows for the summary table
  const roleRows = roles.map(role => {
    const baseRate = role.rate || 0
    const fringe = baseRate * FRINGE_RATE
    const overhead = baseRate * OVERHEAD_RATE
    const ga = baseRate * GA_RATE
    const loadedRate = baseRate + fringe + overhead + ga

    // Hours per year
    const hoursByYear: number[] = yearLabels.map((_, idx) => {
      if (role.hoursByYear) {
        const key = idx === 0 ? 'baseYear' : `oy${idx}`
        return role.hoursByYear[key] || 0
      }
      return 0
    })

    const totalHours = hoursByYear.reduce((sum, h) => sum + h, 0)
    const totalCost = loadedRate * totalHours

    return {
      name: role.name,
      laborCategory: role.laborCategory || '',
      hoursByYear,
      baseRate,
      fringe,
      overhead,
      ga,
      loadedRate,
      totalCost,
    }
  })

  const grandTotal = roleRows.reduce((sum, r) => sum + r.totalCost, 0)

  // Format currency
  const fmt = (val: number, decimals = 2) =>
    `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

  // Format percentage
  const fmtPct = (val: number) => `${(val * 100).toFixed(2)}%`

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* ===== HEADER (56px) ===== */}
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-[#E8E7E2]">
        <h1 className="text-lg font-semibold text-gray-900">Basis of Estimate</h1>
        <span className="text-sm text-gray-500 truncate max-w-md">{proposal.title}</span>
      </header>

      {/* ===== TAB BAR (44px) ===== */}
      <div className="h-11 shrink-0 flex items-end px-6 border-b border-[#E8E7E2]">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 pb-2 text-sm border-b-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-gray-900 font-medium text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab('indirect')}
          className={`px-4 pb-2 text-sm border-b-2 transition-colors ${
            activeTab === 'indirect'
              ? 'border-gray-900 font-medium text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Indirect Rates
        </button>
      </div>

      {/* ===== TABLE AREA (flex-1, scrolls independently) ===== */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'summary' ? (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-48">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-40">
                    Labor Category
                  </th>
                  {yearLabels.map(label => (
                    <th key={label} className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Base Rate
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Fringe
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Overhead
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    G&A
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Loaded Rate
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roleRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.laborCategory}</td>
                    {row.hoursByYear.map((hours, yIdx) => (
                      <td key={yIdx} className="px-4 py-3 text-right text-gray-600 tabular-nums">
                        {hours > 0 ? hours.toLocaleString() : '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(row.baseRate)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{fmt(row.fringe)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{fmt(row.overhead)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{fmt(row.ga)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(row.loadedRate)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(row.totalCost, 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={2 + yearLabels.length + 5} className="px-4 py-3 font-semibold text-right text-sm">
                    Total
                  </td>
                  <td className="px-4 py-3 font-semibold text-sm text-right tabular-nums">
                    {fmt(grandTotal, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="h-full overflow-auto p-6">
            {/* Rate Cards */}
            <div className="grid grid-cols-3 gap-6 max-w-2xl">
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">Fringe</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fmtPct(indirectRates?.fringe || FRINGE_RATE)}
                </p>
              </Card>
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">Overhead</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fmtPct(indirectRates?.overhead || OVERHEAD_RATE)}
                </p>
              </Card>
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">G&A</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fmtPct(indirectRates?.ga || GA_RATE)}
                </p>
              </Card>
            </div>

            {/* Rate Basis Notes */}
            <div className="mt-6 text-sm text-gray-500 space-y-1">
              <p>Rate basis: 2,080 hours/year</p>
              <p>Calculated per FAR 31.2 cost principles</p>
            </div>
          </div>
        )}
      </div>

      {/* ===== CORRECTIONS SLIDE-UP ===== */}
      {showCorrections && !submitted && (
        <div className="shrink-0 border-t border-[#E8E7E2] bg-gray-50 px-6 py-4">
          <Textarea
            placeholder="Describe what needs to be corrected..."
            value={correctionNote}
            onChange={(e) => setCorrectionNote(e.target.value)}
            rows={3}
            className="mb-3"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmitCorrections}
              disabled={submitting || !correctionNote.trim()}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Feedback
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCorrections(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ===== FOOTER (64px) ===== */}
      <footer className="h-16 shrink-0 flex items-center justify-end gap-3 px-6 border-t border-[#E8E7E2] bg-white">
        {submitted === 'approved' ? (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">BOE Approved</span>
          </div>
        ) : submitted === 'corrections' ? (
          <div className="flex items-center gap-2 text-amber-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">Corrections Sent</span>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => setShowCorrections(true)}
              disabled={submitting}
            >
              Request Corrections
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Approve BOE
            </Button>
          </>
        )}
      </footer>

      <Toaster />
    </div>
  )
}
