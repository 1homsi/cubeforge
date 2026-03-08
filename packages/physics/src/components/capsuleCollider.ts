import type { Component } from '@cubeforge/core'

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
    ...opts,
  }
}
