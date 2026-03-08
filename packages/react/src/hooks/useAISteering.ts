import { useCallback } from 'react'
import { seek, flee, arrive, patrol, wander } from '@cubeforge/core'
import type { Vec2Like } from '@cubeforge/core'

export interface AISteering {
  /** Move toward `target` at full `speed`. Returns a velocity vector. */
  seek(pos: Vec2Like, target: Vec2Like, speed: number): Vec2Like
  /** Move away from `threat` at full `speed`. Returns a velocity vector. */
  flee(pos: Vec2Like, threat: Vec2Like, speed: number): Vec2Like
  /**
   * Move toward `target`, slowing down within `slowRadius` of it.
   * Returns a velocity vector.
   */
  arrive(pos: Vec2Like, target: Vec2Like, speed: number, slowRadius: number): Vec2Like
  /**
   * Move toward the current waypoint and advance to the next when close enough.
   * Returns `{ vel, nextIdx }`.
   */
  patrol(
    pos: Vec2Like,
    waypoints: Vec2Like[],
    speed: number,
    currentIdx: number,
    arriveThreshold?: number,
  ): { vel: Vec2Like; nextIdx: number }
  /**
   * Random steering with smooth angular drift.
   * Returns `{ vel, newAngle }` — store `newAngle` and pass it back next frame.
   */
  wander(
    pos: Vec2Like,
    angle: number,
    speed: number,
    jitter: number,
  ): { vel: Vec2Like; newAngle: number }
}

/**
 * Returns stable references to all autonomous steering behavior functions.
 * No internal state — all behaviors are pure functions.
 *
 * @example
 * ```tsx
 * function Enemy() {
 *   const ai = useAISteering()
 *   const wanderAngleRef = useRef(0)
 *   return (
 *     <Script update={(id, world, _input, dt) => {
 *       const t = world.getComponent(id, 'Transform')!
 *       const { vel, newAngle } = ai.wander(t, wanderAngleRef.current, 80, 0.3)
 *       wanderAngleRef.current = newAngle
 *       t.x += vel.x * dt
 *       t.y += vel.y * dt
 *     }} />
 *   )
 * }
 * ```
 */
export function useAISteering(): AISteering {
  const seek$ = useCallback(
    (pos: Vec2Like, target: Vec2Like, speed: number) => seek(pos, target, speed),
    [],
  )
  const flee$ = useCallback(
    (pos: Vec2Like, threat: Vec2Like, speed: number) => flee(pos, threat, speed),
    [],
  )
  const arrive$ = useCallback(
    (pos: Vec2Like, target: Vec2Like, speed: number, slowRadius: number) =>
      arrive(pos, target, speed, slowRadius),
    [],
  )
  const patrol$ = useCallback(
    (
      pos: Vec2Like,
      waypoints: Vec2Like[],
      speed: number,
      currentIdx: number,
      arriveThreshold?: number,
    ) => patrol(pos, waypoints, speed, currentIdx, arriveThreshold),
    [],
  )
  const wander$ = useCallback(
    (pos: Vec2Like, angle: number, speed: number, jitter: number) =>
      wander(pos, angle, speed, jitter),
    [],
  )

  return { seek: seek$, flee: flee$, arrive: arrive$, patrol: patrol$, wander: wander$ }
}
