import { useContext } from 'react'
import { EngineContext, useTriggerEnter } from '@xip/context'
import type { EntityId } from '@xip/core'

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
