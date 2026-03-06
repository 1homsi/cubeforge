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
    ...opts,
  }
}
