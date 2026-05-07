import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaymentMethodBadge } from '@/components/ui/payment-method-badge'

describe('PaymentMethodBadge', () => {
  it('should render cash payment method', () => {
    render(<PaymentMethodBadge method="dinheiro" />)
    expect(screen.getByText('Dinheiro')).toBeInTheDocument()
  })

  it('should render debit card payment method', () => {
    render(<PaymentMethodBadge method="cartao_debito" />)
    expect(screen.getByText('Cartão Débito')).toBeInTheDocument()
  })

  it('should render credit card payment method', () => {
    render(<PaymentMethodBadge method="cartao_credito" />)
    expect(screen.getByText('Cartão Crédito')).toBeInTheDocument()
  })

  it('should render PIX payment method', () => {
    render(<PaymentMethodBadge method="pix" />)
    expect(screen.getByText('PIX')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <PaymentMethodBadge method="dinheiro" className="custom-class" />
    )
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
