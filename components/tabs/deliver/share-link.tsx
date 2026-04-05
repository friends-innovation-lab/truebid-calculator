'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Link2, Copy, Check, Clock, Eye, EyeOff, Loader2, Trash2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { shareLinksApi } from '@/lib/api'

interface ShareLinkData {
  id: string
  token: string
  isActive: boolean
  expiresAt: string | null
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
}

export function ShareLink() {
  const params = useParams()
  const proposalId = params?.id as string

  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shareLink, setShareLink] = useState<ShareLinkData | null>(null)
  const [expiresInDays, setExpiresInDays] = useState(7)

  // Load existing share link
  useEffect(() => {
    if (!proposalId) return

    const loadShareLink = async () => {
      try {
        const data = await shareLinksApi.get(proposalId) as { shareLink: ShareLinkData | null }
        setShareLink(data.shareLink)
        if (data.shareLink?.expiresAt) {
          // Calculate days remaining
          const daysRemaining = Math.ceil(
            (new Date(data.shareLink.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
          if (daysRemaining > 0) {
            setExpiresInDays(daysRemaining)
          }
        }
      } catch (error) {
        console.error('Failed to load share link:', error)
      } finally {
        setLoading(false)
      }
    }

    loadShareLink()
  }, [proposalId])

  const shareUrl = shareLink
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/boe/${shareLink.token}`
    : ''

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleCreateLink = async () => {
    setSaving(true)
    try {
      const data = await shareLinksApi.create(proposalId, { expiresInDays }) as { shareLink: ShareLinkData }
      setShareLink(data.shareLink)
      toast.success('Share link created')
    } catch (error) {
      console.error('Failed to create share link:', error)
      toast.error('Failed to create share link')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!shareLink) return
    setSaving(true)
    try {
      const data = await shareLinksApi.update(proposalId, {
        isActive: !shareLink.isActive,
      }) as { shareLink: ShareLinkData }
      setShareLink(data.shareLink)
      toast.success(data.shareLink.isActive ? 'Link activated' : 'Link deactivated')
    } catch (error) {
      console.error('Failed to update share link:', error)
      toast.error('Failed to update share link')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateExpiration = async (days: number) => {
    setExpiresInDays(days)
    if (!shareLink) return
    setSaving(true)
    try {
      const data = await shareLinksApi.update(proposalId, {
        expiresInDays: days,
      }) as { shareLink: ShareLinkData }
      setShareLink(data.shareLink)
      toast.success('Expiration updated')
    } catch (error) {
      console.error('Failed to update expiration:', error)
      toast.error('Failed to update expiration')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLink = async () => {
    if (!shareLink) return
    setSaving(true)
    try {
      await shareLinksApi.delete(proposalId)
      setShareLink(null)
      toast.success('Share link deleted')
    } catch (error) {
      console.error('Failed to delete share link:', error)
      toast.error('Failed to delete share link')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateLink = async () => {
    setSaving(true)
    try {
      // Delete existing and create new
      await shareLinksApi.delete(proposalId)
      const data = await shareLinksApi.create(proposalId, { expiresInDays }) as { shareLink: ShareLinkData }
      setShareLink(data.shareLink)
      toast.success('New share link generated')
    } catch (error) {
      console.error('Failed to regenerate share link:', error)
      toast.error('Failed to regenerate share link')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Shareable BOE Link</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a read-only link to share your Basis of Estimate with reviewers.
        </p>
      </div>

      {!shareLink ? (
        <Card className="p-6">
          <div className="text-center py-8">
            <Link2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No share link exists</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Create a shareable link to let others view your BOE.
            </p>
            <div className="flex items-center justify-center gap-4 mb-4">
              <Label className="text-sm">Expires in:</Label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="text-sm border rounded-md px-2 py-1"
              >
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <Button onClick={handleCreateLink} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              Create Share Link
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Share Link</h3>
              <Badge variant={shareLink.isActive ? 'default' : 'secondary'} className="text-xs">
                {shareLink.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!shareLink.isActive}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Link Settings</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {shareLink.isActive ? (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <Label className="text-sm">Visibility</Label>
                    <p className="text-xs text-muted-foreground">
                      {shareLink.isActive ? 'Anyone with the link can view' : 'Link is deactivated'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {shareLink.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">Expiration</Label>
                    <p className="text-xs text-muted-foreground">
                      {shareLink.expiresAt
                        ? `Expires ${new Date(shareLink.expiresAt).toLocaleDateString()}`
                        : 'No expiration set'}
                    </p>
                  </div>
                </div>
                <select
                  value={expiresInDays}
                  onChange={(e) => handleUpdateExpiration(Number(e.target.value))}
                  disabled={saving}
                  className="text-sm border rounded-md px-2 py-1"
                >
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Link Activity</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Views: {shareLink.viewCount}</p>
              {shareLink.lastViewedAt && (
                <p>Last viewed: {new Date(shareLink.lastViewedAt).toLocaleString()}</p>
              )}
              <p>Created: {new Date(shareLink.createdAt).toLocaleString()}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium mb-4">Danger Zone</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateLink}
                disabled={saving}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Link
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteLink}
                disabled={saving}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Link
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
