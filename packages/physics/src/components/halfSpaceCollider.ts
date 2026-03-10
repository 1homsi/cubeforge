import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

/**
 * Half-space (infinite plane) collider — defined by an outward-facing normal
 * passing through the entity's transform position.
 *
 * Always treated as a static shape. Useful for floors, walls, or ceilings
 * that extend infinitely.
 */
export interface HalfSpaceColliderComponent extends Component {
  readonly type: 'HalfSpaceCollider'
  /** X component of the outward-facing normal. Default 0 */
  normalX: number
  /** Y component of the outward-facing normal. Default -1 (pointing up) */
  normalY: number
  layer: string
  mask: string | string[]
  friction: number
  restitution: number
  frictionCombineRule: CombineRule
  restitutionCombineRule: CombineRule
  enabled: boolean
  /** Collision group — entities in the same non-empty group do NOT collide with each other */
  group: string
}

export function createHalfSpaceCollider(opts?: Partial<HalfSpaceColliderComponent>): HalfSpaceColliderComponent {
  return {
    type: 'HalfSpaceCollider',
    normalX: 0,
    normalY: -1,
    layer: 'default',
    mask: '*',
    friction: 0.5,
    restitution: 0,
    frictionCombineRule: 'average',
    restitutionCombineRule: 'average',
    enabled: true,
    group: '',
    ...opts,
  }
}
