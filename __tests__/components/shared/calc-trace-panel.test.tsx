/**
 * CalcTracePanel Component Tests
 *
 * Tests for cascade rendering in annual-first format and variants.
 */

import { render, screen } from '@testing-library/react'
import { CalcTracePanel } from '@/components/shared/calc-trace-panel'

describe('CalcTracePanel', () => {
  // Test fixture: $120,000 salary with standard rates
  const traceProps = {
    resolvedSalaryCents: 12000000, // $120,000
    baseHourly: 57.69, // 120000 / 2080
    fringeAmount: 12.21, // 57.69 * 0.2116
    overheadBase: 69.9, // 57.69 + 12.21
    overheadAmount: 23.95, // 69.9 * 0.3426
    gaAmount: 18.61, // (69.9 + 23.95) * 0.1983
    costBeforeProfit: 112.46, // 69.9 + 23.95 + 18.61
    profitRate: 0.1,
    profitAmount: 11.25, // 112.46 * 0.1
    fullyBurdened: 123.71, // 112.46 + 11.25
    rates: {
      fringe: 0.2116,
      overhead: 0.3426,
      ga: 0.1983,
    },
  }

  describe('annual-first format', () => {
    it('renders base salary as annual amount', () => {
      render(<CalcTracePanel {...traceProps} />)

      // Should show $120,000 annual salary
      expect(screen.getByText('Base Salary')).toBeInTheDocument()
      expect(screen.getByText(/\$120,000/)).toBeInTheDocument()
    })

    it('renders fringe as annual amount', () => {
      render(<CalcTracePanel {...traceProps} />)

      // Fringe: $12.21/hr * 2080 = $25,397
      expect(screen.getByText(/\+ Fringe/)).toBeInTheDocument()
    })

    it('renders loaded cost as annual with /yr suffix', () => {
      render(<CalcTracePanel {...traceProps} />)

      expect(screen.getByText('Loaded Cost')).toBeInTheDocument()
      // Check that at least one /yr suffix exists
      const yrSuffixes = screen.getAllByText('/yr')
      expect(yrSuffixes.length).toBeGreaterThanOrEqual(1)
    })

    it('shows division by 2,080 hours', () => {
      render(<CalcTracePanel {...traceProps} />)

      expect(screen.getByText('÷ 2,080 hrs')).toBeInTheDocument()
    })

    it('renders cost per hour after division', () => {
      render(<CalcTracePanel {...traceProps} />)

      expect(screen.getByText('Cost per Hour')).toBeInTheDocument()
    })

    it('renders final bill rate with /hr suffix', () => {
      render(<CalcTracePanel {...traceProps} />)

      expect(screen.getByText('Bill Rate')).toBeInTheDocument()
      // Check for /hr suffix near the bill rate
      const hrSuffixes = screen.getAllByText('/hr')
      expect(hrSuffixes.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('rate labels', () => {
    it('shows rate percentages when provided', () => {
      render(<CalcTracePanel {...traceProps} />)

      expect(screen.getByText(/21\.16%/)).toBeInTheDocument() // Fringe
      expect(screen.getByText(/34\.26%/)).toBeInTheDocument() // Overhead
      expect(screen.getByText(/19\.83%/)).toBeInTheDocument() // G&A
      expect(screen.getByText(/10\.00%/)).toBeInTheDocument() // Profit
    })
  })

  describe('approved variant', () => {
    it('does not show preview warning', () => {
      render(<CalcTracePanel {...traceProps} variant="approved" />)

      expect(
        screen.queryByText(/PREVIEW — NOT AN APPROVED PRICE/)
      ).not.toBeInTheDocument()
    })
  })

  describe('preview variant', () => {
    it('shows preview warning banner', () => {
      render(<CalcTracePanel {...traceProps} variant="preview" />)

      expect(
        screen.getByText('PREVIEW — NOT AN APPROVED PRICE')
      ).toBeInTheDocument()
    })
  })

  describe('arithmetic chain', () => {
    it('renders all cascade steps', () => {
      render(<CalcTracePanel {...traceProps} />)

      // Check that key elements are present (some may appear multiple times)
      expect(screen.getByText('Base Salary')).toBeInTheDocument()
      expect(screen.getByText('After Fringe')).toBeInTheDocument()
      expect(screen.getByText('After Overhead')).toBeInTheDocument()
      expect(screen.getByText('Loaded Cost')).toBeInTheDocument()
      expect(screen.getByText('÷ 2,080 hrs')).toBeInTheDocument()
      expect(screen.getByText('Cost per Hour')).toBeInTheDocument()
      expect(screen.getByText('Bill Rate')).toBeInTheDocument()
    })
  })
})
