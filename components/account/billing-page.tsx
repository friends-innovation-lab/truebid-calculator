'use client'

import React from 'react'
import { CreditCard, Check, Zap, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function BillingPage() {
  const currentPlan = {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      'Up to 3 active proposals',
      '1 user',
      'Basic RFP analysis',
      'Export to Word',
    ],
    limits: {
      proposals: 3,
      users: 1,
    }
  }
  
  const proPlan = {
    name: 'Pro',
    price: '$49',
    period: 'per user/month',
    features: [
      'Unlimited proposals',
      'Unlimited team members',
      'Advanced AI analysis',
      'Historical charge code library',
      'Priority support',
      'Custom rate templates',
    ],
  }
  
  const enterprisePlan = {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact sales',
    features: [
      'Everything in Pro',
      'SSO/SAML authentication',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      'On-premise option',
    ],
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">Manage your subscription and billing</p>
        </div>
      </div>
      
      {/* Current Plan */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Current Plan</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{currentPlan.name}</span>
              <span className="text-sm text-gray-500">{currentPlan.price} {currentPlan.period}</span>
            </div>
          </div>
          <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Included</h4>
          <ul className="space-y-2">
            {currentPlan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-600" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Usage</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Proposals</span>
                <span className="font-medium">1 / {currentPlan.limits.proposals}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: '33%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Team Members</span>
                <span className="font-medium">1 / {currentPlan.limits.users}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Upgrade Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pro Plan */}
        <div className="bg-white rounded-lg border-2 border-blue-200 p-6 relative">
          <Badge className="absolute -top-2 left-4 bg-blue-600 text-white">Recommended</Badge>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">{proPlan.name}</h3>
          </div>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-2xl font-bold text-gray-900">{proPlan.price}</span>
            <span className="text-sm text-gray-500">{proPlan.period}</span>
          </div>
          <ul className="space-y-2 mb-6">
            {proPlan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-blue-600" />
                {feature}
              </li>
            ))}
          </ul>
          <Button className="w-full" disabled>
            Upgrade to Pro
          </Button>
        </div>
        
        {/* Enterprise Plan */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">{enterprisePlan.name}</h3>
          </div>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-2xl font-bold text-gray-900">{enterprisePlan.price}</span>
            <span className="text-sm text-gray-500">{enterprisePlan.period}</span>
          </div>
          <ul className="space-y-2 mb-6">
            {enterprisePlan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-gray-600" />
                {feature}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full" disabled>
            Contact Sales
          </Button>
        </div>
      </div>
      
      {/* Billing History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Billing History</h3>
        <div className="text-center py-8">
          <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No billing history yet</p>
          <p className="text-xs text-gray-500 mt-1">Invoices will appear here when you upgrade</p>
        </div>
      </div>
      
      {/* Early Access */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Interested in Pro or Enterprise?</p>
            <p className="text-xs text-gray-600 mt-0.5">Join our waitlist for early access and exclusive pricing.</p>
          </div>
          <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
            Join Waitlist
          </Button>
        </div>
      </div>
    </div>
  )
}

export default BillingPage