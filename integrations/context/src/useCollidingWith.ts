import { useContext, useEffect, useRef } from 'react'
import type { EntityId } from '@cubeforge/core'
import { EngineContext, EntityContext } from './context'

interface ContactEvent {
  a: EntityId
  b: EntityId
}

/**
 * Returns a live `Set` of entity IDs currently colliding with (or overlapping
 * as triggers/circles) the current entity.
 *
 * The set is updated automatically via collisionEnter/collisionExit,
 * triggerEnter/triggerExit, and circleEnter/circleExit events.
 *
 * Must be used inside an `<Entity>`.
 *
 * @example
 * function Player() {
 *   const touching = useCollidingWith()
 *   // touching is a Set<EntityId> that updates every frame
 *   return null
 * }
 */
export function useCollidingWith(): Set<EntityId> {
  const engine = useContext(EngineContext)
  const entityId = useContext(EntityContext)

  if (!engine) throw new Error('useCollidingWith hook must be used inside <Game>')
  if (entityId === null) throw new Error('useCollidingWith hook must be used inside <Entity>')

  const setRef = useRef<Set<EntityId>>(new Set())

  useEffect(() => {
    const set = setRef.current

    function handleEnter({ a, b }: ContactEvent) {
      const isA = a === entityId
      const isB = b === entityId
      if (!isA && !isB) return
      set.add(isA ? b : a)
    }

    function handleExit({ a, b }: ContactEvent) {
      const isA = a === entityId
      const isB = b === entityId
      if (!isA && !isB) return
      set.delete(isA ? b : a)
    }

    const unsubs = [
      engine.events.on<ContactEvent>('collisionEnter', handleEnter),
      engine.events.on<ContactEvent>('collisionExit', handleExit),
      engine.events.on<ContactEvent>('triggerEnter', handleEnter),
      engine.events.on<ContactEvent>('triggerExit', handleExit),
      engine.events.on<ContactEvent>('circleEnter', handleEnter),
      engine.events.on<ContactEvent>('circleExit', handleExit),
    ]

    return () => {
      unsubs.forEach((unsub) => unsub())
      set.clear()
    }
  }, [engine.events, entityId])

  return setRef.current
}
