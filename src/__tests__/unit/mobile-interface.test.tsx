import { describe, it, expect, vi, afterEach } from 'vitest'
import { createPortal } from 'react-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { phoneDestinations } from '@/components/mobile-navigation'
import { effectivePermissions } from '@/lib/permissions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table'

function viewport(phone: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: phone, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Mobile interface', () => {
  it('retains the administrator operational shortcuts', () => {
    expect(phoneDestinations(() => true).slice(0, 4).map(item => item.key)).toEqual(['mapa', 'reservas', 'pdv', 'restaurante'])
    expect(phoneDestinations(() => false)).toEqual([])
  })
  it('offers stock workers their allowed module without financial or administration access', () => {
    const permissions = effectivePermissions({ accessProfile: 'estoque' })
    const modules = phoneDestinations(permission => permissions.includes(permission)).map(item => item.key)
    expect(modules.slice(0, 4)).toContain('estoque')
    expect(modules).not.toContain('financeiro')
    expect(modules).not.toContain('administracao')
  })
  function form() {
    const close = vi.fn()
    render(<Dialog open onOpenChange={close}><DialogContent mobileTask protectDraft><DialogHeader><DialogTitle>Editar</DialogTitle><DialogDescription>Dados de teste</DialogDescription></DialogHeader><input aria-label="Nome" /><DialogFooter><button onClick={() => close(false)}>Cancelar</button></DialogFooter></DialogContent></Dialog>)
    return close
  }
  it('keeps changed mobile form fields when discard is refused', () => {
    viewport(true)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const close = form()
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Rascunho' } })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(confirm).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nome')).toHaveValue('Rascunho')
  })
  it('does not change desktop cancellation behavior', () => {
    viewport(false)
    const confirm = vi.spyOn(window, 'confirm')
    const close = form()
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Teste' } })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(confirm).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledWith(false)
  })
  it('does not discard the main draft when closing an auxiliary portal', () => {
    viewport(true)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const auxiliaryClose = vi.fn()
    render(<Dialog open><DialogContent mobileTask protectDraft><DialogHeader><DialogTitle>Formulário principal</DialogTitle><DialogDescription>Dados de teste</DialogDescription></DialogHeader><input aria-label="Rascunho principal" />{createPortal(<button onClick={auxiliaryClose}>Cancelar</button>, document.body)}</DialogContent></Dialog>)
    fireEvent.change(screen.getByLabelText('Rascunho principal'), { target: { value: 'Preservar' } })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(auxiliaryClose).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Rascunho principal')).toHaveValue('Preservar')
  })
  function list(count: number) {
    return <Table mobileColumns={['Nome', 'Ações']} mobilePreview={['Nome']}><TableBody>{Array.from({length: count}, (_, index) => <TableRow key={index}><TableCell>Produto {index + 1}</TableCell><TableCell>Editar</TableCell></TableRow>)}</TableBody></Table>
  }
  it('paginates a long mobile list and resets its page after filtering', () => {
    viewport(true)
    const { rerender } = render(list(16))
    expect(screen.queryByText('Produto 16')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Próxima'))
    expect(screen.getByText('Produto 16')).toBeInTheDocument()
    expect(screen.queryByText('Produto 1')).not.toBeInTheDocument()
    rerender(list(4))
    expect(screen.getByText('Produto 1')).toBeInTheDocument()
    expect(screen.queryByText('Próxima')).not.toBeInTheDocument()
  })
  it('keeps the complete desktop list visible', () => {
    viewport(false)
    render(list(16))
    expect(screen.getByText('Produto 16')).toBeInTheDocument()
    expect(screen.queryByText('Próxima')).not.toBeInTheDocument()
  })
})
