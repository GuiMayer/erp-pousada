import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGuestSearch } from '@/lib/hooks/useGuestSearch'
import type { GuestProfile } from '@/lib/store'

describe('useGuestSearch', () => {
  const mockGuest: GuestProfile = {
    cpf: '123.456.789-00',
    name: 'João Silva',
    totalStays: 5,
    avgTicket: 800,
    noShows: 0,
  }

  const mockFindGuest = vi.fn((cpf: string) => {
    if (cpf === '123.456.789-00' || cpf === '12345678900') {
      return mockGuest
    }
    return undefined
  })

  it('should initialize with empty values', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    expect(result.current.cpf).toBe('')
    expect(result.current.guestName).toBe('')
    expect(result.current.foundGuest).toBeUndefined()
    expect(result.current.isValidCPF).toBe(false)
  })

  it('should auto-search when CPF has 11 digits', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    act(() => {
      result.current.setCpf('12345678900')
    })

    expect(mockFindGuest).toHaveBeenCalledWith('12345678900')
    expect(result.current.foundGuest).toEqual(mockGuest)
    expect(result.current.guestName).toBe('João Silva')
  })

  it('should auto-fill guest name when found', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    act(() => {
      result.current.setCpf('123.456.789-00')
    })

    expect(result.current.guestName).toBe('João Silva')
  })

  it('should not search with incomplete CPF', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    mockFindGuest.mockClear()
    
    act(() => {
      result.current.setCpf('123456')
    })

    expect(mockFindGuest).not.toHaveBeenCalled()
    expect(result.current.foundGuest).toBeUndefined()
  })

  it('should validate CPF format', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    act(() => {
      result.current.setCpf('123.456.789-00')
    })

    expect(result.current.isValidCPF).toBe(true)
  })

  it('should identify new guest', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    act(() => {
      result.current.setCpf('987.654.321-00')
    })

    expect(result.current.isNewGuest).toBe(true)
    expect(result.current.foundGuest).toBeUndefined()
  })

  it('should not identify as new guest if CPF is invalid', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    act(() => {
      result.current.setCpf('123')
    })

    expect(result.current.isNewGuest).toBe(false)
  })

  it('should allow manual guest name input', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    act(() => {
      result.current.setGuestName('Maria Santos')
    })

    expect(result.current.guestName).toBe('Maria Santos')
  })

  it('should reset all state', () => {
    const { result } = renderHook(() => useGuestSearch(mockFindGuest))
    
    act(() => {
      result.current.setCpf('123.456.789-00')
      result.current.setGuestName('Test Name')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.cpf).toBe('')
    expect(result.current.guestName).toBe('')
    expect(result.current.foundGuest).toBeUndefined()
  })
})
