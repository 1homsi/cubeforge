/**
 * Reduced-coordinate articulated body solver (Featherstone's algorithm) for 2D.
 *
 * Implements the Articulated Body Algorithm (ABA) for chains and trees of
 * rigid bodies connected by revolute, prismatic, or fixed joints. Uses
 * simplified 2D spatial algebra: 3-component vectors [vx, vy, omega] for
 * motion and [fx, fy, torque] for force, rather than the full 6D spatial
 * vectors used in 3D.
 *
 * References:
 * - Roy Featherstone, "Rigid Body Dynamics Algorithms", Springer 2008
 * - Rapier's multibody_joint module
 */

import type { EntityId } from '@cubeforge/core'

// ── 2D Spatial Algebra ────────────────────────────────────────────────────────
//
// In 2D, spatial vectors reduce from 6D to 3D:
//   motion vector: [vx, vy, omega]   (linear velocity + angular velocity)
//   force  vector: [fx, fy, torque]   (linear force  + torque)
//
// Spatial inertia in 2D is a 3x3 symmetric matrix.

/** A 2D spatial vector: [vx, vy, omega] or [fx, fy, torque]. */
export type Spatial3 = [number, number, number]

/**
 * 3x3 symmetric matrix representing a 2D spatial inertia.
 * Stored as 6 unique elements in row-major upper-triangle order:
 *   [ m00  m01  m02 ]
 *   [ m01  m11  m12 ]
 *   [ m02  m12  m22 ]
 */
export interface SpatialInertia3 {
  m00: number
  m01: number
  m02: number
  m11: number
  m12: number
  m22: number
}

// ── Spatial algebra helpers ───────────────────────────────────────────────────

function spatialZero(): Spatial3 {
  return [0, 0, 0]
}

function spatialAdd(a: Spatial3, b: Spatial3): Spatial3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** Subtract two spatial vectors. */
export function spatialSub(a: Spatial3, b: Spatial3): Spatial3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function spatialScale(s: number, v: Spatial3): Spatial3 {
  return [s * v[0], s * v[1], s * v[2]]
}

