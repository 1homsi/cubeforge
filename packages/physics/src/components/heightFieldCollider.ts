import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

/**
 * Height-field collider — a strip of terrain defined by a 1D array of heights.
 *
 * The heights array defines evenly-spaced columns. The total width of the
 * terrain strip is `(heights.length - 1) * scaleX`, and each height value
 * is multiplied by `scaleY`. Always treated as a static shape.
 */
export interface HeightFieldColliderComponent extends Component {
  readonly type: 'HeightFieldCollider'
  /** Height samples, evenly spaced along the X axis */
  heights: number[]
  /** Horizontal distance between adjacent height samples. Default 1 */
  scaleX: number
  /** Vertical multiplier applied to each height value. Default 1 */
  scaleY: number
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

export function createHeightFieldCollider(
  heights: number[],
  opts?: Partial<HeightFieldColliderComponent>,
): HeightFieldColliderComponent {
  return {
    type: 'HeightFieldCollider',
    heights: [...heights],
    scaleX: 1,
    scaleY: 1,
    layer: 'default',
    mask: '*',
    friction: 0,
    restitution: 0,
    frictionCombineRule: 'average',
    restitutionCombineRule: 'average',
    enabled: true,
    group: '',
    ...opts,
  }
}
