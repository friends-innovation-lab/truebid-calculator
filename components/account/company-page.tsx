'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppContext } from '@/contexts/app-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  X,
  FileText,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SaveStatus } from '@/components/ui/save-status'
import { toast } from 'sonner'
import { WritingGuideForm, WritingGuide, defaultWritingGuide } from './writing-guide-form'
import { settingsApi } from '@/lib/api'

// IDIQ Contract type
interface IDIQContract {
  id: string
  name: string
  contractNumber: string
  agency: string
  expirationDate?: string
}

export function CompanyPage() {
  const { companyProfile, setCompanyProfile, saveCompanyProfile } = useAppContext()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const latestProfile = useRef(companyProfile)
  const isInitialMount = useRef(true)

  // Writing guide state
  const [writingGuide, setWritingGuide] = useState<WritingGuide | undefined>(undefined)
  const [writingGuideLoaded, setWritingGuideLoaded] = useState(false)

  // Load writing guide from settings API
  useEffect(() => {
    async function loadWritingGuide() {
      try {
        const response = await settingsApi.get() as {
          settings?: { writing_guide?: WritingGuide }
        }
        if (response.settings?.writing_guide) {
          setWritingGuide(response.settings.writing_guide)
        }
      } catch {
        // Silently fail - will use defaults
      }
      setWritingGuideLoaded(true)
    }
    loadWritingGuide()
  }, [])

  // Save writing guide to settings API
  const handleSaveWritingGuide = useCallback(async (guide: WritingGuide) => {
    try {
      await settingsApi.save({ writing_guide: guide })
      setWritingGuide(guide)
    } catch (err) {
      console.error('[CompanyPage] Failed to save writing guide:', err)
      throw err // Re-throw so the form shows error state
    }
  }, [])

  // Keep ref in sync
  useEffect(() => { latestProfile.current = companyProfile }, [companyProfile])

  // Auto-save when companyProfile changes (debounced)
  // This handles changes from both this component and child components (like IDIQContracts)
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    setSaveStatus('saving')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        await saveCompanyProfile(latestProfile.current)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 1000)

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [companyProfile, saveCompanyProfile])

  const handleChange = (field: string, value: string | boolean | string[] | number) => {
    setCompanyProfile({ ...companyProfile, [field]: value })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Company Profile</h2>
          <p className="text-sm text-gray-600 mt-1">Company identity and registration information for proposals</p>
        </div>
        <SaveStatus status={saveStatus} />
      </div>

      {/* Basic Info Card */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900">Basic Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={companyProfile.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Your Company Name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-name">Legal Name</Label>
            <Input
              id="legal-name"
              value={companyProfile.legalName || ''}
              onChange={(e) => handleChange('legalName', e.target.value)}
              placeholder="Legal Entity Name, LLC"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Business Size</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="business-size"
                checked={companyProfile.businessSize === 'small'}
                onChange={() => handleChange('businessSize', 'small')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Small Business</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="business-size"
                checked={companyProfile.businessSize === 'other-than-small'}
                onChange={() => handleChange('businessSize', 'other-than-small')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Other Than Small</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Address Card */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900">Address</h3>
        
        <div className="space-y-2">
          <Label htmlFor="street-address">Street Address</Label>
          <Input
            id="street-address"
            value={companyProfile.streetAddress || ''}
            onChange={(e) => handleChange('streetAddress', e.target.value)}
            placeholder="123 Main Street, Suite 400"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={companyProfile.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Washington"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={companyProfile.state || ''}
              onChange={(e) => handleChange('state', e.target.value)}
              placeholder="DC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip">ZIP Code</Label>
            <Input
              id="zip"
              value={companyProfile.zipCode || ''}
              onChange={(e) => handleChange('zipCode', e.target.value)}
              placeholder="20001"
            />
          </div>
        </div>
      </Card>

      {/* Government Registrations Card */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900">Government Registrations</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sam-uei">SAM UEI</Label>
            <Input
              id="sam-uei"
              value={companyProfile.samUei || ''}
              onChange={(e) => handleChange('samUei', e.target.value)}
              placeholder="RA62AG44CFZ8"
            />
            <p className="text-xs text-gray-500">12-character Unique Entity ID from SAM.gov</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duns">DUNS Number (Legacy)</Label>
            <Input
              id="duns"
              value={companyProfile.dunsNumber || ''}
              onChange={(e) => handleChange('dunsNumber', e.target.value)}
              placeholder="123456789"
            />
            <p className="text-xs text-gray-500">9-digit number (being phased out)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cage-code">CAGE Code</Label>
            <Input
              id="cage-code"
              value={companyProfile.cageCode || ''}
              onChange={(e) => handleChange('cageCode', e.target.value)}
              placeholder="1ABC2"
            />
            <p className="text-xs text-gray-500">5-character code from DLA</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ein">EIN / Tax ID</Label>
            <Input
              id="ein"
              value={companyProfile.ein || ''}
              onChange={(e) => handleChange('ein', e.target.value)}
              placeholder="12-3456789"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="naics-codes">NAICS Codes</Label>
          <Input
            id="naics-codes"
            value={(companyProfile.naicsCodes || []).join(', ')}
            onChange={(e) => handleChange('naicsCodes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="541511, 541512, 541519"
          />
          <p className="text-xs text-gray-500">Comma-separated list of your registered NAICS codes</p>
        </div>
      </Card>

      {/* Contract Vehicles Card */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Contract Vehicles</h3>
            <p className="text-xs text-gray-500 mt-0.5">IDIQ and BPA contracts your company holds</p>
          </div>
        </div>

        {/* GSA Schedule - simple reference */}
        <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">GSA MAS Schedule</p>
              <p className="text-xs text-gray-500">
                {companyProfile.gsaContractNumber || 'Not configured'}
              </p>
            </div>
          </div>
          <Badge variant={companyProfile.gsaMasSchedule ? 'default' : 'secondary'} className="text-xs">
            {companyProfile.gsaMasSchedule ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">Configure GSA Schedule details and SIN rates in the GSA Schedule tab.</p>

        {/* Other IDIQs */}
        <IDIQContracts />
      </Card>

      {/* Writing Guide Card */}
      {writingGuideLoaded && (
        <WritingGuideForm
          initialGuide={writingGuide || defaultWritingGuide}
          onSave={handleSaveWritingGuide}
        />
      )}
    </div>
  )
}

// IDIQ Contracts Component
function IDIQContracts() {
  const { companyProfile, setCompanyProfile } = useAppContext()
  
  const idiqContracts: IDIQContract[] = companyProfile.idiqContracts || []

  const handleAddContract = () => {
    const newContract: IDIQContract = {
      id: `idiq-${Date.now()}`,
      name: '',
      contractNumber: '',
      agency: '',
    }
    setCompanyProfile({
      ...companyProfile,
      idiqContracts: [...idiqContracts, newContract],
    })
    toast.success('Contract added')
  }

  const handleUpdateContract = (contractId: string, updates: Partial<IDIQContract>) => {
    setCompanyProfile({
      ...companyProfile,
      idiqContracts: idiqContracts.map(c => c.id === contractId ? { ...c, ...updates } : c),
    })
  }

  const handleRemoveContract = (contractId: string) => {
    setCompanyProfile({
      ...companyProfile,
      idiqContracts: idiqContracts.filter(c => c.id !== contractId),
    })
    toast.success('Contract removed')
  }

  return (
    <div className="space-y-3 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Other IDIQ Contracts</Label>
        <Button variant="outline" size="sm" onClick={handleAddContract}>
          <Plus className="w-3 h-3 mr-1" />
          Add Contract
        </Button>
      </div>

      {idiqContracts.length === 0 ? (
        <p className="text-xs text-gray-500">No other contract vehicles added. Common examples: SEWP V, CIO-SP3, Alliant 2, OASIS+</p>
      ) : (
        <div className="space-y-2">
          {idiqContracts.map((contract) => (
            <div key={contract.id} className="p-3 border border-gray-200 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Contract Name</Label>
                  <Input
                    value={contract.name}
                    onChange={(e) => handleUpdateContract(contract.id, { name: e.target.value })}
                    placeholder="SEWP V"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Contract Number</Label>
                  <Input
                    value={contract.contractNumber}
                    onChange={(e) => handleUpdateContract(contract.id, { contractNumber: e.target.value })}
                    placeholder="NNG15SD78B"
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-gray-500">Issuing Agency</Label>
                  <Input
                    value={contract.agency}
                    onChange={(e) => handleUpdateContract(contract.id, { agency: e.target.value })}
                    placeholder="NASA GSFC"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-gray-500">Expiration</Label>
                  <Input
                    type="date"
                    value={contract.expirationDate || ''}
                    onChange={(e) => handleUpdateContract(contract.id, { expirationDate: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveContract(contract.id)}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CompanyPage