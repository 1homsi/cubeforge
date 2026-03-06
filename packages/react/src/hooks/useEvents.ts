import { useContext, useEffect } from 'react'
import type { EventBus } from '@cubeforge/core'
import { EngineContext } from '../context'

export function useEvents(): EventBus {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useEvents must be used inside <Game>')
  return engine.events
}

export function useEvent<T>(event: string, handler: (data: T) => void): void {
  const events = useEvents()
  useEffect(() => {
    return events.on<T>(event, handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, event])
}
