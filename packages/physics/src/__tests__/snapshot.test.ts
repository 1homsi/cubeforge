import { describe, it, expect } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import { createRigidBody } from '../components/rigidbody'
import { createJoint } from '../components/joint'
import {
  takeSnapshot,
  restoreSnapshot,
  snapshotToJSON,
  snapshotFromJSON,
  snapshotToBytes,
  snapshotFromBytes,
  snapshotHash,
  type PhysicsSnapshot,
} from '../snapshot'

function setupWorld() {
  const world = new ECSWorld()
  return world
}

function addPhysicsEntity(world: ECSWorld, x: number, y: number, vx = 0, vy = 0) {
  const id = world.createEntity()
  const t = createTransform(x, y)
  world.addComponent(id, t)
  const rb = createRigidBody({ vx, vy, mass: 1, invMass: 1, isStatic: false, enabled: true })
  world.addComponent(id, rb)
  return id
}

function addJointEntity(world: ECSWorld, entityA: number, entityB: number) {
  const id = world.createEntity()
  world.addComponent(
    id,
    createJoint({
      jointType: 'spring',
      entityA,
      entityB,
      anchorA: { x: 1, y: 2 },
      anchorB: { x: 3, y: 4 },
      length: 25,
      stiffness: 9,
      damping: 0.75,
      enabled: false,
    }),
  )
  return id
}

describe('takeSnapshot', () => {
  it('returns a snapshot with correct version', () => {
    const world = setupWorld()
    const snap = takeSnapshot(world)
    expect(snap.version).toBe(1)
  })

  it('captures position of all rigid bodies', () => {
    const world = setupWorld()
    addPhysicsEntity(world, 100, 200)
    const snap = takeSnapshot(world)
    expect(snap.bodies).toHaveLength(1)
    expect(snap.bodies[0].x).toBe(100)
    expect(snap.bodies[0].y).toBe(200)
  })

  it('captures velocity of rigid bodies', () => {
    const world = setupWorld()
    addPhysicsEntity(world, 0, 0, 5, -3)
    const snap = takeSnapshot(world)
    expect(snap.bodies[0].vx).toBe(5)
    expect(snap.bodies[0].vy).toBe(-3)
  })

  it('captures multiple bodies', () => {
    const world = setupWorld()
    addPhysicsEntity(world, 10, 20)
    addPhysicsEntity(world, 30, 40)
    const snap = takeSnapshot(world)
    expect(snap.bodies).toHaveLength(2)
  })

  it('uses given timestamp', () => {
    const world = setupWorld()
    const snap = takeSnapshot(world, 42)
    expect(snap.timestamp).toBe(42)
  })

  it('returns empty bodies when no physics entities', () => {
    const world = setupWorld()
    const snap = takeSnapshot(world)
    expect(snap.bodies).toHaveLength(0)
    expect(snap.joints).toHaveLength(0)
  })

  it('captures isStatic flag', () => {
    const world = setupWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(0, 0))
    world.addComponent(id, createRigidBody({ isStatic: true, invMass: 0, mass: 0, enabled: true }))
    const snap = takeSnapshot(world)
    expect(snap.bodies[0].isStatic).toBe(true)
  })

  it('captures enabled flag', () => {
    const world = setupWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(0, 0))
    world.addComponent(id, createRigidBody({ enabled: false }))
    const snap = takeSnapshot(world)
    expect(snap.bodies[0].enabled).toBe(false)
  })

  it('captures full rigid body state fields', () => {
    const world = setupWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(7, 8, 0.5))
    world.addComponent(
      id,
      createRigidBody({
        vx: 3,
        vy: -4,
        angularVelocity: 2,
        mass: 5,
        invMass: 0.2,
        inertia: 9,
        invInertia: 1 / 9,
        isStatic: true,
        isKinematic: true,
        sleeping: true,
        sleepTimer: 6,
        forceX: 11,
        forceY: -12,
        torque: 13,
        onGround: true,
        isNearGround: true,
        dominance: 2,
        enabled: false,
      }),
    )

    const snap = takeSnapshot(world, 123)

    expect(snap.bodies[0]).toMatchObject({
      entityId: id,
      x: 7,
      y: 8,
      rotation: 0.5,
      vx: 3,
      vy: -4,
      angularVelocity: 2,
      mass: 5,
      invMass: 0.2,
      inertia: 9,
      invInertia: 1 / 9,
      isStatic: true,
      isKinematic: true,
      sleeping: true,
      sleepTimer: 6,
      forceX: 11,
      forceY: -12,
      torque: 13,
      onGround: true,
      isNearGround: true,
      dominance: 2,
      enabled: false,
    })
  })

  it('captures joint state', () => {
    const world = setupWorld()
    const a = addPhysicsEntity(world, 0, 0)
    const b = addPhysicsEntity(world, 10, 0)
    const jointId = addJointEntity(world, a, b)
    const joint = world.getComponent<ReturnType<typeof createJoint>>(jointId, 'Joint')!
    joint.broken = true
    joint._accumulatedImpulse = 42

    const snap = takeSnapshot(world)

    expect(snap.joints).toEqual([
      {
        entityId: jointId,
        jointType: 'spring',
        entityA: a,
        entityB: b,
        anchorAx: 1,
        anchorAy: 2,
        anchorBx: 3,
        anchorBy: 4,
        length: 25,
        stiffness: 9,
        damping: 0.75,
        enabled: false,
        broken: true,
        accumulatedImpulse: 42,
      },
    ])
  })
})

