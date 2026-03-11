// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRestart } from '../hooks/useRestart'

describe('useRestart', () => {
  it('starts with restartKey 0', () => {
    const { result } = renderHook(() => useRestart())
    expect(result.current.restartKey).toBe(0)
  })

  it('restart increments restartKey', () => {
    const { result } = renderHook(() => useRestart())
    act(() => {
      result.current.restart()
    })
    expect(result.current.restartKey).toBe(1)
  })

  it('restart can be called multiple times', () => {
    const { result } = renderHook(() => useRestart())
    act(() => {
      result.current.restart()
    })
    act(() => {
      result.current.restart()
    })
    act(() => {
      result.current.restart()
    })
    expect(result.current.restartKey).toBe(3)
  })

  it('restart function is stable across renders', () => {
    const { result, rerender } = renderHook(() => useRestart())
    const fn1 = result.current.restart
    rerender()
    const fn2 = result.current.restart
    expect(fn1).toBe(fn2)
  })
})
