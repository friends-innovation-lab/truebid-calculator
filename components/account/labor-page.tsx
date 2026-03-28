'use client'

import React, { useState } from 'react'
import { useAppContext, CompanyRole } from '@/contexts/app-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  GraduationCap,
  Briefcase,
  Award,
  ExternalLink,
  DollarSign,
  Check,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

// Types
type SalaryStructure = 'steps' | 'bands' | 'single'

interface ExtendedCompanyRole extends CompanyRole {
  education?: {
    minimum: string
    preferred?: string
    substitution?: string
  }
  certifications?: string[]
  functionalResponsibilities?: string
}

// SOC Code data
const SOC_CODES = [
  { code: '15-1252', title: 'Software Developers', group: 'Computer and Mathematical' },
  { code: '15-1253', title: 'Software Quality Assurance Analysts and Testers', group: 'Computer and Mathematical' },
  { code: '15-1254', title: 'Web Developers', group: 'Computer and Mathematical' },
  { code: '15-1255', title: 'Web and Digital Interface Designers', group: 'Computer and Mathematical' },
  { code: '15-1211', title: 'Computer Systems Analysts', group: 'Computer and Mathematical' },
  { code: '15-1212', title: 'Information Security Analysts', group: 'Computer and Mathematical' },
  { code: '15-1241', title: 'Computer Network Architects', group: 'Computer and Mathematical' },
  { code: '15-1244', title: 'Network and Computer Systems Administrators', group: 'Computer and Mathematical' },
  { code: '15-1245', title: 'Database Administrators and Architects', group: 'Computer and Mathematical' },
  { code: '15-1299', title: 'Computer Occupations, All Other', group: 'Computer and Mathematical' },
  { code: '15-2031', title: 'Operations Research Analysts', group: 'Computer and Mathematical' },
  { code: '15-2051', title: 'Data Scientists', group: 'Computer and Mathematical' },
  { code: '11-3021', title: 'Computer and Information Systems Managers', group: 'Management' },
  { code: '11-9041', title: 'Architectural and Engineering Managers', group: 'Management' },
  { code: '11-9199', title: 'Managers, All Other', group: 'Management' },
  { code: '13-1111', title: 'Management Analysts', group: 'Business and Financial' },
  { code: '13-1161', title: 'Market Research Analysts and Marketing Specialists', group: 'Business and Financial' },
  { code: '13-1199', title: 'Business Operations Specialists, All Other', group: 'Business and Financial' },
  { code: '17-2061', title: 'Computer Hardware Engineers', group: 'Architecture and Engineering' },
  { code: '17-2199', title: 'Engineers, All Other', group: 'Architecture and Engineering' },
  { code: '27-1024', title: 'Graphic Designers', group: 'Arts, Design, Entertainment' },
  { code: '27-1021', title: 'Commercial and Industrial Designers', group: 'Arts, Design, Entertainment' },
]

// Common certifications
const COMMON_CERTIFICATIONS = [
  'PMP', 'CISSP', 'CISM', 'Security+', 'AWS Solutions Architect', 'AWS Developer',
  'Azure Administrator', 'Azure Solutions Architect', 'GCP Professional Cloud Architect',
  'Certified Scrum Master (CSM)', 'Certified Scrum Product Owner (CSPO)',
  'SAFe Agilist', 'ITIL', 'Six Sigma Green Belt', 'Six Sigma Black Belt',
  'Certified Information Systems Auditor (CISA)', 'CompTIA A+', 'CompTIA Network+',
  'Cisco CCNA', 'Cisco CCNP', 'Kubernetes Administrator (CKA)',
]

// Save Status Indicator Component
function SaveStatusIndicator({ status }: { status: 'idle' | 'saving' | 'saved' }) {
  if (status === 'idle') return null
  
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 animate-in fade-in duration-200">
      {status === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="w-3 h-3 text-green-600" />
          <span className="text-green-600">Saved</span>
        </>
      )}
    </div>
  )
}

