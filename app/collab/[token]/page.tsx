'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { collaboratorApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorAlert } from '@/components/ui/error-alert'
import {
  Check,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { contractTypeLabels } from '@/lib/solicitation-type'

// ===== TYPES =====

interface WBSElement {
  id: string
  wbs_number: string
  title: string
  description?: string
  hours?: number
}

interface Submission {
  id: string
  wbs_element_id?: string
  is_new_element: boolean
  proposed_title?: string
  proposed_hours: Record<string, number>
  proposed_roles: { role: string; fte: number }[]
  proposed_estimation_method?: string
  proposed_assumptions?: string
  proposed_notes?: string
  status: string
}

interface SessionData {
  session: {
    id: string
    reviewer_name: string
    reviewer_title?: string
    status: string
    expires_at: string
  }
  assigned_wbs_elements: WBSElement[]
  existing_submissions: Submission[]
  proposal_context: {
    title: string
    agency: string
    contract_type: string
    solicitation_number: string
  } | null
  available_roles: string[]
}

// ===== DRAFT STORAGE =====

const DRAFT_PREFIX = 'truebid-collab-draft-'

function saveDraft(token: string, wbsId: string, data: Record<string, unknown>) {
  try {
    const key = `${DRAFT_PREFIX}${token}-${wbsId}`
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* ignore */ }
}

function loadDraft(token: string, wbsId: string): Record<string, unknown> | null {
  try {
    const key = `${DRAFT_PREFIX}${token}-${wbsId}`
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  } catch { return null }
}

function clearDraft(token: string, wbsId: string) {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${token}-${wbsId}`)
  } catch { /* ignore */ }
}

// ===== MAIN PAGE =====

export default function CollabPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<SessionData | null>(null)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showNewElement, setShowNewElement] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const response = await collaboratorApi.getSession(token) as SessionData
      setData(response)
      setError(null)
    } catch (e) {
      if (e instanceof Error) {
        // Parse error from API
        const msg = e.message
        if (msg.includes('invalid') || msg.includes('Invalid')) {
          setError({ message: 'This collaboration link is invalid.', status: 404 })
        } else if (msg.includes('closed')) {
          setError({ message: 'This collaboration session has been closed by the proposal owner.', status: 410 })
        } else if (msg.includes('expired')) {
          setError({ message: 'This collaboration link has expired.', status: 410 })
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
        <div className="max-w-3xl mx-auto py-12 px-6 space-y-6">
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
          <ErrorAlert variant="page" title="Unable to load review" message={error.message} />
        </div>
        <Toaster />
      </div>
    )
  }

  if (!data) return null

  const { session, assigned_wbs_elements, existing_submissions, proposal_context, available_roles } = data
  const submissionMap = new Map(existing_submissions.map(s => [s.wbs_element_id, s]))
  const completedCount = assigned_wbs_elements.filter(el => submissionMap.has(el.id)).length
  const allComplete = completedCount === assigned_wbs_elements.length
  const progress = assigned_wbs_elements.length > 0
    ? Math.round((completedCount / assigned_wbs_elements.length) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                <span className="text-muted-foreground font-normal">TrueBid</span> Staffing Plan Review
              </h1>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Reviewing as <strong className="text-foreground">{session.reviewer_name}</strong></span>
            {session.reviewer_title && <span>— {session.reviewer_title}</span>}
          </div>
        </div>
      </header>

      {/* Proposal context strip */}
      {proposal_context && (
        <div className="bg-gray-100 border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-6 py-2 flex items-center gap-4 text-xs text-muted-foreground">
            {proposal_context.title && <span>{proposal_context.title}</span>}
            {proposal_context.agency && <span>· {proposal_context.agency}</span>}
            {proposal_context.contract_type && (
              <Badge variant="secondary" className="text-xs">
                {contractTypeLabels[proposal_context.contract_type] || proposal_context.contract_type}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">
            {completedCount} of {assigned_wbs_elements.length} elements completed
          </span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-green-600 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Completion banner */}
      {allComplete && (
        <div className="max-w-3xl mx-auto px-6 mt-6">
          <Card className="bg-green-50 border-green-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-green-900">
                All {assigned_wbs_elements.length} elements submitted. Thank you, {session.reviewer_name}.
              </p>
            </div>
            <p className="text-xs text-green-700">
              You can still edit individual submissions until the session is closed.
            </p>
          </Card>
        </div>
      )}

      {/* WBS Element Cards */}
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {assigned_wbs_elements.map(el => (
          <WBSReviewCard
            key={el.id}
            element={el}
            token={token}
            availableRoles={available_roles}
            existingSubmission={submissionMap.get(el.id)}
            onSubmitted={loadData}
          />
        ))}

        {/* Propose New Element */}
        {!showNewElement ? (
          <Button variant="outline" className="w-full" onClick={() => setShowNewElement(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Propose New Element
          </Button>
        ) : (
          <NewElementCard
            token={token}
            availableRoles={available_roles}
            onSubmitted={() => { setShowNewElement(false); loadData() }}
            onCancel={() => setShowNewElement(false)}
          />
        )}
      </div>

      <Toaster />
    </div>
  )
}

// ===== WBS REVIEW CARD =====

function WBSReviewCard({
  element,
  token,
  availableRoles,
  existingSubmission,
  onSubmitted,
}: {
  element: WBSElement
  token: string
  availableRoles: string[]
  existingSubmission?: Submission
  onSubmitted: () => void
}) {
  const isSubmitted = Boolean(existingSubmission)
  const [isEditing, setIsEditing] = useState(!isSubmitted)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state — initialize from draft or existing submission, pre-populate all available roles
  const draft = loadDraft(token, element.id)
  const [hours, setHours] = useState<Record<string, string>>(
    () => {
      // Start with all available roles set to empty
      const initial: Record<string, string> = {}
      availableRoles.forEach(role => { initial[role] = '' })
      // Override with draft or existing values
      if (draft?.proposed_hours) {
        const draftHours = Object.fromEntries(
          Object.entries(draft.proposed_hours as Record<string, number>).map(([k, v]) => [k, String(v)])
        )
        return { ...initial, ...draftHours }
      }
      if (existingSubmission?.proposed_hours) {
        const subHours = Object.fromEntries(
          Object.entries(existingSubmission.proposed_hours).map(([k, v]) => [k, String(v)])
        )
        return { ...initial, ...subHours }
      }
      return initial
    }
  )
  const [newRoleName, setNewRoleName] = useState('')
  const [method, setMethod] = useState<string>(
    (draft?.proposed_estimation_method as string) || existingSubmission?.proposed_estimation_method || ''
  )
  const [assumptions, setAssumptions] = useState(
    (draft?.proposed_assumptions as string) || existingSubmission?.proposed_assumptions || ''
  )
  const [notes, setNotes] = useState(
    (draft?.proposed_notes as string) || existingSubmission?.proposed_notes || ''
  )

  // Auto-save draft
  useEffect(() => {
    if (!isEditing) return
    const timeout = setTimeout(() => {
      const proposedHours: Record<string, number> = {}
      for (const [role, h] of Object.entries(hours)) {
        const num = parseFloat(h)
        if (!isNaN(num) && num > 0) proposedHours[role] = num
      }
      saveDraft(token, element.id, {
        proposed_hours: proposedHours,
        proposed_estimation_method: method,
        proposed_assumptions: assumptions,
        proposed_notes: notes,
      })
    }, 500)
    return () => clearTimeout(timeout)
  }, [hours, method, assumptions, notes, isEditing, token, element.id])

  const handleAddRole = () => {
    if (!newRoleName.trim()) return
    setHours(prev => ({ ...prev, [newRoleName.trim()]: '' }))
    setNewRoleName('')
  }

  const handleSubmit = async () => {
    const proposedHours: Record<string, number> = {}
    for (const [role, h] of Object.entries(hours)) {
      const num = parseFloat(h)
      if (!isNaN(num) && num > 0) proposedHours[role] = num
    }

    if (Object.keys(proposedHours).length === 0) {
      toast.error('Please enter hours for at least one role')
      return
    }

    setIsSubmitting(true)
    try {
      await collaboratorApi.submitReview(token, {
        wbs_element_id: element.id,
        proposed_hours: proposedHours,
        proposed_estimation_method: method || undefined,
        proposed_assumptions: assumptions || undefined,
        proposed_notes: notes || undefined,
      })
      clearDraft(token, element.id)
      toast.success(`${element.wbs_number} submitted`)
      setIsEditing(false)
      onSubmitted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className={`space-y-4 ${isSubmitted && !isEditing ? 'border-green-200 bg-green-50/30' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{element.wbs_number}</span>
            <h3 className="text-sm font-medium">{element.title}</h3>
          </div>
          {element.description && (
            <p className="text-xs text-muted-foreground mt-1">{element.description}</p>
          )}
        </div>
        {isSubmitted && !isEditing && (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700 text-xs">
              <Check className="w-3 h-3 mr-1" /> Submitted
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-xs">
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          </div>
        )}
      </div>

      {/* Form */}
      {isEditing && (
        <>
          {/* Hours by role */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Hours by Role</Label>
            <p className="text-xs text-muted-foreground">Enter estimated hours for each role that applies to this element. Leave blank for roles not needed.</p>
            {Object.entries(hours).map(([role, h]) => (
              <div key={role} className="flex items-center gap-2">
                <span className="text-sm flex-1">{role}</span>
                <Input
                  type="number"
                  value={h}
                  onChange={(e) => setHours(prev => ({ ...prev, [role]: e.target.value }))}
                  placeholder="hours"
                  className="w-24 text-sm"
                />
                <span className="text-xs text-muted-foreground">hours</span>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Add role name"
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
              />
              <Button variant="outline" size="sm" onClick={handleAddRole} disabled={!newRoleName.trim()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Estimation method */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Estimation Method</Label>
            <div className="flex gap-3">
              {(['engineering', 'parametric', 'historical'] as const).map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`method-${element.id}`}
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-sm capitalize">{m}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Assumptions */}
          <div className="space-y-2">
            <Label htmlFor={`assumptions-${element.id}`} className="text-xs font-medium">Assumptions</Label>
            <Textarea
              id={`assumptions-${element.id}`}
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              placeholder="What assumptions are you making about scope, complexity, or resources?"
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor={`notes-${element.id}`} className="text-xs font-medium">Notes (optional)</Label>
            <Textarea
              id={`notes-${element.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything I should know about this element..."
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Submit {element.wbs_number}
          </Button>
        </>
      )}

      {/* Submitted summary (collapsed view) */}
      {isSubmitted && !isEditing && existingSubmission && (
        <div className="text-xs text-muted-foreground space-y-1">
          {Object.entries(existingSubmission.proposed_hours).length > 0 && (
            <p>
              Hours: {Object.entries(existingSubmission.proposed_hours).map(([r, h]) => `${r}: ${h}h`).join(', ')}
            </p>
          )}
          {existingSubmission.proposed_estimation_method && (
            <p>Method: {existingSubmission.proposed_estimation_method}</p>
          )}
        </div>
      )}
    </Card>
  )
}

// ===== NEW ELEMENT CARD =====

function NewElementCard({
  token,
  availableRoles,
  onSubmitted,
  onCancel,
}: {
  token: string
  availableRoles: string[]
  onSubmitted: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [hours, setHours] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    availableRoles.forEach(role => { initial[role] = '' })
    return initial
  })
  const [newRoleName, setNewRoleName] = useState('')
  const [method, setMethod] = useState('')
  const [assumptions, setAssumptions] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddRole = () => {
    if (!newRoleName.trim()) return
    setHours(prev => ({ ...prev, [newRoleName.trim()]: '' }))
    setNewRoleName('')
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    const proposedHours: Record<string, number> = {}
    for (const [role, h] of Object.entries(hours)) {
      const num = parseFloat(h)
      if (!isNaN(num) && num > 0) proposedHours[role] = num
    }

    setIsSubmitting(true)
    try {
      await collaboratorApi.submitReview(token, {
        is_new_element: true,
        proposed_title: title.trim(),
        proposed_hours: proposedHours,
        proposed_estimation_method: method || undefined,
        proposed_assumptions: assumptions || undefined,
        proposed_notes: notes || undefined,
      })
      toast.success('New element proposed')
      onSubmitted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-purple-200 space-y-4">
      <div className="flex items-center gap-2">
        <Badge className="bg-purple-100 text-purple-700 text-xs">New Element</Badge>
        <h3 className="text-sm font-medium">Propose a New WBS Element</h3>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-el-title" className="text-xs font-medium">Element Title *</Label>
        <Input
          id="new-el-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Data Migration Support"
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Hours by Role</Label>
        {Object.entries(hours).map(([role, h]) => (
          <div key={role} className="flex items-center gap-2">
            <span className="text-sm flex-1">{role}</span>
            <Input
              type="number"
              value={h}
              onChange={(e) => setHours(prev => ({ ...prev, [role]: e.target.value }))}
              placeholder="hours"
              className="w-24 text-sm"
            />
            <span className="text-xs text-muted-foreground">hours</span>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Add role name"
            className="text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
          />
          <Button variant="outline" size="sm" onClick={handleAddRole} disabled={!newRoleName.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Estimation Method</Label>
        <div className="flex gap-3">
          {(['engineering', 'parametric', 'historical'] as const).map(m => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="new-method"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="w-3.5 h-3.5"
              />
              <span className="text-sm capitalize">{m}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-el-assumptions" className="text-xs font-medium">Assumptions</Label>
        <Textarea
          id="new-el-assumptions"
          value={assumptions}
          onChange={(e) => setAssumptions(e.target.value)}
          placeholder="What assumptions are you making?"
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-el-notes" className="text-xs font-medium">Notes (optional)</Label>
        <Textarea
          id="new-el-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context for the proposal owner..."
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
          Submit Proposal
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}
