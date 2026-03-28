'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Lock, LogOut, Camera, Check, X } from 'lucide-react'
import { ErrorAlert } from '@/components/ui/error-alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { toast } from 'sonner'
import { userApi } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'

interface UserProfile {
  fullName: string
  email: string
  avatarUrl: string | null
}

function ProfilePage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    email: '',
    avatarUrl: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  // Editing states
  const [editingName, setEditingName] = useState(false)
  const [nameBuffer, setNameBuffer] = useState('')

  // Password dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Load profile from API
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await userApi.getProfile() as { user: { fullName: string; email: string; avatarUrl: string | null } }
        if (response.user) {
          setProfile({
            fullName: response.user.fullName || '',
            email: response.user.email || '',
            avatarUrl: response.user.avatarUrl,
          })
        }
      } catch (e) {
        console.warn('Failed to load profile from API:', e)
        // Fallback to empty profile - user will see they need to set up
      }
      setIsLoading(false)
    }
    loadProfile()
  }, [])
  
  // Save profile to API
  const saveProfile = async (updates: Partial<UserProfile>) => {
    const newProfile = { ...profile, ...updates }
    setProfile(newProfile)

    try {
      await userApi.updateProfile({
        fullName: newProfile.fullName,
        avatarUrl: newProfile.avatarUrl || undefined,
      })
      toast.success('Profile saved')
    } catch (e) {
      console.warn('Failed to save profile to API:', e)
      toast.error('Failed to save profile')
    }
  }
  
  const handleStartEditName = () => {
    setNameBuffer(profile.fullName)
    setEditingName(true)
  }
  
  const handleSaveName = () => {
    if (nameBuffer.trim()) {
      saveProfile({ fullName: nameBuffer.trim() })
    }
    setEditingName(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const response = await userApi.uploadAvatar(file) as { avatarUrl: string }
      setProfile(prev => ({ ...prev, avatarUrl: response.avatarUrl }))
      // Refresh auth context so header shows new avatar
      await refreshUser()
      toast.success('Avatar updated')
    } catch (err) {
      console.error('Avatar upload error:', err)
      toast.error('Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handlePasswordChange = () => {
    setPasswordError('')
    
    if (!passwordForm.currentPassword) {
      setPasswordError('Current password is required')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    
    // Demo mode - just close the dialog
    setShowPasswordDialog(false)
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    toast.success('Password updated')
  }
  
  const handleLogout = () => {
    // Clear auth state (demo mode)
    localStorage.removeItem('truebid-auth')
    router.push('/login')
  }
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="h-20 w-20 bg-gray-200 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-600 mt-1">Manage your personal information</p>
      </div>
      
      {/* Avatar Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile.avatarUrl || undefined} alt={profile.fullName} />
              <AvatarFallback className="text-xl bg-gray-100 text-gray-600">
                {getInitials(profile.fullName)}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </button>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{profile.fullName}</h3>
            <p className="text-sm text-gray-600">{profile.email}</p>
          </div>
        </div>
      </div>
      
      {/* Details Card */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {/* Full Name */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <Label className="text-xs text-gray-500">Full Name</Label>
              {editingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={nameBuffer}
                    onChange={(e) => setNameBuffer(e.target.value)}
                    className="h-8 w-64"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveName} className="h-8 w-8 p-0">
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingName(false)} className="h-8 w-8 p-0">
                    <X className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm font-medium text-gray-900 mt-0.5">{profile.fullName}</p>
              )}
            </div>
          </div>
          {!editingName && (
            <Button variant="ghost" size="sm" onClick={handleStartEditName}>
              Change
            </Button>
          )}
        </div>
        
        {/* Email */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <Label className="text-xs text-gray-500">Email</Label>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{profile.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" disabled>
            Change
          </Button>
        </div>
        
        {/* Password */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-gray-400" />
            <div>
              <Label className="text-xs text-gray-500">Password</Label>
              <p className="text-sm font-medium text-gray-900 mt-0.5">••••••••••••</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowPasswordDialog(true)}>
            Change
          </Button>
        </div>
      </div>
      
      {/* Sign Out */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-red-600 hover:text-red-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>
      
      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
            {passwordError && (
              <ErrorAlert variant="inline" message={passwordError} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordChange}>
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProfilePage