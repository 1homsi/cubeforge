import React from 'react'
import { Entity } from './Entity'
import { Transform } from './Transform'
import { Sprite } from './Sprite'
import { RigidBody } from './RigidBody'
import { BoxCollider } from './BoxCollider'
import { Script } from './Script'
import type { EntityId, ECSWorld } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'

export interface Waypoint {
  x: number
  y: number
}

// State per entity — avoids re-allocation every frame
const platformWaypointIdx = new Map<EntityId, number>()
const platformProgress = new Map<EntityId, number>()
const platformDirection = new Map<EntityId, 1 | -1>()

type TwoPointProps = {
  /** Start position (two-point shorthand) */
  x1: number
  y1: number
  /** End position (two-point shorthand) */
  x2: number
  y2: number
  waypoints?: never
  /** Seconds for a full round trip in two-point mode (default 3). Ignored when waypoints is set. */
  duration?: number
}

type WaypointProps = {
  x1?: never
  y1?: never
  x2?: never
  y2?: never
  /**
   * Ordered list of world-space positions to travel through.
   * The platform ping-pongs between the first and last waypoint.
   */
  waypoints: Waypoint[]
  duration?: never
}

type MovingPlatformProps = (TwoPointProps | WaypointProps) & {
  width?: number
  height?: number
  /**
   * Movement speed in world pixels per second (waypoint mode only, default 120).
   * In two-point mode use `duration` to control timing.
   */
  speed?: number
  color?: string
}

/**
 * A static platform that moves along a path.
 *
 * **Two-point mode** (backward-compatible) — oscillates sinusoidally between
 * `(x1,y1)` and `(x2,y2)` over `duration` seconds:
 * ```tsx
 * <MovingPlatform x1={200} y1={350} x2={450} y2={350} duration={2.5} />
 * ```
 *
 * **Waypoint mode** — travels through an ordered list of positions at a fixed
 * speed, ping-ponging between the first and last point:
 * ```tsx
 * <MovingPlatform
 *   waypoints={[{x:100,y:350},{x:300,y:350},{x:200,y:200}]}
 *   speed={150}
 * />
 * ```
 */
export function MovingPlatform(props: MovingPlatformProps): React.ReactElement {
  const { width = 120, height = 18, color = '#37474f', speed = 120 } = props

  // Resolve waypoints from either API
  const resolvedWaypoints: Waypoint[] =
    props.waypoints ??
    ([
      { x: props.x1, y: props.y1 },
      { x: props.x2, y: props.y2 },
    ] as Waypoint[])

  const startX = resolvedWaypoints[0]?.x ?? 0
  const startY = resolvedWaypoints[0]?.y ?? 0

  const updateFn = (id: EntityId, world: ECSWorld, _input: unknown, dt: number) => {
    if (!world.hasEntity(id)) return
    const t = world.getComponent<TransformComponent>(id, 'Transform')
    if (!t) return

    // Two-point sine mode (duration-based)
    if (!props.waypoints && props.x1 !== undefined) {
      const { x1, y1, x2, y2, duration = 3 } = props as TwoPointProps
      const phase = ((platformProgress.get(id) ?? 0) + dt * ((Math.PI * 2) / duration)) % (Math.PI * 2)
      platformProgress.set(id, phase)
      const alpha = (Math.sin(phase) + 1) / 2
      t.x = x1 + (x2 - x1) * alpha
      t.y = y1 + (y2 - y1) * alpha
      return
    }

    // Waypoint mode — constant-speed travel with ping-pong
    const pts = resolvedWaypoints
    if (pts.length < 2) return

    let idx = platformWaypointIdx.get(id) ?? 0
    let progress = platformProgress.get(id) ?? 0
    let dir = platformDirection.get(id) ?? 1

    const from = pts[idx]
    const to = pts[idx + dir]

    if (!from || !to) return

    const dx = to.x - from.x
    const dy = to.y - from.y
    const segLen = Math.sqrt(dx * dx + dy * dy)

    if (segLen > 0) {
      progress += (speed * dt) / segLen

      while (progress >= 1) {
        progress -= 1
        idx += dir

        // Reverse at ends
        if (idx >= pts.length - 1) {
          idx = pts.length - 1
          dir = -1
        } else if (idx <= 0) {
          idx = 0
          dir = 1
        }
      }

      const f = pts[idx]
      const toNext = pts[idx + dir]
      if (f && toNext) {
        t.x = f.x + (toNext.x - f.x) * progress
        t.y = f.y + (toNext.y - f.y) * progress
      }
    }

    platformWaypointIdx.set(id, idx)
    platformProgress.set(id, progress)
    platformDirection.set(id, dir)
  }

  return (
    <Entity>
      <Transform x={startX} y={startY} />
      <Sprite width={width} height={height} color={color} zIndex={5} />
      <RigidBody isStatic />
      <BoxCollider width={width} height={height} />
      <Script init={() => {}} update={updateFn} />
    </Entity>
  )
}
