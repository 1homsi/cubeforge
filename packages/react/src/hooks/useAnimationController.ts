import { useState, useCallback } from 'react'

export interface AnimationClip {
  /** Frame indices into the sprite sheet */
  frames: number[]
  /** Frames per second (default 12) */
  fps?: number
  /** Whether the clip loops (default true) */
  loop?: boolean
  /**
   * Name of the state to auto-transition to when this clip finishes.
   * Only meaningful when `loop` is false.
   */
  next?: string
  /** Called when this clip completes (before auto-transitioning) */
  onComplete?: () => void
}

export interface AnimationControllerResult<S extends string> {
  /** Currently active state name */
  state: S
  /**
   * Switch to a different state. No-op if already in that state.
   * Safe to call from Script update functions — React batches the re-render.
   */
  setState(next: S): void
  /**
   * Spread these directly onto `<Animation {...animProps} />`.
   * Updates automatically when state changes.
   */
  animProps: {
    frames: number[]
    fps: number
    loop: boolean
    playing: boolean
    onComplete: (() => void) | undefined
  }
}

/**
 * Manages named animation states with optional auto-transitions.
 *
 * @example
 * const anim = useAnimationController({
 *   idle: { frames: [0, 1],        fps: 6 },
 *   run:  { frames: [2, 3, 4, 5],  fps: 12 },
 *   jump: { frames: [6],           fps: 4, loop: false, next: 'idle' },
 * }, 'idle')
 *
 * // In Script update:
 * if (rb.isGrounded) anim.setState(Math.abs(rb.vx) > 10 ? 'run' : 'idle')
 * else               anim.setState('jump')
 *
 * // In JSX:
 * <Animation {...anim.animProps} />
 */
export function useAnimationController<S extends string>(
  states: Record<S, AnimationClip>,
  initial: S,
): AnimationControllerResult<S> {
  const [stateName, setStateName] = useState<S>(initial)

  const setState = useCallback((next: S) => {
    // React bails out automatically when the value is unchanged, so no
    // extra guard is needed here — but the functional form ensures we
    // always compare against the latest committed state.
    setStateName(prev => (prev === next ? prev : next))
  }, [])

  const clip = states[stateName] ?? states[initial]

  const onComplete: (() => void) | undefined =
    clip.next !== undefined || clip.onComplete !== undefined
      ? () => {
          clip.onComplete?.()
          if (clip.next !== undefined) setState(clip.next as S)
        }
      : undefined

  return {
    state: stateName,
    setState,
    animProps: {
      frames:     clip.frames,
      fps:        clip.fps ?? 12,
      loop:       clip.loop ?? true,
      playing:    true,
      onComplete,
    },
  }
}
