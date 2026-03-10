import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

/**
 * Triangle-mesh collider — an arbitrary concave shape defined by vertices
 * and triangle indices.
 *
 * Always treated as a static shape. For dynamic bodies use convex
 * decomposition or compound colliders instead.
 */
export interface TriMeshColliderComponent extends Component {
  readonly type: 'TriMeshCollider'
  /** Mesh vertices, positions relative to entity center */
  vertices: { x: number; y: number }[]
  /** Triangle indices — each consecutive triplet indexes into vertices */
  indices: number[]
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

export function createTriMeshCollider(
  vertices: { x: number; y: number }[],
  indices: number[],
  opts?: Partial<TriMeshColliderComponent>,
): TriMeshColliderComponent {
  return {
    type: 'TriMeshCollider',
    vertices: vertices.map((v) => ({ ...v })),
    indices: [...indices],
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
