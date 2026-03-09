import { useContext } from 'react'
import type { TouchPoint } from '@cubeforge/input'
import { EngineContext } from '../context'

export interface TouchControls {
  /** All currently active touches */
  touches: TouchPoint[]
  /** Touches that started this frame */
  justStarted: TouchPoint[]
  /** Touches that ended this frame */
  justEnded: TouchPoint[]
  /** Number of active touches */
  count: number
  /** Whether any touch is active */
  isTouching: boolean
}

export function useTouch(): TouchControls {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useTouch must be used inside <Game>')
  const t = engine.input.touch
  return {
    get touches() {
      return t.touches
    },
    get justStarted() {
      return t.justStarted
    },
    get justEnded() {
      return t.justEnded
    },
    get count() {
      return t.count
    },
    get isTouching() {
      return t.isTouching
    },
  }
}
