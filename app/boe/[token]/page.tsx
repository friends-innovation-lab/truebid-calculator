'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { publicBoeApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorAlert } from '@/components/ui/error-alert'
import { FileText, Clock, Users, DollarSign } from 'lucide-react'
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
  }[]
  totalHours: number
  totalCost: number
}

interface Role {
  id: string
  name: string
  rate?: number
}

interface BOEData {
  proposal: {
    title: string
    agency: string
    contractType: string
    solicitationNumber: string
    totalValue: number
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
  }
}

// ===== MAIN PAGE =====

export default function PublicBOEPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<BOEData | null>(null)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const response = await publicBoeApi.get(token) as BOEData
      setData(response)
      setError(null)
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-12 px-6 space-y-6">
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

  const { proposal, wbsElements, roles, indirectRates, linkInfo } = data

  // Calculate totals
  const totalHours = wbsElements.reduce((sum, el) => sum + el.totalHours, 0)
  const totalCost = wbsElements.reduce((sum, el) => sum + el.totalCost, 0)

  // Hours by role across all WBS elements
  const hoursByRole: Record<string, number> = {}
  wbsElements.forEach(el => {
    el.laborEstimates.forEach(le => {
      hoursByRole[le.roleName] = (hoursByRole[le.roleName] || 0) + le.hours
    })
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
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
        <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap items-center gap-4 text-sm">
          {proposal.title && <span className="font-medium">{proposal.title}</span>}
          {proposal.agency && <span className="text-muted-foreground">· {proposal.agency}</span>}
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

      {/* Summary Cards */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">WBS Elements</p>
              <p className="text-lg font-semibold">{wbsElements.length}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <p className="text-lg font-semibold">{totalHours.toLocaleString()}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Labor Cost</p>
              <p className="text-lg font-semibold">{formatCurrency(totalCost, 0)}</p>
            </div>
          </Card>
        </div>

        {/* Roles Summary */}
        {roles.length > 0 && (
          <Card className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Labor Categories</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Role</th>
                    <th className="text-right py-2 font-medium">Hours</th>
                    {roles.some(r => r.rate) && (
                      <th className="text-right py-2 font-medium">Rate</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {roles.map(role => (
                    <tr key={role.id} className="border-b border-gray-100">
                      <td className="py-2">{role.name}</td>
                      <td className="text-right py-2 text-muted-foreground">
                        {(hoursByRole[role.name] || 0).toLocaleString()}
                      </td>
                      {roles.some(r => r.rate) && (
                        <td className="text-right py-2 text-muted-foreground">
                          {role.rate ? formatCurrency(role.rate) : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Indirect Rates */}
        {indirectRates && (indirectRates.fringe || indirectRates.overhead || indirectRates.ga) && (
          <Card className="mb-6">
            <h2 className="text-sm font-medium mb-4">Indirect Rates</h2>
            <div className="flex gap-6 text-sm">
              {indirectRates.fringe !== undefined && (
                <div>
                  <span className="text-muted-foreground">Fringe:</span>{' '}
                  <span className="font-medium">{(indirectRates.fringe * 100).toFixed(1)}%</span>
                </div>
              )}
              {indirectRates.overhead !== undefined && (
                <div>
                  <span className="text-muted-foreground">Overhead:</span>{' '}
                  <span className="font-medium">{(indirectRates.overhead * 100).toFixed(1)}%</span>
                </div>
              )}
              {indirectRates.ga !== undefined && (
                <div>
                  <span className="text-muted-foreground">G&A:</span>{' '}
                  <span className="font-medium">{(indirectRates.ga * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* WBS Elements */}
        <h2 className="text-lg font-semibold mb-4">Work Breakdown Structure</h2>
        <div className="space-y-4">
          {wbsElements.map(el => (
            <Card key={el.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{el.wbsNumber}</span>
                    <h3 className="text-sm font-medium">{el.title}</h3>
                  </div>
                  {el.description && (
                    <p className="text-xs text-muted-foreground mt-1">{el.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{el.totalHours.toLocaleString()} hrs</p>
                  {el.totalCost > 0 && (
                    <p className="text-xs text-muted-foreground">{formatCurrency(el.totalCost, 0)}</p>
                  )}
                </div>
              </div>

              {el.laborEstimates.length > 0 && (
                <div className="border-t pt-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {el.laborEstimates.map((le, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="text-muted-foreground">{le.roleName}:</span>{' '}
                        <span className="font-medium">{le.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>
            Generated with TrueBid · View count: {linkInfo.viewCount}
            {linkInfo.expiresAt && (
              <span> · Expires: {new Date(linkInfo.expiresAt).toLocaleDateString()}</span>
            )}
          </p>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
