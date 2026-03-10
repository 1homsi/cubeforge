import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

export interface TriangleColliderComponent extends Component {
  readonly type: 'TriangleCollider'
  /** First vertex, relative to entity center */
  a: { x: number; y: number }
  /** Second vertex, relative to entity center */
  b: { x: number; y: number }
  /** Third vertex, relative to entity center */
  c: { x: number; y: number }
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
  /** Collision group — entities in the same non-empty group do NOT collide with each other */
  group: string
}

export function createTriangleCollider(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  opts?: Partial<TriangleColliderComponent>,
): TriangleColliderComponent {
  return {
    type: 'TriangleCollider',
    a: { ...a },
    b: { ...b },
    c: { ...c },
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
