import { useEffect, useRef, useState } from 'react'
import type { EntityId } from '@cubeforge/core'
import { useGame } from './useGame'

/**
 * Reactively queries the ECS world for entities that have all the given components.
 * Re-syncs on every animation frame, returning an up-to-date array of entity IDs.
 *
 * @example
 * ```tsx
 * function EnemyCounter() {
 *   const enemies = useWorldQuery('Enemy', 'Transform')
 *   return <Text text={`Enemies: ${enemies.length}`} ... />
 * }
 * ```
 */
export function useWorldQuery(...components: string[]): EntityId[] {
  const engine = useGame()
  const [result, setResult] = useState<EntityId[]>(() => engine.ecs.query(...components))
  const prevRef = useRef<EntityId[]>([])
  const rafRef = useRef<number>(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const tick = () => {
      if (!mountedRef.current) return
      const next = engine.ecs.query(...components)
      const prev = prevRef.current
      if (next.length !== prev.length || next.some((id, i) => id !== prev[i])) {
        prevRef.current = next
        setResult([...next])
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      mountedRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, ...components])

  return result
}
