import type { Component } from '@cubeforge/core'

export interface RigidBodyComponent extends Component {
  readonly type: 'RigidBody'
  vx: number
  vy: number
  /** Explicit mass override. If <= 0, mass is auto-computed from collider density × area */
  mass: number
  gravityScale: number
  /** Static bodies do not move but participate in collision response */
  isStatic: boolean
  /** Set to true by physics system when entity rests on solid ground */
  onGround: boolean
  /**
   * Set to true when entity is within ~2px of solid ground even if not strictly touching.
   * Useful for implementing coyote time without manual tracking.
   */
  isNearGround: boolean
  /** @deprecated Use restitution on BoxCollider instead. Kept for backward compat */
  bounce: number
  /** @deprecated Use friction on BoxCollider instead. Kept for backward compat */
  friction: number
  /** Lock horizontal velocity — entity cannot move along X */
  lockX: boolean
  /** Lock vertical velocity — entity cannot move along Y */
  lockY: boolean
  /** Lock rotation — angular velocity is always 0 (invInertia = 0 in solver) */
  lockRotation: boolean
  /**
   * Kinematic bodies skip gravity and velocity integration.
   * They resolve collisions but don't respond to impulses.
   */
  isKinematic: boolean
  /**
   * Drop-through counter: when > 0, the physics step skips one-way platform
   * blocking for this entity. Decremented by 1 each fixed step.
   */
  dropThrough: number
  /** Enable continuous collision detection to prevent tunneling */
  ccd: boolean
  /** Angular velocity in radians per second */
  angularVelocity: number
  /** Angular damping (0–1): fraction of angular velocity removed each fixed step */
  angularDamping: number
  /** Linear damping (0–1): velocity reduction factor applied every fixed step */
  linearDamping: number
  /** Whether this body is sleeping (skipped in physics) */
  sleeping: boolean
  /** Accumulator: how long velocity has been below threshold */
  sleepTimer: number
  /** Velocity threshold below which sleep timer increments */
  sleepThreshold: number
  /** Time in seconds body must be still before sleeping */
  sleepDelay: number
  /** Density for mass computation (mass = density × collider area). Default 1.0 */
  density: number
  /** Cached inverse mass (0 for static/kinematic). Set by physics system */
  invMass: number
  /** Cached inverse moment of inertia. Set by physics system */
  invInertia: number
  /** Moment of inertia. Set by physics system */
  inertia: number
  /** Accumulated force X (cleared each step) */
  forceX: number
  /** Accumulated force Y (cleared each step) */
  forceY: number
  /** Accumulated torque (cleared each step) */
  torque: number
  /** Coefficient of restitution (0 = no bounce, 1 = full bounce) */
  restitution: number
  /** Dominance group (-127 to 127). Higher dominance acts as infinite mass in contacts */
  dominance: number
  /** Whether this body is enabled. Disabled bodies are completely skipped */
  enabled: boolean
  /** Max linear velocity magnitude. 0 = unlimited */
  maxLinearVelocity: number
  /** Max angular velocity magnitude. 0 = unlimited */
  maxAngularVelocity: number
  /** Arbitrary user data */
  userData: unknown
  /** Extra velocity solver iterations for constraints involving this body. Default 0 */
  additionalSolverIterations: number
  /**
   * Kinematic position target (X). When set (!== null), the physics system
   * computes velocity from position delta: vx = (nextX - x) / dt
   * Cleared after each step.
   */
  _nextKinematicX: number | null
  /**
   * Kinematic position target (Y). When set (!== null), the physics system
   * computes velocity from position delta: vy = (nextY - y) / dt
   * Cleared after each step.
   */
  _nextKinematicY: number | null
  /**
   * Kinematic rotation target. When set (!== null), the physics system
   * computes angular velocity from rotation delta: ω = (nextRot - rot) / dt
   * Cleared after each step.
   */
  _nextKinematicRotation: number | null
  /**
   * Active collision types — flags controlling which body-type pairs generate contacts.
   * Bit 0: dynamic-dynamic (default on)
   * Bit 1: dynamic-kinematic (default on)
   * Bit 2: dynamic-static (default on)
   * Bit 3: kinematic-kinematic (default off)
   * Bit 4: kinematic-static (default off)
   */
  activeCollisionTypes: number
  /** Whether mass properties need recomputing (internal) */
  _massPropertiesDirty: boolean
}

export function createRigidBody(opts?: Partial<RigidBodyComponent>): RigidBodyComponent {
  return {
    type: 'RigidBody',
    vx: 0,
    vy: 0,
    mass: 0, // 0 = auto-compute from density
    gravityScale: 1,
    isStatic: false,
    onGround: false,
    isNearGround: false,
    bounce: 0,
    friction: 0.85,
    lockX: false,
    lockY: false,
    lockRotation: true,
    isKinematic: false,
    dropThrough: 0,
    ccd: false,
    angularVelocity: 0,
    angularDamping: 0,
    linearDamping: 0,
    sleeping: false,
    sleepTimer: 0,
    sleepThreshold: 0,
    sleepDelay: 0,
    density: 1,
    invMass: 0,
    invInertia: 0,
    inertia: 0,
    forceX: 0,
    forceY: 0,
    torque: 0,
    restitution: 0,
    dominance: 0,
    enabled: true,
    maxLinearVelocity: 0,
    maxAngularVelocity: 0,
    userData: null,
    additionalSolverIterations: 0,
    _nextKinematicX: null,
    _nextKinematicY: null,
    _nextKinematicRotation: null,
    activeCollisionTypes: 0b00111, // dynamic-dynamic | dynamic-kinematic | dynamic-static
    _massPropertiesDirty: true,
    ...opts,
  }
}
