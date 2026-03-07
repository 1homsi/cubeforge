import { useContext } from 'react'
import { EngineContext } from '../context'
import type { EntityId } from '@cubeforge/core'
import { useTriggerEnter } from './useContact'

interface DamageZoneOpts {
  /** Only damage entities with this tag */
  tag?: string
  /** Only damage entities with this collider layer */
  layer?: string
}

/**
 * Makes the current entity deal damage to any entity that enters its trigger
 * zone. The target entity must be using `useHealth` to receive the damage.
 *
 * Damage is delivered via an engine EventBus `damage:<entityId>` event so it
 * works across entity boundaries with no direct coupling.
 *
 * Must be used inside an `<Entity>` with a `<BoxCollider isTrigger>`.
 *
 * @example
 * function LavaPool() {
 *   useDamageZone(1, { tag: 'player' })
 *   return null
 * }
 */
export function useDamageZone(damage: number, opts: DamageZoneOpts = {}): void {
  const engine = useContext(EngineContext)!

  useTriggerEnter((other: EntityId) => {
    engine.events.emit(`damage:${other}`, { amount: damage })
  }, { tag: opts.tag, layer: opts.layer })
}
