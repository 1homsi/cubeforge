import { useRef, useCallback, useEffect, useContext } from 'react'
import { createTimer, createScript } from '@cubeforge/core'
import type { GameTimer } from '@cubeforge/core'
import { EngineContext } from '@cubeforge/context'

export interface TimerControls {
  /** Start/restart the timer */
  start(): void
  /** Stop the timer */
  stop(): void
  /** Reset timer to initial duration */
  reset(): void
  /** Whether the timer is currently running */
  readonly isRunning: boolean
  /** Remaining time in seconds */
  readonly remaining: number
  /** Elapsed time since start in seconds */
  readonly elapsed: number
  /** Progress 0-1 (0 = just started, 1 = finished) */
  readonly progress: number
}

/**
 * Game-loop aware timer that integrates with the engine's update cycle.
 *
 * @param duration - Timer duration in seconds
 * @param onComplete - Called when timer reaches 0
 * @param opts - { autoStart?: boolean, loop?: boolean }
 *
 * @example
 * const timer = useTimer(3, () => console.log('Done!'))
 * timer.start()
 */
export function useTimer(
  duration: number,
  onComplete?: () => void,
  opts?: { autoStart?: boolean; loop?: boolean },
): TimerControls {
  const engine = useContext(EngineContext)!
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const loopRef = useRef(opts?.loop ?? false)
  loopRef.current = opts?.loop ?? false

  const timerRef = useRef<GameTimer | null>(null)

  // Lazily create the timer once
  if (!timerRef.current) {
    timerRef.current = createTimer(
      duration,
      () => {
        onCompleteRef.current?.()
        if (loopRef.current) {
          timerRef.current!.restart()
        }
      },
      opts?.autoStart ?? false,
    )
  }

  // Register a dedicated entity with a Script to tick the timer each frame
  useEffect(() => {
    const eid = engine.ecs.createEntity()
    engine.ecs.addComponent(
      eid,
      createScript((_id, _world, _input, dt) => {
        timerRef.current!.update(dt)
      }),
    )
    return () => {
      if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
    }
  }, [engine.ecs])

  const start = useCallback(() => {
    timerRef.current!.start()
  }, [])
  const stop = useCallback(() => {
    timerRef.current!.stop()
  }, [])
  const reset = useCallback(() => {
    timerRef.current!.reset()
  }, [])

  return {
    start,
    stop,
    reset,
    get isRunning() {
      return timerRef.current!.running
    },
    get remaining() {
      return timerRef.current!.remaining
    },
    get elapsed() {
      return timerRef.current!.elapsed
    },
    get progress() {
      return timerRef.current!.progress
    },
  }
}
