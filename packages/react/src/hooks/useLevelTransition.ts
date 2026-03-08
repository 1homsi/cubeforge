import { useState, useRef, useCallback, type RefObject } from 'react'

export type TransitionType = 'fade' | 'instant'

export interface TransitionOptions {
  /** Duration in seconds (default 0.4). Ignored for 'instant'. */
  duration?: number
  /** Transition visual style (default 'fade'). */
  type?: TransitionType
}

export interface LevelTransitionControls {
  /** The current level identifier (starts as `initial`). */
  readonly currentLevel: string
  /** True while a transition is in progress. */
  readonly isTransitioning: boolean
  /**
   * Begin a transition to `level`.
   *
   * For `'fade'`: fades to black, calls level swap at the midpoint, then
   * fades back in. Mount the returned `overlayRef` on a full-screen div.
   *
   * For `'instant'`: swaps synchronously with no animation.
   */
  transitionTo(level: string, opts?: TransitionOptions): void
  /** Attach to a full-screen overlay div to enable fade transitions. */
  overlayRef: RefObject<HTMLDivElement | null>
}

/**
 * Manages level transitions with optional fade animation.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { currentLevel, transitionTo, overlayRef } = useLevelTransition('world-1')
 *
 *   return (
 *     <Game>
 *       <World>
 *         {currentLevel === 'world-1' && <Level1 onExit={() => transitionTo('world-2')} />}
 *         {currentLevel === 'world-2' && <Level2 />}
 *       </World>
 *       <div ref={overlayRef} />
 *     </Game>
 *   )
 * }
 * ```
 */
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
      // Fade to black
      el.style.position = 'absolute'
      el.style.inset = '0'
      el.style.backgroundColor = '#000'
      el.style.zIndex = '9998'
      el.style.pointerEvents = 'none'
      el.style.transition = 'none'
      el.style.opacity = '0'
      void el.offsetHeight // force reflow
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
      // No overlay mounted — instant swap
      setCurrentLevel(level)
      setIsTransitioning(false)
    }
  }, [])

  return { currentLevel, isTransitioning, transitionTo, overlayRef }
}