export function LaborPage() {
  const {
    companyRoles,
    addCompanyRole,
    removeCompanyRole,
    companySettings,
    updateCompanySettings,
    companyRolesSaveStatus,
  } = useAppContext()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  
  // Company-wide salary structure setting
  const salaryStructure: SalaryStructure = companySettings?.salaryStructure || 'steps'
  const setSalaryStructure = (structure: SalaryStructure) => {
    updateCompanySettings?.({ salaryStructure: structure })
    toast.success('Salary structure updated')
  }

  const filteredRoles = companyRoles.filter(role =>
    role.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.laborCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.blsOccCode?.includes(searchQuery)
  )

  const handleAddRole = () => {
    const newRole: CompanyRole = {
      id: `cr-${Date.now()}`,
      title: 'New Role',
      laborCategory: '',
      description: '',
      blsOccCode: '',
      blsOccTitle: '',
      levels: [
        {
          level: 'IC3',
          levelName: 'Mid-Level',
          yearsExperience: '2-5',
          monthsBeforePromotionReady: 24,
          isTerminal: false,
          steps: [{ step: 1, salary: 100000, monthsToNextStep: null }],
        },
      ],
    }
    addCompanyRole(newRole)
    setEditingRoleId(newRole.id)
    toast.success('Role added')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Labor Categories</h2>
          <p className="text-sm text-gray-600 mt-1">Define roles with SOC codes, education, and salary data</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={companyRolesSaveStatus} />
          <Button onClick={handleAddRole} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Role
          </Button>
        </div>
      </div>

      {/* Salary Structure Selector */}
     <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1">
            <Label className="text-sm font-medium">Salary Structure</Label>
            <p className="text-xs text-gray-500 mt-0.5">How your company defines compensation levels</p>
            <select
              value={salaryStructure}
              onChange={(e) => setSalaryStructure(e.target.value as SalaryStructure)}
              className="h-9 mt-2 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900"
            >
              <option value="steps">Steps (annual increases within level)</option>
              <option value="bands">Bands (min/mid/max range)</option>
              <option value="single">Single (one salary per level)</option>
            </select>
          </div>
          {salaryStructure === 'steps' && (
            <div className="w-32">
              <Label className="text-sm font-medium">Step Increase</Label>
              <p className="text-xs text-gray-500 mt-0.5">Auto-increment %</p>
              <div className="flex items-center gap-1 mt-2">
                <Input
                  type="number"
                  value={companySettings?.stepIncreasePercent ?? 3}
                  onChange={(e) => updateCompanySettings?.({ stepIncreasePercent: parseFloat(e.target.value) || 3 })}
                  className="h-9 w-16 text-sm"
                  min={0}
                  max={20}
                  step={0.5}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search roles by title, category, or SOC code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Role List */}
      <div className="space-y-3">
        {filteredRoles.map((role) => (
          <RoleCard
            key={role.id}
            role={role as ExtendedCompanyRole}
            isExpanded={expandedRoleId === role.id}
            onToggleExpand={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
            onEdit={() => setEditingRoleId(role.id)}
            onDelete={() => {
              removeCompanyRole(role.id)
              toast.success('Role deleted')
            }}
            salaryStructure={salaryStructure}
          />
        ))}

        {filteredRoles.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-3">No roles found</p>
            <Button variant="outline" size="sm" onClick={handleAddRole}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Role
            </Button>
          </div>
        )}
      </div>

      {/* Edit Role Dialog */}
      {editingRoleId && (
        <EditRoleDialog
          roleId={editingRoleId}
          onClose={() => setEditingRoleId(null)}
          salaryStructure={salaryStructure}
        />
      )}
    </div>
  )
}

// Role Card Component
function RoleCard({
  role,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  salaryStructure,
}: {
  role: ExtendedCompanyRole
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  salaryStructure: SalaryStructure
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Role Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-sm text-gray-900 truncate">{role.title}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {role.blsOccCode && <span>SOC: {role.blsOccCode}</span>}
              {role.blsOccCode && role.levels.length > 0 && (
                <span className="w-1 h-1 rounded-full bg-gray-300" />
              )}
              <span>{role.levels.length} level{role.levels.length !== 1 ? 's' : ''}</span>
              {role.certifications && role.certifications.length > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span>{role.certifications.length} cert{role.certifications.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Salary range preview */}
          {role.levels.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
              {role.levels.slice(0, 3).map((level, i) => {
                const minSalary = Math.min(...level.steps.map(s => s.salary))
                const maxSalary = Math.max(...level.steps.map(s => s.salary))
                return (
                  <Badge key={i} variant="secondary" className="text-[10px] bg-gray-100">
                    {level.level}: ${Math.round(minSalary / 1000)}k{minSalary !== maxSalary ? `-${Math.round(maxSalary / 1000)}k` : ''}
                  </Badge>
                )
              })}
              {role.levels.length > 3 && (
                <span className="text-gray-400">+{role.levels.length - 3}</span>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 py-4 border-t border-gray-200 space-y-4 bg-gray-50">
          {role.description && (
            <p className="text-sm text-gray-600">{role.description}</p>
          )}

          {role.blsOccCode && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">SOC: {role.blsOccCode}</Badge>
              <span className="text-xs text-gray-500">{role.blsOccTitle}</span>
              <a
                href={`https://www.bls.gov/oes/current/oes${role.blsOccCode.replace('-', '')}.htm`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {role.education && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <GraduationCap className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Education</p>
                  <p className="text-blue-800">{role.education.minimum}</p>
                  {role.education.substitution && (
                    <p className="text-xs text-blue-600 mt-1">Substitution: {role.education.substitution}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {role.certifications && role.certifications.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Award className="w-3 h-3" />
                Certifications
              </h5>
              <div className="flex flex-wrap gap-1">
                {role.certifications.map((cert, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{cert}</Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Salary Bands</h5>
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Level</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Experience</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                      {salaryStructure === 'steps' ? 'Salary Steps' : salaryStructure === 'bands' ? 'Range' : 'Salary'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {role.levels.map((level, i) => {
                    const minSalary = Math.min(...level.steps.map(s => s.salary))
                    const maxSalary = Math.max(...level.steps.map(s => s.salary))
                    return (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2">
                          <span className="font-medium text-gray-900">{level.level}</span>
                          <span className="text-gray-500 ml-1">({level.levelName})</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{level.yearsExperience} years</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">
                          {salaryStructure === 'steps' ? (
                            <span className="text-xs">
                              {level.steps.map((s, si) => (
                                <span key={si}>
                                  ${s.salary.toLocaleString()}
                                  {si < level.steps.length - 1 && ' → '}
                                </span>
                              ))}
                            </span>
                          ) : (
                            `$${minSalary.toLocaleString()}${minSalary !== maxSalary ? ` - $${maxSalary.toLocaleString()}` : ''}`
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Edit Role Dialog
function EditRoleDialog({ 
  roleId, 
  onClose, 
  salaryStructure 
}: { 
  roleId: string
  onClose: () => void
  salaryStructure: SalaryStructure
}) {
  const { companyRoles, updateCompanyRole, companySettings } = useAppContext()
  const role = companyRoles.find(r => r.id === roleId) as ExtendedCompanyRole | undefined
  
  const [showSOCLookup, setShowSOCLookup] = useState(false)
  const [socSearch, setSOCSearch] = useState('')
  const [showCertPicker, setShowCertPicker] = useState(false)
  const [certSearch, setCertSearch] = useState('')

  if (!role) return null

  const handleChange = (field: string, value: any) => {
    updateCompanyRole(roleId, { [field]: value })
  }

  const handleSOCSelect = (soc: typeof SOC_CODES[0]) => {
    updateCompanyRole(roleId, { blsOccCode: soc.code, blsOccTitle: soc.title })
    setShowSOCLookup(false)
    setSOCSearch('')
    toast.success('SOC code updated')
  }

  const handleAddCertification = (cert: string) => {
    const currentCerts = (role as any).certifications || []
    if (!currentCerts.includes(cert)) {
      updateCompanyRole(roleId, { certifications: [...currentCerts, cert] })
      toast.success('Certification added')
    }
    setCertSearch('')
    setShowCertPicker(false)
  }

  const handleRemoveCertification = (cert: string) => {
    const currentCerts = (role as any).certifications || []
    updateCompanyRole(roleId, { certifications: currentCerts.filter((c: string) => c !== cert) })
  }

  const filteredSOC = SOC_CODES.filter(soc =>
    soc.code.includes(socSearch) ||
    soc.title.toLowerCase().includes(socSearch.toLowerCase())
  )

  const filteredCerts = COMMON_CERTIFICATIONS.filter(cert =>
    cert.toLowerCase().includes(certSearch.toLowerCase())
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[600px] max-w-full bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Edit Labor Category</h3>
            <p className="text-sm text-gray-600">{role.title}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Basic Information
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-title">Role Title *</Label>
                <Input
                  id="role-title"
                  value={role.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Senior Software Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="labor-cat">Labor Category</Label>
                <Input
                  id="labor-cat"
                  value={role.laborCategory}
                  onChange={(e) => handleChange('laborCategory', e.target.value)}
                  placeholder="Software Developer III"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                value={role.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the role's responsibilities..."
                rows={2}
              />
            </div>
          </div>

          {/* SOC/BLS Classification */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                BLS / SOC Classification
              </h4>
              <Button variant="outline" size="sm" onClick={() => setShowSOCLookup(!showSOCLookup)}>
                <Search className="w-3 h-3 mr-1" />
                Lookup
              </Button>
            </div>

            {showSOCLookup && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <Input
                  placeholder="Search by code or title..."
                  value={socSearch}
                  onChange={(e) => setSOCSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredSOC.slice(0, 10).map((soc) => (
                    <button
                      key={soc.code}
                      onClick={() => handleSOCSelect(soc)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded hover:bg-gray-100"
                    >
                      <div>
                        <span className="font-mono text-gray-500">{soc.code}</span>
                        <span className="mx-2">—</span>
                        <span className="text-gray-900">{soc.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="soc-code">SOC Code</Label>
                <Input
                  id="soc-code"
                  value={role.blsOccCode || ''}
                  onChange={(e) => handleChange('blsOccCode', e.target.value)}
                  placeholder="15-1252"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soc-title">BLS Occupation Title</Label>
                <Input
                  id="soc-title"
                  value={role.blsOccTitle || ''}
                  onChange={(e) => handleChange('blsOccTitle', e.target.value)}
                  placeholder="Software Developers"
                />
              </div>
            </div>
          </div>

          {/* Education Requirements */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Education Requirements
            </h4>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="edu-min">Minimum Education</Label>
                <Input
                  id="edu-min"
                  value={(role as any).education?.minimum || ''}
                  onChange={(e) => handleChange('education', { 
                    ...((role as any).education || {}), 
                    minimum: e.target.value 
                  })}
                  placeholder="Bachelor's degree in Computer Science or related field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edu-sub">Experience Substitution</Label>
                <Input
                  id="edu-sub"
                  value={(role as any).education?.substitution || ''}
                  onChange={(e) => handleChange('education', { 
                    ...((role as any).education || {}), 
                    substitution: e.target.value 
                  })}
                  placeholder="4 years additional experience may substitute for degree"
                />
              </div>
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4" />
                Certifications
              </h4>
              <Button variant="outline" size="sm" onClick={() => setShowCertPicker(!showCertPicker)}>
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>

            {showCertPicker && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <Input
                  placeholder="Search or type custom certification..."
                  value={certSearch}
                  onChange={(e) => setCertSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && certSearch.trim()) {
                      handleAddCertification(certSearch.trim())
                    }
                  }}
                  className="mb-2"
                />
                <div className="max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-1">
                    {filteredCerts.slice(0, 15).map((cert) => (
                      <button
                        key={cert}
                        onClick={() => handleAddCertification(cert)}
                        className="px-2 py-1 text-xs rounded bg-white border border-gray-200 hover:bg-gray-100"
                      >
                        {cert}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {((role as any).certifications || []).map((cert: string, i: number) => (
                <Badge key={i} variant="secondary" className="pr-1 flex items-center gap-1">
                  {cert}
                  <button onClick={() => handleRemoveCertification(cert)} className="ml-1 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {((role as any).certifications || []).length === 0 && (
                <p className="text-xs text-gray-500">No certifications added</p>
              )}
            </div>
          </div>

          {/* Salary Levels */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Salary by Level
                </h4>
                <p className="text-xs text-gray-500">
                  Structure: {salaryStructure === 'steps' ? 'Step increases' : salaryStructure === 'bands' ? 'Salary bands' : 'Single salary'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newLevel = {
                    level: `IC${role.levels.length + 1}`,
                    levelName: 'New Level',
                    yearsExperience: '0-2',
                    monthsBeforePromotionReady: 24,
                    isTerminal: false,
                    steps: [{ step: 1, salary: 80000, monthsToNextStep: null }],
                  }
                  handleChange('levels', [...role.levels, newLevel])
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Level
              </Button>
            </div>

            <div className="space-y-3">
              {role.levels.map((level, levelIndex) => (
                <div key={levelIndex} className="p-3 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Input
                        value={level.level}
                        onChange={(e) => {
                          const newLevels = [...role.levels]
                          newLevels[levelIndex] = { ...level, level: e.target.value }
                          handleChange('levels', newLevels)
                        }}
                        className="w-16 h-7 text-xs font-mono"
                        placeholder="IC3"
                      />
                      <Input
                        value={level.levelName}
                        onChange={(e) => {
                          const newLevels = [...role.levels]
                          newLevels[levelIndex] = { ...level, levelName: e.target.value }
                          handleChange('levels', newLevels)
                        }}
                        className="w-28 h-7 text-xs"
                        placeholder="Senior"
                      />
                      <Input
                        value={level.yearsExperience}
                        onChange={(e) => {
                          const newLevels = [...role.levels]
                          newLevels[levelIndex] = { ...level, yearsExperience: e.target.value }
                          handleChange('levels', newLevels)
                        }}
                        className="w-20 h-7 text-xs"
                        placeholder="4-7"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newLevels = role.levels.filter((_, i) => i !== levelIndex)
                        handleChange('levels', newLevels)
                      }}
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Salary inputs based on structure */}
                  {salaryStructure === 'steps' && (
                    <div className="flex flex-wrap gap-2">
                      {level.steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Step {step.step}:</span>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                            <Input
                              type="number"
                              value={step.salary}
                              onChange={(e) => {
                                const newLevels = [...role.levels]
                                newLevels[levelIndex].steps[stepIndex] = {
                                  ...step,
                                  salary: parseInt(e.target.value) || 0,
                                }
                                handleChange('levels', newLevels)
                              }}
                              className="w-28 h-7 text-xs font-mono pl-5"
                            />
                          </div>
                          {level.steps.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newLevels = [...role.levels]
                                newLevels[levelIndex].steps = level.steps.filter((_, i) => i !== stepIndex)
                                handleChange('levels', newLevels)
                              }}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newLevels = [...role.levels]
                          const lastStep = level.steps[level.steps.length - 1]
                          newLevels[levelIndex].steps.push({
                            step: lastStep.step + 1,
                            salary: Math.round(lastStep.salary * (1 + (companySettings?.stepIncreasePercent ?? 3) / 100)),
                            monthsToNextStep: null,
                          })
                          handleChange('levels', newLevels)
                        }}
                        className="h-7 text-xs text-blue-600"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Step
                      </Button>
                    </div>
                  )}

                  {salaryStructure === 'single' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Salary</Label>
                      <div className="relative w-40">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <Input
                          type="number"
                          value={level.steps[0]?.salary || 0}
                          onChange={(e) => {
                            const newLevels = [...role.levels]
                            newLevels[levelIndex].steps = [{
                              step: 1,
                              salary: parseInt(e.target.value) || 0,
                              monthsToNextStep: null,
                            }]
                            handleChange('levels', newLevels)
                          }}
                          className="h-8 text-sm font-mono pl-5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </>
  )
}

export default LaborPage