function spatialDot(a: Spatial3, b: Spatial3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function inertiaZero(): SpatialInertia3 {
  return { m00: 0, m01: 0, m02: 0, m11: 0, m12: 0, m22: 0 }
}

/** Multiply spatial inertia matrix by spatial vector. */
function inertiaMulVec(I: SpatialInertia3, v: Spatial3): Spatial3 {
  return [
    I.m00 * v[0] + I.m01 * v[1] + I.m02 * v[2],
    I.m01 * v[0] + I.m11 * v[1] + I.m12 * v[2],
    I.m02 * v[0] + I.m12 * v[1] + I.m22 * v[2],
  ]
}

/** Add two spatial inertia matrices. */
function inertiaAdd(A: SpatialInertia3, B: SpatialInertia3): SpatialInertia3 {
  return {
    m00: A.m00 + B.m00,
    m01: A.m01 + B.m01,
    m02: A.m02 + B.m02,
    m11: A.m11 + B.m11,
    m12: A.m12 + B.m12,
    m22: A.m22 + B.m22,
  }
}

/**
 * Build a rigid-body spatial inertia for a 2D body.
 *
 * For a body at the origin with mass m and rotational inertia I_rot:
 *   [ m  0   0     ]
 *   [ 0  m   0     ]
 *   [ 0  0   I_rot ]
 */
function inertiaDiag(mass: number, rotInertia: number): SpatialInertia3 {
  return { m00: mass, m01: 0, m02: 0, m11: mass, m12: 0, m22: rotInertia }
}

/**
 * Compute I - (I * s * s^T * I) / (s^T * I * s + extra).
 *
 * This is the articulated-body inertia update when projecting out the
 * joint DOF direction `s`. The `extra` term is 0 for rigid joints.
 */
function inertiaProjectOut(I: SpatialInertia3, s: Spatial3): SpatialInertia3 {
  const Is = inertiaMulVec(I, s)
  const sIs = spatialDot(s, Is)
  if (Math.abs(sIs) < 1e-12) return { ...I }
  const inv = 1 / sIs
  return {
    m00: I.m00 - Is[0] * Is[0] * inv,
    m01: I.m01 - Is[0] * Is[1] * inv,
    m02: I.m02 - Is[0] * Is[2] * inv,
    m11: I.m11 - Is[1] * Is[1] * inv,
    m12: I.m12 - Is[1] * Is[2] * inv,
    m22: I.m22 - Is[2] * Is[2] * inv,
  }
}

/**
 * Spatial transform: translate a spatial inertia from the child frame to
 * the parent frame. In 2D, translating by (dx, dy) with rotation angle theta
 * modifies the inertia via the parallel-axis theorem equivalent for spatial
 * inertia.
 */
function inertiaTransform(
  I: SpatialInertia3,
  dx: number,
  dy: number,
  cosTheta: number,
  sinTheta: number,
): SpatialInertia3 {
  // Rotate I into parent frame: R * I * R^T
  // R = [cos -sin 0; sin cos 0; 0 0 1]
  const c = cosTheta
  const s = sinTheta
  // Rotate rows/cols 0,1 (linear part)
  const r00 = c * c * I.m00 - 2 * c * s * I.m01 + s * s * I.m11
  const r01 = c * s * (I.m00 - I.m11) + (c * c - s * s) * I.m01
  const r02 = c * I.m02 - s * I.m12
  const r11 = s * s * I.m00 + 2 * c * s * I.m01 + c * c * I.m11
  const r12 = s * I.m02 + c * I.m12
  const r22 = I.m22

  // Translate: parallel-axis theorem for spatial inertia
  // mass terms are unchanged; angular term gets m*(dx^2+dy^2) + cross terms
  const mass = r00 // m00 == m11 == mass after rotation for diagonal mass
  return {
    m00: r00,
    m01: r01,
    m02: r02 + mass * -dy, // coupling: m * (-dy)
    m11: r11,
    m12: r12 + mass * dx, // coupling: m * (dx)
    m22: r22 + mass * (dx * dx + dy * dy) + 2 * (dx * r12 - dy * r02),
  }
}

/**
 * Transform a spatial velocity from child frame to parent frame.
 * v_parent = R * v_child + [omega_parent x r] (for the linear part).
 *
 * In 2D for a child at offset (dx,dy) with rotation theta relative to parent:
 *   vx_parent = cos*vx_child - sin*vy_child - omega*dy
 *   vy_parent = sin*vx_child + cos*vy_child + omega*dx
 *   omega_parent = omega_child
 */
function transformVelocityToParent(v: Spatial3, dx: number, dy: number, cosTheta: number, sinTheta: number): Spatial3 {
  const omega = v[2]
  return [cosTheta * v[0] - sinTheta * v[1] - omega * dy, sinTheta * v[0] + cosTheta * v[1] + omega * dx, omega]
}

/**
 * Transform a spatial force from parent frame to child frame.
 * f_child = R^T * f_parent (for linear part)
 * tau_child = tau_parent + (dx * fy_parent - dy * fx_parent) (cross product contribution)
 */
function transformForceToChild(f: Spatial3, dx: number, dy: number, cosTheta: number, sinTheta: number): Spatial3 {
  return [cosTheta * f[0] + sinTheta * f[1], -sinTheta * f[0] + cosTheta * f[1], f[2] + dx * f[1] - dy * f[0]]
}

// ── Joint axis helpers ────────────────────────────────────────────────────────

/**
 * Get the joint motion subspace vector for a given joint type and parent-to-child
 * transform. In 2D:
 * - Revolute: s = [0, 0, 1] (pure rotation)
 * - Prismatic: s = [cos(axis_angle), sin(axis_angle), 0] (translation along local X)
 * - Fixed: no DOF (returns zero; handled specially)
 */
function jointMotionSubspace(
  jointType: 'revolute' | 'prismatic' | 'fixed',
  cosTheta: number,
  sinTheta: number,
): Spatial3 {
  switch (jointType) {
    case 'revolute':
      return [0, 0, 1]
    case 'prismatic':
      // Slide along the local X axis of the joint frame
      return [cosTheta, sinTheta, 0]
    case 'fixed':
      return [0, 0, 0]
  }
}

// ── MultibodyLink ─────────────────────────────────────────────────────────────

export interface MultibodyLink {
  /** The entity this link represents. */
  entityId: EntityId

  /** Index of parent link in the links array (-1 for root). */
  parentIndex: number

  /** Joint type connecting this link to its parent. */
  jointType: 'revolute' | 'prismatic' | 'fixed'

  /** Anchor point in parent's local frame. */
  localAnchorX: number
  localAnchorY: number

  /** Anchor point in this body's local frame. */
  localFrameX: number
  localFrameY: number

  /** Current joint position (angle for revolute, distance for prismatic). */
  jointAngle: number

  /** Current joint velocity. */
  jointVelocity: number

  /** Computed acceleration (output of forward dynamics). */
  jointAccel: number

  /** Applied joint force/torque (external input). */
  jointForce: number

  /** Joint limits. NaN means no limit. */
  jointMin: number
  jointMax: number

  /** Joint damping coefficient. */
  jointDamping: number

  /** Spring stiffness (0 = free joint). */
  jointStiffness: number

  /** Motor target position/velocity. */
  motorTarget: number

  /** Maximum motor force. */
  motorMaxForce: number

  /** Inverse mass of this body. */
  invMass: number

  /** Inverse rotational inertia of this body. */
  invInertia: number
}

// ── Internal per-link data used during ABA ────────────────────────────────────

interface LinkState {
  /** World-frame position of this link's origin. */
  worldX: number
  worldY: number
  /** Cumulative world rotation of this link. */
  worldAngle: number

  /** Spatial velocity of this link (in world frame). */
  velocity: Spatial3

  /** Bias acceleration (Coriolis + centrifugal). */
  c: Spatial3

  /** Articulated-body inertia. */
  Ia: SpatialInertia3

  /** Articulated bias force. */
  pa: Spatial3

  /** Joint axis in world frame. */
  S: Spatial3

  /** Scalar: S^T * Ia * S (effective inertia along joint DOF). */
  D: number

  /** Scalar: S^T * pa (effective bias along joint DOF). */
  u: number

  /** Parent-to-child offset in world frame. */
  dx: number
  dy: number
  cosTheta: number
  sinTheta: number
}

// ── MultibodyArticulation ─────────────────────────────────────────────────────

export class MultibodyArticulation {
  links: MultibodyLink[] = []
  /** Children list per link (computed from parentIndex). */
  private children: number[][] = []
  /** Per-link transient state for ABA passes. */
  private state: LinkState[] = []

  addLink(link: MultibodyLink): void {
    this.links.push(link)
    this.rebuildTopology()
  }

  // ── Topology ──────────────────────────────────────────────────────────────

  private rebuildTopology(): void {
    const n = this.links.length
    this.children = Array.from({ length: n }, () => [])
    for (let i = 0; i < n; i++) {
      const pi = this.links[i].parentIndex
      if (pi >= 0) {
        this.children[pi].push(i)
      }
    }
    // Ensure state array matches link count
    while (this.state.length < n) {
      this.state.push({
        worldX: 0,
        worldY: 0,
        worldAngle: 0,
        velocity: spatialZero(),
        c: spatialZero(),
        Ia: inertiaZero(),
        pa: spatialZero(),
        S: spatialZero(),
        D: 0,
        u: 0,
        dx: 0,
        dy: 0,
        cosTheta: 1,
        sinTheta: 0,
      })
    }
  }

  // ── Forward Kinematics (outward pass) ──────────────────────────────────────

  /**
   * Compute world positions and rotations for every link from joint angles.
   * Traverses from root outward (parent before child).
   */
  forwardKinematics(): void {
    const n = this.links.length
    for (let i = 0; i < n; i++) {
      const link = this.links[i]
      const st = this.state[i]

      if (link.parentIndex < 0) {
        // Root link: placed at its local frame position, joint angle is world rotation
        st.worldX = link.localFrameX
        st.worldY = link.localFrameY
        st.worldAngle = link.jointType === 'revolute' ? link.jointAngle : 0
        st.dx = 0
        st.dy = 0
        st.cosTheta = Math.cos(st.worldAngle)
        st.sinTheta = Math.sin(st.worldAngle)
      } else {
        const parent = this.state[link.parentIndex]

        // Compute anchor position in world frame
        const pCos = Math.cos(parent.worldAngle)
        const pSin = Math.sin(parent.worldAngle)
        const anchorWorldX = parent.worldX + pCos * link.localAnchorX - pSin * link.localAnchorY
        const anchorWorldY = parent.worldY + pSin * link.localAnchorX + pCos * link.localAnchorY

        if (link.jointType === 'revolute') {
          // Child rotates by jointAngle relative to parent
          st.worldAngle = parent.worldAngle + link.jointAngle
          const cCos = Math.cos(st.worldAngle)
          const cSin = Math.sin(st.worldAngle)
          // Child origin = anchor - rotated local frame offset
          st.worldX = anchorWorldX - cCos * link.localFrameX + cSin * link.localFrameY
          st.worldY = anchorWorldY - cSin * link.localFrameX - cCos * link.localFrameY
        } else if (link.jointType === 'prismatic') {
          // Slides along parent's local X axis by jointAngle (distance)
          st.worldAngle = parent.worldAngle
          const slideX = pCos * link.jointAngle
          const slideY = pSin * link.jointAngle
          const cCos = Math.cos(st.worldAngle)
          const cSin = Math.sin(st.worldAngle)
          st.worldX = anchorWorldX + slideX - cCos * link.localFrameX + cSin * link.localFrameY
          st.worldY = anchorWorldY + slideY - cSin * link.localFrameX - cCos * link.localFrameY
        } else {
          // Fixed: child is rigidly attached
          st.worldAngle = parent.worldAngle
          const cCos = Math.cos(st.worldAngle)
          const cSin = Math.sin(st.worldAngle)
          st.worldX = anchorWorldX - cCos * link.localFrameX + cSin * link.localFrameY
          st.worldY = anchorWorldY - cSin * link.localFrameX - cCos * link.localFrameY
        }

        st.cosTheta = Math.cos(st.worldAngle)
        st.sinTheta = Math.sin(st.worldAngle)
        // Offset from parent origin to this link origin (world frame)
        st.dx = st.worldX - parent.worldX
        st.dy = st.worldY - parent.worldY
      }
    }
  }

  // ── Inverse Dynamics ───────────────────────────────────────────────────────

  /**
   * Newton-Euler inverse dynamics: compute forces/torques needed for the
   * current joint accelerations. Sets each link's jointForce to the required
   * value.
   *
   * @param gravity Gravitational acceleration (positive = downward in Y).
   */
  inverseDynamics(gravity: number): void {
    const n = this.links.length
    this.forwardKinematics()

    // Outward pass: compute velocities and accelerations
    const velocities: Spatial3[] = new Array(n)
    const accelerations: Spatial3[] = new Array(n)

    for (let i = 0; i < n; i++) {
      const link = this.links[i]
      const st = this.state[i]
      const S = jointMotionSubspace(link.jointType, st.cosTheta, st.sinTheta)

      if (link.parentIndex < 0) {
        velocities[i] = spatialScale(link.jointVelocity, S)
        accelerations[i] = spatialAdd(
          spatialScale(link.jointAccel, S),
          [0, gravity, 0], // gravity acts on linear Y
        )
      } else {
        const parentVel = velocities[link.parentIndex]
        const parentAcc = accelerations[link.parentIndex]
        const qd = link.jointVelocity
        const Sqd = spatialScale(qd, S)

        velocities[i] = spatialAdd(parentVel, Sqd)

        // Coriolis: omega_parent x (S * qd) in 2D = [−omega*Sqd_y, omega*Sqd_x, 0]
        const omega = parentVel[2]
        const coriolis: Spatial3 = [-omega * Sqd[1], omega * Sqd[0], 0]

        accelerations[i] = spatialAdd(spatialAdd(parentAcc, spatialScale(link.jointAccel, S)), coriolis)
      }
    }

    // Inward pass: compute forces
    const forces: Spatial3[] = new Array(n)
    for (let i = 0; i < n; i++) {
      forces[i] = spatialZero()
    }

    for (let i = n - 1; i >= 0; i--) {
      const link = this.links[i]
      const st = this.state[i]

      // Body inertia
      const mass = link.invMass > 0 ? 1 / link.invMass : 0
      const inertia = link.invInertia > 0 ? 1 / link.invInertia : 0

      const I = inertiaDiag(mass, inertia)
      const Ia = inertiaMulVec(I, accelerations[i])

      // Velocity-dependent bias (Coriolis in spatial): omega x (I * v)
      const Iv = inertiaMulVec(I, velocities[i])
      const omega = velocities[i][2]
      const bias: Spatial3 = [-omega * Iv[1], omega * Iv[0], 0]

      forces[i] = spatialAdd(forces[i], spatialAdd(Ia, bias))

      // Propagate to parent
      if (link.parentIndex >= 0) {
        // Transform force to parent frame and accumulate
        const f = transformForceToChild(forces[i], -st.dx, -st.dy, st.cosTheta, st.sinTheta)
        forces[link.parentIndex] = spatialAdd(forces[link.parentIndex], f)
      }

      // Project onto joint axis to get required joint force
      const S = jointMotionSubspace(link.jointType, st.cosTheta, st.sinTheta)
      link.jointForce = spatialDot(S, forces[i])
    }
  }

  // ── Forward Dynamics (Featherstone ABA) ────────────────────────────────────

  /**
   * Featherstone's Articulated Body Algorithm for 2D.
   * Computes joint accelerations from applied forces and gravity.
   *
   * @param gravity Gravitational acceleration (positive = downward in Y).
   * @param dt Time step (used for damping/spring force computation).
   */
  forwardDynamics(gravity: number, _dt: number): void {
    const n = this.links.length
    if (n === 0) return

    this.forwardKinematics()

    // ── Pass 1 (outward): compute velocities, bias accelerations, ──────────
    //    and initialize articulated inertias and bias forces.

    for (let i = 0; i < n; i++) {
      const link = this.links[i]
      const st = this.state[i]

      // Joint axis in world frame
      st.S = jointMotionSubspace(link.jointType, st.cosTheta, st.sinTheta)

      // Body spatial inertia (in link frame, but we work in world frame)
      const mass = link.invMass > 0 ? 1 / link.invMass : 1e6
      const inertia = link.invInertia > 0 ? 1 / link.invInertia : 1e6
      st.Ia = inertiaDiag(mass, inertia)

      if (link.parentIndex < 0) {
        // Root: velocity comes from joint DOF only
        st.velocity = spatialScale(link.jointVelocity, st.S)
        st.c = spatialZero()
      } else {
        const parentSt = this.state[link.parentIndex]
        const qd = link.jointVelocity
        const Sqd = spatialScale(qd, st.S)

        // Velocity = parent velocity + joint velocity contribution
        st.velocity = spatialAdd(parentSt.velocity, Sqd)

        // Coriolis/centrifugal bias: omega_parent x (S * qd)
        const omega = parentSt.velocity[2]
        st.c = [-omega * Sqd[1], omega * Sqd[0], 0]
      }

      // Bias force: velocity-dependent (Coriolis in spatial form)
      // p = v x* (I * v)  where x* is the spatial cross product for forces
      const Iv = inertiaMulVec(st.Ia, st.velocity)
      const omega = st.velocity[2]
      // In 2D: v x* f = [−omega*fy, omega*fx, vx*fy − vy*fx]
      // But simplified Coriolis bias:
      st.pa = [-omega * Iv[1], omega * Iv[0], 0]

      // Subtract gravity (applied as external force: [0, -m*g, 0])
      // Since gravity acts downward in world Y, and we want to include it as
      // an external force on the body:
      st.pa[1] -= mass * gravity

      // Subtract applied joint force (projected onto joint axis)
      // This will be handled in pass 2 via the `u` term.
    }

    // ── Pass 2 (inward): aggregate articulated inertias and bias forces ─────
    //    from leaves to root.

    for (let i = n - 1; i >= 0; i--) {
      const link = this.links[i]
      const st = this.state[i]

      if (link.jointType === 'fixed') {
        // Fixed joint: no DOF to project out
        st.D = 0
        st.u = 0

        if (link.parentIndex >= 0) {
          const parentSt = this.state[link.parentIndex]
          // Transform and add this link's articulated inertia to parent
          const Itrans = inertiaTransform(st.Ia, st.dx, st.dy, st.cosTheta, st.sinTheta)
          parentSt.Ia = inertiaAdd(parentSt.Ia, Itrans)

          // Transform and add bias force to parent
          const pTrans = transformVelocityToParent(st.pa, st.dx, st.dy, st.cosTheta, st.sinTheta)
          parentSt.pa = spatialAdd(parentSt.pa, pTrans)
        }
        continue
      }

      // Compute effective inertia along joint DOF
      const Is = inertiaMulVec(st.Ia, st.S)
      st.D = spatialDot(st.S, Is)

      // Compute joint force components
      let tau = link.jointForce

      // Spring force: -k * (q - 0) (spring pulls toward zero)
      if (link.jointStiffness > 0) {
        tau -= link.jointStiffness * link.jointAngle
      }

      // Damping force: -d * qd
      if (link.jointDamping > 0) {
        tau -= link.jointDamping * link.jointVelocity
      }

      // u = tau - S^T * pA
      st.u = tau - spatialDot(st.S, st.pa)

      if (link.parentIndex >= 0 && Math.abs(st.D) > 1e-12) {
        const parentSt = this.state[link.parentIndex]

        // Ia' = Ia - (Ia * S * S^T * Ia) / D
        const IaProjected = inertiaProjectOut(st.Ia, st.S)
        const IaTrans = inertiaTransform(IaProjected, st.dx, st.dy, st.cosTheta, st.sinTheta)
        parentSt.Ia = inertiaAdd(parentSt.Ia, IaTrans)

        // pa' = pa + Ia' * c + (Ia * S * u) / D
        const IaSu = spatialScale(st.u / st.D, Is)
        const paUpdated = spatialAdd(st.pa, spatialAdd(inertiaMulVec(st.Ia, st.c), IaSu))
        const paTrans = transformVelocityToParent(paUpdated, st.dx, st.dy, st.cosTheta, st.sinTheta)
        parentSt.pa = spatialAdd(parentSt.pa, paTrans)
      }
    }

    // ── Pass 3 (outward): compute accelerations from root to leaves ─────────

    const accels: Spatial3[] = new Array(n)

    for (let i = 0; i < n; i++) {
      const link = this.links[i]
      const st = this.state[i]

      let parentAccel: Spatial3
      if (link.parentIndex < 0) {
        // Root acceleration (gravity is already in bias force, so base accel is zero
        // for a floating root, or gravity for a fixed root)
        parentAccel = spatialZero()
      } else {
        parentAccel = accels[link.parentIndex]
      }

      if (link.jointType === 'fixed') {
        // Fixed: acceleration = parent acceleration + bias
        accels[i] = spatialAdd(parentAccel, st.c)
        link.jointAccel = 0
      } else if (Math.abs(st.D) > 1e-12) {
        // qdd = (u - S^T * Ia * (a_parent + c)) / D
        const apc = spatialAdd(parentAccel, st.c)
        const IaApc = inertiaMulVec(st.Ia, apc)
        link.jointAccel = (st.u - spatialDot(st.S, IaApc)) / st.D

        // Link acceleration = parent + S * qdd + c
        accels[i] = spatialAdd(apc, spatialScale(link.jointAccel, st.S))
      } else {
        // Degenerate case: zero effective inertia
        link.jointAccel = 0
        accels[i] = spatialAdd(parentAccel, st.c)
      }
    }
  }

  // ── Integration ────────────────────────────────────────────────────────────

  /**
   * Semi-implicit Euler integration of joint velocities and positions.
   */
  integrate(dt: number): void {
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i]
      if (link.jointType === 'fixed') continue

      // Update velocity from acceleration
      link.jointVelocity += link.jointAccel * dt

      // Update position from velocity
      link.jointAngle += link.jointVelocity * dt
    }
  }

  // ── Joint Limits ───────────────────────────────────────────────────────────

  /**
   * Clamp joint positions to their [min, max] range and zero out velocity
   * at limits.
   */
  applyJointLimits(): void {
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i]
      if (link.jointType === 'fixed') continue

      const hasMin = !Number.isNaN(link.jointMin)
      const hasMax = !Number.isNaN(link.jointMax)

      if (hasMin && link.jointAngle < link.jointMin) {
        link.jointAngle = link.jointMin
        if (link.jointVelocity < 0) link.jointVelocity = 0
      }

      if (hasMax && link.jointAngle > link.jointMax) {
        link.jointAngle = link.jointMax
        if (link.jointVelocity > 0) link.jointVelocity = 0
      }
    }
  }

  // ── Motors ─────────────────────────────────────────────────────────────────

  /**
   * Apply PD motor forces to joints that have a motor configured
   * (motorMaxForce > 0).
   *
   * Motor force = stiffness * (target - current) - damping * velocity,
   * clamped to [-motorMaxForce, motorMaxForce].
   */
  applyMotors(_dt: number): void {
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i]
      if (link.jointType === 'fixed') continue
      if (link.motorMaxForce <= 0) continue

      const posError = link.motorTarget - link.jointAngle
      const velError = -link.jointVelocity

      // PD control: use stiffness as P gain and damping as D gain
      const pGain = link.jointStiffness > 0 ? link.jointStiffness : 100
      const dGain = link.jointDamping > 0 ? link.jointDamping : 10

      let force = pGain * posError + dGain * velError

      // Clamp to max motor force
      if (force > link.motorMaxForce) force = link.motorMaxForce
      if (force < -link.motorMaxForce) force = -link.motorMaxForce

      link.jointForce += force
    }
  }

  // ── World-frame getters ────────────────────────────────────────────────────

  /**
   * Get the world position of a link after forwardKinematics() has been called.
   */
  getWorldPosition(linkIndex: number): { x: number; y: number; angle: number } {
    const st = this.state[linkIndex]
    return { x: st.worldX, y: st.worldY, angle: st.worldAngle }
  }

  /**
   * Get the spatial velocity of a link after pass 1 of forwardDynamics().
   */
  getWorldVelocity(linkIndex: number): { vx: number; vy: number; omega: number } {
    const st = this.state[linkIndex]
    return { vx: st.velocity[0], vy: st.velocity[1], omega: st.velocity[2] }
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a multibody articulation from an array of link definitions.
 */
export function createMultibody(links: MultibodyLink[]): MultibodyArticulation {
  const mb = new MultibodyArticulation()
  for (const link of links) {
    mb.addLink(link)
  }
  return mb
}

/**
 * Create a default MultibodyLink with sensible defaults.
 * Only `entityId` and `parentIndex` are required.
 */
export function createLink(opts: {
  entityId: EntityId
  parentIndex: number
  jointType?: 'revolute' | 'prismatic' | 'fixed'
  localAnchorX?: number
  localAnchorY?: number
  localFrameX?: number
  localFrameY?: number
  jointAngle?: number
  jointVelocity?: number
  jointForce?: number
  jointMin?: number
  jointMax?: number
  jointDamping?: number
  jointStiffness?: number
  motorTarget?: number
  motorMaxForce?: number
  invMass?: number
  invInertia?: number
}): MultibodyLink {
  return {
    entityId: opts.entityId,
    parentIndex: opts.parentIndex,
    jointType: opts.jointType ?? 'revolute',
    localAnchorX: opts.localAnchorX ?? 0,
    localAnchorY: opts.localAnchorY ?? 0,
    localFrameX: opts.localFrameX ?? 0,
    localFrameY: opts.localFrameY ?? 0,
    jointAngle: opts.jointAngle ?? 0,
    jointVelocity: opts.jointVelocity ?? 0,
    jointAccel: 0,
    jointForce: opts.jointForce ?? 0,
    jointMin: opts.jointMin ?? NaN,
    jointMax: opts.jointMax ?? NaN,
    jointDamping: opts.jointDamping ?? 0,
    jointStiffness: opts.jointStiffness ?? 0,
    motorTarget: opts.motorTarget ?? 0,
    motorMaxForce: opts.motorMaxForce ?? 0,
    invMass: opts.invMass ?? 1,
    invInertia: opts.invInertia ?? 1,
  }
}
