'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { shareLinksApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

// ==================== HELPERS ====================

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ==================== MAIN COMPONENT ====================

export function DeliverShare() {
  const params = useParams()
  const proposalId = params?.id as string

  // Share link state
  const [shareLink, setShareLink] = useState<ShareLinkData | null>(null)
  const [allLinks, setAllLinks] = useState<ShareLinkData[]>([])
  const [shareLoading, setShareLoading] = useState(true)

  // BOE review form
  const [showSendForm, setShowSendForm] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendLabel, setSendLabel] = useState('')
  const [sendLoading, setSendLoading] = useState(false)

  // Create link dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createLabel, setCreateLabel] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createExpiry, setCreateExpiry] = useState('30')
  const [createLoading, setCreateLoading] = useState(false)

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Revoke confirmation
  const [revokeId, setRevokeId] = useState<string | null>(null)

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

  // Find accountant link
  const accountantLink = allLinks.find(
    (l) => l.linkType === 'accountant' || (!l.linkType && l.reviewerEmail)
  )

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
      const expiryDays = createExpiry === 'none' ? 9999 : Number(createExpiry)
      const data = await shareLinksApi.create(proposalId, {
        expiresInDays: expiryDays,
        reviewerEmail: createEmail.trim(),
        label: createLabel.trim() || undefined,
        linkType: 'accountant',
      }) as { shareLink: ShareLinkData }
      setAllLinks((prev) => [...prev, data.shareLink])
      setShowCreateDialog(false)
      setCreateEmail('')
      setCreateLabel('')
      toast.success('Link created')
    } catch (error) {
      console.error('Failed to create link:', error)
      toast.error('Failed to create link')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCopyLink = async (token: string, linkId: string) => {
    const url = `${window.location.origin}/boe/${token}`
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

  // ==================== RENDER ====================

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Share</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage access to this proposal</p>
        </div>

        {/* Section A: BOE Accountant Review */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">BOE Accountant Review</h3>

          <Card className="p-6">
            {shareLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !accountantLink ? (
              /* STATE 1: No link sent yet */
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
                      <Input
                        type="email"
                        placeholder="accountant@example.com"
                        value={sendEmail}
                        onChange={(e) => setSendEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Label (optional)</label>
                      <Input
                        placeholder="e.g., Q2 Rate Review"
                        value={sendLabel}
                        onChange={(e) => setSendLabel(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSendBOEForReview} disabled={sendLoading || !sendEmail.trim()}>
                        {sendLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Send Link
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowSendForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : accountantLink.approvalStatus === 'approved' ? (
              /* STATE 4: Approved */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                  <span className="text-xs text-muted-foreground">&mdash; {formatDate(accountantLink.createdAt)}</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-700">
                  Approved
                </span>
                {accountantLink.approvedAt && (
                  <p className="text-xs text-muted-foreground">Approved on {formatDate(accountantLink.approvedAt)}</p>
                )}
              </div>
            ) : accountantLink.approvalStatus === 'corrections_requested' ? (
              /* STATE 3: Corrections requested */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                  <span className="text-xs text-muted-foreground">&mdash; {formatDate(accountantLink.createdAt)}</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">
                  Corrections requested
                </span>
                {accountantLink.accountantNote && (
                  <div className="bg-amber-50 rounded p-3 text-sm text-amber-800">
                    {accountantLink.accountantNote}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyLink(accountantLink.token, accountantLink.id)}>
                    {copiedId === accountantLink.id ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    Copy link
                  </Button>
                  <Button size="sm" variant="outline">Resend</Button>
                </div>
              </div>
            ) : (
              /* STATE 2: Awaiting response */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{accountantLink.reviewerEmail}</span>
                  <span className="text-xs text-muted-foreground">&mdash; Sent {formatDate(accountantLink.createdAt)}</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">
                  Awaiting review
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyLink(accountantLink.token, accountantLink.id)}>
                    {copiedId === accountantLink.id ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    Copy link
                  </Button>
                  <Button size="sm" variant="outline">Resend</Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Section B: Active Links */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Active Links</h3>
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Create Link
            </Button>
          </div>

          {allLinks.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No links created yet"
              description="Create a link to share the BOE with your accountant for review."
            />
          ) : (
            <Card className="p-0 divide-y divide-gray-100">
              {/* Table header */}
              <div className="grid grid-cols-6 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-gray-50 rounded-t-lg">
                <span>Type</span>
                <span>Label</span>
                <span>Sent To</span>
                <span>Created</span>
                <span>Last Accessed</span>
                <span>Actions</span>
              </div>
              {/* Table rows */}
              {allLinks.map((link) => (
                <div key={link.id} className="grid grid-cols-6 gap-4 px-4 py-3 items-center text-sm">
                  <span>
                    <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded">Accountant</span>
                  </span>
                  <span className="text-gray-700 truncate">{link.label || '—'}</span>
                  <span className="text-gray-700 truncate">{link.reviewerEmail || '—'}</span>
                  <span className="text-muted-foreground text-xs">{formatDate(link.createdAt)}</span>
                  <span className="text-muted-foreground text-xs">
                    {link.lastViewedAt ? formatDate(link.lastViewedAt) : 'Never'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyLink(link.token, link.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      title="Copy link"
                    >
                      {copiedId === link.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    {revokeId === link.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRevokeLink(link.id)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRevokeId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevokeId(link.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Revoke link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Create Link Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Link</DialogTitle>
              <DialogDescription>
                Create a link to share the BOE with your accountant for review.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <Input
                  placeholder="e.g., Q2 Review"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Send To</label>
                <Input
                  type="email"
                  placeholder="reviewer@example.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Expiry</label>
                <Select value={createExpiry} onValueChange={setCreateExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
      </div>
    </div>
  )
}
