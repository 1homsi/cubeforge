import React from 'react'
import { Entity } from './Entity'
import { Transform } from './Transform'
import { Sprite } from './Sprite'
import { BoxCollider } from './BoxCollider'
import { Script } from './Script'
import type { EntityId, ECSWorld } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'

interface CheckpointProps {
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  /** Called once when a 'player'-tagged entity enters the checkpoint */
  onActivate?: () => void
}

/**
 * A trigger zone that fires `onActivate` when the player enters it, then destroys itself.
 *
 * @example
 * <Checkpoint x={800} y={450} onActivate={() => setCheckpoint(800)} />
 */
export function Checkpoint({
  x, y,
  width = 24, height = 48,
  color = '#ffd54f',
  onActivate,
}: CheckpointProps): React.ReactElement {
  return (
    <Entity tags={['checkpoint']}>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} zIndex={5} />
      <BoxCollider width={width} height={height} isTrigger />
      <Script
        init={() => {}}
        update={(id: EntityId, world: ECSWorld) => {
          if (!world.hasEntity(id)) return
          const ct = world.getComponent<TransformComponent>(id, 'Transform')
          if (!ct) return

          for (const pid of world.query('Tag')) {
            const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(pid, 'Tag')
            if (!tag?.tags.includes('player')) continue
            const pt = world.getComponent<TransformComponent>(pid, 'Transform')
            if (!pt) continue

            const dx = Math.abs(pt.x - ct.x)
            const dy = Math.abs(pt.y - ct.y)
            if (dx < (width / 2 + 16) && dy < (height / 2 + 20)) {
              onActivate?.()
              world.destroyEntity(id)
              return
            }
          }
        }}
      />
    </Entity>
  )
}
