'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { ErrorAlert } from '@/components/ui/error-alert'
import { createClient } from '@/lib/supabase/client'

// OAuth provider icons
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23">
      <path d="M11 11H0V0h11v11z" fill="#F25022"/>
      <path d="M23 11H12V0h11v11z" fill="#7FBA00"/>
      <path d="M11 23H0V12h11v11z" fill="#00A4EF"/>
      <path d="M23 23H12V12h11v11z" fill="#FFB900"/>
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'email' | 'password'>('email')

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
    
    setStep('password')
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password) {
      setError('Please enter your password')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        setIsLoading(false)
        return
      }

      // Successful login - redirect happens via middleware
      router.push('/dashboard')
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'microsoft') => {
    setIsLoading(true)
    try {
      setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in coming soon`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout title="Log in to TrueBid" showSignUp>
      {error && (
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {step === 'email' ? (
        <>
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-12 text-base border-gray-300 rounded-md"
              autoComplete="email"
              autoFocus
            />

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium bg-black hover:bg-gray-800 rounded-md"
              disabled={isLoading}
            >
              Continue with Email
            </Button>
          </form>

          {/* OAuth buttons - stacked like Vercel */}
          <div className="mt-4 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-normal border-gray-300 rounded-md hover:bg-gray-50 justify-center"
              onClick={() => handleOAuth('google')}
              disabled={isLoading}
            >
              <GoogleIcon className="w-5 h-5 mr-3" />
              Continue with Google
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-normal border-gray-300 rounded-md hover:bg-gray-50 justify-center"
              onClick={() => handleOAuth('microsoft')}
              disabled={isLoading}
            >
              <MicrosoftIcon className="w-5 h-5 mr-3" />
              Continue with Microsoft
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200">
            <span className="text-sm text-gray-900">{email}</span>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Edit
            </button>
          </div>

          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="h-12 text-base pr-10 border-gray-300 rounded-md"
              autoComplete="current-password"
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

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
              Forgot your password?
            </Link>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium bg-black hover:bg-gray-800 rounded-md"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              'Log In'
            )}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 mt-8">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-blue-600 hover:text-blue-700">
          Sign Up
        </Link>
      </p>
    </AuthLayout>
  )
}