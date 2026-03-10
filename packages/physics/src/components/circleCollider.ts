import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

export interface CircleColliderComponent extends Component {
  readonly type: 'CircleCollider'
  radius: number
  /** Offset from entity transform center */
  offsetX: number
  offsetY: number
  /** Triggers fire contact events but do not physically block movement */
  isTrigger: boolean
  /** Collision layer */
  layer: string
  /** Collision mask — '*' interacts with everything */
  mask: string | string[]
  /** Per-collider friction coefficient (0–1). Default 0.5 */
  friction: number
  /** Per-collider restitution (bounciness) coefficient (0–1). Default 0.0 */
  restitution: number
  /** How to combine friction with the other collider. Default 'average' */
  frictionCombineRule: CombineRule
  /** How to combine restitution with the other collider. Default 'average' */
  restitutionCombineRule: CombineRule
  /** Whether this collider is enabled. Disabled colliders skip all detection */
  enabled: boolean
  /**
   * Collision group — entities in the same non-empty group do NOT collide
   * with each other. Useful for parts of the same character, linked chains, etc.
   */
  group: string
}

export function createCircleCollider(radius: number, opts?: Partial<CircleColliderComponent>): CircleColliderComponent {
  return {
    type: 'CircleCollider',
    radius,
    offsetX: 0,
    offsetY: 0,
    isTrigger: false,
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
