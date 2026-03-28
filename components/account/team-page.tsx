'use client'

import React from 'react'
import { Users, Mail, Shield, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

export function TeamPage() {
  const plannedFeatures = [
    {
      icon: Mail,
      title: 'Invite Team Members',
      description: 'Send email invitations to bring your team into TrueBid',
    },
    {
      icon: Shield,
      title: 'Role-Based Permissions',
      description: 'Control who can view, edit, or approve proposals',
    },
    {
      icon: Clock,
      title: 'Activity Log',
      description: 'Track who made changes and when for audit compliance',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Team</h2>
            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">Invite your team and manage permissions</p>
        </div>
      </div>
      
      {/* Empty State */}
      <EmptyState
        icon={Users}
        title="Team collaboration is coming soon"
        description="We're building features to help your BD team collaborate on proposals. Get notified when it's ready."
      />
      
      {/* Planned Features */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">What&apos;s coming</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plannedFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="bg-white rounded-lg border border-gray-200 p-4">
                <Icon className="w-5 h-5 text-gray-400 mb-2" />
                <h4 className="text-sm font-medium text-gray-900 mb-1">{feature.title}</h4>
                <p className="text-xs text-gray-600">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Notify Me */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Want to be notified when Team features launch?</p>
            <p className="text-xs text-blue-700 mt-0.5">We&apos;ll email you as soon as it&apos;s available.</p>
          </div>
          <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
            Notify Me
          </Button>
        </div>
      </div>
    </div>
  )
}

export default TeamPage