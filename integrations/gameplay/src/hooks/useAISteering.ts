import { useCallback } from 'react'
import { seek, flee, arrive, patrol, wander } from '@cubeforge/core'
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

  return { seek: seek$, flee: flee$, arrive: arrive$, patrol: patrol$, wander: wander$ }
}
