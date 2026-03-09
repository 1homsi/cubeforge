import { useRef, useMemo, useEffect } from 'react'

export interface ObjectPool<T> {
  /** Take an object from the pool (or create one via factory if empty). */
  acquire(): T
  /** Return an object to the pool after calling reset(). */
  release(obj: T): void
  /** Pre-create objects into the pool. */
  prewarm(count: number): void
  /** Number of currently acquired (in-use) objects. */
  activeCount: number
  /** Number of idle objects sitting in the pool. */
  poolSize: number
}

/**
 * Generic object pool hook. Objects are created via `factory` and cleaned up
 * via `reset` before being returned to the pool.
 *
 * ```tsx
 * const bullets = useObjectPool(
 *   () => ({ x: 0, y: 0, active: false }),
 *   (b) => { b.x = 0; b.y = 0; b.active = false },
 *   20, // prewarm 20 bullets on mount
 * )
 *
 * // In your update loop:
 * const b = bullets.acquire()
 * b.x = playerX; b.y = playerY; b.active = true
 *
 * // When done:
 * bullets.release(b)
 * ```
 */
export function useObjectPool<T>(factory: () => T, reset: (obj: T) => void, initialSize?: number): ObjectPool<T> {
  const poolRef = useRef<T[]>([])
  const activeRef = useRef(0)
  // Keep latest factory/reset in refs so the returned object stays stable
  const factoryRef = useRef(factory)
  factoryRef.current = factory
  const resetRef = useRef(reset)
  resetRef.current = reset

  // Prewarm on mount if initialSize is provided
  useEffect(() => {
    if (initialSize != null && initialSize > 0) {
      const pool = poolRef.current
      for (let i = 0; i < initialSize; i++) {
        pool.push(factoryRef.current())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return useMemo<ObjectPool<T>>(
    () => ({
      acquire(): T {
        activeRef.current++
        if (poolRef.current.length > 0) {
          return poolRef.current.pop()!
        }
        return factoryRef.current()
      },
      release(obj: T): void {
        resetRef.current(obj)
        activeRef.current = Math.max(0, activeRef.current - 1)
        poolRef.current.push(obj)
      },
      prewarm(count: number): void {
        for (let i = 0; i < count; i++) {
          poolRef.current.push(factoryRef.current())
        }
      },
      get activeCount(): number {
        return activeRef.current
      },
      get poolSize(): number {
        return poolRef.current.length
      },
    }),
    [],
  )
}
