import { useCallback } from 'react'
import { seek, flee, arrive, patrol, wander, pursuit, evade, separation, cohesion, alignment } from '@cubeforge/core'
import type { Vec2Like } from '@cubeforge/core'

export interface AISteering {
  seek(pos: Vec2Like, target: Vec2Like, speed: number): Vec2Like
  flee(pos: Vec2Like, threat: Vec2Like, speed: number): Vec2Like
  arrive(pos: Vec2Like, target: Vec2Like, speed: number, slowRadius: number): Vec2Like
  patrol(
    pos: Vec2Like,
    waypoints: Vec2Like[],
    speed: number,
    currentIdx: number,
    arriveThreshold?: number,
  ): { vel: Vec2Like; nextIdx: number }
  wander(pos: Vec2Like, angle: number, speed: number, jitter: number): { vel: Vec2Like; newAngle: number }
  /** Seek a moving target by predicting its future position. */
  pursuit(pos: Vec2Like, targetPos: Vec2Like, targetVel: Vec2Like, speed: number, lookAhead?: number): Vec2Like
  /** Flee from a moving threat by predicting its future position. */
  evade(pos: Vec2Like, threatPos: Vec2Like, threatVel: Vec2Like, speed: number, lookAhead?: number): Vec2Like
  /** Push away from nearby agents (boids separation rule). */
  separation(pos: Vec2Like, neighbors: Vec2Like[], speed: number, radius: number): Vec2Like
  /** Steer toward the center of nearby agents (boids cohesion rule). */
  cohesion(pos: Vec2Like, neighbors: Vec2Like[], speed: number): Vec2Like
  /** Match the average velocity direction of nearby agents (boids alignment rule). */
  alignment(neighborVelocities: Vec2Like[], speed: number): Vec2Like
}

export function useAISteering(): AISteering {
  const seek$ = useCallback((pos: Vec2Like, target: Vec2Like, speed: number) => seek(pos, target, speed), [])
  const flee$ = useCallback((pos: Vec2Like, threat: Vec2Like, speed: number) => flee(pos, threat, speed), [])
  const arrive$ = useCallback(
    (pos: Vec2Like, target: Vec2Like, speed: number, slowRadius: number) => arrive(pos, target, speed, slowRadius),
    [],
  )
  const patrol$ = useCallback(
    (pos: Vec2Like, waypoints: Vec2Like[], speed: number, currentIdx: number, arriveThreshold?: number) =>
      patrol(pos, waypoints, speed, currentIdx, arriveThreshold),
    [],
  )
  const wander$ = useCallback(
    (pos: Vec2Like, angle: number, speed: number, jitter: number) => wander(pos, angle, speed, jitter),
    [],
  )
  const pursuit$ = useCallback(
    (pos: Vec2Like, targetPos: Vec2Like, targetVel: Vec2Like, speed: number, lookAhead?: number) =>
      pursuit(pos, targetPos, targetVel, speed, lookAhead),
    [],
  )
  const evade$ = useCallback(
    (pos: Vec2Like, threatPos: Vec2Like, threatVel: Vec2Like, speed: number, lookAhead?: number) =>
      evade(pos, threatPos, threatVel, speed, lookAhead),
    [],
  )
  const separation$ = useCallback(
    (pos: Vec2Like, neighbors: Vec2Like[], speed: number, radius: number) =>
      separation(pos, neighbors, speed, radius),
    [],
  )
  const cohesion$ = useCallback(
    (pos: Vec2Like, neighbors: Vec2Like[], speed: number) => cohesion(pos, neighbors, speed),
    [],
  )
  const alignment$ = useCallback(
    (neighborVelocities: Vec2Like[], speed: number) => alignment(neighborVelocities, speed),
    [],
  )

  return {
    seek: seek$,
    flee: flee$,
    arrive: arrive$,
    patrol: patrol$,
    wander: wander$,
    pursuit: pursuit$,
    evade: evade$,
    separation: separation$,
    cohesion: cohesion$,
    alignment: alignment$,
  }
}
