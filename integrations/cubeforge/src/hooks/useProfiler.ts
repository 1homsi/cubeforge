import { useContext, useEffect, useRef, useState } from 'react'
import { EngineContext } from '../context'

export interface ProfilerData {
  fps: number
  frameTime: number
  entityCount: number
  systemTimings: Map<string, number>
}

const EMPTY: ProfilerData = {
  fps: 0,
  frameTime: 0,
  entityCount: 0,
  systemTimings: new Map(),
}

/**
 * Returns live performance data from the engine: FPS, frame time, entity count,
 * and per-system timings. Updates at most every 500 ms to avoid excessive re-renders.
 *
 * Must be used inside a `<Game>` component.
 */
export function useProfiler(): ProfilerData {
  const engine = useContext(EngineContext)
  const [data, setData] = useState<ProfilerData>(EMPTY)
  const frameTimesRef = useRef<number[]>([])
  const lastUpdateRef = useRef(0)
  const prevTimeRef = useRef(0)

  useEffect(() => {
    if (!engine) return

    let rafId: number
    const frameTimes = frameTimesRef.current

    const sample = (now: number) => {
      // Track frame time
      if (prevTimeRef.current > 0) {
        frameTimes.push(now - prevTimeRef.current)
      }
      prevTimeRef.current = now

      // Throttle state updates to every 500ms
      if (now - lastUpdateRef.current >= 500) {
        lastUpdateRef.current = now

        // Calculate average FPS from collected frame times
        let fps = 0
        let avgFrameTime = 0
        if (frameTimes.length > 0) {
          const sum = frameTimes.reduce((a, b) => a + b, 0)
          avgFrameTime = sum / frameTimes.length
          fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0
          frameTimes.length = 0
        }

        setData({
          fps: Math.round(fps * 10) / 10,
          frameTime: Math.round(avgFrameTime * 100) / 100,
          entityCount: engine.ecs.entityCount,
          systemTimings: new Map(engine.systemTimings),
        })
      }

      rafId = requestAnimationFrame(sample)
    }

    rafId = requestAnimationFrame(sample)

    return () => {
      cancelAnimationFrame(rafId)
      frameTimes.length = 0
      prevTimeRef.current = 0
      lastUpdateRef.current = 0
    }
  }, [engine])

  return data
}
