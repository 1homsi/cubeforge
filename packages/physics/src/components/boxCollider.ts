import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

export interface BoxColliderComponent extends Component {
  readonly type: 'BoxCollider'
  width: number
  height: number
  /** Offset from entity transform center */
  offsetX: number
  offsetY: number
  /** Triggers fire contact events but do not physically block movement */
  isTrigger: boolean
  /** Collision layer — which layer this collider belongs to */
  layer: string
  /**
   * Collision mask — which layers this collider interacts with.
   * `'*'` (default) interacts with everything.
   * Pass an array of layer names to restrict interactions.
   */
  mask: string | string[]
  /**
   * Slope angle in degrees. 0 = flat box. Positive = surface rises left→right.
   * The sloped surface is the top face; collision pushes entities up along the slope.
   */
  slope: number
  /**
   * One-way platform: only blocks dynamic entities that are falling onto the
   * top surface. Entities below the platform pass through freely.
   */
  oneWay: boolean
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

export function createBoxCollider(
  width: number,
  height: number,
  opts?: Partial<BoxColliderComponent>,
): BoxColliderComponent {
  return {
    type: 'BoxCollider',
    width,
    height,
    offsetX: 0,
    offsetY: 0,
    isTrigger: false,
    layer: 'default',
    mask: '*',
    slope: 0,
    oneWay: false,
    friction: 0.5,
    restitution: 0,
    frictionCombineRule: 'average',
    restitutionCombineRule: 'average',
    enabled: true,
    group: '',
    ...opts,
  }
}
