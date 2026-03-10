import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

export interface ConvexPolygonColliderComponent extends Component {
  readonly type: 'ConvexPolygonCollider'
  /** Vertices in CCW order, max 8 for performance. Positions relative to entity center. */
  vertices: { x: number; y: number }[]
  offsetX: number
  offsetY: number
  isTrigger: boolean
  layer: string
  mask: string | string[]
  friction: number
  restitution: number
  frictionCombineRule: CombineRule
  restitutionCombineRule: CombineRule
  enabled: boolean
}

export function createConvexPolygonCollider(
  vertices: { x: number; y: number }[],
  opts?: Partial<ConvexPolygonColliderComponent>,
): ConvexPolygonColliderComponent {
  return {
    type: 'ConvexPolygonCollider',
    vertices: [...vertices],
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
    ...opts,
  }
}
