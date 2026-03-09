import { useRef, useEffect, useContext } from 'react'
import { createScript } from '@cubeforge/core'
import { EngineContext } from '@cubeforge/context'

export type CoroutineGenerator = Generator<CoroutineYield, void, number>
export type CoroutineFactory = () => CoroutineGenerator

/** What a coroutine can yield */
export type CoroutineYield =
  | { type: 'wait'; seconds: number }
  | { type: 'waitFrames'; frames: number }
  | { type: 'waitUntil'; condition: () => boolean }
  | null // yield null = wait one frame

/** Convenience helpers for yielding */
export const wait = (seconds: number): CoroutineYield => ({ type: 'wait', seconds })
export const waitFrames = (frames: number): CoroutineYield => ({ type: 'waitFrames', frames })
export const waitUntil = (condition: () => boolean): CoroutineYield => ({ type: 'waitUntil', condition })

interface RunningCoroutine {
  gen: CoroutineGenerator
  /** Seconds remaining for a 'wait' yield */
  waitTimer: number
  /** Frames remaining for a 'waitFrames' yield */
  waitFramesLeft: number
  /** Condition function for a 'waitUntil' yield */
  waitCondition: (() => boolean) | null
}

export interface CoroutineControls {
  /** Start a coroutine. Returns an ID for cancellation. */
  start(factory: CoroutineFactory): number
  /** Cancel a running coroutine by ID */
  cancel(id: number): void
  /** Cancel all running coroutines */
  cancelAll(): void
  /** Number of running coroutines */
  readonly activeCount: number
}

let nextCoroutineId = 1

/**
 * Unity-style coroutine system for sequencing game logic.
 *
 * @example
 * const co = useCoroutine()
 *
 * co.start(function* () {
 *   sprite.color = '#ff0000'
 *   yield wait(0.2)
 *   sprite.color = '#ffffff'
 *   yield waitFrames(10)
 *   sprite.color = '#ff0000'
 *   yield waitUntil(() => rb.onGround)
 *   console.log('Landed!')
 * })
 */
export function useCoroutine(): CoroutineControls {
  const engine = useContext(EngineContext)!
  const coroutinesRef = useRef<Map<number, RunningCoroutine>>(new Map())

  useEffect(() => {
    const eid = engine.ecs.createEntity()
    engine.ecs.addComponent(
      eid,
      createScript((_id, _world, _input, dt) => {
        const coroutines = coroutinesRef.current
        for (const [id, co] of coroutines) {
          // Handle wait timer
          if (co.waitTimer > 0) {
            co.waitTimer -= dt
            if (co.waitTimer > 0) continue
            co.waitTimer = 0
          }

          // Handle waitFrames
          if (co.waitFramesLeft > 0) {
            co.waitFramesLeft--
            if (co.waitFramesLeft > 0) continue
          }

          // Handle waitUntil
          if (co.waitCondition !== null) {
            if (!co.waitCondition()) continue
            co.waitCondition = null
          }

          // Advance the generator
          const result = co.gen.next(dt)

          if (result.done) {
            coroutines.delete(id)
            continue
          }

          const yielded = result.value
          if (yielded === null) {
            // yield null = wait one frame — will advance next tick
            co.waitFramesLeft = 1
          } else if (yielded.type === 'wait') {
            co.waitTimer = yielded.seconds
          } else if (yielded.type === 'waitFrames') {
            co.waitFramesLeft = yielded.frames
          } else if (yielded.type === 'waitUntil') {
            co.waitCondition = yielded.condition
          }
        }
      }),
    )

    return () => {
      coroutinesRef.current.clear()
      if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
    }
  }, [engine.ecs])

  const controls: CoroutineControls = {
    start(factory: CoroutineFactory): number {
      const id = nextCoroutineId++
      const gen = factory()
      coroutinesRef.current.set(id, {
        gen,
        waitTimer: 0,
        waitFramesLeft: 0,
        waitCondition: null,
      })
      return id
    },

    cancel(id: number): void {
      coroutinesRef.current.delete(id)
    },

    cancelAll(): void {
      coroutinesRef.current.clear()
    },

    get activeCount() {
      return coroutinesRef.current.size
    },
  }

  // Store in a ref so we always return the same object identity
  const controlsRef = useRef(controls)
  return controlsRef.current
}
