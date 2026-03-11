import { useCallback, useContext } from 'react'
import type { SquashStretchComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

export interface SquashStretchControls {
  /**
   * Manually trigger a squash-stretch effect.
   *
   * The provided scale values are applied immediately as the target for this
   * frame, then the component recovers back to 1 at its normal `recovery` speed.
   *
   * @param scaleX - Target X scale (e.g. 1.3 = 30% wider)
   * @param scaleY - Target Y scale (e.g. 0.7 = 30% shorter)
   *
   * @example
   * const ss = useSquashStretch()
   * // On jump:
   * ss.trigger(0.8, 1.3)
   * // On land:
   * ss.trigger(1.3, 0.7)
   */
  trigger(scaleX: number, scaleY: number): void
}

/**
 * Provides imperative control over the SquashStretch component attached to the
 * current entity. Use alongside the `<SquashStretch />` component.
 *
 * @example
 * ```tsx
 * function Player() {
 *   const ss = useSquashStretch()
 *   useCollisionEnter('ground', () => ss.trigger(1.3, 0.7))
 *   return (
 *     <Entity>
 *       <SquashStretch intensity={0.3} recovery={10} />
 *       <Sprite src="player.png" width={32} height={48} />
 *     </Entity>
 *   )
 * }
 * ```
 */
export function useSquashStretch(): SquashStretchControls {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  const trigger = useCallback(
    (scaleX: number, scaleY: number) => {
      const ss = engine.ecs.getComponent<SquashStretchComponent>(entityId, 'SquashStretch')
      if (!ss) return
      ss._manualTargetX = scaleX
      ss._manualTargetY = scaleY
    },
    [engine, entityId],
  )

  return { trigger }
}
