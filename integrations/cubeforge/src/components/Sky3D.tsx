import { useContext, useEffect, useRef } from 'react'
import { SkySystem, type SkyOptions } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

export interface Sky3DProps {
  /** 0-1, 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk (default 0.5) */
  timeOfDay?: number
  turbidity?: number
  rayleigh?: number
  /** Auto-advance time of day each frame (default false) */
  autoRotate?: boolean
  /** Days per real second (default 0.002) */
  rotateSpeed?: number
  moonEnabled?: boolean
  starsEnabled?: boolean
  /** Called with the current timeOfDay value each frame when autoRotate is true */
  onTimeChange?: (t: number) => void
}

export function Sky3D({
  timeOfDay = 0.5,
  turbidity,
  rayleigh,
  autoRotate = false,
  rotateSpeed = 0.002,
  moonEnabled,
  starsEnabled,
  onTimeChange,
}: Sky3DProps) {
  const engine = useContext(Engine3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <Sky3D> must be inside a <Game3D>.')
    }
  }

  // Keep mutable refs for values used inside the frame listener closure
  // so we don't need to tear down + rebuild the listener on every prop change.
  const timeRef = useRef<number>(timeOfDay)
  const autoRotateRef = useRef<boolean>(autoRotate)
  const rotateSpeedRef = useRef<number>(rotateSpeed)
  const onTimeChangeRef = useRef<((t: number) => void) | undefined>(onTimeChange)

  // Sync refs on every render so the frame listener always sees fresh values.
  timeRef.current = timeOfDay
  autoRotateRef.current = autoRotate
  rotateSpeedRef.current = rotateSpeed
  onTimeChangeRef.current = onTimeChange

  // Mount / unmount effect — create SkySystem and register frame listener.
  useEffect(() => {
    if (!engine) return

    const opts: SkyOptions = {
      turbidity,
      rayleigh,
      moonEnabled,
      starsEnabled,
    }

    const sky = new SkySystem(engine.scene, opts)

    // Initial update with current time
    sky.update(timeRef.current)

    const frameListener = (dt: number) => {
      if (autoRotateRef.current) {
        timeRef.current = (timeRef.current + dt * rotateSpeedRef.current) % 1
        onTimeChangeRef.current?.(timeRef.current)
      }
      sky.update(timeRef.current)
    }

    engine._frameListeners.add(frameListener)

    return () => {
      engine._frameListeners.delete(frameListener)
      sky.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When not auto-rotating, sync timeOfDay changes to the sky immediately.
  // We use a separate effect so the frame listener always runs update() anyway,
  // but this ensures a prop-driven timeOfDay is applied on the next react cycle
  // even when autoRotate is false (the frame listener will re-apply it too).
  useEffect(() => {
    if (!autoRotate) {
      timeRef.current = timeOfDay
    }
  }, [timeOfDay, autoRotate])

  return null
}
