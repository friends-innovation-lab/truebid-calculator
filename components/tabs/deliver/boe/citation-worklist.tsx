'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ExternalLink, X } from 'lucide-react'
import type { UncitedLineDetail } from '@/lib/commands/boe/types'

interface CitationWorklistProps {
  uncitedLines: UncitedLineDetail[]
  onDismiss: () => void
}

/**
 * Renders the CITATION_INCOMPLETE error as an actionable worklist.
 * Each uncited line is displayed with identifying info and a link to fix.
 *
 * Interim behavior: Links navigate to legacy WBS view (?view=wbs-elements)
 * since WBS editor (screen 3) doesn't exist yet.
 */
export function CitationWorklist({ uncitedLines, onDismiss }: CitationWorklistProps) {
  const issueLabel = (line: UncitedLineDetail) => {
    if (line.missingLinkage === 'no_wbs_task') {
      return 'Not linked to WBS task'
    }
    return 'No requirement links'
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-amber-800">
              Citation Incomplete
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">
              {uncitedLines.length} estimate line{uncitedLines.length !== 1 ? 's' : ''}{' '}
              require requirement citations before BOE generation
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
          onClick={onDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Worklist table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-200 bg-amber-100/50">
              <th className="text-left py-2 px-4 font-medium text-amber-800">
                WBS Code
              </th>
              <th className="text-left py-2 px-4 font-medium text-amber-800">
                Task
              </th>
              <th className="text-left py-2 px-4 font-medium text-amber-800">
                Role
              </th>
              <th className="text-left py-2 px-4 font-medium text-amber-800">
                Period
              </th>
              <th className="text-left py-2 px-4 font-medium text-amber-800">
                Issue
              </th>
              <th className="py-2 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {uncitedLines.map((line, index) => (
              <tr
                key={line.lineId}
                className={index % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}
              >
                <td className="py-2 px-4 font-mono text-xs">
                  {line.wbsCode || '—'}
                </td>
                <td className="py-2 px-4 text-gray-900">
                  {line.taskTitle || '(no task)'}
                </td>
                <td className="py-2 px-4 text-gray-700">{line.roleTitle}</td>
                <td className="py-2 px-4 text-gray-600">{line.periodLabel}</td>
                <td className="py-2 px-4 text-amber-700">{issueLabel(line)}</td>
                <td className="py-2 px-4 text-right">
                  <a
                    href="?view=wbs-elements"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                    title="WBS editor coming in M1 — navigate to WBS view"
                  >
                    Fix
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="p-3 border-t border-amber-200 bg-amber-100/30">
        <p className="text-xs text-amber-700">
          Each WBS task must have at least one accepted requirement link to satisfy
          the citation gate.
        </p>
      </div>
    </Card>
  )
}
