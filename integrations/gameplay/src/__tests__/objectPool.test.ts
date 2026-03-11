// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useObjectPool } from '../hooks/useObjectPool'

describe('useObjectPool', () => {
  const factory = () => ({ x: 0, y: 0, active: false })
  const reset = (obj: { x: number; y: number; active: boolean }) => {
    obj.x = 0
    obj.y = 0
    obj.active = false
  }

  it('starts with 0 active and 0 pooled', () => {
    const { result } = renderHook(() => useObjectPool(factory, reset))
    expect(result.current.activeCount).toBe(0)
    expect(result.current.poolSize).toBe(0)
  })

  it('acquire creates an object via factory when pool is empty', () => {
    const { result } = renderHook(() => useObjectPool(factory, reset))
    let obj: ReturnType<typeof factory>
    act(() => {
      obj = result.current.acquire()
    })
    expect(obj!).toBeDefined()
    expect(result.current.activeCount).toBe(1)
  })

  it('release returns object to pool', () => {
    const { result } = renderHook(() => useObjectPool(factory, reset))
    let obj: ReturnType<typeof factory>
    act(() => {
      obj = result.current.acquire()
    })
    act(() => {
      result.current.release(obj!)
    })
    expect(result.current.activeCount).toBe(0)
    expect(result.current.poolSize).toBe(1)
  })

  it('release calls reset function', () => {
    const resetFn = vi.fn()
    const { result } = renderHook(() => useObjectPool(factory, resetFn))
    let obj: ReturnType<typeof factory>
    act(() => {
      obj = result.current.acquire()
      obj!.x = 100
      obj!.active = true
    })
    act(() => {
      result.current.release(obj!)
    })
    expect(resetFn).toHaveBeenCalledWith(obj!)
  })

  it('acquire reuses pooled objects', () => {
    const { result } = renderHook(() => useObjectPool(factory, reset))
    let obj1: ReturnType<typeof factory>
    let obj2: ReturnType<typeof factory>
    act(() => {
      obj1 = result.current.acquire()
    })
    act(() => {
      result.current.release(obj1!)
    })
    act(() => {
      obj2 = result.current.acquire()
    })
    // Should reuse the same object
    expect(obj2!).toBe(obj1!)
    expect(result.current.poolSize).toBe(0)
    expect(result.current.activeCount).toBe(1)
  })

  it('prewarm pre-creates objects', () => {
    const { result } = renderHook(() => useObjectPool(factory, reset))
    act(() => {
      result.current.prewarm(5)
    })
    expect(result.current.poolSize).toBe(5)
    expect(result.current.activeCount).toBe(0)
  })

  it('prewarm + acquire uses pooled objects', () => {
    const { result } = renderHook(() => useObjectPool(factory, reset))
    act(() => {
      result.current.prewarm(3)
    })
    act(() => {
      result.current.acquire()
    })
    expect(result.current.poolSize).toBe(2)
    expect(result.current.activeCount).toBe(1)
  })

  it('multiple acquire/release cycles work correctly', () => {
    const { result } = renderHook(() => useObjectPool(factory, reset))
    const objects: ReturnType<typeof factory>[] = []

    act(() => {
      for (let i = 0; i < 5; i++) {
        objects.push(result.current.acquire())
      }
    })
    expect(result.current.activeCount).toBe(5)

    act(() => {
      for (const obj of objects) {
        result.current.release(obj)
      }
    })
    expect(result.current.activeCount).toBe(0)
    expect(result.current.poolSize).toBe(5)
  })

  it('activeCount does not go below 0', () => {
    const { result } = renderHook(() => useObjectPool(factory, reset))
    act(() => {
      result.current.release(factory())
    })
    expect(result.current.activeCount).toBe(0)
  })

  it('pool stays stable across renders', () => {
    const { result, rerender } = renderHook(() => useObjectPool(factory, reset))
    const pool1 = result.current
    rerender()
    const pool2 = result.current
    expect(pool1.acquire).toBe(pool2.acquire)
    expect(pool1.release).toBe(pool2.release)
  })
})
