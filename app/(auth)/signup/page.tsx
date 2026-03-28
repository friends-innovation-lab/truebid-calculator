'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
import { ErrorAlert } from '@/components/ui/error-alert'
import { createClient } from '@/lib/supabase/client'

// OAuth provider icons
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" fill="currentColor">
      <path d="M11 11H0V0h11v11z" fill="#F25022"/>
      <path d="M23 11H12V0h11v11z" fill="#7FBA00"/>
      <path d="M11 23H0V12h11v11z" fill="#00A4EF"/>
      <path d="M23 23H12V12h11v11z" fill="#FFB900"/>
    </svg>
  )
}

// Password requirements
const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: '8+ characters', validator: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'Uppercase', validator: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'Lowercase', validator: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'Number', validator: (p: string) => /[0-9]/.test(p) },
]

function PasswordStrength({ password }: { password: string }) {
  const strength = useMemo(() => {
    const passed = PASSWORD_REQUIREMENTS.filter(req => req.validator(password))
    return {
      score: passed.length,
      percentage: (passed.length / PASSWORD_REQUIREMENTS.length) * 100,
    }
  }, [password])

  if (!password) return null

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            strength.score <= 1 ? 'bg-red-500' :
            strength.score === 2 ? 'bg-yellow-500' :
            strength.score === 3 ? 'bg-blue-500' :
            'bg-green-500'
          }`}
          style={{ width: `${strength.percentage}%` }}
        />
      </div>

      {/* Requirements inline */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {PASSWORD_REQUIREMENTS.map((req) => {
          const passed = req.validator(password)
          return (
            <div
              key={req.id}
              className={`flex items-center gap-1 text-xs ${
                passed ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              {req.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  
  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'email' | 'details'>('email')

  // Check if password meets all requirements
  const passwordIsValid = useMemo(() => {
    return PASSWORD_REQUIREMENTS.every(req => req.validator(password))
  }, [password])

  // Handle email submit
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!email) {
      setError('Please enter your email address')
      return
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    
    setStep('details')
  }

  // Handle final submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password) {
      setError('Please create a password')
      return
    }

    if (!passwordIsValid) {
      setError('Password does not meet requirements')
      return
    }

    if (!agreedToTerms) {
      setError('Please agree to the terms to continue')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/signup/verify`,
        },
      })

      if (error) {
        setError(error.message)
        setIsLoading(false)
        return
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        // Email confirmation required
        router.push(`/signup/verify?email=${encodeURIComponent(email)}`)
      } else {
        // Auto-confirmed (for dev) - go to onboarding
        router.push('/onboarding')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  // Handle OAuth
  const handleOAuth = async (provider: 'google' | 'microsoft') => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual Supabase OAuth
      setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-up coming soon`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout 
      title="Sign up for TrueBid" 
      subtitle="Start your 14-day free trial"
      showSignIn
    >
      {/* Error message */}
      {error && (
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {step === 'email' ? (
        <>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Work Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-12 text-base bg-white dark:bg-black border-gray-300 dark:border-gray-700"
              autoComplete="email"
              autoFocus
            />

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              disabled={isLoading}
            >
              Continue with Email
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-black px-4 text-gray-400">or</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-normal border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => handleOAuth('google')}
              disabled={isLoading}
            >
              <GoogleIcon className="w-5 h-5 mr-3" />
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-normal border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => handleOAuth('microsoft')}
              disabled={isLoading}
            >
              <MicrosoftIcon className="w-5 h-5 mr-3" />
              Continue with Microsoft
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email display */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <span className="text-sm text-gray-900 dark:text-white">{email}</span>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Edit
            </button>
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-12 text-base pr-10 bg-white dark:bg-black border-gray-300 dark:border-gray-700"
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          {/* Terms */}
          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              disabled={isLoading}
              className="mt-0.5"
            />
            <label htmlFor="terms" className="text-sm text-gray-500 leading-tight cursor-pointer">
              I agree to the{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-700 underline underline-offset-2">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-700 underline underline-offset-2">Privacy Policy</Link>
            </label>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            disabled={isLoading || !passwordIsValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 mt-8">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Log In
        </Link>
      </p>
    </AuthLayout>
  )
}