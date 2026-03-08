import { useContext, useEffect, useRef } from 'react'
import type { EventBus } from '@cubeforge/core'
import { EngineContext } from '../context'

export function useEvents(): EventBus {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useEvents must be used inside <Game>')
  return engine.events
}

export function useEvent<T>(event: string, handler: (data: T) => void): void {
  const events = useEvents()
  // Always-current ref — updated synchronously every render so the subscription
  // closure never calls a stale handler. Re-subscription only happens when
  // the event name or bus instance changes.
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    return events.on<T>(event, (data) => handlerRef.current(data))
  }, [events, event])
}
