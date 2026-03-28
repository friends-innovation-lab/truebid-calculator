'use client'

import React from 'react'
import { Users, Mail, Shield, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Team collaboration is coming soon
        </h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
          We&apos;re building features to help your BD team collaborate on proposals.
          Get notified when it&apos;s ready.
        </p>
        <Button disabled>
          <Mail className="w-4 h-4 mr-2" />
          Invite Team Member
        </Button>
      </div>
      
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