describe('restoreSnapshot', () => {
  it('restores position of bodies', () => {
    const world = setupWorld()
    const id = addPhysicsEntity(world, 10, 20)

    const snap = takeSnapshot(world)

    // Modify position
    const t = world.getComponent<{ type: 'Transform'; x: number; y: number; rotation: number }>(id, 'Transform')!
    t.x = 999
    t.y = 888

    restoreSnapshot(world, snap)

    const restored = world.getComponent<{ type: 'Transform'; x: number; y: number }>(id, 'Transform')!
    expect(restored.x).toBe(10)
    expect(restored.y).toBe(20)
  })

  it('restores velocity of bodies', () => {
    const world = setupWorld()
    const id = addPhysicsEntity(world, 0, 0, 10, -5)
    const snap = takeSnapshot(world)

    const rb = world.getComponent<ReturnType<typeof createRigidBody>>(id, 'RigidBody')!
    rb.vx = 0
    rb.vy = 0

    restoreSnapshot(world, snap)

    expect(rb.vx).toBe(10)
    expect(rb.vy).toBe(-5)
  })

  it('ignores entities not present in snapshot', () => {
    const world = setupWorld()
    const snap: PhysicsSnapshot = {
      version: 1,
      timestamp: 0,
      bodies: [
        {
          entityId: 999,
          x: 0,
          y: 0,
          rotation: 0,
          vx: 0,
          vy: 0,
          angularVelocity: 0,
          mass: 1,
          invMass: 1,
          inertia: 0,
          invInertia: 0,
          isStatic: false,
          isKinematic: false,
          sleeping: false,
          sleepTimer: 0,
          forceX: 0,
          forceY: 0,
          torque: 0,
          onGround: false,
          isNearGround: false,
          dominance: 0,
          enabled: true,
        },
      ],
      joints: [],
    }
    // Should not throw even though entity 999 doesn't exist
    expect(() => restoreSnapshot(world, snap)).not.toThrow()
  })

  it('restores body state flags and forces', () => {
    const world = setupWorld()
    const id = addPhysicsEntity(world, 0, 0, 10, -5)
    const rb = world.getComponent<ReturnType<typeof createRigidBody>>(id, 'RigidBody')!
    rb.angularVelocity = 3
    rb.forceX = 4
    rb.forceY = 5
    rb.torque = 6
    rb.dominance = 7
    rb.enabled = false
    rb.sleeping = true
    rb.sleepTimer = 8
    rb.onGround = true
    rb.isNearGround = true
    const snap = takeSnapshot(world)

    rb.angularVelocity = 0
    rb.forceX = 0
    rb.forceY = 0
    rb.torque = 0
    rb.dominance = 0
    rb.enabled = true
    rb.sleeping = false
    rb.sleepTimer = 0
    rb.onGround = false
    rb.isNearGround = false

    restoreSnapshot(world, snap)

    expect(rb).toMatchObject({
      angularVelocity: 3,
      forceX: 4,
      forceY: 5,
      torque: 6,
      dominance: 7,
      enabled: false,
      sleeping: true,
      sleepTimer: 8,
      onGround: true,
      isNearGround: true,
    })
  })

  it('restores joint enabled, broken, and accumulated impulse fields', () => {
    const world = setupWorld()
    const a = addPhysicsEntity(world, 0, 0)
    const b = addPhysicsEntity(world, 10, 0)
    const jointId = addJointEntity(world, a, b)
    const snap = takeSnapshot(world)
    const joint = world.getComponent<ReturnType<typeof createJoint>>(jointId, 'Joint')!
    joint.enabled = true
    joint.broken = true
    joint._accumulatedImpulse = 9

    restoreSnapshot(world, snap)

    expect(joint.enabled).toBe(false)
    expect(joint.broken).toBe(false)
    expect(joint._accumulatedImpulse).toBe(0)
  })
})

