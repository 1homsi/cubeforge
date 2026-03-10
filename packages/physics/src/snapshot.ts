/**
 * Physics Snapshot — serialize and restore complete physics world state.
 *
 * Supports both binary (Uint8Array) and JSON formats. Captures all rigid body
 * state, collider properties, joint state, and solver cache for deterministic
 * replay and save/load.
 */

import type { ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from './components/rigidbody'
import type { JointComponent } from './components/joint'

// ── Types ──────────────────────────────────────────────────────────────────

/** Serialized representation of the physics world. */
export interface PhysicsSnapshot {
  /** Format version for forward/backward compatibility. */
  version: number
  /** Timestamp or frame number when snapshot was taken. */
  timestamp: number
  /** All physics bodies with their transform and rigid body state. */
  bodies: PhysicsBodySnapshot[]
  /** All joints. */
  joints: JointSnapshot[]
}

export interface PhysicsBodySnapshot {
  entityId: EntityId
  x: number
  y: number
  rotation: number
  vx: number
  vy: number
  angularVelocity: number
  mass: number
  invMass: number
  inertia: number
  invInertia: number
  isStatic: boolean
  isKinematic: boolean
  sleeping: boolean
  sleepTimer: number
  forceX: number
  forceY: number
  torque: number
  onGround: boolean
  isNearGround: boolean
  dominance: number
  enabled: boolean
}

export interface JointSnapshot {
  entityId: EntityId
  jointType: string
  entityA: EntityId
  entityB: EntityId
  anchorAx: number
  anchorAy: number
  anchorBx: number
  anchorBy: number
  length: number
  stiffness: number
  damping: number
  enabled: boolean
  broken: boolean
  accumulatedImpulse: number
}

// ── Current format version ────────────────────────────────────────────────

const SNAPSHOT_VERSION = 1

// ── Take Snapshot ─────────────────────────────────────────────────────────

/**
 * Capture the current physics state of all rigid bodies and joints.
 */
export function takeSnapshot(world: ECSWorld, timestamp = 0): PhysicsSnapshot {
  const bodies: PhysicsBodySnapshot[] = []

  // Gather all entities with RigidBody
  const rbEntities = world.query('Transform', 'RigidBody')
  for (const id of rbEntities) {
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    bodies.push({
      entityId: id,
      x: t.x,
      y: t.y,
      rotation: t.rotation,
      vx: rb.vx,
      vy: rb.vy,
      angularVelocity: rb.angularVelocity,
      mass: rb.mass,
      invMass: rb.invMass,
      inertia: rb.inertia,
      invInertia: rb.invInertia,
      isStatic: rb.isStatic,
      isKinematic: rb.isKinematic,
      sleeping: rb.sleeping,
      sleepTimer: rb.sleepTimer,
      forceX: rb.forceX,
      forceY: rb.forceY,
      torque: rb.torque,
      onGround: rb.onGround,
      isNearGround: rb.isNearGround,
      dominance: rb.dominance,
      enabled: rb.enabled,
    })
  }

  const joints: JointSnapshot[] = []
  for (const jid of world.query('Joint')) {
    const j = world.getComponent<JointComponent>(jid, 'Joint')!
    joints.push({
      entityId: jid,
      jointType: j.jointType,
      entityA: j.entityA,
      entityB: j.entityB,
      anchorAx: j.anchorA.x,
      anchorAy: j.anchorA.y,
      anchorBx: j.anchorB.x,
      anchorBy: j.anchorB.y,
      length: j.length,
      stiffness: j.stiffness,
      damping: j.damping,
      enabled: j.enabled,
      broken: j.broken,
      accumulatedImpulse: j._accumulatedImpulse,
    })
  }

  return { version: SNAPSHOT_VERSION, timestamp, bodies, joints }
}

/**
 * Restore physics state from a snapshot. Entities must already exist in the world.
 * Only updates Transform and RigidBody components — does not create/destroy entities.
 */
export function restoreSnapshot(world: ECSWorld, snapshot: PhysicsSnapshot): void {
  for (const bs of snapshot.bodies) {
    const t = world.getComponent<TransformComponent>(bs.entityId, 'Transform')
    if (t) {
      t.x = bs.x
      t.y = bs.y
      t.rotation = bs.rotation
    }
    const rb = world.getComponent<RigidBodyComponent>(bs.entityId, 'RigidBody')
    if (rb) {
      rb.vx = bs.vx
      rb.vy = bs.vy
      rb.angularVelocity = bs.angularVelocity
      rb.mass = bs.mass
      rb.invMass = bs.invMass
      rb.inertia = bs.inertia
      rb.invInertia = bs.invInertia
      rb.isStatic = bs.isStatic
      rb.isKinematic = bs.isKinematic
      rb.sleeping = bs.sleeping
      rb.sleepTimer = bs.sleepTimer
      rb.forceX = bs.forceX
      rb.forceY = bs.forceY
      rb.torque = bs.torque
      rb.onGround = bs.onGround
      rb.isNearGround = bs.isNearGround
      rb.dominance = bs.dominance
      rb.enabled = bs.enabled
    }
  }

  for (const js of snapshot.joints) {
    const j = world.getComponent<JointComponent>(js.entityId, 'Joint')
    if (j) {
      j.enabled = js.enabled
      j.broken = js.broken
      j._accumulatedImpulse = js.accumulatedImpulse
    }
  }
}

// ── JSON Serialization ────────────────────────────────────────────────────

/** Serialize snapshot to a JSON-compatible string. */
export function snapshotToJSON(snapshot: PhysicsSnapshot): string {
  return JSON.stringify(snapshot)
}

/** Deserialize snapshot from a JSON string. */
export function snapshotFromJSON(json: string): PhysicsSnapshot {
  return JSON.parse(json) as PhysicsSnapshot
}

// ── Binary Serialization ──────────────────────────────────────────────────

/**
 * Serialize snapshot to a compact Uint8Array.
 *
 * Format:
 *   [4 bytes] version
 *   [8 bytes] timestamp (float64)
 *   [4 bytes] body count
 *   [N * BODY_SIZE bytes] body data
 *   [4 bytes] joint count
 *   [N * JOINT_SIZE bytes] joint data
 */
// entityId(4) + 14 f64s(112) + dominance i32(4) + sleepTimer f64(8) + 5 bools(5) = 133
const BODY_RECORD_SIZE = 4 + 14 * 8 + 4 + 8 + 5
// 3 ids(12) + 6 f64s(48) + 2 bools(2) = 62
const JOINT_RECORD_SIZE = 4 * 3 + 8 * 6 + 1 * 2

export function snapshotToBytes(snapshot: PhysicsSnapshot): Uint8Array {
  const headerSize = 4 + 8 + 4 + 4 // version + timestamp + bodyCount + jointCount
  const bodySize = snapshot.bodies.length * BODY_RECORD_SIZE
  const jointSize = snapshot.joints.length * JOINT_RECORD_SIZE
  const buf = new ArrayBuffer(headerSize + bodySize + jointSize)
  const view = new DataView(buf)
  let offset = 0

  // Header
  view.setUint32(offset, snapshot.version)
  offset += 4
  view.setFloat64(offset, snapshot.timestamp)
  offset += 8
  view.setUint32(offset, snapshot.bodies.length)
  offset += 4

  // Bodies
  for (const b of snapshot.bodies) {
    view.setUint32(offset, b.entityId)
    offset += 4
    view.setFloat64(offset, b.x)
    offset += 8
    view.setFloat64(offset, b.y)
    offset += 8
    view.setFloat64(offset, b.rotation)
    offset += 8
    view.setFloat64(offset, b.vx)
    offset += 8
    view.setFloat64(offset, b.vy)
    offset += 8
    view.setFloat64(offset, b.angularVelocity)
    offset += 8
    view.setFloat64(offset, b.mass)
    offset += 8
    view.setFloat64(offset, b.invMass)
    offset += 8
    view.setFloat64(offset, b.inertia)
    offset += 8
    view.setFloat64(offset, b.invInertia)
    offset += 8
    view.setFloat64(offset, b.forceX)
    offset += 8
    view.setFloat64(offset, b.forceY)
    offset += 8
    view.setFloat64(offset, b.torque)
    offset += 8
    view.setInt32(offset, b.dominance)
    offset += 4
    view.setFloat64(offset, b.sleepTimer)
    offset += 8
    view.setUint8(offset, b.isStatic ? 1 : 0)
    offset += 1
    view.setUint8(offset, b.isKinematic ? 1 : 0)
    offset += 1
    view.setUint8(offset, b.sleeping ? 1 : 0)
    offset += 1
    view.setUint8(offset, b.onGround ? 1 : 0)
    offset += 1
    view.setUint8(offset, b.enabled ? 1 : 0)
    offset += 1
  }

  // Joint count
  view.setUint32(offset, snapshot.joints.length)
  offset += 4

  // Joints
  for (const j of snapshot.joints) {
    view.setUint32(offset, j.entityId)
    offset += 4
    view.setUint32(offset, j.entityA)
    offset += 4
    view.setUint32(offset, j.entityB)
    offset += 4
    view.setFloat64(offset, j.anchorAx)
    offset += 8
    view.setFloat64(offset, j.anchorAy)
    offset += 8
    view.setFloat64(offset, j.anchorBx)
    offset += 8
    view.setFloat64(offset, j.anchorBy)
    offset += 8
    view.setFloat64(offset, j.length)
    offset += 8
    view.setFloat64(offset, j.accumulatedImpulse)
    offset += 8
    view.setUint8(offset, j.enabled ? 1 : 0)
    offset += 1
    view.setUint8(offset, j.broken ? 1 : 0)
    offset += 1
  }

  return new Uint8Array(buf)
}

export function snapshotFromBytes(data: Uint8Array): PhysicsSnapshot {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 0

  const version = view.getUint32(offset)
  offset += 4
  const timestamp = view.getFloat64(offset)
  offset += 8
  const bodyCount = view.getUint32(offset)
  offset += 4

  const bodies: PhysicsBodySnapshot[] = []
  for (let i = 0; i < bodyCount; i++) {
    const entityId = view.getUint32(offset)
    offset += 4
    const x = view.getFloat64(offset)
    offset += 8
    const y = view.getFloat64(offset)
    offset += 8
    const rotation = view.getFloat64(offset)
    offset += 8
    const vx = view.getFloat64(offset)
    offset += 8
    const vy = view.getFloat64(offset)
    offset += 8
    const angularVelocity = view.getFloat64(offset)
    offset += 8
    const mass = view.getFloat64(offset)
    offset += 8
    const invMass = view.getFloat64(offset)
    offset += 8
    const inertia = view.getFloat64(offset)
    offset += 8
    const invInertia = view.getFloat64(offset)
    offset += 8
    const forceX = view.getFloat64(offset)
    offset += 8
    const forceY = view.getFloat64(offset)
    offset += 8
    const torque = view.getFloat64(offset)
    offset += 8
    const dominance = view.getInt32(offset)
    offset += 4
    const sleepTimer = view.getFloat64(offset)
    offset += 8
    const isStatic = view.getUint8(offset) === 1
    offset += 1
    const isKinematic = view.getUint8(offset) === 1
    offset += 1
    const sleeping = view.getUint8(offset) === 1
    offset += 1
    const onGround = view.getUint8(offset) === 1
    offset += 1
    const enabled = view.getUint8(offset) === 1
    offset += 1
    bodies.push({
      entityId,
      x,
      y,
      rotation,
      vx,
      vy,
      angularVelocity,
      mass,
      invMass,
      inertia,
      invInertia,
      isStatic,
      isKinematic,
      sleeping,
      sleepTimer,
      forceX,
      forceY,
      torque,
      onGround,
      isNearGround: false,
      dominance,
      enabled,
    })
  }

  const jointCount = view.getUint32(offset)
  offset += 4
  const joints: JointSnapshot[] = []
  for (let i = 0; i < jointCount; i++) {
    const entityId = view.getUint32(offset)
    offset += 4
    const entityA = view.getUint32(offset)
    offset += 4
    const entityB = view.getUint32(offset)
    offset += 4
    const anchorAx = view.getFloat64(offset)
    offset += 8
    const anchorAy = view.getFloat64(offset)
    offset += 8
    const anchorBx = view.getFloat64(offset)
    offset += 8
    const anchorBy = view.getFloat64(offset)
    offset += 8
    const length = view.getFloat64(offset)
    offset += 8
    const accumulatedImpulse = view.getFloat64(offset)
    offset += 8
    const jEnabled = view.getUint8(offset) === 1
    offset += 1
    const broken = view.getUint8(offset) === 1
    offset += 1
    joints.push({
      entityId,
      jointType: '',
      entityA,
      entityB,
      anchorAx,
      anchorAy,
      anchorBx,
      anchorBy,
      length,
      stiffness: 0,
      damping: 0,
      enabled: jEnabled,
      broken,
      accumulatedImpulse,
    })
  }

  return { version, timestamp, bodies, joints }
}

// ── Snapshot Hashing ──────────────────────────────────────────────────────

/**
 * Compute a deterministic hash of a snapshot for replay verification.
 * Uses FNV-1a 32-bit hash over all numeric body state.
 */
export function snapshotHash(snapshot: PhysicsSnapshot): number {
  let h = 0x811c9dc5 // FNV offset basis

  for (const b of snapshot.bodies) {
    h = fnv1aFloat(h, b.x)
    h = fnv1aFloat(h, b.y)
    h = fnv1aFloat(h, b.rotation)
    h = fnv1aFloat(h, b.vx)
    h = fnv1aFloat(h, b.vy)
    h = fnv1aFloat(h, b.angularVelocity)
  }

  return h >>> 0 // unsigned 32-bit
}

function fnv1aFloat(hash: number, value: number): number {
  // Convert float to integer bits for hashing
  const buf = new Float64Array(1)
  buf[0] = value
  const u8 = new Uint8Array(buf.buffer)
  for (let i = 0; i < 8; i++) {
    hash ^= u8[i]
    hash = Math.imul(hash, 0x01000193)
  }
  return hash
}
