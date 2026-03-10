import type { Component, EntityId } from '@cubeforge/core'

export type JointType = 'distance' | 'spring' | 'revolute' | 'rope' | 'fixed' | 'prismatic' | 'weld' | 'generic'

export type MotorMode = 'velocity' | 'position'

export interface JointMotor {
  /** Motor mode: target velocity or target position/angle */
  mode: MotorMode
  /** Target value (velocity in units/s or position/angle) */
  target: number
  /** PD controller stiffness (position mode) or direct drive factor (velocity mode) */
  stiffness: number
  /** PD controller damping */
  damping: number
  /** Maximum impulse the motor can apply per step. 0 = unlimited */
  maxForce: number
}

/**
 * Axis lock for generic joints.
 * - 'free': no constraint on this axis
 * - 'locked': fully constrained (no relative movement)
 * - 'limited': constrained within min/max range
 */
export type AxisLock = 'free' | 'locked' | 'limited'

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
  /** Whether this joint is enabled. Disabled joints are skipped in solver */
  enabled: boolean
  /** Whether colliders on joined bodies generate contacts with each other */
  contactsEnabled: boolean
  /** Arbitrary user data */
  userData: unknown

  // ── Limits ────────────────────────────────────────────────────────────

  /** Minimum angle for revolute joint limits (radians). null = no limit */
  minAngle: number | null
  /** Maximum angle for revolute joint limits (radians). null = no limit */
  maxAngle: number | null
  /** Minimum distance for prismatic joint limits. null = no limit */
  minDistance: number | null
  /** Maximum distance for prismatic joint limits. null = no limit */
  maxDistance: number | null

  // ── Motor ─────────────────────────────────────────────────────────────

  /** Motor configuration. null = no motor */
  motor: JointMotor | null

  // ── Breaking ──────────────────────────────────────────────────────────

  /** Break force threshold. If constraint impulse exceeds this, the joint breaks. 0 = unbreakable */
  breakForce: number
  /** Whether this joint has been broken (set by physics system) */
  broken: boolean

  // ── Prismatic axis ────────────────────────────────────────────────────

  /** Local axis direction for prismatic joints (normalized) */
  localAxisA: { x: number; y: number }

  // ── Generic joint axis locks ──────────────────────────────────────────

  /** X translation lock (generic joint) */
  axisLockX: AxisLock
  /** Y translation lock (generic joint) */
  axisLockY: AxisLock
  /** Rotation lock (generic joint) */
  axisLockRotation: AxisLock

  // ── Accumulated impulse for warm starting / break detection ───────────

  /** Accumulated constraint impulse magnitude (set by solver, used for break detection) */
  _accumulatedImpulse: number
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
  enabled?: boolean
  contactsEnabled?: boolean
  userData?: unknown
  minAngle?: number | null
  maxAngle?: number | null
  minDistance?: number | null
  maxDistance?: number | null
  motor?: JointMotor | null
  breakForce?: number
  localAxisA?: { x: number; y: number }
  axisLockX?: AxisLock
  axisLockY?: AxisLock
  axisLockRotation?: AxisLock
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
    enabled: opts.enabled ?? true,
    contactsEnabled: opts.contactsEnabled ?? true,
    userData: opts.userData ?? null,
    minAngle: opts.minAngle ?? null,
    maxAngle: opts.maxAngle ?? null,
    minDistance: opts.minDistance ?? null,
    maxDistance: opts.maxDistance ?? null,
    motor: opts.motor ?? null,
    breakForce: opts.breakForce ?? 0,
    broken: false,
    localAxisA: opts.localAxisA ?? { x: 1, y: 0 },
    axisLockX: opts.axisLockX ?? 'free',
    axisLockY: opts.axisLockY ?? 'free',
    axisLockRotation: opts.axisLockRotation ?? 'free',
    _accumulatedImpulse: 0,
  }
}
