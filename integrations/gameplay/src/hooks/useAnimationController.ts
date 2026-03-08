import { useState, useCallback } from 'react'

export interface AnimationClip {
  frames: number[]
  fps?: number
  loop?: boolean
  next?: string
  onComplete?: () => void
}

export interface AnimationControllerResult<S extends string> {
  state: S
  setState(next: S): void
  animProps: {
    frames: number[]
    fps: number
    loop: boolean
    playing: boolean
    onComplete: (() => void) | undefined
  }
}

export function useAnimationController<S extends string>(
  states: Record<S, AnimationClip>,
  initial: S,
): AnimationControllerResult<S> {
  const [stateName, setStateName] = useState<S>(initial)

  const setState = useCallback((next: S) => {
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
