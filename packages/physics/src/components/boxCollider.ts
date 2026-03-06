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
    ...opts,
  }
}
