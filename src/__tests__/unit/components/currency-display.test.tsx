import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CurrencyDisplay } from '@/components/ui/currency-display'

describe('CurrencyDisplay', () => {
  it('should format currency correctly', () => {
    render(<CurrencyDisplay value={1234.56} />)
    expect(screen.getByText('R$ 1.234,56')).toBeInTheDocument()
  })

  it('should apply size classes', () => {
    const { container } = render(<CurrencyDisplay value={100} size="lg" />)
    const span = container.querySelector('span')
    expect(span).toHaveClass('text-lg', 'font-semibold')
  })

  it('should apply variant classes', () => {
    const { container } = render(<CurrencyDisplay value={100} variant="positive" />)
    const span = container.querySelector('span')
    expect(span).toHaveClass('text-success')
  })

  it('should handle negative values', () => {
    render(<CurrencyDisplay value={-50} variant="negative" />)
    expect(screen.getByText('-R$ 50,00')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(<CurrencyDisplay value={100} className="custom-class" />)
    const span = container.querySelector('span')
    expect(span).toHaveClass('custom-class')
  })
})
