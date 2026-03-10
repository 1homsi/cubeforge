import type { Component } from '@cubeforge/core'
import type { CombineRule } from '../combineRules'

/**
 * Line segment collider — a thin edge between two points.
 * Useful for terrain edges, walls, and one-way platforms.
 */
export interface SegmentColliderComponent extends Component {
  readonly type: 'SegmentCollider'
  /** Start point, relative to entity center */
  start: { x: number; y: number }
  /** End point, relative to entity center */
  end: { x: number; y: number }
  offsetX: number
  offsetY: number
  isTrigger: boolean
  /**
   * One-way edge: only blocks dynamic entities approaching from the
   * normal side (left-hand normal of start→end). Entities on the
   * back side pass through freely.
   */
  oneWay: boolean
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

export function createSegmentCollider(
  start: { x: number; y: number },
  end: { x: number; y: number },
  opts?: Partial<SegmentColliderComponent>,
): SegmentColliderComponent {
  return {
    type: 'SegmentCollider',
    start: { ...start },
    end: { ...end },
    offsetX: 0,
    offsetY: 0,
    isTrigger: false,
    oneWay: false,
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
