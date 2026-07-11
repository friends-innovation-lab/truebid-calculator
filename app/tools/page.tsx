'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Wrench, DollarSign, Calculator, Building2, ArrowRight } from 'lucide-react'

export default function ToolsPage() {
  const tools = [
    {
      id: 'sub-rate-calculator',
      label: 'Sub Rate Calculator',
      description: "Evaluate a prime's bill rate offer against your indirect costs",
      icon: DollarSign,
      href: '/tools/sub-rate-calculator',
      available: true,
      color: 'text-green-600 bg-green-50',
    },
    {
      id: 'rate-builder',
      label: 'Rate Builder',
      description: 'Build compliant labor rates from salary data and indirect costs',
      icon: Calculator,
      href: '/tools/rate-builder',
      available: false,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      id: 'wrap-rate',
      label: 'Wrap Rate Analyzer',
      description: 'Analyze and compare wrap rate structures across contracts',
      icon: Building2,
      href: '/tools/wrap-rate',
      available: false,
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Tools Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Wrench className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Tools</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Standalone utilities for government contracting calculations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Cards Grid */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Card
                key={tool.id}
                className={`p-6 space-y-4 ${
                  tool.available
                    ? 'hover:shadow-md hover:border-gray-300 transition-all cursor-pointer'
                    : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg ${tool.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {!tool.available && (
                    <Badge variant="secondary" className="text-xs">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {tool.label}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tool.description}
                  </p>
                </div>
                {tool.available ? (
                  <Link href={tool.href}>
                    <Button className="w-full gap-2">
                      Open Tool
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Button disabled className="w-full">
                    Coming Soon
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
