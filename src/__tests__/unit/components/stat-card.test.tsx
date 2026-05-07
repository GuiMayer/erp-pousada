import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from '@/components/ui/stat-card'
import { DollarSign } from 'lucide-react'

describe('StatCard', () => {
  it('should render title and value', () => {
    render(<StatCard title="Total Revenue" value="R$ 1.000,00" icon={DollarSign} />)
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument()
  })

  it('should render description when provided', () => {
    render(
      <StatCard 
        title="Total Revenue" 
        value="R$ 1.000,00" 
        icon={DollarSign}
        description="+20% from last month"
      />
    )
    expect(screen.getByText('+20% from last month')).toBeInTheDocument()
  })

  it('should apply variant classes', () => {
    const { container } = render(
      <StatCard title="Revenue" value="1000" icon={DollarSign} variant="success" />
    )
    const card = container.querySelector('.border-success\\/30')
    expect(card).toBeInTheDocument()
  })

  it('should render numeric values', () => {
    render(<StatCard title="Count" value={42} icon={DollarSign} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <StatCard 
        title="Revenue" 
        value="1000" 
        icon={DollarSign}
        className="custom-class"
      />
    )
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
