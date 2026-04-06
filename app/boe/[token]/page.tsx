'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { publicBoeApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorAlert } from '@/components/ui/error-alert'
import { Clock, CheckCircle2, Loader2 } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { contractTypeLabels } from '@/lib/solicitation-type'
import { formatCurrency } from '@/lib/utils'

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto py-12 px-6 space-y-6">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-8 w-64 rounded-lg" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                <span className="text-muted-foreground font-normal">TrueBid</span> Basis of Estimate
              </h1>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              Read-only
            </Badge>
          </div>
        </div>
      </header>

      {/* Proposal context strip */}
      <div className="bg-gray-100 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap items-center gap-4 text-sm">
          {proposal.title && <span className="font-medium">{proposal.title}</span>}
          {proposal.agency && <span className="text-muted-foreground">&middot; {proposal.agency}</span>}
          {proposal.contractType && (
            <Badge variant="secondary" className="text-xs">
              {contractTypeLabels[proposal.contractType] || proposal.contractType}
            </Badge>
          )}
          {proposal.solicitationNumber && (
            <span className="text-muted-foreground text-xs font-mono">
              {proposal.solicitationNumber}
            </span>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-muted-foreground hover:text-gray-700'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('indirect')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'indirect'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-muted-foreground hover:text-gray-700'
            }`}
          >
            Indirect Rates
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {activeTab === 'summary' ? (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-3 font-medium text-gray-700">Role</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-700">Labor Category</th>
                  {yearLabels.map(label => (
                    <th key={label} className="text-right py-3 px-3 font-medium text-gray-700">{label} Hours</th>
                  ))}
                  <th className="text-right py-3 px-3 font-medium text-gray-700">Base Rate</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-700">Fringe</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-700">Overhead</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-700">G&A</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-700">Loaded Rate</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {roleRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{row.name}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{row.laborCategory}</td>
                    {row.hoursByYear.map((hours, yIdx) => (
                      <td key={yIdx} className="py-2.5 px-3 text-right text-muted-foreground">
                        {hours > 0 ? hours.toLocaleString() : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right">{formatCurrency(row.baseRate)}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(row.fringe)}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(row.overhead)}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(row.ga)}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(row.loadedRate)}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(row.totalCost, 0)}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 font-medium">
                  <td className="py-2.5 px-3" colSpan={2}>Total</td>
                  {yearLabels.map((_, yIdx) => (
                    <td key={yIdx} className="py-2.5 px-3 text-right">
                      {roleRows.reduce((sum, r) => sum + r.hoursByYear[yIdx], 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="py-2.5 px-3" colSpan={4}></td>
                  <td className="py-2.5 px-3 text-right">
                    {formatCurrency(roleRows.reduce((sum, r) => sum + r.totalCost, 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        ) : (
          <Card className="space-y-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-3 font-medium text-gray-700">Rate Type</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-700">Percentage</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-700">Basis</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 px-3 font-medium">Fringe</td>
                  <td className="py-2.5 px-3 text-right">{((indirectRates?.fringe || FRINGE_RATE) * 100).toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-muted-foreground">Direct labor</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 px-3 font-medium">Overhead</td>
                  <td className="py-2.5 px-3 text-right">{((indirectRates?.overhead || OVERHEAD_RATE) * 100).toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-muted-foreground">Direct labor + fringe</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 px-3 font-medium">G&A</td>
                  <td className="py-2.5 px-3 text-right">{((indirectRates?.ga || GA_RATE) * 100).toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-muted-foreground">Total cost input</td>
                </tr>
              </tbody>
            </table>

            <div className="px-3 pb-3 text-xs text-muted-foreground">
              <p>Rate basis: 2,080 hours/year</p>
              <p className="mt-1">
                Rates calculated on 2,080-hour annual basis per FAR 31.2 cost principles.
              </p>
            </div>
          </Card>
        )}

        {/* Approve / Request Corrections */}
        <div className="mt-8 space-y-4">
          {submitted === 'approved' ? (
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700">BOE approved.</p>
                  <p className="text-xs text-muted-foreground">Friends From The City has been notified.</p>
                </div>
              </div>
            </Card>
          ) : submitted === 'corrections' ? (
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-700">Corrections sent.</p>
                  <p className="text-xs text-muted-foreground">Friends From The City has been notified.</p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Approve BOE
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCorrections(true)}
                  disabled={submitting}
                >
                  Request Corrections
                </Button>
              </div>

              {showCorrections && (
                <Card className="p-4 space-y-3">
                  <Textarea
                    placeholder="Describe what needs to be corrected..."
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSubmitCorrections}
                      disabled={submitting || !correctionNote.trim()}
                    >
                      {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Send to TrueBid
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCorrections(false)}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>
            Generated with TrueBid &middot; View count: {data.linkInfo.viewCount}
            {data.linkInfo.expiresAt && (
              <span> &middot; Expires: {new Date(data.linkInfo.expiresAt).toLocaleDateString()}</span>
            )}
          </p>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
