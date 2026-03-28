'use client'

import React, { useState } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  HelpCircle,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'

// GSA SIN types
interface GSALaborCategory {
  id: string
  laborCategory: string
  hourlyRate: number
  yearsExperience?: string
  education?: string
}

interface GSASin {
  id: string
  sin: string
  title: string
  laborCategories: GSALaborCategory[]
}

export function GSASchedulePage() {
  const { companyProfile, setCompanyProfile } = useAppContext()

  const handleChange = (field: string, value: string | boolean | number) => {
    setCompanyProfile({ ...companyProfile, [field]: value })
  }

  const isActive = companyProfile.gsaMasSchedule || false

  return (
    <TooltipProvider>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">GSA Schedule</h2>
          <p className="text-sm text-gray-600 mt-1">Manage your GSA MAS contract, SINs, and ceiling rates</p>
        </div>

        {/* GSA Contract Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Contract Information</h3>
            <a
              href="https://www.gsa.gov/buy-through-us/purchasing-programs/gsa-multiple-award-schedule"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              GSA MAS Info
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-green-100' : 'bg-gray-200'}`}>
                <FileText className={`w-5 h-5 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">GSA MAS Schedule</p>
                <p className="text-xs text-gray-500">
                  {isActive ? 'Your company has an active GSA contract' : 'Enable if your company holds a GSA MAS contract'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => handleChange('gsaMasSchedule', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {!isActive && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">No GSA Schedule configured</p>
                <p className="text-xs text-amber-700 mt-1">
                  Enable the toggle above if your company has an active GSA MAS contract. 
                  This allows TrueBid to use your GSA ceiling rates when pricing GSA task orders.
                </p>
              </div>
            </div>
          )}

          {isActive && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gsa-contract">GSA Contract Number</Label>
                  <Input
                    id="gsa-contract"
                    value={companyProfile.gsaContractNumber || ''}
                    onChange={(e) => handleChange('gsaContractNumber', e.target.value)}
                    placeholder="47QTCA23D0076"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gsa-expiration">Contract Expiration</Label>
                  <Input
                    id="gsa-expiration"
                    type="date"
                    value={companyProfile.gsaExpirationDate || ''}
                    onChange={(e) => handleChange('gsaExpirationDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="gsa-escalation">Annual Escalation Rate</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">The Economic Price Adjustment (EPA) rate from your GSA contract. This allows annual rate increases.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="relative">
                    <Input
                      id="gsa-escalation"
                      type="number"
                      step="0.1"
                      value={((companyProfile.gsaEscalationRate || 0.03) * 100).toFixed(1)}
                      onChange={(e) => handleChange('gsaEscalationRate', parseFloat(e.target.value) / 100)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="gsa-base-year">Base Year</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">The year your current ceiling rates are based on. Used to calculate escalated rates for future periods.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="gsa-base-year"
                    type="number"
                    value={companyProfile.gsaBaseYear || new Date().getFullYear()}
                    onChange={(e) => handleChange('gsaBaseYear', parseInt(e.target.value))}
                    placeholder="2024"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* SINs and Labor Categories */}
        {isActive && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">SINs & Ceiling Rates</h3>
              <p className="text-xs text-gray-500 mt-0.5">Special Item Numbers and labor category ceiling rates from your GSA price list</p>
            </div>
            
            <GSAScheduleRates />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

// GSA Schedule Rates Component
function GSAScheduleRates() {
  const { companyProfile, setCompanyProfile } = useAppContext()
  const [expandedSin, setExpandedSin] = useState<string | null>(null)
  
  const gsaSins: GSASin[] = companyProfile.gsaSins || []

  const handleAddSin = () => {
    const newSin: GSASin = {
      id: `sin-${Date.now()}`,
      sin: '',
      title: '',
      laborCategories: [],
    }
    setCompanyProfile({
      ...companyProfile,
      gsaSins: [...gsaSins, newSin],
    })
    setExpandedSin(newSin.id)
    toast.success('SIN added')
  }

  const handleUpdateSin = (sinId: string, updates: Partial<GSASin>) => {
    setCompanyProfile({
      ...companyProfile,
      gsaSins: gsaSins.map(s => s.id === sinId ? { ...s, ...updates } : s),
    })
  }

  const handleRemoveSin = (sinId: string) => {
    setCompanyProfile({
      ...companyProfile,
      gsaSins: gsaSins.filter(s => s.id !== sinId),
    })
    toast.success('SIN removed')
  }

  const handleAddLaborCategory = (sinId: string) => {
    const sin = gsaSins.find(s => s.id === sinId)
    if (!sin) return
    
    const newCategory: GSALaborCategory = {
      id: `lc-${Date.now()}`,
      laborCategory: '',
      hourlyRate: 0,
      yearsExperience: '',
      education: '',
    }
    
    handleUpdateSin(sinId, {
      laborCategories: [...sin.laborCategories, newCategory],
    })
  }

  const handleUpdateLaborCategory = (sinId: string, lcId: string, updates: Partial<GSALaborCategory>) => {
    const sin = gsaSins.find(s => s.id === sinId)
    if (!sin) return
    
    handleUpdateSin(sinId, {
      laborCategories: sin.laborCategories.map(lc => 
        lc.id === lcId ? { ...lc, ...updates } : lc
      ),
    })
  }

  const handleRemoveLaborCategory = (sinId: string, lcId: string) => {
    const sin = gsaSins.find(s => s.id === sinId)
    if (!sin) return
    
    handleUpdateSin(sinId, {
      laborCategories: sin.laborCategories.filter(lc => lc.id !== lcId),
    })
  }

  // Calculate totals
  const totalSins = gsaSins.length
  const totalLaborCategories = gsaSins.reduce((sum, sin) => sum + sin.laborCategories.length, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      {totalSins > 0 && (
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="secondary">{totalSins} SIN{totalSins !== 1 ? 's' : ''}</Badge>
          <Badge variant="secondary">{totalLaborCategories} Labor Categor{totalLaborCategories !== 1 ? 'ies' : 'y'}</Badge>
        </div>
      )}

      {/* Add SIN button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleAddSin}>
          <Plus className="w-3 h-3 mr-1" />
          Add SIN
        </Button>
      </div>

      {gsaSins.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No SINs configured"
          description="Add the Special Item Numbers (SINs) from your GSA contract along with the approved ceiling rates for each labor category."
          action={{ label: 'Add Your First SIN', onClick: handleAddSin, variant: 'outline' }}
        />
      ) : (
        <div className="space-y-3">
          {gsaSins.map((sin) => (
            <div key={sin.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* SIN Header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => setExpandedSin(expandedSin === sin.id ? null : sin.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <Input
                      value={sin.sin}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleUpdateSin(sin.id, { sin: e.target.value })
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="541611"
                      className="w-28 h-8 text-sm font-mono"
                    />
                    <Input
                      value={sin.title}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleUpdateSin(sin.id, { title: e.target.value })
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="IT Professional Services"
                      className="w-56 h-8 text-sm"
                    />
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {sin.laborCategories.length} rate{sin.laborCategories.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleRemoveSin(sin.id) }}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {expandedSin === sin.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Labor Categories */}
              {expandedSin === sin.id && (
                <div className="px-4 py-4 space-y-3 border-t border-gray-200 bg-white">
                  {/* Column headers */}
                  {sin.laborCategories.length > 0 && (
                    <div className="grid grid-cols-12 gap-2 px-1 text-xs text-gray-500 font-medium">
                      <span className="col-span-4">Labor Category</span>
                      <span className="col-span-2">Ceiling Rate</span>
                      <span className="col-span-2">Years Exp</span>
                      <span className="col-span-3">Education</span>
                      <span className="col-span-1"></span>
                    </div>
                  )}
                  
                  {sin.laborCategories.map((lc) => (
                    <div key={lc.id} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        value={lc.laborCategory}
                        onChange={(e) => handleUpdateLaborCategory(sin.id, lc.id, { laborCategory: e.target.value })}
                        placeholder="Software Developer III"
                        className="col-span-4 h-8 text-sm"
                      />
                      <div className="col-span-2 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <Input
                          type="number"
                          value={lc.hourlyRate || ''}
                          onChange={(e) => handleUpdateLaborCategory(sin.id, lc.id, { hourlyRate: parseFloat(e.target.value) || 0 })}
                          placeholder="185.00"
                          className="h-8 text-sm font-mono pl-5"
                        />
                      </div>
                      <Input
                        value={lc.yearsExperience || ''}
                        onChange={(e) => handleUpdateLaborCategory(sin.id, lc.id, { yearsExperience: e.target.value })}
                        placeholder="5+"
                        className="col-span-2 h-8 text-sm"
                      />
                      <Input
                        value={lc.education || ''}
                        onChange={(e) => handleUpdateLaborCategory(sin.id, lc.id, { education: e.target.value })}
                        placeholder="Bachelor's"
                        className="col-span-3 h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLaborCategory(sin.id, lc.id)}
                        className="col-span-1 h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddLaborCategory(sin.id)}
                    className="h-8 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Labor Category
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        These ceiling rates will be used when pricing GSA task orders. Rates are automatically escalated based on your EPA rate and base year.
      </p>
    </div>
  )
}

export default GSASchedulePage