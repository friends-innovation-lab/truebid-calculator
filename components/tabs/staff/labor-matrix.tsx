'use client'

import { useMemo } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { Card } from '@/components/ui/card'
import { Grid3X3 } from 'lucide-react'

export function LaborMatrix() {
  const { estimateWbsElements, selectedRoles } = useAppContext()

  // Extract unique roles from either selectedRoles or WBS labor estimates
  const roles = useMemo(() => {
    const roleSet = new Set<string>()

    // Add roles from selectedRoles
    selectedRoles.forEach(r => {
      if (r.name) roleSet.add(r.name)
    })

    // Add roles from WBS labor estimates
    estimateWbsElements.forEach(el => {
      el.laborEstimates?.forEach(le => {
        if (le.roleName) roleSet.add(le.roleName)
      })
    })

    return Array.from(roleSet).sort()
  }, [selectedRoles, estimateWbsElements])

  // Calculate hours per role per WBS element
  const matrix = useMemo(() => {
    return estimateWbsElements.map(el => {
      const hoursByRole: Record<string, number> = {}

      el.laborEstimates?.forEach(le => {
        if (le.roleName) {
          // Sum up hours across all periods
          const totalHours = le.hoursByPeriod
            ? Object.values(le.hoursByPeriod).reduce((sum, h) => sum + (h || 0), 0)
            : 0
          hoursByRole[le.roleName] = (hoursByRole[le.roleName] || 0) + totalHours
        }
      })

      return {
        id: el.id,
        wbsNumber: el.wbsNumber,
        title: el.title,
        hoursByRole,
        totalHours: Object.values(hoursByRole).reduce((sum, h) => sum + h, 0),
      }
    })
  }, [estimateWbsElements])

  // Calculate totals per role
  const totals = useMemo(() => {
    const roleTotal: Record<string, number> = {}
    roles.forEach(role => {
      roleTotal[role] = matrix.reduce((sum, row) => sum + (row.hoursByRole[role] || 0), 0)
    })
    return roleTotal
  }, [matrix, roles])

  const grandTotal = Object.values(totals).reduce((sum, h) => sum + h, 0)

  if (estimateWbsElements.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Labor Matrix</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Hours breakdown by WBS element and role.
          </p>
        </div>

        <Card className="p-12 text-center">
          <Grid3X3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No WBS Elements</h3>
          <p className="text-sm text-muted-foreground">
            Add WBS elements in the Estimate tab to see the labor matrix.
          </p>
        </Card>
      </div>
    )
  }

  if (roles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Labor Matrix</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Hours breakdown by WBS element and role.
          </p>
        </div>

        <Card className="p-12 text-center">
          <Grid3X3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Roles Defined</h3>
          <p className="text-sm text-muted-foreground">
            Add labor estimates to WBS elements or select roles in the Roles & Pricing tab.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Labor Matrix</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Hours breakdown by WBS element and role.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  WBS Element
                </th>
                {roles.map(role => (
                  <th key={role} className="text-right px-4 py-3 font-medium text-muted-foreground min-w-[100px]">
                    {role}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-semibold text-gray-900 bg-muted min-w-[100px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                  <td className="px-4 py-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{row.wbsNumber}</span>
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">{row.title}</span>
                    </div>
                  </td>
                  {roles.map(role => (
                    <td key={role} className="text-right px-4 py-3 font-mono text-gray-700">
                      {row.hoursByRole[role] ? row.hoursByRole[role].toLocaleString() : '—'}
                    </td>
                  ))}
                  <td className="text-right px-4 py-3 font-mono font-semibold text-gray-900 bg-muted/30">
                    {row.totalHours > 0 ? row.totalHours.toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted">
                <td className="px-4 py-3 font-semibold text-gray-900">
                  Total Hours
                </td>
                {roles.map(role => (
                  <td key={role} className="text-right px-4 py-3 font-mono font-semibold text-gray-900">
                    {totals[role] > 0 ? totals[role].toLocaleString() : '—'}
                  </td>
                ))}
                <td className="text-right px-4 py-3 font-mono font-bold text-gray-900 bg-primary/10">
                  {grandTotal > 0 ? grandTotal.toLocaleString() : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">WBS Elements</p>
          <p className="text-2xl font-semibold">{matrix.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Roles</p>
          <p className="text-2xl font-semibold">{roles.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Hours</p>
          <p className="text-2xl font-semibold">{grandTotal.toLocaleString()}</p>
        </Card>
      </div>
    </div>
  )
}
