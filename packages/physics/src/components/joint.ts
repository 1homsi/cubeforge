import type { Component, EntityId } from '@cubeforge/core'

export type JointType = 'distance' | 'spring' | 'revolute' | 'rope'

export interface JointComponent extends Component {
  readonly type: 'Joint'
  jointType: JointType
  /** Entity A (owner of this component) */
  entityA: EntityId
  /** Entity B (connected entity) */
  entityB: EntityId
  /** Anchor point on entity A (local offset) */
  anchorA: { x: number; y: number }
  /** Anchor point on entity B (local offset) */
  anchorB: { x: number; y: number }
  /** Rest length (for distance/spring joints) */
  length: number
  /** Spring stiffness (for spring joints) */
  stiffness: number
  /** Damping ratio (for spring joints) */
  damping: number
  /** Maximum length (for rope joints) */
  maxLength?: number
  /** Whether joint limits rotation */
  enableRotation: boolean
}

export function createJoint(opts: {
  jointType: JointType
  entityA: EntityId
  entityB: EntityId
  anchorA?: { x: number; y: number }
  anchorB?: { x: number; y: number }
  length?: number
  stiffness?: number
  damping?: number
  maxLength?: number
  enableRotation?: boolean
}): JointComponent {
  return {
    type: 'Joint',
    jointType: opts.jointType,
    entityA: opts.entityA,
    entityB: opts.entityB,
    anchorA: opts.anchorA ?? { x: 0, y: 0 },
    anchorB: opts.anchorB ?? { x: 0, y: 0 },
    length: opts.length ?? 100,
    stiffness: opts.stiffness ?? 0.5,
    damping: opts.damping ?? 0.3,
    maxLength: opts.maxLength,
    enableRotation: opts.enableRotation ?? true,
  }
}
