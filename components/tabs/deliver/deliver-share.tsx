'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext } from '@/contexts/app-context'
import { shareLinksApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Copy,
  Check,
  Link2,
  Trash2,
  Plus,
  Send,
  FileText,
  ArrowRight,
  X,
  Sparkles,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'

// ==================== TYPES ====================

interface ShareLinkData {
  id: string
  token: string
  isActive: boolean
  expiresAt: string | null
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
  approvalStatus?: string | null
  accountantNote?: string | null
  approvedAt?: string | null
  reviewerEmail?: string | null
  label?: string | null
  linkType?: string | null
}

interface SectionInfo {
  id: string
  title: string
  sectionNumber: string | null
  sortOrder: number
}

interface CollabLink {
  id: string
  token: string
  link_type: string
  label: string | null
  reviewer_email: string | null
  reviewer_name: string | null
  section_ids: string[]
  submission_status: string
  submitted_at: string | null
  submission_content: { html?: string } | null
  transformed_content: { html?: string } | null
  created_at: string
  expires_at: string | null
  approved_at: string | null
  reviewer_note: string | null
}

// ==================== HELPERS ====================

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ==================== MAIN COMPONENT ====================

export function DeliverShare() {
  const params = useParams()
  const proposalId = params?.id as string
  const { outline } = useAppContext()

  // Tab state
  const [activeTab, setActiveTab] = useState<'links' | 'submissions'>('links')

  // Share link state (accountant BOE links)
  const [shareLink, setShareLink] = useState<ShareLinkData | null>(null)
  const [allLinks, setAllLinks] = useState<ShareLinkData[]>([])
  const [shareLoading, setShareLoading] = useState(true)

  // Collab links (submissions)
  const [collabLinks, setCollabLinks] = useState<CollabLink[]>([])
  const [collabLoading, setCollabLoading] = useState(true)

  // Sections for multi-select
  const [sections, setSections] = useState<SectionInfo[]>([])

  // BOE review form
  const [showSendForm, setShowSendForm] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendLabel, setSendLabel] = useState('')
  const [sendLoading, setSendLoading] = useState(false)

  // Create link dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createLinkCategory, setCreateLinkCategory] = useState<'accountant' | 'collaborator'>('accountant')
  const [createCollabRole, setCreateCollabRole] = useState<'contributor' | 'subcontractor'>('contributor')
  const [createLabel, setCreateLabel] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createExpiry, setCreateExpiry] = useState('30')
  const [createLoading, setCreateLoading] = useState(false)
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Revoke confirmation
  const [revokeId, setRevokeId] = useState<string | null>(null)

  // Review drawer
  const [reviewLink, setReviewLink] = useState<CollabLink | null>(null)
  const [transformedHtml, setTransformedHtml] = useState<string>('')
  const [isTransforming, setIsTransforming] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showSendBack, setShowSendBack] = useState(false)
  const [sendBackNote, setSendBackNote] = useState('')
  const [isSendingBack, setIsSendingBack] = useState(false)

  // Load share links
  useEffect(() => {
    if (!proposalId) return
    async function loadLinks() {
      try {
        const data = await shareLinksApi.get(proposalId) as {
          shareLink: ShareLinkData | null
          allLinks?: ShareLinkData[]
        }
        setShareLink(data.shareLink)
        setAllLinks(data.allLinks || (data.shareLink ? [data.shareLink] : []))
      } catch {
        // Silently fail
      } finally {
        setShareLoading(false)
      }
    }
    loadLinks()
  }, [proposalId])

  // Load collab section links
  const loadCollabLinks = useCallback(async () => {
    if (!proposalId) return
    try {
      const res = await fetch(`/api/proposals/${proposalId}/collab-links`)
      if (res.ok) {
        const data = await res.json()
        setCollabLinks(data.links || [])
      }
    } catch {
      // Silently fail
    } finally {
      setCollabLoading(false)
    }
  }, [proposalId])

  useEffect(() => { loadCollabLinks() }, [loadCollabLinks])

  // Build sections from outline for multi-select (include subsections)
  useEffect(() => {
    if (!outline?.volumes) {
      setSections([])
      return
    }

    const sectionList: SectionInfo[] = []
    let sortOrder = 0
    outline.volumes.forEach((volume) => {
      volume.sections.forEach((section) => {
        // Add the parent section
        sectionList.push({
          id: section.id,
          title: section.title,
          sectionNumber: section.number || null,
          sortOrder: sortOrder++,
        })
        // Add subsections (H2-level items for assignment)
        if (section.subsections && section.subsections.length > 0) {
          section.subsections.forEach((sub) => {
            sectionList.push({
              id: sub.id,
              title: sub.title,
              sectionNumber: sub.number || null,
              sortOrder: sortOrder++,
            })
          })
        }
      })
    })

    setSections(sectionList)
  }, [outline])

  // Find accountant link
  const accountantLink = allLinks.find(
    (l) => l.linkType === 'accountant' || (!l.linkType && l.reviewerEmail)
  )

  // Submissions (filtered collab links)
  const submissions = collabLinks.filter(
    (l) => l.submission_status === 'submitted' || l.submission_status === 'transform_pending' || l.submission_status === 'transform_approved'
  )

  // Section name lookup
  const sectionNameMap = new Map(sections.map(s => [s.id, s.sectionNumber ? `${s.sectionNumber} ${s.title}` : s.title]))

  // ==================== HANDLERS ====================

  const handleSendBOEForReview = async () => {
    if (!sendEmail.trim()) return
    setSendLoading(true)
    try {
      const data = await shareLinksApi.create(proposalId, {
        expiresInDays: 30,
        reviewerEmail: sendEmail.trim(),
        label: sendLabel.trim() || undefined,
        linkType: 'accountant',
      }) as { shareLink: ShareLinkData }
      setShareLink(data.shareLink)
      setAllLinks((prev) => [...prev, data.shareLink])
      setShowSendForm(false)
      setSendEmail('')
      setSendLabel('')
      toast.success('BOE review link created')
    } catch (error) {
      console.error('Failed to create review link:', error)
      toast.error('Failed to create review link')
    } finally {
      setSendLoading(false)
    }
  }

  const handleCreateLink = async () => {
    if (!createEmail.trim()) return
    setCreateLoading(true)
    try {
      if (createLinkCategory === 'collaborator') {
        // Create collab_section_link
        if (selectedSectionIds.size === 0) {
          toast.error('Select at least one section')
          setCreateLoading(false)
          return
        }
        const expiryDays = createExpiry === 'none' ? 9999 : Number(createExpiry)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + expiryDays)

        const res = await fetch(`/api/proposals/${proposalId}/collab-links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            linkType: createCollabRole,
            label: createLabel.trim() || undefined,
            reviewerEmail: createEmail.trim(),
            sectionIds: Array.from(selectedSectionIds),
            expiresAt: expiresAt.toISOString(),
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create link')
        }

        const data = await res.json()

        // Copy URL to clipboard
        const url = `${window.location.origin}/collaborate/${data.link.token}`
        await navigator.clipboard.writeText(url)
        toast.success('Collaborator link created and copied to clipboard')
        loadCollabLinks()
      } else {
        // Create accountant link (existing flow)
        const expiryDays = createExpiry === 'none' ? 9999 : Number(createExpiry)
        const data = await shareLinksApi.create(proposalId, {
          expiresInDays: expiryDays,
          reviewerEmail: createEmail.trim(),
          label: createLabel.trim() || undefined,
          linkType: 'accountant',
        }) as { shareLink: ShareLinkData }
        setAllLinks((prev) => [...prev, data.shareLink])
        toast.success('Link created')
      }

      setShowCreateDialog(false)
      setCreateEmail('')
      setCreateLabel('')
      setSelectedSectionIds(new Set())
    } catch (error) {
      console.error('Failed to create link:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create link')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCopyLink = async (token: string, linkId: string, isCollab = false) => {
    const url = isCollab
      ? `${window.location.origin}/collaborate/${token}`
      : `${window.location.origin}/boe/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(linkId)
      toast.success('Link copied')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleRevokeLink = async (linkId: string) => {
    try {
      await shareLinksApi.delete(proposalId)
      setAllLinks((prev) => prev.filter((l) => l.id !== linkId))
      if (shareLink?.id === linkId) setShareLink(null)
      setRevokeId(null)
      toast.success('Link revoked')
    } catch {
      toast.error('Failed to revoke link')
    }
  }

  // Review drawer handlers
  const handleOpenReview = (link: CollabLink) => {
    setReviewLink(link)
    setTransformedHtml(link.transformed_content?.html || '')
    setShowSendBack(false)
    setSendBackNote('')
  }

  const handleTransform = async () => {
    if (!reviewLink) return
    setIsTransforming(true)
    try {
      const res = await fetch(`/api/collaborate/${reviewLink.token}/transform`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Transform failed')
      const data = await res.json()
      setTransformedHtml(data.transformed)
      toast.success('Content transformed')
      loadCollabLinks()
    } catch {
      toast.error('Transform failed')
    } finally {
      setIsTransforming(false)
    }
  }

  const handleApprove = async () => {
    if (!reviewLink || !transformedHtml) return
    setIsApproving(true)
    try {
      const res = await fetch(`/api/collaborate/${reviewLink.token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: transformedHtml,
          sectionIds: reviewLink.section_ids,
        }),
      })
      if (!res.ok) throw new Error('Approve failed')
      toast.success('Content approved and merged')
      setReviewLink(null)
      loadCollabLinks()
    } catch {
      toast.error('Approve failed')
    } finally {
      setIsApproving(false)
    }
  }

  const handleSendBack = async () => {
    if (!reviewLink) return
    setIsSendingBack(true)
    try {
      const res = await fetch(`/api/collaborate/${reviewLink.token}/save`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reviewLink.submission_content }),
      })
      if (!res.ok) throw new Error('Send back failed')
      // Also update status back to pending via a dedicated call
      // For now, use the save endpoint pattern
      toast.success('Sent back for revision')
      setReviewLink(null)
      loadCollabLinks()
    } catch {
      toast.error('Failed to send back')
    } finally {
      setIsSendingBack(false)
    }
  }

  const toggleSection = (id: string) => {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ==================== RENDER ====================

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Share</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage access to this proposal</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('links')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'links'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-muted-foreground hover:text-gray-700'
            }`}
          >
            Links
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'submissions'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-muted-foreground hover:text-gray-700'
            }`}
          >
            Submissions
            {submissions.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700">
                {submissions.length}
              </span>
            )}
          </button>
        </div>

        {/* ====== LINKS TAB ====== */}
        {activeTab === 'links' && (
          <div className="space-y-8">
            {/* BOE Accountant Review */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">BOE Accountant Review</h3>
              <Card className="p-6">
                {shareLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !accountantLink ? (
                  <div>
                    {!showSendForm ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Send the BOE to your accountant for review before finalizing.
                        </p>
                        <Button size="sm" onClick={() => setShowSendForm(true)}>
                          <Send className="w-4 h-4 mr-2" />
                          Send BOE for Review
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Email</label>
                          <Input type="email" placeholder="accountant@example.com" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Label (optional)</label>
                          <Input placeholder="e.g., Q2 Rate Review" value={sendLabel} onChange={(e) => setSendLabel(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSendBOEForReview} disabled={sendLoading || !sendEmail.trim()}>
                            {sendLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Send Link
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowSendForm(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : accountantLink.approvalStatus === 'approved' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                      <span className="text-xs text-muted-foreground">&mdash; {formatDate(accountantLink.createdAt)}</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-700">Approved</span>
                    {accountantLink.approvedAt && <p className="text-xs text-muted-foreground">Approved on {formatDate(accountantLink.approvedAt)}</p>}
                  </div>
                ) : accountantLink.approvalStatus === 'corrections_requested' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                      <span className="text-xs text-muted-foreground">&mdash; {formatDate(accountantLink.createdAt)}</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">Corrections requested</span>
                    {accountantLink.accountantNote && <div className="bg-amber-50 rounded p-3 text-sm text-amber-800">{accountantLink.accountantNote}</div>}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleCopyLink(accountantLink.token, accountantLink.id)}>
                        {copiedId === accountantLink.id ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}Copy link
                      </Button>
                      <Button size="sm" variant="outline">Resend</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                      <span className="text-xs text-muted-foreground">&mdash; Sent {formatDate(accountantLink.createdAt)}</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">Awaiting review</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleCopyLink(accountantLink.token, accountantLink.id)}>
                        {copiedId === accountantLink.id ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}Copy link
                      </Button>
                      <Button size="sm" variant="outline">Resend</Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Active Links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Active Links</h3>
                <Button size="sm" variant="outline" onClick={() => { setCreateLinkCategory('accountant'); setShowCreateDialog(true) }}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Link
                </Button>
              </div>

              {allLinks.length === 0 && collabLinks.length === 0 ? (
                <EmptyState
                  icon={Link2}
                  title="No links created yet"
                  description="Create a link to share the BOE or invite collaborators to write sections."
                />
              ) : (
                <Card className="p-0 divide-y divide-gray-100">
                  <div className="grid grid-cols-6 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-gray-50 rounded-t-lg">
                    <span>Type</span>
                    <span>Label</span>
                    <span>Sent To</span>
                    <span>Created</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {/* Accountant links */}
                  {allLinks.map((link) => (
                    <div key={link.id} className="grid grid-cols-6 gap-4 px-4 py-3 items-center text-sm">
                      <span><span className="bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded">Accountant</span></span>
                      <span className="text-gray-700 truncate">{link.label || '—'}</span>
                      <span className="text-gray-700 truncate">{link.reviewerEmail || '—'}</span>
                      <span className="text-muted-foreground text-xs">{formatDate(link.createdAt)}</span>
                      <span className="text-muted-foreground text-xs">{link.approvalStatus === 'approved' ? 'Approved' : 'Active'}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleCopyLink(link.token, link.id)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="Copy link">
                          {copiedId === link.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                        {revokeId === link.id ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRevokeLink(link.id)}>Confirm</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRevokeId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <button onClick={() => setRevokeId(link.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Revoke"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Collaborator links */}
                  {collabLinks.map((link) => (
                    <div key={link.id} className="grid grid-cols-6 gap-4 px-4 py-3 items-center text-sm">
                      <span><span className="bg-purple-50 text-purple-700 text-xs font-medium px-2 py-0.5 rounded capitalize">{link.link_type}</span></span>
                      <span className="text-gray-700 truncate">{link.label || '—'}</span>
                      <span className="text-gray-700 truncate">{link.reviewer_email || '—'}</span>
                      <span className="text-muted-foreground text-xs">{formatDate(link.created_at)}</span>
                      <span className="text-muted-foreground text-xs capitalize">{link.submission_status.replace('_', ' ')}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleCopyLink(link.token, link.id, true)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="Copy link">
                          {copiedId === link.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ====== SUBMISSIONS TAB ====== */}
        {activeTab === 'submissions' && (
          <div className="space-y-4">
            {collabLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : submissions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No submissions yet"
                description="Collaborator submissions will appear here once they submit their drafts."
              />
            ) : (
              <Card className="p-0 divide-y divide-gray-100">
                <div className="grid grid-cols-6 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-gray-50 rounded-t-lg">
                  <span>Contributor</span>
                  <span>Sections</span>
                  <span>Submitted</span>
                  <span>Score</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {submissions.map((link) => (
                  <div key={link.id} className="grid grid-cols-6 gap-4 px-4 py-3 items-center text-sm">
                    <span className="text-gray-700 truncate">{link.reviewer_email || link.label || '—'}</span>
                    <span className="text-gray-700 truncate text-xs">
                      {link.section_ids.map(id => sectionNameMap.get(id) || id).join(', ')}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {link.submitted_at ? relativeTime(link.submitted_at) : '—'}
                    </span>
                    <span className="text-muted-foreground text-xs">—</span>
                    <span>
                      {link.submission_status === 'submitted' && (
                        <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded">Awaiting review</span>
                      )}
                      {link.submission_status === 'transform_pending' && (
                        <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">Transformed</span>
                      )}
                      {link.submission_status === 'transform_approved' && (
                        <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded">Approved</span>
                      )}
                    </span>
                    <span>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleOpenReview(link)}>
                        Review <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* ====== CREATE LINK DIALOG ====== */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Link</DialogTitle>
              <DialogDescription>
                Share the BOE or invite a collaborator to write proposal sections.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Link Type</label>
                <Select value={createLinkCategory} onValueChange={(v) => setCreateLinkCategory(v as 'accountant' | 'collaborator')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accountant">Accountant — BOE review</SelectItem>
                    <SelectItem value="collaborator">Collaborator — Section writing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {createLinkCategory === 'collaborator' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={createCollabRole} onValueChange={(v) => setCreateCollabRole(v as 'contributor' | 'subcontractor')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contributor">Contributor</SelectItem>
                      <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <Input placeholder="e.g., Q2 Review" value={createLabel} onChange={(e) => setCreateLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Send To</label>
                <Input type="email" placeholder="reviewer@example.com" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
              </div>

              {createLinkCategory === 'collaborator' && sections.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sections</label>
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {sections.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-1 px-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSectionIds.has(s.id)}
                          onChange={() => toggleSection(s.id)}
                          className="w-3.5 h-3.5 rounded"
                        />
                        <span className="text-sm text-gray-700">
                          {s.sectionNumber && <span className="font-mono text-xs text-muted-foreground mr-1">{s.sectionNumber}</span>}
                          {s.title}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedSectionIds.size} section{selectedSectionIds.size !== 1 ? 's' : ''} selected</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Expiry</label>
                <Select value={createExpiry} onValueChange={setCreateExpiry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="none">No expiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateLink} disabled={createLoading || !createEmail.trim()}>
                {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ====== REVIEW DRAWER ====== */}
        {reviewLink && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setReviewLink(null)} />
            <div className="fixed inset-y-0 right-0 w-[calc(100vw-80px)] max-w-6xl bg-white z-50 flex flex-col shadow-2xl">
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Review Submission</h3>
                  <p className="text-xs text-muted-foreground">{reviewLink.reviewer_email || reviewLink.label}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setReviewLink(null)} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Side-by-side panels */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left: Submitted Draft */}
                <div className="flex-1 border-r border-gray-200 overflow-y-auto">
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-700">Submitted Draft</span>
                  </div>
                  <div
                    className="p-6 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: reviewLink.submission_content?.html || '<p class="text-muted-foreground">No content</p>' }}
                  />
                </div>

                {/* Middle: Transform action */}
                <div className="w-16 flex flex-col items-center justify-center bg-gray-50 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleTransform}
                    disabled={isTransforming}
                    className="h-10 w-10 rounded-full"
                    title="Transform to FFTC Voice"
                  >
                    {isTransforming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </Button>
                  <span className="text-[10px] text-muted-foreground mt-1 text-center leading-tight">Transform</span>
                </div>

                {/* Right: FFTC Voice */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-700">FFTC Voice</span>
                  </div>
                  {transformedHtml ? (
                    <div className="p-6">
                      <Textarea
                        value={transformedHtml}
                        onChange={(e) => setTransformedHtml(e.target.value)}
                        className="min-h-[400px] text-sm font-sans leading-relaxed"
                        rows={20}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      Click Transform to see the FFTC voice version
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom actions */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
                <div>
                  {showSendBack ? (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Note for the collaborator..."
                        value={sendBackNote}
                        onChange={(e) => setSendBackNote(e.target.value)}
                        className="w-64 text-sm"
                      />
                      <Button size="sm" variant="outline" onClick={handleSendBack} disabled={isSendingBack}>
                        {isSendingBack && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        Send
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowSendBack(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setShowSendBack(true)}>
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Send back
                    </Button>
                  )}
                </div>
                <Button size="sm" onClick={handleApprove} disabled={isApproving || !transformedHtml}>
                  {isApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Approve and merge
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
