'use client'

import React from 'react'
import { useAppContext, IndirectRates } from '@/contexts/app-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function RatesPage() {
  const {
    indirectRates,
    setIndirectRates,
    profitTargets,
    setProfitTargets,
    escalationRates,
    setEscalationRates,
    companyPolicy,
    setCompanyPolicy,
  } = useAppContext()

  const handleIndirectChange = (updates: Partial<IndirectRates>) => {
    setIndirectRates({ ...indirectRates, ...updates })
  }

  const handleProfitChange = (updates: Partial<typeof profitTargets>) => {
    setProfitTargets({ ...profitTargets, ...updates })
  }

  const handleEscalationChange = (updates: Partial<typeof escalationRates>) => {
    setEscalationRates({ ...escalationRates, ...updates })
  }

  const handlePolicyChange = (updates: Partial<typeof companyPolicy>) => {
    setCompanyPolicy({ ...companyPolicy, ...updates })
  }

  return (
    <TooltipProvider>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Rates & Margins</h2>
          <p className="text-sm text-gray-600 mt-1">Configure indirect rates, profit targets, and escalation factors</p>
        </div>

        {/* Indirect Rates Card */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Indirect Rates</h3>
              <p className="text-xs text-gray-500 mt-0.5">From your accountant or forward pricing rate proposal</p>
            </div>
            <Badge variant="outline" className="text-xs">
              FY{indirectRates.fiscalYear}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="fringe">Fringe Rate</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">Benefits cost as percentage of labor (health, 401k, PTO, etc.)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="relative">
                <Input
                  id="fringe"
                  type="number"
                  step="0.01"
                  value={(indirectRates.fringe * 100).toFixed(2)}
                  onChange={(e) => handleIndirectChange({ fringe: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="overhead">Overhead Rate</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">Indirect costs for running operations (facilities, IT, HR support, etc.)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="relative">
                <Input
                  id="overhead"
                  type="number"
                  step="0.01"
                  value={(indirectRates.overhead * 100).toFixed(2)}
                  onChange={(e) => handleIndirectChange({ overhead: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="ga">G&A Rate</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">General & Administrative costs (executive, legal, accounting, BD, etc.)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="relative">
                <Input
                  id="ga"
                  type="number"
                  step="0.01"
                  value={(indirectRates.ga * 100).toFixed(2)}
                  onChange={(e) => handleIndirectChange({ ga: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="rate-source">Source</Label>
              <Input
                id="rate-source"
                value={indirectRates.source}
                onChange={(e) => handleIndirectChange({ source: e.target.value })}
                placeholder="Rate Model 2025"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="rate-type">Rate Type</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2 text-sm">
                      <p><strong>Forward Pricing:</strong> Projected rates for proposals (most common for bidding)</p>
                      <p><strong>Provisional:</strong> Temporary DCAA-approved rates for billing while final rates are determined</p>
                      <p><strong>Billing:</strong> Rates currently used to invoice the government</p>
                      <p><strong>Final:</strong> Audited rates after contract closeout</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <select
                id="rate-type"
                value={indirectRates.rateType}
                onChange={(e) => handleIndirectChange({ rateType: e.target.value as IndirectRates['rateType'] })}
                className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900"
              >
                <option value="forward-pricing">Forward Pricing</option>
                <option value="provisional">Provisional</option>
                <option value="billing">Billing</option>
                <option value="final">Final</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Profit Targets Card */}
        <Card>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Profit Targets</h3>
            <p className="text-xs text-gray-500 mt-0.5">Default profit margins by contract type and risk level</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tm-profit">T&M Default</Label>
              <div className="relative">
                <Input
                  id="tm-profit"
                  type="number"
                  step="1"
                  value={(profitTargets.tmDefault * 100).toFixed(0)}
                  onChange={(e) => handleProfitChange({ tmDefault: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gsa-profit">GSA Default</Label>
              <div className="relative">
                <Input
                  id="gsa-profit"
                  type="number"
                  step="1"
                  value={(profitTargets.gsaDefault * 100).toFixed(0)}
                  onChange={(e) => handleProfitChange({ gsaDefault: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ffp-low">FFP Low Risk</Label>
              <div className="relative">
                <Input
                  id="ffp-low"
                  type="number"
                  step="1"
                  value={(profitTargets.ffpLowRisk * 100).toFixed(0)}
                  onChange={(e) => handleProfitChange({ ffpLowRisk: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ffp-med">FFP Medium Risk</Label>
              <div className="relative">
                <Input
                  id="ffp-med"
                  type="number"
                  step="1"
                  value={(profitTargets.ffpMediumRisk * 100).toFixed(0)}
                  onChange={(e) => handleProfitChange({ ffpMediumRisk: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Escalation Rates Card */}
        <Card>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Escalation Rates</h3>
            <p className="text-xs text-gray-500 mt-0.5">Annual escalation for multi-year contracts</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="labor-esc">Labor Escalation</Label>
              <div className="relative">
                <Input
                  id="labor-esc"
                  type="number"
                  step="0.5"
                  value={(escalationRates.laborDefault * 100).toFixed(1)}
                  onChange={(e) => handleEscalationChange({ laborDefault: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="odc-esc">ODC Escalation</Label>
              <div className="relative">
                <Input
                  id="odc-esc"
                  type="number"
                  step="0.5"
                  value={(escalationRates.odcDefault * 100).toFixed(1)}
                  onChange={(e) => handleEscalationChange({ odcDefault: parseFloat(e.target.value) / 100 })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Company Defaults Card */}
        <Card>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Company Defaults</h3>
            <p className="text-xs text-gray-500 mt-0.5">Base rate calculation uses standard hours. Billable hours are set per-bid.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="std-hours">Standard Hours/Year</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">Used for base rate calculation: annual salary ÷ 2,080. Don&apos;t change unless you have a reason.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="std-hours"
                type="number"
                value={companyPolicy.standardHours}
                onChange={(e) => handlePolicyChange({ standardHours: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="target-billable">Default Billable Hours</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">Default for new proposals. Accounts for PTO, holidays, training. Can be overridden per-bid.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="target-billable"
                type="number"
                value={companyPolicy.targetBillableHours || 1920}
                onChange={(e) => handlePolicyChange({ targetBillableHours: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default RatesPage