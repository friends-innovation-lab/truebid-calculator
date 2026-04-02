'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { useAppContext, type TeamMember, type Director } from '@/contexts/app-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, Plus, Upload, Copy, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface TeamStats {
  primeCount: number
  subCount: number
  partnerCount: number
  directorCount: number
  primeWorkShare: number
}

interface ComplianceRule {
  clause: string
  label: string
  rule: string
  threshold: number
}

// ==================== COMPLIANCE UTILITY ====================

function getSetAsideCompliance(setAside: string): ComplianceRule | null {
  const rules: Record<string, ComplianceRule> = {
    '8a_sole_source': {
      clause: 'FAR 52.219-14',
      label: '8(a) Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    '8a_competitive': {
      clause: 'FAR 52.219-14',
      label: '8(a) Competitive',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    '8a': {
      clause: 'FAR 52.219-14',
      label: '8(a) Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'sdvosb': {
      clause: 'FAR 52.219-27',
      label: 'SDVOSB Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'wosb': {
      clause: 'FAR 52.219-29',
      label: 'WOSB Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'edwosb': {
      clause: 'FAR 52.219-29',
      label: 'EDWOSB Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'hubzone': {
      clause: 'FAR 52.219-3',
      label: 'HUBZone Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'small_business': {
      clause: 'FAR 52.219-14',
      label: 'Small Business Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    },
    'small-business': {
      clause: 'FAR 52.219-14',
      label: 'Small Business Set-Aside',
      rule: 'Prime must perform ≥50% of personnel cost',
      threshold: 50
    }
  }
  return rules[setAside] || {
    clause: 'FAR 52.219-14',
    label: 'Small Business Set-Aside',
    rule: 'Prime must perform ≥50% of personnel cost',
    threshold: 50
  }
}

// ==================== DATE HELPERS ====================

function getDaysUntil(dateStr: string): number {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = date.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDaysAgo(dateStr: string): number {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ==================== MAIN COMPONENT ====================

export function Team() {
  const params = useParams()
  const proposalId = params?.id as string
  const {
    teamMembers,
    setTeamMembers,
    directors,
    setDirectors,
    selectedRoles,
    proposalSetup,
  } = useAppContext()

  // Local UI state
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showAddDirector, setShowAddDirector] = useState(false)
  const [newDirector, setNewDirector] = useState({ name: '', role: '', email: '' })
  const [sendingLink, setSendingLink] = useState<string | null>(null)

  // Calculate prime work share from roles
  // Use hoursByYear.baseYear if available, fall back to billableHours
  const getRoleHours = (r: typeof selectedRoles[number]) =>
    r.hoursByYear?.baseYear || r.billableHours || 0
  const totalHours = selectedRoles.reduce(
    (sum, r) => sum + getRoleHours(r), 0
  )
  const primeHours = selectedRoles
    .filter(r => (r.type || 'prime') === 'prime')
    .reduce(
      (sum, r) => sum + getRoleHours(r), 0
    )
  const primeShare = totalHours > 0
    ? Math.round((primeHours / totalHours) * 100)
    : 0

  // Calculate stats
  const stats: TeamStats = {
    primeCount: teamMembers.filter(m => m.type === 'prime').length,
    subCount: teamMembers.filter(m => m.type === 'sub').length,
    partnerCount: teamMembers.filter(m => m.type === 'partner').length,
    directorCount: directors.length,
    primeWorkShare: primeShare,
  }

  // Get compliance rule for current set-aside
  const compliance = getSetAsideCompliance(proposalSetup?.setAside || '')

  // Team member handlers
  const handleAddMember = () => {
    const newMember: TeamMember = {
      id: crypto.randomUUID(),
      name: '',
      type: 'sub',
      contactName: null,
      workShare: 0,
      uei: null,
      agreementStatus: 'none',
      agreementType: null,
      notes: null,
    }
    setTeamMembers([...teamMembers, newMember])
    setSelectedMember(newMember)
    toast.success('Saved', { duration: 2000 })
  }

  const handleUpdateMember = (id: string, updates: Partial<TeamMember>) => {
    setTeamMembers(teamMembers.map(m => m.id === id ? { ...m, ...updates } : m))
    if (selectedMember?.id === id) {
      setSelectedMember(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  const handleSaveMember = () => {
    toast.success('Saved', { duration: 2000 })
  }

  const handleDeleteMember = (id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id))
    setSelectedMember(null)
    toast.success('Removed', { duration: 2000 })
  }

  const handleDuplicateMember = (member: TeamMember) => {
    const duplicate: TeamMember = {
      ...member,
      id: crypto.randomUUID(),
      name: `${member.name} (copy)`,
      agreementStatus: 'none',
    }
    setTeamMembers(prev => [...prev, duplicate])
    toast.success('Duplicated', { duration: 2000 })
  }

  // Director handlers
  const handleAddDirector = () => {
    if (!newDirector.name || !newDirector.email) return

    const director: Director = {
      id: `director-${crypto.randomUUID()}`,
      name: newDirector.name,
      role: newDirector.role,
      email: newDirector.email,
      token: null,
      tokenExpiry: null,
      lastViewed: null,
      createdAt: new Date().toISOString(),
    }
    setDirectors(prev => [...prev, director])
    setNewDirector({ name: '', role: '', email: '' })
    setShowAddDirector(false)
    toast.success('Saved', { duration: 2000 })
  }

  const handleSendLink = async (directorId: string) => {
    setSendingLink(directorId)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/director-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directorId }),
      })

      if (!res.ok) throw new Error('Failed to generate link')

      const data = await res.json()

      // Update director with new token
      setDirectors(prev => prev.map(d =>
        d.id === directorId
          ? { ...d, token: data.token, tokenExpiry: data.tokenExpiry }
          : d
      ))

      toast.success('Link sent', { description: 'Director will receive an email with the review link.' })
    } catch {
      toast.error('Failed to send link')
    } finally {
      setSendingLink(null)
    }
  }

  const handleCopyLink = (director: Director) => {
    if (!director.token) return
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${baseUrl}/director-review/${director.token}`
    navigator.clipboard.writeText(link)
    toast.success('Copied!', { duration: 2000 })
  }

  const handleDeleteDirector = (id: string) => {
    setDirectors(prev => prev.filter(d => d.id !== id))
    toast.success('Removed', { duration: 2000 })
  }

  const handleDuplicateDirector = (director: Director) => {
    const duplicate: Director = {
      ...director,
      id: `director-${crypto.randomUUID()}`,
      name: `${director.name} (copy)`,
      token: null,
      tokenExpiry: null,
      lastViewed: null,
      createdAt: new Date().toISOString(),
    }
    setDirectors(prev => [...prev, duplicate])
    toast.success('Duplicated', { duration: 2000 })
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#FFFFFF' }}>
      {/* PAGE HEADER */}
      <div className="shrink-0" style={{ padding: '20px 24px 0', borderBottom: '0.5px solid #E8E7E2' }}>
        {/* Eyebrow */}
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#C4C3BE',
          letterSpacing: '0.5px',
        }}>
          Staff · Team
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#111110',
          letterSpacing: '-0.5px',
          marginTop: 4,
        }}>
          Who&apos;s on this proposal with us?
        </h1>

        {/* Stats row */}
        <div className="flex items-center gap-6" style={{ marginTop: 14, marginBottom: 14 }}>
          <StatItem value={stats.primeCount} label="prime" />
          <Divider />
          <StatItem value={stats.subCount} label="subcontractors" />
          <Divider />
          <StatItem value={stats.partnerCount} label="teaming partners" />
          <Divider />
          <StatItem value={stats.directorCount} label="directors" />
          <Divider />
          <StatItem value={`${stats.primeWorkShare}%`} label="prime work share" />
        </div>
      </div>

      {/* COMPLIANCE BANNER */}
      <ComplianceBanner compliance={compliance} primeShare={primeShare} />

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto">
        {/* TEAM MEMBERS section */}
        <section>
          {/* Section header */}
          <div className="flex items-center justify-between" style={{ padding: '16px 20px 10px' }}>
            <div className="flex items-center gap-2">
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: '#6B6A65',
              }}>
                Team members
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#6B6A65',
                background: '#F4F3EF',
                padding: '2px 6px',
                borderRadius: 10,
              }}>
                {teamMembers.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7">
                <Upload className="w-3.5 h-3.5 mr-1" />
                Import from Rolodex
              </Button>
              <Button size="sm" className="text-xs h-7" style={{ backgroundColor: '#111110' }} onClick={handleAddMember}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add member
              </Button>
            </div>
          </div>

          {/* Card grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              padding: '0 20px 16px',
            }}
          >
            {teamMembers.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                onClick={() => setSelectedMember(member)}
                onDelete={() => handleDeleteMember(member.id)}
                onDuplicate={() => handleDuplicateMember(member)}
              />
            ))}
            <AddMemberCard onClick={handleAddMember} />
          </div>
        </section>

        {/* DIRECTOR REVIEW section */}
        <section style={{ borderTop: '0.5px solid #F4F3EF', padding: '16px 20px' }}>
          {/* Section header */}
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <div className="flex items-center gap-2">
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: '#6B6A65',
              }}>
                Director review
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#6B6A65',
                background: '#F4F3EF',
                padding: '2px 6px',
                borderRadius: 10,
              }}>
                {directors.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowAddDirector(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add director
            </Button>
          </div>

          {/* Hint text */}
          <p style={{
            fontSize: 11,
            color: '#6B6A65',
            lineHeight: 1.5,
            marginBottom: 10,
          }}>
            Directors receive a private link to review WBS elements and assign hours.
            Links expire after 14 days and can be resent.
          </p>

          {/* Director list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {directors.map(director => (
              <DirectorCard
                key={director.id}
                director={director}
                onSendLink={() => handleSendLink(director.id)}
                onCopyLink={() => handleCopyLink(director)}
                onDelete={() => handleDeleteDirector(director.id)}
                onDuplicate={() => handleDuplicateDirector(director)}
                isSending={sendingLink === director.id}
              />
            ))}
          </div>

          {/* Add director form */}
          {showAddDirector && (
            <div
              style={{
                marginTop: 10,
                padding: 14,
                background: '#FAFAF9',
                border: '0.5px solid #E8E7E2',
                borderRadius: 7,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Input
                  placeholder="Name"
                  value={newDirector.name}
                  onChange={(e) => setNewDirector({ ...newDirector, name: e.target.value })}
                  className="text-sm flex-1"
                />
                <Input
                  placeholder="Role (e.g. VP of Engineering)"
                  value={newDirector.role}
                  onChange={(e) => setNewDirector({ ...newDirector, role: e.target.value })}
                  className="text-sm flex-1"
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={newDirector.email}
                  onChange={(e) => setNewDirector({ ...newDirector, email: e.target.value })}
                  className="text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setShowAddDirector(false)
                    setNewDirector({ name: '', role: '', email: '' })
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-7"
                  style={{ backgroundColor: '#111110' }}
                  onClick={handleAddDirector}
                  disabled={!newDirector.name || !newDirector.email}
                >
                  Add director
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {directors.length === 0 && !showAddDirector && (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                background: '#FAFAF9',
                border: '1px dashed #D4D3CE',
                borderRadius: 7,
              }}
            >
              <p style={{ fontSize: 12, color: '#9B9A95', marginBottom: 8 }}>
                No directors added yet
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowAddDirector(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add your first director
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* MEMBER DETAIL SLIDEOUT */}
      {selectedMember && (
        <MemberDetailSlideout
          member={selectedMember}
          onUpdate={(updates) => handleUpdateMember(selectedMember.id, updates)}
          onSave={handleSaveMember}
          onDelete={() => handleDeleteMember(selectedMember.id)}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}

// ==================== DIRECTOR CARD ====================

function DirectorCard({
  director,
  onSendLink,
  onCopyLink,
  onDelete,
  onDuplicate,
  isSending,
}: {
  director: Director
  onSendLink: () => void
  onCopyLink: () => void
  onDelete: () => void
  onDuplicate: () => void
  isSending: boolean
}) {
  // Get initials from name
  const nameParts = director.name.split(' ')
  const initials = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : (nameParts[0]?.[0] || '?').toUpperCase()

  // Determine token status
  const hasToken = !!director.token
  const isExpired = director.tokenExpiry ? new Date(director.tokenExpiry) < new Date() : false
  const isActive = hasToken && !isExpired

  // Calculate days
  const daysUntilExpiry = director.tokenExpiry ? getDaysUntil(director.tokenExpiry) : 0
  const daysSinceExpiry = director.tokenExpiry ? getDaysAgo(director.tokenExpiry) : 0
  const daysSinceViewed = director.lastViewed ? getDaysAgo(director.lastViewed) : null

  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: '12px 14px',
        background: '#FFFFFF',
        border: '0.5px solid #E8E7E2',
        borderRadius: 7,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#111110',
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111110' }}>
          {director.name}
        </div>
        <div style={{ fontSize: 11, color: '#6B6A65' }}>
          {director.role || director.email}
        </div>
      </div>

      {/* Status block */}
      <div style={{ textAlign: 'right', marginRight: 8 }}>
        {isActive && (
          <>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 3,
              background: '#EAF3DE',
              color: '#27500A',
            }}>
              Link active
            </span>
            <div style={{ fontSize: 10, color: '#6B6A65', marginTop: 2 }}>
              Expires in {daysUntilExpiry} days
            </div>
            {daysSinceViewed !== null ? (
              <div style={{ fontSize: 10, color: '#6B6A65' }}>
                Last viewed: {daysSinceViewed} days ago
              </div>
            ) : (
              <div style={{ fontSize: 10, color: '#C4C3BE' }}>
                Not yet opened
              </div>
            )}
          </>
        )}
        {hasToken && isExpired && (
          <>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 3,
              background: '#FCEBEB',
              color: '#501313',
            }}>
              Link expired
            </span>
            <div style={{ fontSize: 10, color: '#6B6A65', marginTop: 2 }}>
              Expired {daysSinceExpiry} days ago
            </div>
            {!director.lastViewed && (
              <div style={{ fontSize: 10, color: '#C4C3BE' }}>
                Never opened
              </div>
            )}
          </>
        )}
        {!hasToken && (
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 3,
            background: '#F4F3EF',
            color: '#5F5E5A',
          }}>
            No link sent
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {isActive && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={onCopyLink}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={onSendLink}
              disabled={isSending}
            >
              <Send className="w-3 h-3 mr-1" />
              Resend
            </Button>
          </>
        )}
        {hasToken && isExpired && (
          <Button
            size="sm"
            className="text-xs h-6 px-2"
            style={{ backgroundColor: '#111110' }}
            onClick={onSendLink}
            disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Send new link'}
          </Button>
        )}
        {!hasToken && (
          <Button
            size="sm"
            className="text-xs h-6 px-2"
            style={{ backgroundColor: '#111110' }}
            onClick={onSendLink}
            disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Send link'}
          </Button>
        )}
        <button
          onClick={onDuplicate}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#C4C3BE',
          }}
          className="hover:text-gray-600"
          title="Duplicate director"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#C4C3BE',
          }}
          className="hover:text-red-500"
          title="Remove director"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ==================== MEMBER CARD ====================

function MemberCard({ member, onClick, onDelete, onDuplicate }: { member: TeamMember; onClick: () => void; onDelete: () => void; onDuplicate: () => void }) {
  // Get initials from org name
  const initials = member.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase() || '??'

  // Type-based colors
  const typeColors = {
    prime: { bg: '#111110', text: '#FFFFFF', avatarBg: '#111110', avatarText: '#F5C200' },
    sub: { bg: '#F4F3EF', text: '#5F5E5A', avatarBg: '#F4F3EF', avatarText: '#5F5E5A' },
    partner: { bg: '#E1F5EE', text: '#085041', avatarBg: '#E1F5EE', avatarText: '#085041', border: '0.5px solid #5DCAA5' },
  }
  const colors = typeColors[member.type]

  // Agreement status colors
  const statusColors = {
    signed: { bg: '#EAF3DE', text: '#27500A' },
    pending: { bg: '#FAEEDA', text: '#412402' },
    none: { bg: '#F4F3EF', text: '#5F5E5A' },
  }
  const statusStyle = statusColors[member.agreementStatus]

  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        border: '0.5px solid #E8E7E2',
        borderRadius: 8,
        padding: '14px 14px 12px',
        cursor: 'pointer',
        position: 'relative',
      }}
      className="group hover:border-[#D4D3CE] transition-colors"
    >
      {/* Top right: type badge + actions */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 3, color: '#C4C3BE' }}
            className="hover:bg-gray-100 hover:text-gray-600"
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 3, color: '#C4C3BE' }}
            className="hover:bg-red-50 hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 3,
            background: colors.bg,
            color: colors.text,
            border: member.type === 'partner' ? '0.5px solid #5DCAA5' : 'none',
            textTransform: 'capitalize',
          }}
        >
          {member.type}
        </div>
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: colors.avatarBg,
          color: colors.avatarText,
          fontSize: 13,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        {initials}
      </div>

      {/* Org name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111110', marginBottom: 2 }}>
        {member.name || 'Unnamed'}
      </div>

      {/* Type label */}
      <div style={{ fontSize: 11, color: '#6B6A65', marginBottom: 10 }}>
        {member.type === 'prime' ? 'Prime contractor' : member.type === 'sub' ? 'Subcontractor' : 'Teaming partner'}
      </div>

      {/* Divider */}
      <div style={{ height: 0.5, background: '#F4F3EF', marginBottom: 8 }} />

      {/* Metadata rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <MetadataRow label="Work share" value={`${member.workShare}%`} />
        <MetadataRow label="Contact" value={member.contactName || '—'} />
        {member.type === 'prime' && member.uei && (
          <MetadataRow label="UEI" value={member.uei} mono />
        )}
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 10, color: '#9B9A95' }}>Agreement</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 3,
              background: statusStyle.bg,
              color: statusStyle.text,
              textTransform: 'capitalize',
            }}
          >
            {member.agreementStatus}
          </span>
        </div>
      </div>
    </div>
  )
}

function MetadataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 10, color: '#9B9A95' }}>{label}</span>
      <span style={{
        fontSize: 10,
        color: '#5F5E5A',
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  )
}

// ==================== ADD MEMBER CARD ====================

function AddMemberCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#FAFAF9',
        border: '1px dashed #D4D3CE',
        borderRadius: 8,
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        gap: 6,
      }}
      className="hover:border-[#C4C3BE] transition-colors"
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#F0EDE6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus className="w-3.5 h-3.5" style={{ color: '#9B9A95' }} />
      </div>
      <span style={{ fontSize: 12, color: '#C4C3BE' }}>Add member</span>
    </div>
  )
}

// ==================== MEMBER DETAIL SLIDEOUT ====================

function MemberDetailSlideout({
  member,
  onUpdate,
  onSave,
  onDelete,
  onClose,
}: {
  member: TeamMember
  onUpdate: (updates: Partial<TeamMember>) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 w-[480px] bg-white z-50 flex flex-col"
        style={{ borderLeft: '0.5px solid #E8E7E2' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 shrink-0"
          style={{ borderBottom: '0.5px solid #E8E7E2' }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111110' }}>
            {member.name || 'New Team Member'}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            aria-label="Close"
          >
            <X className="w-4 h-4" style={{ color: '#6B6A65' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Organization name */}
          <div className="space-y-1.5">
            <FieldLabel>Organization name</FieldLabel>
            <Input
              value={member.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              onBlur={() => onSave()}
              placeholder="e.g. Skybrid Solutions"
              className="text-sm"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <FieldLabel>Type</FieldLabel>
            <div style={{ display: 'flex', border: '0.5px solid #E8E7E2', borderRadius: 6, padding: 2, gap: 1 }}>
              {(['prime', 'sub', 'partner'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => onUpdate({ type: t })}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: 12,
                    fontWeight: member.type === t ? 600 : 400,
                    background: member.type === t ? '#111110' : 'transparent',
                    color: member.type === t ? '#FFFFFF' : '#6B6A65',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Contact name */}
          <div className="space-y-1.5">
            <FieldLabel>Contact name</FieldLabel>
            <Input
              value={member.contactName || ''}
              onChange={(e) => onUpdate({ contactName: e.target.value || null })}
              onBlur={() => onSave()}
              placeholder="Primary point of contact"
              className="text-sm"
            />
          </div>

          {/* Work share */}
          <div className="space-y-1.5">
            <FieldLabel>Work share</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={member.workShare}
                onChange={(e) => onUpdate({ workShare: parseInt(e.target.value) || 0 })}
                onBlur={() => onSave()}
                className="text-sm w-24"
              />
              <span style={{ fontSize: 11, color: '#5F5E5A' }}>%</span>
            </div>
          </div>

          {/* UEI (prime only) */}
          {member.type === 'prime' && (
            <div className="space-y-1.5">
              <FieldLabel>UEI (Unique Entity ID)</FieldLabel>
              <Input
                value={member.uei || ''}
                onChange={(e) => onUpdate({ uei: e.target.value || null })}
                onBlur={() => onSave()}
                placeholder="12-character UEI"
                className="text-sm font-mono"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
          )}

          <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

          {/* Agreement type */}
          <div className="space-y-1.5">
            <FieldLabel>Agreement type</FieldLabel>
            <select
              value={member.agreementType || ''}
              onChange={(e) => { onUpdate({ agreementType: e.target.value || null }); onSave() }}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '0.5px solid #E8E7E2',
                borderRadius: 6,
                background: '#FFFFFF',
                color: '#111110',
              }}
            >
              <option value="">Select type...</option>
              <option value="Teaming Agreement">Teaming Agreement</option>
              <option value="MOU">MOU</option>
              <option value="Subcontract">Subcontract</option>
              <option value="Letter of Intent">Letter of Intent</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Agreement status */}
          <div className="space-y-1.5">
            <FieldLabel>Agreement status</FieldLabel>
            <select
              value={member.agreementStatus}
              onChange={(e) => { onUpdate({ agreementStatus: e.target.value as TeamMember['agreementStatus'] }); onSave() }}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '0.5px solid #E8E7E2',
                borderRadius: 6,
                background: '#FFFFFF',
                color: '#111110',
              }}
            >
              <option value="none">None</option>
              <option value="pending">Pending</option>
              <option value="signed">Signed</option>
            </select>
          </div>

          <div style={{ borderTop: '0.5px solid #E8E7E2' }} />

          {/* Notes */}
          <div className="space-y-1.5">
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              value={member.notes || ''}
              onChange={(e) => onUpdate({ notes: e.target.value || null })}
              onBlur={() => onSave()}
              placeholder="Internal notes about this team member..."
              className="text-sm min-h-[80px]"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="shrink-0 p-4 flex items-center justify-between"
          style={{ borderTop: '0.5px solid #E8E7E2' }}
        >
          <button
            onClick={onDelete}
            style={{
              fontSize: 11,
              color: '#A32D2D',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Delete member
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 11,
              color: '#5F5E5A',
              background: 'none',
              border: '0.5px solid #E8E7E2',
              borderRadius: 5,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: '#6B6A65',
      letterSpacing: '1px',
    }}>
      {children}
    </div>
  )
}

// ==================== COMPLIANCE BANNER ====================

function ComplianceBanner({ compliance, primeShare }: { compliance: ComplianceRule | null; primeShare: number }) {
  // Don&apos;t render banner for Full & Open or if no set-aside configured
  if (!compliance) return null

  // Determine state
  const isCompliant = primeShare >= compliance.threshold
  const isWarning = primeShare >= 40 && primeShare < compliance.threshold
  const isDanger = primeShare < 40

  // State-based colors
  let backgroundColor: string
  let borderColor: string
  let accentColor: string

  if (isCompliant) {
    backgroundColor = '#FBF9F0'
    borderColor = '#F5C200'
    accentColor = '#639922'
  } else if (isWarning) {
    backgroundColor = '#FEF9F0'
    borderColor = '#BA7517'
    accentColor = '#BA7517'
  } else {
    backgroundColor = '#FEFCFC'
    borderColor = '#A32D2D'
    accentColor = '#A32D2D'
  }

  // Extract clause number (e.g., "52.219-14" from "FAR 52.219-14")
  const clauseNumber = compliance.clause.replace('FAR ', '')

  return (
    <div
      className="shrink-0 flex items-center gap-2.5"
      style={{
        margin: '10px 16px 0',
        padding: '10px 14px',
        background: backgroundColor,
        borderLeft: `2px solid ${borderColor}`,
        borderRadius: '0 7px 7px 0',
      }}
    >
      {/* Left icon - clause number */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          background: '#111110',
          color: '#F5C200',
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {clauseNumber}
      </div>

      {/* Middle - compliance text */}
      <div style={{ flex: 1, fontSize: 12, color: '#5F5E5A', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: '#111110' }}>{compliance.label} compliance: </span>
        {compliance.rule}. Must be documented before submission.
        {isWarning && (
          <div style={{ fontSize: 11, color: '#BA7517', marginTop: 2 }}>
            Approaching minimum — review subcontractor work allocation
          </div>
        )}
        {isDanger && primeShare > 0 && (
          <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 2 }}>
            Below required minimum — this proposal may not be compliant
          </div>
        )}
        {primeShare === 0 && (
          <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 2 }}>
            No roles added yet — add roles in Roles &amp; Pricing to calculate prime work share
          </div>
        )}
      </div>

      {/* Right - percentage and progress bar */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: accentColor }}>
          {primeShare}%
        </div>
        <div style={{ fontSize: 9, color: '#6B6A65', marginBottom: 4 }}>
          FFTC prime share
        </div>
        {/* Progress bar */}
        <div style={{ width: 120, height: 4, background: '#E8E7E2', borderRadius: 2, position: 'relative' }}>
          <div
            style={{
              width: `${Math.min(primeShare, 100)}%`,
              height: '100%',
              background: accentColor,
              borderRadius: 2,
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: '#6B6A65', marginTop: 2 }}>
          Required: {compliance.threshold}%
        </div>
      </div>
    </div>
  )
}

// ==================== SHARED UI ATOMS ====================

function StatItem({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span style={{ fontSize: 20, fontWeight: 800, color: '#111110' }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: '#6B6A65' }}>
        {label}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 0.5, height: 28, background: '#E8E7E2' }} />
}
