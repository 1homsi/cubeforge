import type { Component } from '@cubeforge/core'

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
    ...opts,
  }
}
