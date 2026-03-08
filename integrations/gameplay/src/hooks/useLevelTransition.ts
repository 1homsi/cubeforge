import { useState, useRef, useCallback, type RefObject } from 'react'

export type TransitionType = 'fade' | 'instant'

export interface TransitionOptions {
  duration?: number
  type?: TransitionType
}

export interface LevelTransitionControls {
  readonly currentLevel: string
  readonly isTransitioning: boolean
  transitionTo(level: string, opts?: TransitionOptions): void
  overlayRef: RefObject<HTMLDivElement | null>
}

export function useLevelTransition(initial: string): LevelTransitionControls {
  const [currentLevel, setCurrentLevel] = useState(initial)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  const transitionTo = useCallback((level: string, opts: TransitionOptions = {}) => {
    const { duration = 0.4, type = 'fade' } = opts

    if (type === 'instant') {
      setCurrentLevel(level)
      return
    }

    setIsTransitioning(true)
    const el = overlayRef.current
    const durationMs = duration * 1000
    const halfDurationMs = durationMs / 2

    if (el) {
      el.style.position = 'absolute'
      el.style.inset = '0'
      el.style.backgroundColor = '#000'
      el.style.zIndex = '9998'
      el.style.pointerEvents = 'none'
      el.style.transition = 'none'
      el.style.opacity = '0'
      void el.offsetHeight
      el.style.transition = `opacity ${halfDurationMs}ms linear`
      el.style.opacity = '1'

      setTimeout(() => {
        setCurrentLevel(level)
        if (!overlayRef.current) return
        overlayRef.current.style.transition = `opacity ${halfDurationMs}ms linear`
        overlayRef.current.style.opacity = '0'
        setTimeout(() => setIsTransitioning(false), halfDurationMs)
      }, halfDurationMs)
    } else {
      setCurrentLevel(level)
      setIsTransitioning(false)
    }
  }, [])

  return { currentLevel, isTransitioning, transitionTo, overlayRef }
}
