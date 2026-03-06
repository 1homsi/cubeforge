import type { Component } from '@cubeforge/core'

export interface BoxColliderComponent extends Component {
  readonly type: 'BoxCollider'
  width: number
  height: number
  /** Offset from entity transform center */
  offsetX: number
  offsetY: number
  /** Triggers fire collision events but do not physically block movement */
  isTrigger: boolean
  /** Collision layer tag — used to filter which entities collide */
  layer: string
  /**
   * Slope angle in degrees. 0 = flat box. Positive = surface rises left→right.
   * The sloped surface is the top face; collision pushes entities up along the slope.
   */
  slope: number
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
    slope: 0,
    ...opts,
  }
}
