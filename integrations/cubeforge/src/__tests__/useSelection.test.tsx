// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { Selection, useSelection } from '../hooks/useSelection'

function wrap(initial?: number[], onChange?: (s: number[]) => void) {
  return ({ children }: { children: React.ReactNode }) => (
    <Selection initial={initial} onChange={onChange}>
      {children}
    </Selection>
  )
}

describe('Selection', () => {
  it('useSelection throws outside a Selection provider', () => {
    expect(() => renderHook(() => useSelection())).toThrow(/inside a <Selection>/)
  })

  it('starts with an empty selection by default', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap() })
    expect(result.current.selected).toEqual([])
  })

  it('honors the initial prop', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([1, 2, 3]) })
    expect(result.current.selected).toEqual([1, 2, 3])
  })

  it('select() replaces the selection by default', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([1, 2]) })
    act(() => result.current.select(5))
    expect(result.current.selected).toEqual([5])
  })

  it('select() with additive:true adds to the selection', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([1, 2]) })
    act(() => result.current.select(3, { additive: true }))
    expect(result.current.selected).toEqual([1, 2, 3])
  })

  it('select() with additive:true does not duplicate', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([1, 2]) })
    act(() => result.current.select(1, { additive: true }))
    expect(result.current.selected).toEqual([1, 2])
  })

  it('deselect() removes an entity', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([1, 2, 3]) })
    act(() => result.current.deselect(2))
    expect(result.current.selected).toEqual([1, 3])
  })

  it('toggle() flips an entity', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([1]) })
    act(() => result.current.toggle(2))
    expect(result.current.selected).toEqual([1, 2])
    act(() => result.current.toggle(1))
    expect(result.current.selected).toEqual([2])
  })

  it('clear() empties the selection', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([1, 2, 3]) })
    act(() => result.current.clear())
    expect(result.current.selected).toEqual([])
  })

  it('isSelected() reports membership correctly', () => {
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([5, 10]) })
    expect(result.current.isSelected(5)).toBe(true)
    expect(result.current.isSelected(6)).toBe(false)
  })

  it('onChange is called after every mutation', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([], onChange) })
    act(() => result.current.select(1))
    act(() => result.current.select(2, { additive: true }))
    act(() => result.current.toggle(3))
    act(() => result.current.deselect(1))
    act(() => result.current.clear())
    expect(onChange).toHaveBeenCalledTimes(5)
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('does not call onChange when select is called with an already-selected id additively', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useSelection(), { wrapper: wrap([1], onChange) })
    act(() => result.current.select(1, { additive: true }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
