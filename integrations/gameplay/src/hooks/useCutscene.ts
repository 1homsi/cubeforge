import { useState, useCallback, useRef, useEffect, useContext } from 'react'
import { createScript } from '@cubeforge/core'
import { EngineContext } from '@cubeforge/context'

export type CutsceneStep =
  | { type: 'wait'; duration: number }
  | { type: 'call'; fn: () => void | Promise<void> }
  | { type: 'parallel'; steps: CutsceneStep[] }

export interface CutsceneControls {
  readonly playing: boolean
  readonly stepIndex: number
  play(steps: CutsceneStep[]): void
  skip(): void
}

export function useCutscene(): CutsceneControls {
  const engine = useContext(EngineContext)!
  const [playing, setPlaying] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const stepsRef = useRef<CutsceneStep[]>([])
  const timerRef = useRef(0)
  const idxRef = useRef(0)
  const playingRef = useRef(false)
  const entityRef = useRef<number | null>(null)

  const finish = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    setStepIndex(0)
    idxRef.current = 0
    if (entityRef.current !== null && engine.ecs.hasEntity(entityRef.current)) {
      engine.ecs.destroyEntity(entityRef.current)
      entityRef.current = null
    }
  }, [engine.ecs])

  const fireStep = useCallback((step: CutsceneStep) => {
    if (step.type === 'call') step.fn()
    if (step.type === 'parallel')
      step.steps.forEach((s) => {
        if (s.type === 'call') s.fn()
      })
  }, [])

  const play = useCallback(
    (steps: CutsceneStep[]) => {
      stepsRef.current = steps
      idxRef.current = 0
      timerRef.current = 0
      playingRef.current = true
      setPlaying(true)
      setStepIndex(0)

      // Fire any initial 'call' steps
      const step = steps[0]
      if (step) fireStep(step)

      // Create script entity for frame-by-frame updates
      const eid = engine.ecs.createEntity()
      entityRef.current = eid
      engine.ecs.addComponent(
        eid,
        createScript((_id, _world, _input, dt) => {
          if (!playingRef.current) return
          const allSteps = stepsRef.current
          const idx = idxRef.current
          if (idx >= allSteps.length) {
            finish()
            return
          }

          const current = allSteps[idx]
          if (current.type === 'wait') {
            timerRef.current += dt
            if (timerRef.current >= current.duration) {
              timerRef.current = 0
              idxRef.current++
              setStepIndex(idxRef.current)
              const next = allSteps[idxRef.current]
              if (next) fireStep(next)
              if (idxRef.current >= allSteps.length) finish()
            }
          } else if (current.type === 'call') {
            // Already fired, advance immediately
            idxRef.current++
            setStepIndex(idxRef.current)
            const next = allSteps[idxRef.current]
            if (next) fireStep(next)
            if (idxRef.current >= allSteps.length) finish()
          } else if (current.type === 'parallel') {
            // Check wait sub-steps
            const waits = current.steps.filter((s) => s.type === 'wait') as Array<{ type: 'wait'; duration: number }>
            const maxDuration = waits.length > 0 ? Math.max(...waits.map((w) => w.duration)) : 0
            timerRef.current += dt
            if (timerRef.current >= maxDuration) {
              timerRef.current = 0
              idxRef.current++
              setStepIndex(idxRef.current)
              const next = allSteps[idxRef.current]
              if (next) fireStep(next)
              if (idxRef.current >= allSteps.length) finish()
            }
          }
        }),
      )
    },
    [engine.ecs, finish, fireStep],
  )

  const skip = useCallback(() => {
    // Fire all remaining call steps
    for (let i = idxRef.current; i < stepsRef.current.length; i++) {
      const step = stepsRef.current[i]
      if (step.type === 'call') step.fn()
      if (step.type === 'parallel')
        step.steps.forEach((s) => {
          if (s.type === 'call') s.fn()
        })
    }
    finish()
  }, [finish])

  useEffect(() => {
    return () => {
      if (entityRef.current !== null && engine.ecs.hasEntity(entityRef.current)) {
        engine.ecs.destroyEntity(entityRef.current)
      }
    }
  }, [engine.ecs])

  return { playing, stepIndex, play, skip }
}
