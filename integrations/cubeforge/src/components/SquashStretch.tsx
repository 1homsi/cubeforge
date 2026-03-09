import { useEffect, useContext } from 'react'
import type { SquashStretchComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface SquashStretchProps {
  /** How much to squash/stretch (default 0.2) */
  intensity?: number
  /** How fast it returns to 1.0 — lerp speed (default 8) */
  recovery?: number
}

export function SquashStretch({ intensity = 0.2, recovery = 8 }: SquashStretchProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, {
      type: 'SquashStretch' as const,
      intensity,
      recovery,
      currentScaleX: 1,
      currentScaleY: 1,
    } as SquashStretchComponent)

    return () => engine.ecs.removeComponent(entityId, 'SquashStretch')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
