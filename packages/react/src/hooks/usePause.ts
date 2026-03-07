import { useContext, useState, useCallback } from 'react'
import { EngineContext } from '../context'

export interface PauseControls {
  paused: boolean
  pause(): void
  resume(): void
  toggle(): void
}

/**
 * Controls the game loop pause state from inside a `<Game>` tree.
 *
 * @example
 * function PauseButton() {
 *   const { paused, toggle } = usePause()
 *   return <button onClick={toggle}>{paused ? 'Resume' : 'Pause'}</button>
 * }
 */
export function usePause(): PauseControls {
  const engine = useContext(EngineContext)!
  const [paused, setPaused] = useState(false)

  const pause = useCallback(() => {
    engine.loop.pause()
    setPaused(true)
  }, [engine])

  const resume = useCallback(() => {
    engine.loop.resume()
    setPaused(false)
  }, [engine])

  const toggle = useCallback(() => {
    if (engine.loop.isPaused) resume()
    else pause()
  }, [engine, pause, resume])

  return { paused, pause, resume, toggle }
}
