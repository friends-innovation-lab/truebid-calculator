'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext, CompanyRole, IndirectRates } from '@/contexts/app-context';
import {
  Building2,
  DollarSign,
  Users,
  UserPlus,
  X,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  GraduationCap,
  Briefcase,
  Award,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';

// ==================== TYPES ====================

type SettingsTab = 'company' | 'rates' | 'labor' | 'team';

// Salary structure types
type SalaryStructure = 'steps' | 'bands' | 'single';

// GSA SIN types
interface GSALaborCategory {
  id: string;
  laborCategory: string;
  hourlyRate: number;
  yearsExperience?: string;
  education?: string;
}

interface GSASin {
  id: string;
  sin: string;
  title: string;
  laborCategories: GSALaborCategory[];
}

interface SettingsSlideoutProps {
  isOpen: boolean;
  onClose: () => void;
}

// Extended CompanyRole with education and certifications
interface ExtendedCompanyRole extends CompanyRole {
  education?: {
    minimum: string;
    preferred?: string;
    substitution?: string;
  };
  certifications?: string[];
  functionalResponsibilities?: string;
}

// ==================== SOC CODE LOOKUP DATA ====================
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
];

// Common certifications
const COMMON_CERTIFICATIONS = [
  'PMP', 'CISSP', 'CISM', 'Security+', 'AWS Solutions Architect', 'AWS Developer',
  'Azure Administrator', 'Azure Solutions Architect', 'GCP Professional Cloud Architect',
  'Certified Scrum Master (CSM)', 'Certified Scrum Product Owner (CSPO)',
  'SAFe Agilist', 'ITIL', 'Six Sigma Green Belt', 'Six Sigma Black Belt',
  'Certified Information Systems Auditor (CISA)', 'CompTIA A+', 'CompTIA Network+',
  'Cisco CCNA', 'Cisco CCNP', 'Kubernetes Administrator (CKA)',
];

// ==================== SETTINGS SLIDEOUT ====================

export function SettingsSlideout({ isOpen, onClose }: SettingsSlideoutProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');

  // Reset to first tab when slideout opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on prop change
      setActiveTab('company');
    }
  }, [isOpen, setActiveTab]);

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: typeof Building2 }[] = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'rates', label: 'Rates & Margins', icon: DollarSign },
    { id: 'labor', label: 'Labor Categories', icon: Users },
    { id: 'team', label: 'Company Team', icon: UserPlus },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Slideout Panel */}
      <div className="fixed inset-y-0 right-0 w-[800px] max-w-full bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage your company configuration</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-800 px-6">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'company' && <CompanyProfileTab />}
          {activeTab === 'rates' && <RatesAndMarginsTab />}
          {activeTab === 'labor' && <LaborCategoriesTab />}
          {activeTab === 'team' && <TeamAccessTab />}
        </div>

        {/* Footer with save status */}
        <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Changes save automatically</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </>
  );
}

// ==================== COMPANY PROFILE TAB ====================

