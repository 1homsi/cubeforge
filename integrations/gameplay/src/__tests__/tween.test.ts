// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTween } from '../hooks/useTween'

describe('useTween', () => {
  it('is not running initially when autoStart is false', () => {
    const { result } = renderHook(() =>
      useTween({
        from: 0,
        to: 100,
        duration: 1,
        onUpdate: vi.fn(),
      }),
    )
    expect(result.current.isRunning).toBe(false)
  })

  it('start sets isRunning to true', () => {
    const { result } = renderHook(() =>
      useTween({
        from: 0,
        to: 100,
        duration: 1,
        onUpdate: vi.fn(),
      }),
    )
    act(() => {
      result.current.start()
    })
    expect(result.current.isRunning).toBe(true)
  })

  it('stop sets isRunning to false', () => {
    const { result } = renderHook(() =>
      useTween({
        from: 0,
        to: 100,
        duration: 1,
        onUpdate: vi.fn(),
      }),
    )
    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.stop()
    })
    expect(result.current.isRunning).toBe(false)
  })

  it('start/stop are stable references', () => {
    const { result, rerender } = renderHook(() =>
      useTween({
        from: 0,
        to: 100,
        duration: 1,
        onUpdate: vi.fn(),
      }),
    )
    const start1 = result.current.start
    const stop1 = result.current.stop
    rerender()
    expect(result.current.start).toBe(start1)
    expect(result.current.stop).toBe(stop1)
  })

  it('cleans up on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useTween({
        from: 0,
        to: 100,
        duration: 1,
        onUpdate: vi.fn(),
      }),
    )
    act(() => {
      result.current.start()
    })
    // Should not throw on unmount
    expect(() => unmount()).not.toThrow()
  })
})
