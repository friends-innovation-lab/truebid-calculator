'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Link2, Copy, Check, Clock, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export function ShareLink() {
  const params = useParams()
  const proposalId = params?.id as string

  const [copied, setCopied] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState(7)

  // TODO: Replace with real token-based URL generation via API
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${proposalId}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Shareable BOE Link</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a read-only link to share your Basis of Estimate with reviewers.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Share Link</h3>
          <Badge variant="secondary" className="text-xs">
            {isPublic ? 'Public' : 'Private'}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Input
            readOnly
            value={shareUrl}
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium mb-4">Link Settings</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Eye className="w-4 h-4 text-muted-foreground" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <Label className="text-sm">Visibility</Label>
                <p className="text-xs text-muted-foreground">
                  {isPublic ? 'Anyone with the link can view' : 'Only invited users can view'}
                </p>
              </div>
            </div>
            {/* TODO: Wire toggle to real API when token system is built */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPublic(!isPublic)}
            >
              {isPublic ? 'Make Private' : 'Make Public'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <Label className="text-sm">Expiration</Label>
                <p className="text-xs text-muted-foreground">
                  Link expires after {expiresInDays} days
                </p>
              </div>
            </div>
            {/* TODO: Wire to real API when token system is built */}
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
        </div>
      </Card>

      <Card className="space-y-0">
        <p className="text-xs text-muted-foreground">
          {/* TODO: Wire to real access log when token system is built */}
          No one has accessed this link yet.
        </p>
      </Card>
    </div>
  )
}
