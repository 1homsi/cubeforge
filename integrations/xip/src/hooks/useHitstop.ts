import { useContext, useCallback } from 'react'
import { EngineContext } from '../context'

/**
 * Freeze gameplay for a short duration — physics and scripts stop
 * but the last frame stays rendered. Creates impactful collision feedback.
 *
 * @example
 * const hitstop = useHitstop()
 *
 * useCollisionEnter(() => {
 *   hitstop.freeze(0.08) // 80ms freeze on hit
 * })
 */
export function useHitstop() {
  const engine = useContext(EngineContext)!

  const freeze = useCallback(
    (seconds: number) => {
      engine.loop.hitPause(seconds)
    },
    [engine],
  )

  return { freeze }
}
