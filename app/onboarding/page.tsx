'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Briefcase, 
  Calculator, 
  Users, 
  LineChart,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2
} from 'lucide-react'

// Step indicator component
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < currentStep 
              ? 'w-8 bg-black' 
              : i === currentStep 
                ? 'w-8 bg-black' 
                : 'w-8 bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

// Role option component
function RoleOption({ 
  icon: Icon, 
  title, 
  description, 
  selected, 
  onClick 
}: { 
  icon: React.ElementType
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
        selected 
          ? 'border-black bg-gray-50' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${selected ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">{title}</span>
            {selected && <Check className="w-5 h-5 text-black" />}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  )
}

// Company size option
function SizeOption({ 
  label, 
  selected, 
  onClick 
}: { 
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
        selected 
          ? 'border-black bg-black text-white' 
          : 'border-gray-200 text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  
  // Form state
  const [role, setRole] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState<string | null>(null)
  const [contractFocus, setContractFocus] = useState<string | null>(null)

  const totalSteps = 2

  const roles = [
    { id: 'bd', icon: Briefcase, title: 'Business Development', description: 'I find opportunities and lead captures' },
    { id: 'estimator', icon: Calculator, title: 'Estimator / Pricing', description: 'I build BOEs and price proposals' },
    { id: 'pm', icon: Users, title: 'Project Manager', description: 'I deliver contracts and manage teams' },
    { id: 'executive', icon: LineChart, title: 'Executive', description: 'I oversee strategy and make decisions' },
  ]

  const companySizes = ['1-10', '11-50', '51-200', '200+']
  
  const contractTypes = [
    { id: 'tm', label: 'T&M' },
    { id: 'ffp', label: 'FFP' },
    { id: 'cost-plus', label: 'Cost-Plus' },
    { id: 'mixed', label: 'Mixed' },
  ]

  const canProceed = () => {
    if (step === 0) return !!role
    if (step === 1) return !!companyName && !!companySize
    return true
  }

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleComplete = async () => {
    setIsLoading(true)
    
    // Save company profile to localStorage
    if (companyName) {
      const profile = {
        name: companyName,
        size: companySize || '',
        userRole: role || '',
      }
      localStorage.setItem('truebid-company-profile', JSON.stringify(profile))
    }
    
    // Mark onboarding as complete
    localStorage.setItem('truebid-onboarding-complete', 'true')
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Always go to dashboard
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
        </Link>
        <StepIndicator currentStep={step} totalSteps={totalSteps} />
        <div className="w-8" /> {/* Spacer for alignment */}
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          
          {/* Step 1: Role */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-semibold text-gray-900">What&apos;s your role?</h1>
                <p className="text-gray-500 mt-2">This helps us personalize your experience</p>
              </div>

              <div className="space-y-3">
                {roles.map((r) => (
                  <RoleOption
                    key={r.id}
                    icon={r.icon}
                    title={r.title}
                    description={r.description}
                    selected={role === r.id}
                    onClick={() => setRole(r.id)}
                  />
                ))}
              </div>

              <Button 
                onClick={handleNext}
                disabled={!canProceed()}
                className="w-full h-12 text-base bg-black hover:bg-gray-800"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Company */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-semibold text-gray-900">Tell us about your company</h1>
                <p className="text-gray-500 mt-2">We&apos;ll set up your workspace</p>
              </div>

              <div className="space-y-5">
                {/* Company name */}
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-sm font-medium">
                    Company name
                  </Label>
                  <Input
                    id="companyName"
                    placeholder="Acme Consulting"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-12"
                    autoFocus
                  />
                </div>

                {/* Company size */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Company size</Label>
                  <div className="flex flex-wrap gap-2">
                    {companySizes.map((size) => (
                      <SizeOption
                        key={size}
                        label={size}
                        selected={companySize === size}
                        onClick={() => setCompanySize(size)}
                      />
                    ))}
                  </div>
                </div>

                {/* Contract focus */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Primary contract type (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {contractTypes.map((type) => (
                      <SizeOption
                        key={type.id}
                        label={type.label}
                        selected={contractFocus === type.id}
                        onClick={() => setContractFocus(type.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  onClick={handleBack}
                  className="h-12"
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleComplete}
                  disabled={!canProceed() || isLoading}
                  className="flex-1 h-12 text-base bg-black hover:bg-gray-800"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-xs text-gray-400">
          You can always change these settings later
        </p>
      </footer>
    </div>
  )
}