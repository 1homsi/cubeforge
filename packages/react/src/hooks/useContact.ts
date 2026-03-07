import { useContext, useEffect } from 'react'
import type { EntityId } from '@cubeforge/core'
import { EngineContext, EntityContext } from '../context'

interface ContactEvent {
  a: EntityId
  b: EntityId
}

interface ContactOpts {
  /** Only fire if the other entity has this tag */
  tag?: string
  /** Only fire if the other entity's BoxCollider is on this layer */
  layer?: string
}

function useContactEvent(
  eventName: string,
  handler: (other: EntityId) => void,
  opts?: ContactOpts,
): void {
  const engine = useContext(EngineContext)
  const entityId = useContext(EntityContext)

  if (!engine) throw new Error(`${eventName} hook must be used inside <Game>`)
  if (entityId === null) throw new Error(`${eventName} hook must be used inside <Entity>`)

  useEffect(() => {
    return engine.events.on<ContactEvent>(eventName, ({ a, b }) => {
      // Only handle events involving this entity
      const isA = a === entityId
      const isB = b === entityId
      if (!isA && !isB) return
      const other = isA ? b : a

      // Tag filter
      if (opts?.tag) {
        const tagComp = engine.ecs.getComponent<{ type: 'Tag'; tags: string[] }>(other, 'Tag')
        if (!tagComp?.tags.includes(opts.tag)) return
      }

      // Layer filter — check BoxCollider first, fall back to CircleCollider so
      // that circle-circle contacts are not incorrectly dropped by the filter.
      if (opts?.layer) {
        const box    = engine.ecs.getComponent<{ type: 'BoxCollider';    layer: string }>(other, 'BoxCollider')
        const circle = engine.ecs.getComponent<{ type: 'CircleCollider'; layer: string }>(other, 'CircleCollider')
        const layer  = box?.layer ?? circle?.layer
        if (layer !== opts.layer) return
      }

      handler(other)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.events, engine.ecs, entityId, opts?.tag, opts?.layer])
}

/**
 * Fires once when another entity's collider first overlaps this entity's trigger.
 * Must be used inside an `<Entity>`.
 *
 * @example
 * function CoinPickup() {
 *   useTriggerEnter((other) => collectCoin(), { tag: 'player' })
 *   return null
 * }
 */
export function useTriggerEnter(handler: (other: EntityId) => void, opts?: ContactOpts): void {
  useContactEvent('triggerEnter', handler, opts)
}

/**
 * Fires once when an overlapping entity's collider leaves this entity's trigger.
 * Must be used inside an `<Entity>`.
 */
export function useTriggerExit(handler: (other: EntityId) => void, opts?: ContactOpts): void {
  useContactEvent('triggerExit', handler, opts)
}

/**
 * Fires once on the first frame two solid dynamic bodies touch.
 * Must be used inside an `<Entity>`.
 *
 * @example
 * function Enemy() {
 *   useCollisionEnter((other) => takeDamage(), { tag: 'player' })
 *   return null
 * }
 */
export function useCollisionEnter(handler: (other: EntityId) => void, opts?: ContactOpts): void {
  useContactEvent('collisionEnter', handler, opts)
}

/**
 * Fires once when two solid dynamic bodies separate.
 * Must be used inside an `<Entity>`.
 */
export function useCollisionExit(handler: (other: EntityId) => void, opts?: ContactOpts): void {
  useContactEvent('collisionExit', handler, opts)
}

/**
 * Fires once when another entity's CircleCollider first overlaps this entity's CircleCollider.
 * Also fires when a CircleCollider overlaps a BoxCollider.
 * Must be used inside an `<Entity>`.
 *
 * @example
 * function Asteroid() {
 *   useCircleEnter((other) => onHit(other), { tag: 'bullet' })
 *   return null
 * }
 */
export function useCircleEnter(handler: (other: EntityId) => void, opts?: ContactOpts): void {
  useContactEvent('circleEnter', handler, opts)
}

/**
 * Fires once when two CircleCollider entities stop overlapping.
 * Must be used inside an `<Entity>`.
 */
export function useCircleExit(handler: (other: EntityId) => void, opts?: ContactOpts): void {
  useContactEvent('circleExit', handler, opts)
}
