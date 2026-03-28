'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { collabApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorAlert } from '@/components/ui/error-alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Users,
  Copy,
  Check,
  X,
  Loader2,
  UserPlus,
  ExternalLink,
  Eye,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

// ===== TYPES =====

interface CollabSession {
  id: string
  proposal_id: string
  reviewer_name: string
  reviewer_title?: string
  token: string
  assigned_wbs_ids: string[]
  status: 'open' | 'closed' | 'expired'
  created_at: string
  expires_at: string
  completed_at?: string
  submission_count: number
  pending_count: number
  wbs_submissions?: { id: string; status: string; wbs_element_id?: string }[]
}

interface WBSSubmission {
  id: string
  session_id: string
  wbs_element_id?: string
  is_new_element: boolean
  proposed_title?: string
  proposed_hours: Record<string, number>
  proposed_roles: { role: string; fte: number }[]
  proposed_estimation_method?: string
  proposed_assumptions?: string
  proposed_notes?: string
  status: 'pending' | 'accepted' | 'modified' | 'rejected'
  reviewer_comment?: string
  owner_response?: string
  created_at: string
}

// ===== MAIN COMPONENT =====

export function CollabManager() {
  const params = useParams()
  const proposalId = params?.id as string
  const { estimateWbsElements } = useAppContext()

  const [sessions, setSessions] = useState<CollabSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [reviewingSession, setReviewingSession] = useState<CollabSession | null>(null)

  const wbsElements = estimateWbsElements as { id: string; wbsNumber: string; title: string }[]

  const loadSessions = useCallback(async () => {
    if (!proposalId) return
    try {
      const response = await collabApi.listSessions(proposalId) as { sessions: CollabSession[] }
      setSessions(response.sessions || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load collaboration sessions')
    } finally {
      setIsLoading(false)
    }
  }, [proposalId])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleCloseSession = async (sessionId: string) => {
    try {
      await collabApi.updateSession(proposalId, sessionId, { status: 'closed' })
      toast.success('Collaboration session closed')
      loadSessions()
    } catch {
      toast.error('Failed to close session')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await collabApi.deleteSession(proposalId, sessionId)
      toast.success('Collaboration session deleted')
      loadSessions()
    } catch {
      toast.error('Failed to delete session')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
    )
  }

  if (error) {
    return <ErrorAlert variant="page" message={error} onRetry={loadSessions} />
  }

  const openSessions = sessions.filter(s => s.status === 'open')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Director Review</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Invite directors to review and propose changes to WBS elements
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
          Invite Director
        </Button>
      </div>

      {openSessions.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No active director reviews"
          description="Invite a director to review your WBS elements and propose staffing changes."
          action={{ label: 'Invite Director', onClick: () => setShowInviteDialog(true) }}
        />
      ) : (
        <div className="space-y-3">
          {openSessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              wbsElements={wbsElements}
              onClose={() => handleCloseSession(session.id)}
              onDelete={() => handleDeleteSession(session.id)}
              onViewSubmissions={() => setReviewingSession(session)}
            />
          ))}
        </div>
      )}

      {/* Closed sessions (collapsed) */}
      {sessions.filter(s => s.status !== 'open').length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Closed ({sessions.filter(s => s.status !== 'open').length})
          </p>
          <div className="space-y-2">
            {sessions.filter(s => s.status !== 'open').map(session => (
              <Card key={session.id} className="p-3 space-y-0 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{session.reviewer_name}</span>
                    {session.reviewer_title && (
                      <span className="text-xs text-muted-foreground ml-2">{session.reviewer_title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{session.status}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSession(session.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Invite Dialog */}
      <InviteDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        proposalId={proposalId}
        wbsElements={wbsElements}
        onSuccess={loadSessions}
      />

      {/* Submission Review Slideout */}
      {reviewingSession && (
        <SubmissionReviewSlideout
          session={reviewingSession}
          proposalId={proposalId}
          wbsElements={wbsElements}
          onClose={() => { setReviewingSession(null); loadSessions() }}
        />
      )}
    </div>
  )
}

// ===== SESSION CARD =====

function SessionCard({
  session,
  wbsElements,
  onClose,
  onDelete,
  onViewSubmissions,
}: {
  session: CollabSession
  wbsElements: { id: string; wbsNumber: string; title: string }[]
  onClose: () => void
  onDelete: () => void
  onViewSubmissions: () => void
}) {
  const submissions = session.wbs_submissions || []
  const submittedIds = new Set(submissions.filter(s => s.status !== 'rejected').map(s => s.wbs_element_id))
  const allSubmitted = session.assigned_wbs_ids.every(id => submittedIds.has(id))
  const someSubmitted = submittedIds.size > 0

  const statusColor = allSubmitted ? 'bg-green-100 text-green-700' : someSubmitted ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
  const statusText = allSubmitted ? 'Complete' : someSubmitted ? 'In Progress' : 'Awaiting'

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{session.reviewer_name}</span>
            {session.reviewer_title && (
              <span className="text-xs text-muted-foreground">— {session.reviewer_title}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {session.assigned_wbs_ids.length} element{session.assigned_wbs_ids.length !== 1 ? 's' : ''} assigned
            · Expires {formatDate(session.expires_at)}
          </p>
        </div>
        <Badge className={`text-xs ${statusColor}`}>{statusText}</Badge>
      </div>

      {/* Per-element status dots */}
      <div className="flex gap-1.5 flex-wrap">
        {session.assigned_wbs_ids.map(wbsId => {
          const el = wbsElements.find(e => e.id === wbsId)
          const sub = submissions.find(s => s.wbs_element_id === wbsId)
          const dotColor = sub?.status === 'accepted' ? 'bg-green-500' : sub ? 'bg-amber-500' : 'bg-gray-300'
          return (
            <div key={wbsId} className="flex items-center gap-1" title={el?.title || wbsId}>
              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              <span className="text-xs text-muted-foreground">{el?.wbsNumber || '?'}</span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const url = `${window.location.origin}/collab/${session.token}`
            await navigator.clipboard.writeText(url)
            toast.success('Review link copied to clipboard')
          }}
        >
          <Copy className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Copy Link
        </Button>
        {someSubmitted && (
          <Button variant="outline" size="sm" onClick={onViewSubmissions}>
            <Eye className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            View Submissions ({session.submission_count})
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500">
          Close Session
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}

// ===== INVITE DIALOG =====

function InviteDialog({
  open,
  onOpenChange,
  proposalId,
  wbsElements,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  wbsElements: { id: string; wbsNumber: string; title: string }[]
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [selectedWbs, setSelectedWbs] = useState<Set<string>>(new Set())
  const [expiresDays, setExpiresDays] = useState(7)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggleWbs = (id: string) => {
    setSelectedWbs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedWbs.size === wbsElements.length) {
      setSelectedWbs(new Set())
    } else {
      setSelectedWbs(new Set(wbsElements.map(e => e.id)))
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || selectedWbs.size === 0) return
    setIsSubmitting(true)
    setError(null)

    try {
      const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()
      const response = await collabApi.createSession(proposalId, {
        reviewer_name: name.trim(),
        reviewer_title: title.trim() || undefined,
        assigned_wbs_ids: Array.from(selectedWbs),
        expires_at: expiresAt,
      }) as { session: CollabSession; review_url: string }

      setGeneratedUrl(response.review_url)
      toast.success(`Review link created for ${name}`)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create collaboration session')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    toast.success('Link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setName('')
    setTitle('')
    setSelectedWbs(new Set())
    setGeneratedUrl(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) handleReset() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite Director for Review</DialogTitle>
          <DialogDescription>
            Generate a unique link for a director to review and propose changes to WBS elements.
          </DialogDescription>
        </DialogHeader>

        {generatedUrl ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                Review link created for <strong>{name}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Review Link</Label>
              <div className="flex gap-2">
                <Input readOnly value={generatedUrl} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={handleCopy} aria-label="Copy link">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { handleReset() }}>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Another Director
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {error && <ErrorAlert message={error} />}

            <div className="space-y-2">
              <Label htmlFor="director-name">Director Name *</Label>
              <Input
                id="director-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sarah Chen"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="director-title">Title / Department</Label>
              <Input
                id="director-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., VP of Engineering"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Assign WBS Elements *</Label>
                <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-xs h-6 px-2">
                  {selectedWbs.size === wbsElements.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-gray-100">
                {wbsElements.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">No WBS elements yet</p>
                ) : (
                  wbsElements.map(el => (
                    <label
                      key={el.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedWbs.has(el.id)}
                        onCheckedChange={() => handleToggleWbs(el.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground mr-2">{el.wbsNumber}</span>
                        <span className="text-sm">{el.title}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">{selectedWbs.size} element{selectedWbs.size !== 1 ? 's' : ''} selected</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Link Expiration</Label>
              <select
                id="expires"
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value))}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim() || selectedWbs.size === 0}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                Generate Link
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ===== SUBMISSION REVIEW SLIDEOUT =====

function SubmissionReviewSlideout({
  session,
  proposalId,
  wbsElements,
  onClose,
}: {
  session: CollabSession
  proposalId: string
  wbsElements: { id: string; wbsNumber: string; title: string; description?: string }[]
  onClose: () => void
}) {
  const [submissions, setSubmissions] = useState<WBSSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const response = await collabApi.listSubmissions(proposalId, session.id) as { submissions: WBSSubmission[] }
        setSubmissions(response.submissions || [])
      } catch {
        toast.error('Failed to load submissions')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [proposalId, session.id])

  const handleReview = async (submissionId: string, status: 'accepted' | 'modified' | 'rejected', ownerResponse?: string) => {
    try {
      await collabApi.reviewSubmission(proposalId, session.id, {
        submissionId,
        status,
        owner_response: ownerResponse,
      })
      toast.success(`Submission ${status}`)
      // Refresh
      const response = await collabApi.listSubmissions(proposalId, session.id) as { submissions: WBSSubmission[] }
      setSubmissions(response.submissions || [])
    } catch {
      toast.error('Failed to review submission')
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[680px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Submissions from {session.reviewer_name}</h2>
            {session.reviewer_title && (
              <p className="text-xs text-muted-foreground">{session.reviewer_title}</p>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)
          ) : submissions.length === 0 ? (
            <EmptyState icon={Users} title="No submissions yet" description="The director hasn't submitted any changes yet." />
          ) : (
            submissions.map(sub => {
              const el = wbsElements.find(e => e.id === sub.wbs_element_id)
              return (
                <SubmissionCard
                  key={sub.id}
                  submission={sub}
                  element={el}
                  onAccept={() => handleReview(sub.id, 'accepted')}
                  onReject={(response) => handleReview(sub.id, 'rejected', response)}
                />
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

// ===== SUBMISSION CARD =====

function SubmissionCard({
  submission,
  element,
  onAccept,
  onReject,
}: {
  submission: WBSSubmission
  element?: { id: string; wbsNumber: string; title: string; description?: string }
  onAccept: () => void
  onReject: (response?: string) => void
}) {
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)

  const isReviewed = submission.status !== 'pending'
  const statusBadge = {
    pending: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    modified: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          {submission.is_new_element && (
            <Badge className="bg-purple-100 text-purple-700 text-xs mb-1">New Element Proposed</Badge>
          )}
          <p className="text-sm font-medium">
            {element ? `${element.wbsNumber} — ${element.title}` : submission.proposed_title || 'New Element'}
          </p>
        </div>
        <Badge className={`text-xs ${statusBadge[submission.status]}`}>{submission.status}</Badge>
      </div>

      {/* Proposed values */}
      {Object.keys(submission.proposed_hours).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Proposed Hours by Role</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(submission.proposed_hours).map(([role, hours]) => (
              <div key={role} className="flex justify-between text-sm bg-amber-50 px-2 py-1 rounded">
                <span>{role}</span>
                <span className="font-mono font-medium">{hours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {submission.proposed_estimation_method && (
        <p className="text-xs text-muted-foreground">
          Method: <span className="font-medium text-foreground capitalize">{submission.proposed_estimation_method}</span>
        </p>
      )}

      {submission.proposed_assumptions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Assumptions</p>
          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{submission.proposed_assumptions}</p>
        </div>
      )}

      {submission.proposed_notes && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Notes</p>
          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{submission.proposed_notes}</p>
        </div>
      )}

      {/* Actions */}
      {!isReviewed && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <Button size="sm" onClick={onAccept} className="bg-green-600 hover:bg-green-700">
            <Check className="w-3.5 h-3.5 mr-1" /> Accept
          </Button>
          {showReject ? (
            <div className="flex-1 flex gap-2">
              <Input
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Reason (optional)"
                className="text-sm h-8"
              />
              <Button size="sm" variant="destructive" onClick={() => { onReject(rejectNote); setShowReject(false) }}>
                Reject
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowReject(true)}>
              <X className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          )}
        </div>
      )}

      {/* Owner response */}
      {submission.owner_response && (
        <p className="text-xs text-muted-foreground italic">
          Your response: &quot;{submission.owner_response}&quot;
        </p>
      )}
    </Card>
  )
}

// ===== COLLAB STATUS DOT (for WBS list) =====

export function CollabStatusDot({ wbsElementId, sessions }: { wbsElementId: string; sessions: CollabSession[] }) {
  let status: 'assigned' | 'pending' | 'accepted' | null = null

  for (const session of sessions) {
    if (!session.assigned_wbs_ids.includes(wbsElementId)) continue
    const sub = session.wbs_submissions?.find(s => s.wbs_element_id === wbsElementId)
    if (sub?.status === 'accepted') {
      status = 'accepted'
    } else if (sub && status !== 'accepted') {
      status = 'pending'
    } else if (!sub && status !== 'accepted' && status !== 'pending') {
      status = 'assigned'
    }
  }

  if (!status) return null

  const colors = {
    assigned: 'bg-purple-500',
    pending: 'bg-amber-500',
    accepted: 'bg-green-500',
  }
  const labels = {
    assigned: 'Assigned to reviewer',
    pending: 'Submission pending review',
    accepted: 'Submission accepted',
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status]}`}
      title={labels[status]}
      aria-label={labels[status]}
    />
  )
}
