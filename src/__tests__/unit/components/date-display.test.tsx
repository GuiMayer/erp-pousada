import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DateDisplay, DueDateDisplay } from '@/components/ui/date-display'
import { businessDay } from '@/lib/utils/business-values'

describe('DateDisplay', () => {
  it('should format date in short format', () => {
    render(<DateDisplay date="2026-05-07" format="short" />)
    expect(screen.getByText('07/05/26')).toBeInTheDocument()
  })

  it('should show icon when requested', () => {
    const { container } = render(<DateDisplay date="2026-05-07" showIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <DateDisplay date="2026-05-07" className="custom-class" />
    )
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

describe('DueDateDisplay', () => {
  it('should show overdue warning for past dates', () => {
    const yesterday = new Date(businessDay())
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    const { container } = render(<DueDateDisplay dueDate={dateStr} />)
    expect(container.querySelector('.text-destructive')).toBeInTheDocument()
  })

  it('should show warning for dates due soon', () => {
    const tomorrow = new Date(businessDay())
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    const { container } = render(<DueDateDisplay dueDate={dateStr} />)
    expect(container.querySelector('.text-warning')).toBeInTheDocument()
  })

  it('should show days remaining when enabled', () => {
    const tomorrow = new Date(businessDay())
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    render(<DueDateDisplay dueDate={dateStr} showDaysRemaining />)
    expect(screen.getByText(/Amanhã|1d/)).toBeInTheDocument()
  })
})
