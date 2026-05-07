import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/ui/status-badge'

describe('StatusBadge', () => {
  describe('Room status', () => {
    it('should render available room status', () => {
      render(<StatusBadge status="disponivel" type="room" />)
      expect(screen.getByText('Disponível')).toBeInTheDocument()
    })

    it('should render occupied room status', () => {
      render(<StatusBadge status="ocupado" type="room" />)
      expect(screen.getByText('Ocupado')).toBeInTheDocument()
    })

    it('should render cleaning room status', () => {
      render(<StatusBadge status="limpeza" type="room" />)
      expect(screen.getByText('Limpeza')).toBeInTheDocument()
    })

    it('should render blocked room status', () => {
      render(<StatusBadge status="bloqueado" type="room" />)
      expect(screen.getByText('Bloqueado')).toBeInTheDocument()
    })
  })

  describe('Reservation status', () => {
    it('should render confirmed reservation status', () => {
      render(<StatusBadge status="confirmada" type="reservation" />)
      expect(screen.getByText('Confirmada')).toBeInTheDocument()
    })

    it('should render checkin reservation status', () => {
      render(<StatusBadge status="checkin" type="reservation" />)
      expect(screen.getByText('Check-in')).toBeInTheDocument()
    })

    it('should render checkout reservation status', () => {
      render(<StatusBadge status="checkout" type="reservation" />)
      expect(screen.getByText('Check-out')).toBeInTheDocument()
    })

    it('should render cancelled reservation status', () => {
      render(<StatusBadge status="cancelada" type="reservation" />)
      expect(screen.getByText('Cancelada')).toBeInTheDocument()
    })

    it('should render noshow reservation status', () => {
      render(<StatusBadge status="noshow" type="reservation" />)
      expect(screen.getByText('No-show')).toBeInTheDocument()
    })
  })

  it('should apply custom className', () => {
    const { container } = render(
      <StatusBadge status="disponivel" type="room" className="custom-class" />
    )
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
