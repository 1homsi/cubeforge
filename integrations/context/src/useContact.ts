import { useContext, useEffect, useRef } from 'react'
import type { EntityId } from '@cubeforge/core'
import { EngineContext, EntityContext } from './context'

interface ContactEvent {
  a: EntityId
  b: EntityId
  normalX?: number
  normalY?: number
}

/**
 * Contact normal data passed to collision/trigger handlers.
 *
 * `normalX` / `normalY` form a unit vector pointing **from the other entity
 * toward this entity** — i.e. the direction you were pushed. Use this for
 * knockback, surface detection (floor, wall, ceiling), and damage scaling.
 *
 * @example
 * useCollisionEnter((other, contact) => {
 *   // Knock player back on contact
 *   setVelocity(contact.normalX * 300, contact.normalY * 300)
 * })
 *
 * @example
 * useTriggerEnter((other, contact) => {
 *   // Detect which side the player entered from
 *   const fromTop = contact.normalY > 0.5
 * })
 */
export interface ContactData {
  /**
   * X component of the contact normal — direction from other entity toward this entity.
   * Positive = other entity is to the left of this entity.
   */
  normalX: number
  /**
   * Y component of the contact normal — direction from other entity toward this entity.
   * Positive = other entity is above this entity (world Y-down convention).
   */
  normalY: number
}

interface ContactOpts {
  /** Only fire if the other entity has this tag */
  tag?: string
  /** Only fire if the other entity's BoxCollider is on this layer */
  layer?: string
}

function useContactEvent(
  eventName: string,
  handler: (other: EntityId, contact: ContactData) => void,
  opts?: ContactOpts,
): void {
  const engine = useContext(EngineContext)
  const entityId = useContext(EntityContext)

  if (!engine) throw new Error(`${eventName} hook must be used inside <Game>`)
  if (entityId === null) throw new Error(`${eventName} hook must be used inside <Entity>`)

  // Always-current ref — updated synchronously every render so the subscription
  // closure never calls a stale handler.
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    return engine.events.on<ContactEvent>(eventName, ({ a, b, normalX = 0, normalY = 0 }) => {
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
        const box = engine.ecs.getComponent<{ type: 'BoxCollider'; layer: string }>(other, 'BoxCollider')
        const circle = engine.ecs.getComponent<{ type: 'CircleCollider'; layer: string }>(other, 'CircleCollider')
        const layer = box?.layer ?? circle?.layer
        if (layer !== opts.layer) return
      }

      // The manifold normal points A→B. From A's perspective the normal pointing
      // toward A (away from B) is -normal. From B's perspective it's +normal.
      // Both give "direction from other entity toward this entity."
      const flip = isA ? -1 : 1
      const contact: ContactData = {
        normalX: normalX * flip,
        normalY: normalY * flip,
      }

      handlerRef.current(other, contact)
    })
    // opts.tag and opts.layer intentionally in deps: filter changes require re-subscription.
    // handler is NOT a dep — the ref keeps it current without re-subscribing.
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
export function useTriggerEnter(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('triggerEnter', handler, opts)
}

/**
 * Fires once when an overlapping entity's collider leaves this entity's trigger.
 * Must be used inside an `<Entity>`.
 */
export function useTriggerExit(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('triggerExit', handler, opts)
}

/**
 * Fires once on the first frame two solid dynamic bodies touch.
 * Must be used inside an `<Entity>`.
 *
 * @example
 * function Enemy() {
 *   useCollisionEnter((other, contact) => {
 *     // Knock enemy back
 *     rb.vx = contact.normalX * 400
 *     rb.vy = contact.normalY * 400
 *   }, { tag: 'player' })
 *   return null
 * }
 */
export function useCollisionEnter(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('collisionEnter', handler, opts)
}

/**
 * Fires once when two solid dynamic bodies separate.
 * Must be used inside an `<Entity>`.
 */
export function useCollisionExit(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('collisionExit', handler, opts)
}

/**
 * Fires once when another entity's CircleCollider first overlaps this entity's CircleCollider.
 * Also fires when a CircleCollider overlaps a BoxCollider.
 * Must be used inside an `<Entity>`.
 *
 * @example
 * function Asteroid() {
 *   useCircleEnter((other, contact) => onHit(other, contact), { tag: 'bullet' })
 *   return null
 * }
 */
export function useCircleEnter(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('circleEnter', handler, opts)
}

/**
 * Fires once when two CircleCollider entities stop overlapping.
 * Must be used inside an `<Entity>`.
 */
export function useCircleExit(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('circleExit', handler, opts)
}

/**
 * Fires every frame while another entity remains inside this entity's trigger.
 * Must be used inside an `<Entity>`.
 */
export function useTriggerStay(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('triggerStay', handler, opts)
}

/**
 * Fires every frame while two solid dynamic bodies remain in contact.
 * Must be used inside an `<Entity>`.
 */
export function useCollisionStay(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('collisionStay', handler, opts)
}

/**
 * Fires every frame while two CircleColliders remain overlapping.
 * Must be used inside an `<Entity>`.
 */
export function useCircleStay(handler: (other: EntityId, contact: ContactData) => void, opts?: ContactOpts): void {
  useContactEvent('circleStay', handler, opts)
}
