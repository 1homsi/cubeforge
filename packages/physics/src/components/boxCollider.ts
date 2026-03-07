import type { Component } from '@cubeforge/core'

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
   * Both sides must allow the interaction (AND semantics).
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
    ...opts,
  }
}
