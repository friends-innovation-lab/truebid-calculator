'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, CheckCircle2, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  // Form state
  const [email, setEmail] = useState('')
  
  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
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
    
    setIsLoading(true)
    
    try {
      // TODO: Replace with actual Supabase password reset
      // const { error } = await supabase.auth.resetPasswordForEmail(email, {
      //   redirectTo: `${window.location.origin}/reset-password`,
      // })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Always show success (don't reveal if account exists)
      setIsSubmitted(true)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Password reset error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Success state
  if (isSubmitted) {
    return (
      <AuthLayout 
        title="Check your email" 
        subtitle="We sent you a password reset link"
      >
        <div className="text-center space-y-6">
          {/* Email illustration */}
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400">
              If an account exists for <span className="font-medium text-gray-900 dark:text-white">{email}</span>, 
              you&apos;ll receive an email with instructions to reset your password.
            </p>
          </div>

          {/* Tips */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">Didn&apos;t receive an email?</strong>
              <br />
              Check your spam folder, or make sure you entered the email address associated with your account.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsSubmitted(false)
                setEmail('')
              }}
              className="w-full"
            >
              <Mail className="w-4 h-4 mr-2" />
              Try another email
            </Button>
          </div>

          {/* Back to login */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <Link 
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  // Form state
  return (
    <AuthLayout 
      title="Reset your password" 
      subtitle="Enter your email and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            disabled={isLoading}
            aria-invalid={!!error}
            aria-describedby={error ? 'email-error' : undefined}
            className={`h-11 ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            autoComplete="email"
            autoFocus
          />
          {error && (
            <p id="email-error" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Submit button */}
        <Button 
          type="submit" 
          className="w-full h-11 font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending reset link...
            </>
          ) : (
            'Send reset link'
          )}
        </Button>

        {/* Back to login */}
        <div className="text-center pt-2">
          <Link 
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}