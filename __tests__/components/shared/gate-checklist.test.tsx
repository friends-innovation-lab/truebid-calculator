/**
 * GateChecklist Component Tests
 *
 * Tests for state transitions, blocked count display, and fix links.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { GateChecklist } from '@/components/shared/gate-checklist'

describe('GateChecklist', () => {
  const mockOnAction = jest.fn()

  beforeEach(() => {
    mockOnAction.mockClear()
  })

  describe('when all conditions are met', () => {
    const allMetConditions = [
      { label: 'Conservation clean', met: true },
      { label: 'No engine flags', met: true },
    ]

    it('renders action button as enabled', () => {
      render(
        <GateChecklist
          conditions={allMetConditions}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      const button = screen.getByRole('button', { name: 'Approve' })
      expect(button).not.toBeDisabled()
    })

    it('shows all conditions with check icons', () => {
      render(
        <GateChecklist
          conditions={allMetConditions}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('Conservation clean')).toBeInTheDocument()
      expect(screen.getByText('No engine flags')).toBeInTheDocument()
    })

    it('calls onAction when button is clicked', () => {
      render(
        <GateChecklist
          conditions={allMetConditions}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      const button = screen.getByRole('button', { name: 'Approve' })
      fireEvent.click(button)

      expect(mockOnAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('when some conditions are not met', () => {
    const mixedConditions = [
      { label: 'Conservation clean', met: true },
      { label: 'No engine flags', met: false, detail: 'Missing utilization data' },
      { label: 'Valid salaries', met: false },
    ]

    it('renders action button as disabled with correct count', () => {
      render(
        <GateChecklist
          conditions={mixedConditions}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      const button = screen.getByRole('button', {
        name: 'Approve — 2 items need resolution',
      })
      expect(button).toBeDisabled()
    })

    it('shows detail text for unmet conditions', () => {
      render(
        <GateChecklist
          conditions={mixedConditions}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('Missing utilization data')).toBeInTheDocument()
    })

    it('does not call onAction when disabled button is clicked', () => {
      render(
        <GateChecklist
          conditions={mixedConditions}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      const button = screen.getByRole('button', {
        name: 'Approve — 2 items need resolution',
      })
      fireEvent.click(button)

      expect(mockOnAction).not.toHaveBeenCalled()
    })
  })

  describe('with fix links', () => {
    const conditionsWithLinks = [
      {
        label: 'Utilization confirmed',
        met: false,
        fixHref: '/scope/requirements',
      },
    ]

    it('renders fix link for unmet conditions', () => {
      render(
        <GateChecklist
          conditions={conditionsWithLinks}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      const link = screen.getByRole('link', { name: /fix/i })
      expect(link).toHaveAttribute('href', '/scope/requirements')
    })
  })

  describe('loading state', () => {
    it('shows loading indicator when loading is true', () => {
      render(
        <GateChecklist
          conditions={[{ label: 'Test', met: true }]}
          actionLabel="Approve"
          onAction={mockOnAction}
          loading={true}
        />
      )

      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('disables button when loading', () => {
      render(
        <GateChecklist
          conditions={[{ label: 'Test', met: true }]}
          actionLabel="Approve"
          onAction={mockOnAction}
          loading={true}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('singular vs plural text', () => {
    it('shows singular text for 1 unmet item', () => {
      render(
        <GateChecklist
          conditions={[{ label: 'Test', met: false }]}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      expect(
        screen.getByRole('button', { name: 'Approve — 1 item needs resolution' })
      ).toBeInTheDocument()
    })

    it('shows plural text for multiple unmet items', () => {
      render(
        <GateChecklist
          conditions={[
            { label: 'Test 1', met: false },
            { label: 'Test 2', met: false },
          ]}
          actionLabel="Approve"
          onAction={mockOnAction}
        />
      )

      expect(
        screen.getByRole('button', { name: 'Approve — 2 items need resolution' })
      ).toBeInTheDocument()
    })
  })
})
