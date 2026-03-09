import { useContext } from 'react'
import { EngineContext, useTriggerEnter } from '@cubeforge/context'
import type { EntityId } from '@cubeforge/core'

interface DamageZoneOpts {
  tag?: string
  layer?: string
}

export function useDamageZone(damage: number, opts: DamageZoneOpts = {}): void {
  const engine = useContext(EngineContext)!

  useTriggerEnter(
    (other: EntityId) => {
      engine.events.emit(`damage:${other}`, { amount: damage })
    },
    { tag: opts.tag, layer: opts.layer },
  )
}