describe('JSON serialization', () => {
  it('round-trips through snapshotToJSON and snapshotFromJSON', () => {
    const world = setupWorld()
    const a = addPhysicsEntity(world, 42, 84, 1, -1)
    const b = addPhysicsEntity(world, 10, 20, -2, 3)
    addJointEntity(world, a, b)
    const snap = takeSnapshot(world, 100)
    const json = snapshotToJSON(snap)
    const restored = snapshotFromJSON(json)

    expect(restored).toEqual(snap)
  })

  it('produces a valid JSON string', () => {
    const world = setupWorld()
    const snap = takeSnapshot(world)
    const json = snapshotToJSON(snap)
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

describe('binary serialization', () => {
  it('round-trips through snapshotToBytes and snapshotFromBytes', () => {
    const world = setupWorld()
    const a = addPhysicsEntity(world, 10, 20, 3, -2)
    const b = addPhysicsEntity(world, 30, 40, -1, 2)
    const rb = world.getComponent<ReturnType<typeof createRigidBody>>(a, 'RigidBody')!
    rb.angularVelocity = 9
    rb.mass = 7
    rb.invMass = 1 / 7
    rb.inertia = 11
    rb.invInertia = 1 / 11
    rb.forceX = 4
    rb.forceY = 5
    rb.torque = 6
    rb.dominance = 2
    rb.isStatic = true
    rb.isKinematic = true
    rb.sleeping = true
    rb.sleepTimer = 8
    rb.onGround = true
    rb.isNearGround = true
    rb.enabled = false
    const jointId = addJointEntity(world, a, b)
    const joint = world.getComponent<ReturnType<typeof createJoint>>(jointId, 'Joint')!
    joint.broken = true
    joint._accumulatedImpulse = 12
    const snap = takeSnapshot(world, 5)
    const bytes = snapshotToBytes(snap)
    const restored = snapshotFromBytes(bytes)

    expect(restored.version).toBe(snap.version)
    expect(restored.timestamp).toBe(snap.timestamp)
    expect(restored.bodies).toHaveLength(2)
    expect(restored.bodies[0]).toMatchObject({
      entityId: a,
      x: 10,
      y: 20,
      rotation: 0,
      vx: 3,
      vy: -2,
      angularVelocity: 9,
      mass: 7,
      invMass: 1 / 7,
      inertia: 11,
      invInertia: 1 / 11,
      forceX: 4,
      forceY: 5,
      torque: 6,
      dominance: 2,
      isStatic: true,
      isKinematic: true,
      sleeping: true,
      sleepTimer: 8,
      onGround: true,
      enabled: false,
    })
    expect(restored.bodies[0].isNearGround).toBe(false)
    expect(restored.joints).toHaveLength(1)
    expect(restored.joints[0]).toMatchObject({
      entityId: jointId,
      entityA: a,
      entityB: b,
      anchorAx: 1,
      anchorAy: 2,
      anchorBx: 3,
      anchorBy: 4,
      length: 25,
      accumulatedImpulse: 12,
      enabled: false,
      broken: true,
    })
    expect(restored.joints[0].jointType).toBe('')
    expect(restored.joints[0].stiffness).toBe(0)
    expect(restored.joints[0].damping).toBe(0)
  })

  it('produces a Uint8Array', () => {
    const world = setupWorld()
    const snap = takeSnapshot(world)
    const bytes = snapshotToBytes(snap)
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  it('handles empty snapshot in binary form', () => {
    const world = setupWorld()
    const snap = takeSnapshot(world)
    const bytes = snapshotToBytes(snap)
    const restored = snapshotFromBytes(bytes)
    expect(restored.bodies).toHaveLength(0)
    expect(restored.joints).toHaveLength(0)
  })
})

describe('snapshotHash', () => {
  it('returns a number', () => {
    const world = setupWorld()
    const snap = takeSnapshot(world)
    expect(typeof snapshotHash(snap)).toBe('number')
  })

  it('returns the same hash for identical snapshots', () => {
    const world = setupWorld()
    addPhysicsEntity(world, 100, 200)
    const snap1 = takeSnapshot(world)
    const snap2 = takeSnapshot(world)
    expect(snapshotHash(snap1)).toBe(snapshotHash(snap2))
  })

  it('returns different hashes for different states', () => {
    const world = setupWorld()
    addPhysicsEntity(world, 100, 200)
    const snap1 = takeSnapshot(world)

    const t = world.getComponent<{ type: 'Transform'; x: number; y: number; rotation: number }>(
      world.query('Transform')[0],
      'Transform',
    )!
    t.x = 101
    const snap2 = takeSnapshot(world)

    expect(snapshotHash(snap1)).not.toBe(snapshotHash(snap2))
  })

  it('returns 0x811c9dc5 (FNV offset) for empty snapshot', () => {
    const world = setupWorld()
    const snap = takeSnapshot(world)
    // Empty snapshot — no bodies iterated, so hash remains FNV offset basis
    expect(snapshotHash(snap)).toBe(0x811c9dc5)
  })
})
