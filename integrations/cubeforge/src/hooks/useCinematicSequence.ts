import { useEffect, useRef, useCallback, useState, useContext } from 'react'
import { createScript } from '@cubeforge/core'
import type { EntityId } from '@cubeforge/core'
import { EngineContext } from '../context'
import { getRegistry } from '../components/VirtualCamera'

export interface CinematicStep {
  /** ID of the virtual camera to activate for this step. */
  cameraId: string
  /**
   * How long to hold this camera in seconds before advancing.
   * Use `Infinity` to hold until `stop()` is called or the sequence is unmounted.
   */
  holdFor: number
  /**
   * Override the virtual camera's `blendDuration` for this specific step.
   * When omitted, uses the camera's configured `blendDuration`.
   */
  blendDuration?: number
}

export interface CinematicSequenceControls {
  /** Start the sequence from the beginning. */
  play(): void
  /** Stop the sequence and deactivate the current camera step. */
  stop(): void
  /** Whether the sequence is currently playing. */
  readonly isPlaying: boolean
  /** Zero-based index of the current step, or -1 when stopped. */
  readonly currentStep: number
}

/**
 * Plays an ordered sequence of virtual camera shots inside the engine loop.
 * Each step activates a named `<VirtualCamera>` for `holdFor` seconds, then
 * automatically advances to the next step. Respects engine pause.
 *
 * The virtual cameras referenced in the steps must be mounted in the scene
 * tree via `<VirtualCamera>` before calling `play()`.
 *
 * @example
 * ```tsx
 * const { play, stop, isPlaying } = useCinematicSequence([
 *   { cameraId: 'intro',     holdFor: 2,        blendDuration: 0 },
 *   { cameraId: 'overview',  holdFor: 3,        blendDuration: 1 },
 *   { cameraId: 'mainFollow', holdFor: Infinity, blendDuration: 0.5 },
 * ], { onComplete: () => console.log('cutscene done') })
 *
 * // Trigger on mount:
 * useEffect(() => { play() }, [])
 * ```
 */
export function useCinematicSequence(
  steps: CinematicStep[],
  opts?: { onComplete?: () => void },
): CinematicSequenceControls {
  const engine = useContext(EngineContext)!
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const optsRef = useRef(opts)
  optsRef.current = opts

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)

  const stateRef = useRef<{
    playing: boolean
    step: number
    elapsed: number
    scriptEid: EntityId | null
  }>({ playing: false, step: -1, elapsed: 0, scriptEid: null })

  // Activate the virtual camera for the given step
  const activateStep = useCallback(
    (idx: number) => {
      const steps = stepsRef.current
      if (idx < 0 || idx >= steps.length) return
      const step = steps[idx]
      const registry = getRegistry(engine)

      // Deactivate all other sequence cameras first
      for (const s of steps) {
        if (s.cameraId !== step.cameraId) {
          const entry = registry.get(s.cameraId)
          if (entry) entry.active = false
        }
      }

      // Activate the target camera, optionally overriding blendDuration
      const entry = registry.get(step.cameraId)
      if (entry) {
        if (step.blendDuration !== undefined) entry.blendDuration = step.blendDuration
        entry.active = true
      }
    },
    [engine],
  )

  const play = useCallback(() => {
    const state = stateRef.current
    state.playing = true
    state.step = 0
    state.elapsed = 0
    setIsPlaying(true)
    setCurrentStep(0)
    activateStep(0)
  }, [activateStep])

  const stop = useCallback(() => {
    const state = stateRef.current
    if (!state.playing) return
    state.playing = false
    setIsPlaying(false)
    setCurrentStep(-1)

    // Deactivate all sequence cameras
    const registry = getRegistry(engine)
    for (const s of stepsRef.current) {
      const entry = registry.get(s.cameraId)
      if (entry) entry.active = false
    }
  }, [engine])

  // Drive the sequence inside the engine loop (respects pause)
  useEffect(() => {
    const state = stateRef.current
    const eid: EntityId = engine.ecs.createEntity()
    state.scriptEid = eid

    engine.ecs.addComponent(
      eid,
      createScript((_id, _world, _input, dt) => {
        if (!state.playing) return
        const steps = stepsRef.current
        if (steps.length === 0) return

        const step = steps[state.step]
        if (!step) return

        if (step.holdFor === Infinity) return // hold indefinitely

        state.elapsed += dt
        if (state.elapsed >= step.holdFor) {
          state.elapsed = 0
          const next = state.step + 1
          if (next >= steps.length) {
            // Sequence complete
            state.playing = false
            setIsPlaying(false)
            setCurrentStep(-1)
            optsRef.current?.onComplete?.()
          } else {
            state.step = next
            setCurrentStep(next)
            activateStep(next)
          }
        }
      }),
    )

    return () => {
      state.scriptEid = null
      if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  return {
    play,
    stop,
    get isPlaying() {
      return isPlaying
    },
    get currentStep() {
      return currentStep
    },
  }
}
