/**
 * Autonomous steering behaviors.
 *
 * All functions are pure — they return a velocity vector and optional state.
 * No side effects. Caller is responsible for applying velocity to the entity.
 */

import type { Vec2Like } from './types'
export type { Vec2Like }

function len(v: Vec2Like): number {
  return Math.hypot(v.x, v.y)
}

function normalize(v: Vec2Like, magnitude = 1): Vec2Like {
  const l = len(v)
  if (l === 0) return { x: 0, y: 0 }
  return { x: (v.x / l) * magnitude, y: (v.y / l) * magnitude }
}

/**
 * Seek: move toward `target` at full `speed`.
 */
export function seek(pos: Vec2Like, target: Vec2Like, speed: number): Vec2Like {
  return normalize({ x: target.x - pos.x, y: target.y - pos.y }, speed)
}

/**
 * Flee: move away from `threat` at full `speed`.
 */
export function flee(pos: Vec2Like, threat: Vec2Like, speed: number): Vec2Like {
  return normalize({ x: pos.x - threat.x, y: pos.y - threat.y }, speed)
}

/**
 * Arrive: move toward `target` and slow down as distance decreases.
 *
 * @param slowRadius - Start slowing within this distance from target.
 */
export function arrive(
  pos: Vec2Like,
  target: Vec2Like,
  speed: number,
  slowRadius: number,
): Vec2Like {
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return { x: 0, y: 0 }
  const desiredSpeed = dist < slowRadius ? speed * (dist / slowRadius) : speed
  return { x: (dx / dist) * desiredSpeed, y: (dy / dist) * desiredSpeed }
}

/**
 * Patrol: move toward the current waypoint, advance to next when close enough.
 *
 * Returns the velocity and the (possibly incremented) waypoint index.
 */
export function patrol(
  pos: Vec2Like,
  waypoints: Vec2Like[],
  speed: number,
  currentIdx: number,
  arriveThreshold = 8,
): { vel: Vec2Like; nextIdx: number } {
  if (waypoints.length === 0) return { vel: { x: 0, y: 0 }, nextIdx: 0 }

  const target = waypoints[currentIdx % waypoints.length]
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const dist = Math.hypot(dx, dy)

  let nextIdx = currentIdx
  if (dist < arriveThreshold) {
    nextIdx = (currentIdx + 1) % waypoints.length
  }

  return { vel: normalize({ x: dx, y: dy }, speed), nextIdx }
}

/**
 * Wander: random steering with smooth angular drift.
 *
 * @param jitter - How much to perturb the angle each frame (radians, e.g. 0.3).
 * @returns New velocity vector and the updated wander angle.
 */
export function wander(
  _pos: Vec2Like,
  angle: number,
  speed: number,
  jitter: number,
): { vel: Vec2Like; newAngle: number } {
  const newAngle = angle + (Math.random() - 0.5) * 2 * jitter
  return {
    vel: { x: Math.cos(newAngle) * speed, y: Math.sin(newAngle) * speed },
    newAngle,
  }
}
