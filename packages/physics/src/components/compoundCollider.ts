import type { Component } from '@cubeforge/core'

export interface ColliderShape {
  type: 'box' | 'circle'
  offsetX: number
  offsetY: number
  // box-specific
  width?: number
  height?: number
  // circle-specific
  radius?: number
}

export interface CompoundColliderComponent extends Component {
  readonly type: 'CompoundCollider'
  shapes: ColliderShape[]
  isTrigger: boolean
  layer: string
  mask: string | string[]
  /**
   * Collision group — entities in the same non-empty group do NOT collide
   * with each other. Useful for parts of the same character, linked chains, etc.
   */
  group: string
}

export function createCompoundCollider(
  shapes: ColliderShape[],
  opts?: Partial<Omit<CompoundColliderComponent, 'type' | 'shapes'>>,
): CompoundColliderComponent {
  return {
    type: 'CompoundCollider',
    shapes,
    isTrigger: false,
    layer: 'default',
    mask: '*',
    group: '',
    ...opts,
  }
}
