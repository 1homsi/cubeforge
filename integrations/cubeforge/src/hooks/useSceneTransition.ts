import { useState, useCallback, useRef, useEffect } from 'react'

export type TransitionEffect =
  | { type: 'fade'; duration?: number; color?: string }
  | { type: 'wipe'; duration?: number; direction?: 'left' | 'right' | 'up' | 'down'; color?: string }
  | { type: 'circle-close'; duration?: number; color?: string }
  | { type: 'instant' }

export interface SceneTransitionControls {
  /** Currently active scene (after transition completes). */
  current: string
  /** Full scene stack. */
  stack: string[]
  /** Push scene with transition. */
  push(scene: string, transition?: TransitionEffect): void
  /** Pop top scene with transition. Returns popped scene name. */
  pop(transition?: TransitionEffect): string | undefined
  /** Replace current scene with transition. */
  replace(scene: string, transition?: TransitionEffect): void
  /** Reset to a single scene with transition. */
  reset(scene: string, transition?: TransitionEffect): void
  /** Transition progress 0–1 (0 = no overlay, 1 = fully covered). */
  progress: number
  /** Current transition phase. */
  phase: 'idle' | 'out' | 'in'
  /** Active transition effect (for overlay rendering). */
  activeTransition: TransitionEffect | null
}

interface TransitionState {
  phase: 'idle' | 'out' | 'in'
  progress: number
  effect: TransitionEffect | null
  pendingAction: (() => void) | null
}

/**
 * Scene manager with built-in visual transitions.
 *
 * @example
 * const scenes = useSceneTransition('gameplay')
 * scenes.push('pause', { type: 'fade', duration: 0.4, color: '#000' })
 * scenes.replace('gameOver', { type: 'circle-close', duration: 0.6 })
 *
 * // Render the overlay component to see transitions:
 * <SceneTransitionOverlay controls={scenes} />
 */
export function useSceneTransition(
  initialScene: string,
  defaultTransition?: TransitionEffect,
): SceneTransitionControls {
  const [stack, setStack] = useState<string[]>([initialScene])
  const [transState, setTransState] = useState<TransitionState>({
    phase: 'idle',
    progress: 0,
    effect: null,
    pendingAction: null,
  })
  const stackRef = useRef(stack)
  stackRef.current = stack
  const transRef = useRef(transState)
  transRef.current = transState

  // Animate transition progress
  useEffect(() => {
    if (transState.phase === 'idle') return
    const effect = transState.effect
    if (!effect || effect.type === 'instant') return
    const duration = (effect.duration ?? 0.4) / 2 // half for out, half for in

    let rafId: number
    let start = performance.now()

    const animate = (now: number) => {
      const elapsed = (now - start) / 1000
      const t = Math.min(elapsed / duration, 1)

      if (transRef.current.phase === 'out') {
        setTransState((prev) => ({ ...prev, progress: t }))
        if (t >= 1) {
          // Midpoint: execute the scene change
          transRef.current.pendingAction?.()
          start = performance.now()
          setTransState((prev) => ({ ...prev, phase: 'in', progress: 1, pendingAction: null }))
        }
      } else if (transRef.current.phase === 'in') {
        setTransState((prev) => ({ ...prev, progress: 1 - t }))
        if (t >= 1) {
          setTransState({ phase: 'idle', progress: 0, effect: null, pendingAction: null })
          return
        }
      }

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [transState.phase, transState.effect])

  const startTransition = useCallback(
    (effect: TransitionEffect | undefined, action: () => void) => {
      const eff = effect ?? defaultTransition ?? { type: 'instant' }
      if (eff.type === 'instant') {
        action()
        return
      }
      setTransState({
        phase: 'out',
        progress: 0,
        effect: eff,
        pendingAction: action,
      })
    },
    [defaultTransition],
  )

  const push = useCallback(
    (scene: string, transition?: TransitionEffect) => {
      startTransition(transition, () => setStack((prev) => [...prev, scene]))
    },
    [startTransition],
  )

  const pop = useCallback(
    (transition?: TransitionEffect) => {
      const prev = stackRef.current
      if (prev.length <= 1) return undefined
      const popped = prev[prev.length - 1]
      startTransition(transition, () => setStack((p) => p.slice(0, -1)))
      return popped
    },
    [startTransition],
  )

  const replace = useCallback(
    (scene: string, transition?: TransitionEffect) => {
      startTransition(transition, () => setStack((prev) => [...prev.slice(0, -1), scene]))
    },
    [startTransition],
  )

  const reset = useCallback(
    (scene: string, transition?: TransitionEffect) => {
      startTransition(transition, () => setStack([scene]))
    },
    [startTransition],
  )

  return {
    current: stack[stack.length - 1],
    stack,
    push,
    pop,
    replace,
    reset,
    progress: transState.progress,
    phase: transState.phase,
    activeTransition: transState.effect,
  }
}
