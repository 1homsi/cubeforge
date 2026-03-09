import React from 'react'
import { Entity } from './Entity'
import { Transform } from './Transform'
import { Sprite } from './Sprite'
import { RigidBody } from './RigidBody'
import { BoxCollider } from './BoxCollider'
import { Script } from './Script'
import type { EntityId, ECSWorld } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'

const platformPhases = new Map<EntityId, number>()

interface MovingPlatformProps {
  /** Start position */
  x1: number
  y1: number
  /** End position */
  x2: number
  y2: number
  width?: number
  height?: number
  /** Seconds for a full round trip (default 3) */
  duration?: number
  color?: string
}

/**
 * A static platform that oscillates between (x1,y1) and (x2,y2).
 *
 * @example
 * <MovingPlatform x1={200} y1={350} x2={450} y2={350} width={120} duration={2.5} />
 */
export function MovingPlatform({
  x1,
  y1,
  x2,
  y2,
  width = 120,
  height = 18,
  duration = 3,
  color = '#37474f',
}: MovingPlatformProps): React.ReactElement {
  return (
    <Entity>
      <Transform x={x1} y={y1} />
      <Sprite width={width} height={height} color={color} zIndex={5} />
      <RigidBody isStatic />
      <BoxCollider width={width} height={height} />
      <Script
        init={() => {}}
        update={(id: EntityId, world: ECSWorld, _input: unknown, dt: number) => {
          if (!world.hasEntity(id)) return
          const t = world.getComponent<TransformComponent>(id, 'Transform')
          if (!t) return
          const phase = (platformPhases.get(id) ?? 0) + (dt * (Math.PI * 2)) / duration
          platformPhases.set(id, phase)
          const alpha = (Math.sin(phase) + 1) / 2 // 0..1
          t.x = x1 + (x2 - x1) * alpha
          t.y = y1 + (y2 - y1) * alpha
        }}
      />
    </Entity>
  )
}
