import { useRef, useCallback, useEffect } from 'react'
import { Ease } from '@cubeforge/core'

export interface TweenControls {
  start(): void
  stop(): void
  isRunning: boolean
}

export function useTween(opts: {
  from: number
  to: number
  duration: number
  ease?: (t: number) => number
  onUpdate: (value: number) => void
  onComplete?: () => void
  autoStart?: boolean
}): TweenControls {
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const runningRef = useRef(false)

  // Keep latest callbacks in refs so start/stop stay stable
  const optsRef = useRef(opts)
  optsRef.current = opts

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    runningRef.current = false
  }, [])

  const start = useCallback(() => {
    stop()
    runningRef.current = true
    startTimeRef.current = performance.now()

    const tick = (now: number) => {
      if (!runningRef.current) return
      const { from, to, duration, ease, onUpdate, onComplete } = optsRef.current
      const easeFn = ease ?? Ease.linear
      const elapsed = (now - startTimeRef.current) / 1000 // ms → s
      const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1
      const value = from + (to - from) * easeFn(t)
      onUpdate(value)

      if (t >= 1) {
        runningRef.current = false
        rafRef.current = null
        onComplete?.()
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stop])

  // Auto-start support
  useEffect(() => {
    if (opts.autoStart) {
      start()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      runningRef.current = false
    }
  }, [])

  return {
    start,
    stop,
    get isRunning() { return runningRef.current },
  }
}
