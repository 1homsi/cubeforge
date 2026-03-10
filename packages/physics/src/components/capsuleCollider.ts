import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

/**
 * Capsule (pill) shaped collider — two circles connected by a rectangle.
 * The collision shape is `width` wide and `height` tall.
 * Capsules fire contact events like `circleEnter/circleStay/circleExit`.
 */
export interface CapsuleColliderComponent extends Component {
  readonly type: 'CapsuleCollider'
  width: number
  height: number
  offsetX: number
  offsetY: number
  isTrigger: boolean
  layer: string
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
  /** Collision group — entities in the same non-empty group do NOT collide with each other */
  group: string
}

export function createCapsuleCollider(
  width: number,
  height: number,
  opts?: Partial<CapsuleColliderComponent>,
): CapsuleColliderComponent {
  return {
    type: 'CapsuleCollider',
    width,
    height,
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
