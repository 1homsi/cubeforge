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
export function arrive(pos: Vec2Like, target: Vec2Like, speed: number, slowRadius: number): Vec2Like {
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

/**
 * Pursuit: like seek, but predicts where a moving target will be.
 *
 * @param targetVel - Current velocity of the target.
 * @param lookAhead - How many seconds ahead to predict (e.g. 0.5).
 */
export function pursuit(
  pos: Vec2Like,
  targetPos: Vec2Like,
  targetVel: Vec2Like,
  speed: number,
  lookAhead = 0.5,
): Vec2Like {
  const predicted = {
    x: targetPos.x + targetVel.x * lookAhead,
    y: targetPos.y + targetVel.y * lookAhead,
  }
  return seek(pos, predicted, speed)
}

/**
 * Evade: like flee, but predicts where a moving threat will be.
 *
 * @param threatVel - Current velocity of the threat.
 * @param lookAhead - How many seconds ahead to predict (e.g. 0.5).
 */
export function evade(
  pos: Vec2Like,
  threatPos: Vec2Like,
  threatVel: Vec2Like,
  speed: number,
  lookAhead = 0.5,
): Vec2Like {
  const predicted = {
    x: threatPos.x + threatVel.x * lookAhead,
    y: threatPos.y + threatVel.y * lookAhead,
  }
  return flee(pos, predicted, speed)
}

/**
 * Separation: push away from nearby agents to avoid crowding.
 *
 * @param neighbors - Positions of nearby agents (excluding self).
 * @param radius - Influence radius; agents further away are ignored.
 */
export function separation(pos: Vec2Like, neighbors: Vec2Like[], speed: number, radius: number): Vec2Like {
  let sx = 0
  let sy = 0
  let count = 0

  for (const n of neighbors) {
    const dx = pos.x - n.x
    const dy = pos.y - n.y
    const dist = Math.hypot(dx, dy)
    if (dist > 0 && dist < radius) {
      // Weight by inverse distance — closer neighbors repel more
      const weight = 1 - dist / radius
      sx += (dx / dist) * weight
      sy += (dy / dist) * weight
      count++
    }
  }

  if (count === 0) return { x: 0, y: 0 }
  return normalize({ x: sx, y: sy }, speed)
}

/**
 * Cohesion: steer toward the average position of nearby agents (boids rule).
 *
 * @param neighbors - Positions of nearby agents (excluding self).
 */
export function cohesion(pos: Vec2Like, neighbors: Vec2Like[], speed: number): Vec2Like {
  if (neighbors.length === 0) return { x: 0, y: 0 }
  let cx = 0
  let cy = 0
  for (const n of neighbors) {
    cx += n.x
    cy += n.y
  }
  cx /= neighbors.length
  cy /= neighbors.length
  return seek(pos, { x: cx, y: cy }, speed)
}

/**
 * Alignment: steer to match the average velocity direction of nearby agents (boids rule).
 *
 * @param neighborVelocities - Velocities of nearby agents (excluding self).
 */
export function alignment(neighborVelocities: Vec2Like[], speed: number): Vec2Like {
  if (neighborVelocities.length === 0) return { x: 0, y: 0 }
  let ax = 0
  let ay = 0
  for (const v of neighborVelocities) {
    ax += v.x
    ay += v.y
  }
  return normalize({ x: ax, y: ay }, speed)
}
