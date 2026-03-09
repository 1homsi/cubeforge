import type { Component } from '@cubeforge/core'

export interface RigidBodyComponent extends Component {
  readonly type: 'RigidBody'
  vx: number
  vy: number
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
  /** Coefficient of restitution (0 = no bounce, 1 = full bounce) */
  bounce: number
  /** Horizontal friction multiplier applied when on ground (0–1) */
  friction: number
  /** Lock horizontal velocity — entity cannot move along X (useful for fixed-column runners) */
  lockX: boolean
  /** Lock vertical velocity — entity cannot move along Y */
  lockY: boolean
  /**
   * Kinematic bodies skip gravity and velocity integration.
   * They resolve collisions but don't respond to impulses.
   * Use `useKinematicBody` to move them.
   */
  isKinematic: boolean
  /**
   * Drop-through counter: when > 0, the physics step skips one-way platform
   * blocking for this entity. Decremented by 1 each fixed step.
   * Set via `useDropThrough`.
   */
  dropThrough: number
  /**
   * Enable continuous collision detection (CCD) for this body.
   * When true, a swept AABB test is performed after velocity integration
   * to prevent fast-moving bodies from tunneling through thin colliders.
   * Only activates when the body moves more than half its collider width
   * in a single step (automatic optimization).
   */
  ccd: boolean
  /** Angular velocity in radians per second */
  angularVelocity: number
  /** Angular damping (0–1): fraction of angular velocity removed each fixed step */
  angularDamping: number
  /** Linear damping (0–1): velocity reduction factor applied every fixed step (air resistance) */
  linearDamping: number
  /** Whether this body is sleeping (skipped in physics) */
  sleeping: boolean
  /** Accumulator: how long velocity has been below threshold */
  sleepTimer: number
  /** Velocity threshold below which sleep timer increments */
  sleepThreshold: number
  /** Time in seconds body must be still before sleeping */
  sleepDelay: number
}

export function createRigidBody(opts?: Partial<RigidBodyComponent>): RigidBodyComponent {
  return {
    type: 'RigidBody',
    vx: 0,
    vy: 0,
    mass: 1,
    gravityScale: 1,
    isStatic: false,
    onGround: false,
    isNearGround: false,
    bounce: 0,
    friction: 0.85,
    lockX: false,
    lockY: false,
    isKinematic: false,
    dropThrough: 0,
    ccd: false,
    angularVelocity: 0,
    angularDamping: 0,
    linearDamping: 0,
    sleeping: false,
    sleepTimer: 0,
    sleepThreshold: 5,
    sleepDelay: 1,
    ...opts,
  }
}