function CompanyProfileTab() {
  const { companyProfile, setCompanyProfile } = useAppContext();

  const handleChange = (field: string, value: string | boolean | string[]) => {
    setCompanyProfile({ ...companyProfile, [field]: value });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Company Profile</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Basic company information for proposals and compliance</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={companyProfile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Your Company Name"
              className="dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-name">Legal Name</Label>
            <Input
              id="legal-name"
              value={companyProfile.legalName}
              onChange={(e) => handleChange('legalName', e.target.value)}
              placeholder="Legal Entity Name, LLC"
              className="dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sam-uei">SAM UEI</Label>
            <Input
              id="sam-uei"
              value={companyProfile.samUei}
              onChange={(e) => handleChange('samUei', e.target.value)}
              placeholder="RA62AG44CFZ8"
              className="dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cage-code">CAGE Code</Label>
            <Input
              id="cage-code"
              value={companyProfile.cageCode}
              onChange={(e) => handleChange('cageCode', e.target.value)}
              placeholder="1ABC2"
              className="dark:bg-gray-800 dark:border-gray-700"
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
              <span className="text-sm text-gray-700 dark:text-gray-300">Small Business</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="business-size"
                checked={companyProfile.businessSize === 'other-than-small'}
                onChange={() => handleChange('businessSize', 'other-than-small')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Other Than Small</span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="naics-codes">NAICS Codes</Label>
          <Input
            id="naics-codes"
            value={companyProfile.naicsCodes.join(', ')}
            onChange={(e) => handleChange('naicsCodes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="541511, 541512, 541519"
            className="dark:bg-gray-800 dark:border-gray-700"
          />
          <p className="text-xs text-gray-500">Comma-separated list</p>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">GSA Schedule</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="gsa-contract">GSA Contract Number</Label>
              <Input
                id="gsa-contract"
                value={companyProfile.gsaContractNumber || ''}
                onChange={(e) => handleChange('gsaContractNumber', e.target.value)}
                placeholder="47QTCA23D0076"
                className="dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div className="space-y-2 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={companyProfile.gsaMasSchedule || false}
                  onChange={(e) => handleChange('gsaMasSchedule', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active GSA MAS Schedule</span>
              </label>
            </div>
          </div>

          {/* GSA Escalation - only show when GSA is active */}
          {companyProfile.gsaMasSchedule && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gsa-escalation">Annual Escalation Rate</Label>
                  <div className="relative">
                    <Input
                      id="gsa-escalation"
                      type="number"
                      step="0.1"
                      value={((companyProfile.gsaEscalationRate || 0.03) * 100).toFixed(1)}
                      onChange={(e) => handleChange('gsaEscalationRate', parseFloat(e.target.value) / 100 as any)}
                      className="pr-8 dark:bg-gray-900 dark:border-gray-700"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500">From your GSA contract (EPA clause)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gsa-base-year">Base Year (rates effective)</Label>
                  <Input
                    id="gsa-base-year"
                    type="number"
                    value={companyProfile.gsaBaseYear || new Date().getFullYear()}
                    onChange={(e) => handleChange('gsaBaseYear', parseInt(e.target.value) as any)}
                    placeholder="2024"
                    className="dark:bg-gray-900 dark:border-gray-700"
                  />
                  <p className="text-xs text-gray-500">Year your current rates are based on</p>
                </div>
              </div>
            </div>
          )}

          {/* GSA SINs and Rates */}
          {companyProfile.gsaMasSchedule && (
            <GSAScheduleRates />
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== GSA SCHEDULE RATES ====================

function GSAScheduleRates() {
  const { companyProfile, setCompanyProfile } = useAppContext();
  const [expandedSin, setExpandedSin] = useState<string | null>(null);
  
  // GSA SINs data stored in companyProfile.gsaSins
  const gsaSins = companyProfile.gsaSins || [];

  const handleAddSin = () => {
    const newSin = {
      id: `sin-${Date.now()}`,
      sin: '',
      title: '',
      laborCategories: [],
    };
    setCompanyProfile({
      ...companyProfile,
      gsaSins: [...gsaSins, newSin],
    });
    setExpandedSin(newSin.id);
  };

  const handleUpdateSin = (sinId: string, updates: Partial<GSASin>) => {
    setCompanyProfile({
      ...companyProfile,
      gsaSins: gsaSins.map(s => s.id === sinId ? { ...s, ...updates } : s),
    });
  };

  const handleRemoveSin = (sinId: string) => {
    setCompanyProfile({
      ...companyProfile,
      gsaSins: gsaSins.filter(s => s.id !== sinId),
    });
  };

  const handleAddLaborCategory = (sinId: string) => {
    const sin = gsaSins.find(s => s.id === sinId);
    if (!sin) return;
    
    const newCategory = {
      id: `lc-${Date.now()}`,
      laborCategory: '',
      hourlyRate: 0,
      yearsExperience: '',
      education: '',
    };
    
    handleUpdateSin(sinId, {
      laborCategories: [...sin.laborCategories, newCategory],
    });
  };

  const handleUpdateLaborCategory = (sinId: string, lcId: string, updates: Partial<GSALaborCategory>) => {
    const sin = gsaSins.find(s => s.id === sinId);
    if (!sin) return;
    
    handleUpdateSin(sinId, {
      laborCategories: sin.laborCategories.map(lc => 
        lc.id === lcId ? { ...lc, ...updates } : lc
      ),
    });
  };

  const handleRemoveLaborCategory = (sinId: string, lcId: string) => {
    const sin = gsaSins.find(s => s.id === sinId);
    if (!sin) return;
    
    handleUpdateSin(sinId, {
      laborCategories: sin.laborCategories.filter(lc => lc.id !== lcId),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">SINs & Labor Category Rates</Label>
        <Button variant="outline" size="sm" onClick={handleAddSin}>
          <Plus className="w-3 h-3 mr-1" />
          Add SIN
        </Button>
      </div>

      {gsaSins.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No SINs configured</p>
          <Button variant="outline" size="sm" onClick={handleAddSin}>
            <Plus className="w-3 h-3 mr-1" />
            Add Your First SIN
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {gsaSins.map((sin) => (
            <div key={sin.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* SIN Header */}
              <div
                className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
                onClick={() => setExpandedSin(expandedSin === sin.id ? null : sin.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={sin.sin}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateSin(sin.id, { sin: e.target.value });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="541611"
                      className="w-24 h-7 text-xs font-mono dark:bg-gray-900 dark:border-gray-700"
                    />
                    <Input
                      value={sin.title}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateSin(sin.id, { title: e.target.value });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="IT Professional Services"
                      className="w-48 h-7 text-xs dark:bg-gray-900 dark:border-gray-700"
                    />
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {sin.laborCategories.length} rate{sin.laborCategories.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleRemoveSin(sin.id); }}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
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
                <div className="px-3 py-3 space-y-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                  {/* Column headers */}
                  {sin.laborCategories.length > 0 && (
                    <div className="grid grid-cols-12 gap-2 px-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="col-span-4">Labor Category</span>
                      <span className="col-span-2">Hourly Rate</span>
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
                        className="col-span-4 h-7 text-xs dark:bg-gray-800 dark:border-gray-700"
                      />
                      <div className="col-span-2 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <Input
                          type="number"
                          value={lc.hourlyRate || ''}
                          onChange={(e) => handleUpdateLaborCategory(sin.id, lc.id, { hourlyRate: parseFloat(e.target.value) || 0 })}
                          placeholder="185"
                          className="h-7 text-xs font-mono pl-5 dark:bg-gray-800 dark:border-gray-700"
                        />
                      </div>
                      <Input
                        value={lc.yearsExperience || ''}
                        onChange={(e) => handleUpdateLaborCategory(sin.id, lc.id, { yearsExperience: e.target.value })}
                        placeholder="5+"
                        className="col-span-2 h-7 text-xs dark:bg-gray-800 dark:border-gray-700"
                      />
                      <Input
                        value={lc.education || ''}
                        onChange={(e) => handleUpdateLaborCategory(sin.id, lc.id, { education: e.target.value })}
                        placeholder="BS"
                        className="col-span-3 h-7 text-xs dark:bg-gray-800 dark:border-gray-700"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLaborCategory(sin.id, lc.id)}
                        className="col-span-1 h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddLaborCategory(sin.id)}
                    className="h-7 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Labor Category
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        These ceiling rates will be used when generating GSA pricing
      </p>
    </div>
  );
}

// ==================== RATES & MARGINS TAB ====================

function RatesAndMarginsTab() {
  const {
    indirectRates,
    setIndirectRates,
    profitTargets,
    setProfitTargets,
    escalationRates,
    setEscalationRates,
    companyPolicy,
    setCompanyPolicy,
  } = useAppContext();

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Indirect Rates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Indirect Rates</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">From your accountant or forward pricing rate proposal</p>
          </div>
          <Badge variant="outline" className="text-xs">
            FY{indirectRates.fiscalYear}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="fringe">Fringe Rate</Label>
            <div className="relative">
              <Input
                id="fringe"
                type="number"
                step="0.01"
                value={(indirectRates.fringe * 100).toFixed(2)}
                onChange={(e) => setIndirectRates({ ...indirectRates, fringe: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="overhead">Overhead Rate</Label>
            <div className="relative">
              <Input
                id="overhead"
                type="number"
                step="0.01"
                value={(indirectRates.overhead * 100).toFixed(2)}
                onChange={(e) => setIndirectRates({ ...indirectRates, overhead: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ga">G&A Rate</Label>
            <div className="relative">
              <Input
                id="ga"
                type="number"
                step="0.01"
                value={(indirectRates.ga * 100).toFixed(2)}
                onChange={(e) => setIndirectRates({ ...indirectRates, ga: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rate-source">Source</Label>
            <Input
              id="rate-source"
              value={indirectRates.source}
              onChange={(e) => setIndirectRates({ ...indirectRates, source: e.target.value })}
              placeholder="Rate Model 2025"
              className="dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate-type">Rate Type</Label>
            <select
              id="rate-type"
              value={indirectRates.rateType}
              onChange={(e) => setIndirectRates({ ...indirectRates, rateType: e.target.value as IndirectRates['rateType'] })}
              className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-white"
            >
              <option value="forward-pricing">Forward Pricing</option>
              <option value="provisional">Provisional</option>
              <option value="billing">Billing</option>
              <option value="final">Final</option>
            </select>
          </div>
        </div>
      </div>

      {/* Profit Targets */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Profit Targets</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Default profit margins by contract type and risk level</p>
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
                onChange={(e) => setProfitTargets({ ...profitTargets, tmDefault: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
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
                onChange={(e) => setProfitTargets({ ...profitTargets, gsaDefault: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
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
                onChange={(e) => setProfitTargets({ ...profitTargets, ffpLowRisk: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
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
                onChange={(e) => setProfitTargets({ ...profitTargets, ffpMediumRisk: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Escalation */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Escalation Rates</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Annual escalation for multi-year contracts</p>
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
                onChange={(e) => setEscalationRates({ ...escalationRates, laborDefault: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
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
                onChange={(e) => setEscalationRates({ ...escalationRates, odcDefault: parseFloat(e.target.value) / 100 })}
                className="pr-8 dark:bg-gray-800 dark:border-gray-700"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Company Defaults */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Company Defaults</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Base rate calculation uses standard hours. Billable hours are set per-bid.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="std-hours">Standard Hours/Year</Label>
            <Input
              id="std-hours"
              type="number"
              value={companyPolicy.standardHours}
              onChange={(e) => setCompanyPolicy({ ...companyPolicy, standardHours: parseInt(e.target.value) })}
              className="dark:bg-gray-800 dark:border-gray-700"
            />
            <p className="text-xs text-gray-500">Used for base rate: salary ÷ 2,080</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-billable">Default Billable Hours</Label>
            <Input
              id="target-billable"
              type="number"
              value={companyPolicy.targetBillableHours || 1920}
              onChange={(e) => setCompanyPolicy({ ...companyPolicy, targetBillableHours: parseInt(e.target.value) })}
              className="dark:bg-gray-800 dark:border-gray-700"
            />
            <p className="text-xs text-gray-500">Default for new bids (can override)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== LABOR CATEGORIES TAB ====================

function LaborCategoriesTab() {
  const {
    companyRoles,
    addCompanyRole,
    removeCompanyRole,
    companySettings,
    updateCompanySettings,
  } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  
  // Company-wide salary structure setting from context
  const salaryStructure = companySettings?.salaryStructure || 'steps';
  const setSalaryStructure = (structure: SalaryStructure) => {
    updateCompanySettings?.({ salaryStructure: structure });
  };

  const filteredRoles = companyRoles.filter(role =>
    role.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.laborCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.blsOccCode?.includes(searchQuery)
  );

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
    };
    addCompanyRole(newRole);
    setEditingRoleId(newRole.id);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Labor Categories</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Define roles with SOC codes, education, and salary data</p>
        </div>
        <Button onClick={handleAddRole} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Role
        </Button>
      </div>

      {/* Salary Structure Selector */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Salary Structure</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">How your company defines compensation levels</p>
          </div>
          <select
            value={salaryStructure}
            onChange={(e) => setSalaryStructure(e.target.value as SalaryStructure)}
            className="h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-white"
          >
            <option value="steps">Steps (annual increases within level)</option>
            <option value="bands">Bands (min/mid/max range)</option>
            <option value="single">Single (one salary per level)</option>
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search roles by title, category, or SOC code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 dark:bg-gray-800 dark:border-gray-700"
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
            onDelete={() => removeCompanyRole(role.id)}
            salaryStructure={salaryStructure}
          />
        ))}

        {filteredRoles.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">No roles found</p>
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
  );
}

// ==================== ROLE CARD ====================

function RoleCard({
  role,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  salaryStructure,
}: {
  role: ExtendedCompanyRole;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  salaryStructure: SalaryStructure;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Role Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">{role.title}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {role.blsOccCode && (
                <span>SOC: {role.blsOccCode}</span>
              )}
              {role.blsOccCode && role.levels.length > 0 && <span>•</span>}
              <span>{role.levels.length} level{role.levels.length !== 1 ? 's' : ''}</span>
              {role.certifications && role.certifications.length > 0 && (
                <>
                  <span>•</span>
                  <span>{role.certifications.length} cert{role.certifications.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Salary range preview */}
          {role.levels.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {role.levels.slice(0, 3).map((level, i) => {
                const minSalary = Math.min(...level.steps.map(s => s.salary));
                const maxSalary = Math.max(...level.steps.map(s => s.salary));
                return (
                  <Badge key={i} variant="secondary" className="text-[10px] bg-gray-100 dark:bg-gray-700">
                    {level.level}: ${Math.round(minSalary / 1000)}k{minSalary !== maxSalary ? `-${Math.round(maxSalary / 1000)}k` : ''}
                  </Badge>
                );
              })}
              {role.levels.length > 3 && (
                <span className="text-gray-400">+{role.levels.length - 3}</span>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
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
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 space-y-4 bg-white dark:bg-gray-900">
          {/* Description */}
          {role.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{role.description}</p>
          )}

          {/* BLS Info */}
          {role.blsOccCode && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                SOC: {role.blsOccCode}
              </Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">{role.blsOccTitle}</span>
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

          {/* Education Requirements */}
          {role.education && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start gap-2">
                <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Education</p>
                  <p className="text-blue-800 dark:text-blue-200">{role.education.minimum}</p>
                  {role.education.substitution && (
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      Substitution: {role.education.substitution}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Certifications */}
          {role.certifications && role.certifications.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Award className="w-3 h-3" />
                Certifications
              </h5>
              <div className="flex flex-wrap gap-1">
                {role.certifications.map((cert, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Salary Table */}
          <div>
            <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Salary Bands</h5>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Level</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Experience</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                      {salaryStructure === 'steps' ? 'Salary Steps' : salaryStructure === 'bands' ? 'Range' : 'Salary'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {role.levels.map((level, i) => {
                    const minSalary = Math.min(...level.steps.map(s => s.salary));
                    const maxSalary = Math.max(...level.steps.map(s => s.salary));
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <td className="px-3 py-2">
                          <span className="font-medium text-gray-900 dark:text-white">{level.level}</span>
                          <span className="text-gray-500 ml-1">({level.levelName})</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{level.yearsExperience} years</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== EDIT ROLE DIALOG ====================

function EditRoleDialog({ 
  roleId, 
  onClose, 
  salaryStructure 
}: { 
  roleId: string; 
  onClose: () => void; 
  salaryStructure: SalaryStructure;
}) {
  const { companyRoles, updateCompanyRole } = useAppContext();
  const role = companyRoles.find(r => r.id === roleId) as ExtendedCompanyRole | undefined;
  
  const [showSOCLookup, setShowSOCLookup] = useState(false);
  const [socSearch, setSOCSearch] = useState('');
  const [showCertPicker, setShowCertPicker] = useState(false);
  const [certSearch, setCertSearch] = useState('');

  if (!role) return null;

  const handleChange = (field: string, value: any) => {
    updateCompanyRole(roleId, { [field]: value });
  };

  const handleSOCSelect = (soc: typeof SOC_CODES[0]) => {
    updateCompanyRole(roleId, { blsOccCode: soc.code, blsOccTitle: soc.title });
    setShowSOCLookup(false);
    setSOCSearch('');
  };

  const handleAddCertification = (cert: string) => {
    const currentCerts = (role as any).certifications || [];
    if (!currentCerts.includes(cert)) {
      updateCompanyRole(roleId, { certifications: [...currentCerts, cert] });
    }
    setCertSearch('');
    setShowCertPicker(false);
  };

  const handleRemoveCertification = (cert: string) => {
    const currentCerts = (role as any).certifications || [];
    updateCompanyRole(roleId, { certifications: currentCerts.filter((c: string) => c !== cert) });
  };

  const filteredSOC = SOC_CODES.filter(soc =>
    soc.code.includes(socSearch) ||
    soc.title.toLowerCase().includes(socSearch.toLowerCase())
  );

  const filteredCerts = COMMON_CERTIFICATIONS.filter(cert =>
    cert.toLowerCase().includes(certSearch.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[600px] max-w-full bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Labor Category</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{role.title}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
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
                  className="dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="labor-cat">Labor Category</Label>
                <Input
                  id="labor-cat"
                  value={role.laborCategory}
                  onChange={(e) => handleChange('laborCategory', e.target.value)}
                  placeholder="Software Developer III"
                  className="dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                value={role.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the role's responsibilities and typical duties..."
                rows={2}
                className="dark:bg-gray-800 dark:border-gray-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="func-resp">Functional Responsibilities (for proposals)</Label>
              <Textarea
                id="func-resp"
                value={(role as any).functionalResponsibilities || ''}
                onChange={(e) => handleChange('functionalResponsibilities', e.target.value)}
                placeholder="Detailed responsibilities that appear in Labor Category Descriptions export..."
                rows={3}
                className="dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>

          {/* SOC/BLS Classification */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                BLS / SOC Classification
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSOCLookup(!showSOCLookup)}
              >
                <Search className="w-3 h-3 mr-1" />
                Lookup
              </Button>
            </div>

            {showSOCLookup && (
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Input
                  placeholder="Search by code or title..."
                  value={socSearch}
                  onChange={(e) => setSOCSearch(e.target.value)}
                  className="mb-2 dark:bg-gray-900 dark:border-gray-700"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredSOC.slice(0, 10).map((soc) => (
                    <button
                      key={soc.code}
                      onClick={() => handleSOCSelect(soc)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <div>
                        <span className="font-mono text-gray-500">{soc.code}</span>
                        <span className="mx-2">—</span>
                        <span className="text-gray-900 dark:text-white">{soc.title}</span>
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
                  className="dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soc-title">BLS Occupation Title</Label>
                <Input
                  id="soc-title"
                  value={role.blsOccTitle || ''}
                  onChange={(e) => handleChange('blsOccTitle', e.target.value)}
                  placeholder="Software Developers"
                  className="dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>
          </div>

          {/* Education Requirements */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
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
                  className="dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edu-pref">Preferred Education</Label>
                <Input
                  id="edu-pref"
                  value={(role as any).education?.preferred || ''}
                  onChange={(e) => handleChange('education', { 
                    ...((role as any).education || {}), 
                    preferred: e.target.value 
                  })}
                  placeholder="Master's degree preferred"
                  className="dark:bg-gray-800 dark:border-gray-700"
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
                  className="dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4" />
                Certifications
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCertPicker(!showCertPicker)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>

            {showCertPicker && (
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Input
                  placeholder="Search or type custom certification..."
                  value={certSearch}
                  onChange={(e) => setCertSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && certSearch.trim()) {
                      handleAddCertification(certSearch.trim());
                    }
                  }}
                  className="mb-2 dark:bg-gray-900 dark:border-gray-700"
                />
                <div className="max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-1">
                    {filteredCerts.slice(0, 15).map((cert) => (
                      <button
                        key={cert}
                        onClick={() => handleAddCertification(cert)}
                        className="px-2 py-1 text-xs rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {cert}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Current Certifications */}
            <div className="flex flex-wrap gap-2">
              {((role as any).certifications || []).map((cert: string, i: number) => (
                <Badge key={i} variant="secondary" className="pr-1 flex items-center gap-1">
                  {cert}
                  <button
                    onClick={() => handleRemoveCertification(cert)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {((role as any).certifications || []).length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">No certifications added</p>
              )}
            </div>
          </div>

          {/* Salary Levels */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Salary by Level
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
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
                  };
                  handleChange('levels', [...role.levels, newLevel]);
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Level
              </Button>
            </div>

            <div className="space-y-3">
              {/* Column labels - show once above the levels */}
              {role.levels.length > 0 && (
                <div className="flex items-center gap-2 px-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="w-16">Level</span>
                  <span className="w-28">Name</span>
                  <span className="w-20">Years Exp</span>
                </div>
              )}
              
              {role.levels.map((level, levelIndex) => (
                <div key={levelIndex} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={level.level}
                        onChange={(e) => {
                          const newLevels = [...role.levels];
                          newLevels[levelIndex] = { ...level, level: e.target.value };
                          handleChange('levels', newLevels);
                        }}
                        className="w-16 h-7 text-xs font-mono dark:bg-gray-900 dark:border-gray-700"
                        placeholder="IC3"
                      />
                      <Input
                        value={level.levelName}
                        onChange={(e) => {
                          const newLevels = [...role.levels];
                          newLevels[levelIndex] = { ...level, levelName: e.target.value };
                          handleChange('levels', newLevels);
                        }}
                        className="w-28 h-7 text-xs dark:bg-gray-900 dark:border-gray-700"
                        placeholder="Senior"
                      />
                      <Input
                        value={level.yearsExperience}
                        onChange={(e) => {
                          const newLevels = [...role.levels];
                          newLevels[levelIndex] = { ...level, yearsExperience: e.target.value };
                          handleChange('levels', newLevels);
                        }}
                        className="w-20 h-7 text-xs dark:bg-gray-900 dark:border-gray-700"
                        placeholder="4-7"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newLevels = role.levels.filter((_, i) => i !== levelIndex);
                        handleChange('levels', newLevels);
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
                                const newLevels = [...role.levels];
                                newLevels[levelIndex].steps[stepIndex] = {
                                  ...step,
                                  salary: parseInt(e.target.value) || 0,
                                };
                                handleChange('levels', newLevels);
                              }}
                              className="w-28 h-7 text-xs font-mono pl-5 dark:bg-gray-900 dark:border-gray-700"
                            />
                          </div>
                          {level.steps.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newLevels = [...role.levels];
                                newLevels[levelIndex].steps = level.steps.filter((_, i) => i !== stepIndex);
                                handleChange('levels', newLevels);
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
                          const newLevels = [...role.levels];
                          const lastStep = level.steps[level.steps.length - 1];
                          newLevels[levelIndex].steps.push({
                            step: lastStep.step + 1,
                            salary: Math.round(lastStep.salary * 1.03),
                            monthsToNextStep: null,
                          });
                          handleChange('levels', newLevels);
                        }}
                        className="h-7 text-xs text-blue-600"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Step
                      </Button>
                    </div>
                  )}

                  {salaryStructure === 'bands' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Min</Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <Input
                            type="number"
                            value={level.steps[0]?.salary || 0}
                            onChange={(e) => {
                              const newLevels = [...role.levels];
                              if (newLevels[levelIndex].steps.length < 3) {
                                newLevels[levelIndex].steps = [
                                  { step: 1, salary: parseInt(e.target.value) || 0, monthsToNextStep: null },
                                  { step: 2, salary: level.steps[1]?.salary || 0, monthsToNextStep: null },
                                  { step: 3, salary: level.steps[2]?.salary || 0, monthsToNextStep: null },
                                ];
                              } else {
                                newLevels[levelIndex].steps[0].salary = parseInt(e.target.value) || 0;
                              }
                              handleChange('levels', newLevels);
                            }}
                            className="h-7 text-xs font-mono pl-5 dark:bg-gray-900 dark:border-gray-700"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Mid</Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <Input
                            type="number"
                            value={level.steps[1]?.salary || Math.round((level.steps[0]?.salary || 0) * 1.1)}
                            onChange={(e) => {
                              const newLevels = [...role.levels];
                              if (newLevels[levelIndex].steps.length < 3) {
                                newLevels[levelIndex].steps = [
                                  { step: 1, salary: level.steps[0]?.salary || 0, monthsToNextStep: null },
                                  { step: 2, salary: parseInt(e.target.value) || 0, monthsToNextStep: null },
                                  { step: 3, salary: level.steps[2]?.salary || 0, monthsToNextStep: null },
                                ];
                              } else {
                                newLevels[levelIndex].steps[1].salary = parseInt(e.target.value) || 0;
                              }
                              handleChange('levels', newLevels);
                            }}
                            className="h-7 text-xs font-mono pl-5 dark:bg-gray-900 dark:border-gray-700"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max</Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <Input
                            type="number"
                            value={level.steps[2]?.salary || Math.round((level.steps[0]?.salary || 0) * 1.2)}
                            onChange={(e) => {
                              const newLevels = [...role.levels];
                              if (newLevels[levelIndex].steps.length < 3) {
                                newLevels[levelIndex].steps = [
                                  { step: 1, salary: level.steps[0]?.salary || 0, monthsToNextStep: null },
                                  { step: 2, salary: level.steps[1]?.salary || 0, monthsToNextStep: null },
                                  { step: 3, salary: parseInt(e.target.value) || 0, monthsToNextStep: null },
                                ];
                              } else {
                                newLevels[levelIndex].steps[2].salary = parseInt(e.target.value) || 0;
                              }
                              handleChange('levels', newLevels);
                            }}
                            className="h-7 text-xs font-mono pl-5 dark:bg-gray-900 dark:border-gray-700"
                          />
                        </div>
                      </div>
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
                            const newLevels = [...role.levels];
                            newLevels[levelIndex].steps = [{
                              step: 1,
                              salary: parseInt(e.target.value) || 0,
                              monthsToNextStep: null,
                            }];
                            handleChange('levels', newLevels);
                          }}
                          className="h-8 text-sm font-mono pl-5 dark:bg-gray-900 dark:border-gray-700"
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
        <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Changes save automatically</span>
          </div>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </>
  );
}

// ==================== COMPANY TEAM TAB ====================

function TeamAccessTab() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Company Team</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">People with ongoing access to TrueBid across all bids</p>
      </div>

      {/* Coming Soon */}
      <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
        <UserPlus className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Company Team Management Coming Soon</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
          Invite team members who need ongoing access to TrueBid. Assign company-wide roles like Admin, Finance, or Director.
        </p>
        <Button variant="outline" disabled>
          <Plus className="w-4 h-4 mr-2" />
          Invite Team Member
        </Button>
      </div>

      {/* Two-level explanation */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Two levels of access</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Company Team</strong> (here) — People with ongoing TrueBid access across all bids.
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              <strong>Bid Team</strong> (per-bid) — People assigned to work on a specific bid. Set from the Solicitation Bar.
            </p>
          </div>
        </div>
      </div>

      {/* Company-level roles */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Company Roles</h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 shrink-0">Admin</Badge>
            <span className="text-gray-600 dark:text-gray-400">Full access to all bids, settings, and team management</span>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">Finance</Badge>
            <span className="text-gray-600 dark:text-gray-400">Can update indirect rates and view pricing across all bids</span>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shrink-0">Director</Badge>
            <span className="text-gray-600 dark:text-gray-400">View-only access to all bids for oversight</span>
          </div>
        </div>
      </div>

      {/* Bid-level roles preview */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Bid Roles (assigned per-bid)</h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 shrink-0">Bid Manager</Badge>
            <span className="text-gray-600 dark:text-gray-400">Owns the bid, full access to all tabs</span>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 shrink-0">Estimator</Badge>
            <span className="text-gray-600 dark:text-gray-400">Can edit Upload and Estimate tabs only</span>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 shrink-0">Pricing Analyst</Badge>
            <span className="text-gray-600 dark:text-gray-400">Can edit Roles & Pricing, sees salary data</span>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 shrink-0">Reviewer</Badge>
            <span className="text-gray-600 dark:text-gray-400">View-only with ability to add comments</span>
          </div>
          <div className="flex items-start gap-3">
            <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 shrink-0">SME</Badge>
            <span className="text-gray-600 dark:text-gray-400">Invited for specific technical input</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsSlideout;