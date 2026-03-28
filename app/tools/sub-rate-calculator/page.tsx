'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, DollarSign } from 'lucide-react'
import { SubRateCalculator } from '@/components/tabs/staff/sub-rate-calculator'

export default function SubRateCalculatorPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/tools">
              <Button variant="ghost" size="sm" className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Tools
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-50 rounded-md">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sub Rate Calculator
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        <SubRateCalculator />
      </main>
    </div>
  )
}
