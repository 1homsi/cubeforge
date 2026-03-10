import { describe, it, expect, vi } from 'vitest'
import { ECSWorld, EventBus } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from '../components/rigidbody'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createJoint } from '../components/joint'
import type { JointComponent } from '../components/joint'
import { PhysicsSystem } from '../physicsSystem'

const FIXED_DT = 1 / 60

function createTestWorld(gravity = 0) {
  const world = new ECSWorld()
  const events = new EventBus()
  const physics = new PhysicsSystem(gravity, events)
  world.addSystem(physics)
  return { world, physics, events }
}

function addDynamic(world: ECSWorld, x: number, y: number, w = 20, h = 20) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createRigidBody())
  world.addComponent(id, createBoxCollider(w, h))
  return id
}

function addStatic(world: ECSWorld, x: number, y: number, w: number, h: number) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createRigidBody({ isStatic: true }))
  world.addComponent(id, createBoxCollider(w, h))
  return id
}

function runSteps(world: ECSWorld, steps: number) {
  for (let i = 0; i < steps; i++) world.update(FIXED_DT)
}

// ── Fixed Joint ──────────────────────────────────────────────────────

describe('fixed joint', () => {
  it('locks relative position between two bodies', () => {
    const { world } = createTestWorld(0)
    const idA = addDynamic(world, 0, 0)
    const idB = addDynamic(world, 100, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'fixed',
        entityA: idA,
        entityB: idB,
      }),
    )

    // Push body B away
    const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
    rbB.vx = 200

    runSteps(world, 60)

    // Fixed joint should have pulled them back together (anchor offset 0,0)
    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    const dist = Math.sqrt((tB.x - tA.x) ** 2 + (tB.y - tA.y) ** 2)
    expect(dist).toBeLessThan(5) // should converge near 0
  })

  it('locks relative rotation', () => {
    const { world } = createTestWorld(0)
    const idA = addDynamic(world, 0, 0)
    const idB = addDynamic(world, 0, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'fixed',
        entityA: idA,
        entityB: idB,
      }),
    )

    // Set different rotations
    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    tB.rotation = 1.0

    runSteps(world, 30)

    // Rotations should converge
    expect(Math.abs(tB.rotation - tA.rotation)).toBeLessThan(0.1)
  })
})

// ── Prismatic Joint ─────────────────────────────────────────────────

describe('prismatic joint', () => {
  it('constrains movement to axis direction only', () => {
    const { world } = createTestWorld(0)
    const idA = addStatic(world, 0, 0, 20, 20)
    const idB = addDynamic(world, 0, 50)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'prismatic',
        entityA: idA,
        entityB: idB,
        localAxisA: { x: 0, y: 1 }, // vertical axis
      }),
    )

    // Push B horizontally (perpendicular to axis)
    const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
    rbB.vx = 100

    runSteps(world, 30)

    // B should not have drifted far horizontally (corrected by joint)
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    expect(Math.abs(tB.x)).toBeLessThan(10)
  })

  it('enforces distance limits along axis', () => {
    const { world } = createTestWorld(980)
    const idA = addStatic(world, 0, 0, 20, 20)
    const idB = addDynamic(world, 0, 50)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'prismatic',
        entityA: idA,
        entityB: idB,
        localAxisA: { x: 0, y: 1 }, // vertical axis
        maxDistance: 80,
      }),
    )

    // Gravity pulls B down along Y axis
    runSteps(world, 120)

    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    const axisDist = tB.y - tA.y
    // Should not exceed maxDistance significantly
    expect(axisDist).toBeLessThan(85)
  })

  it('motor drives body along axis', () => {
    const { world } = createTestWorld(0)
    const idA = addStatic(world, 0, 0, 20, 20)
    const idB = addDynamic(world, 0, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'prismatic',
        entityA: idA,
        entityB: idB,
        localAxisA: { x: 0, y: 1 }, // vertical axis
        motor: {
          mode: 'velocity',
          target: 100, // target velocity: 100 units/s downward
          stiffness: 10,
          damping: 0,
          maxForce: 0,
        },
      }),
    )

    runSteps(world, 30)

    const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
    // Motor should be driving B downward
    expect(rbB.vy).toBeGreaterThan(0)
  })
})

// ── Weld Joint ──────────────────────────────────────────────────────

describe('weld joint', () => {
  it('behaves like fixed joint', () => {
    const { world } = createTestWorld(0)
    const idA = addDynamic(world, 0, 0)
    const idB = addDynamic(world, 50, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'weld',
        entityA: idA,
        entityB: idB,
      }),
    )

    runSteps(world, 60)

    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    const dist = Math.sqrt((tB.x - tA.x) ** 2 + (tB.y - tA.y) ** 2)
    expect(dist).toBeLessThan(5)
  })
})

// ── Generic Joint ───────────────────────────────────────────────────

describe('generic joint', () => {
  it('locked X + locked Y + locked rotation = fixed joint', () => {
    const { world } = createTestWorld(0)
    const idA = addDynamic(world, 0, 0)
    const idB = addDynamic(world, 50, 30)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'generic',
        entityA: idA,
        entityB: idB,
        axisLockX: 'locked',
        axisLockY: 'locked',
        axisLockRotation: 'locked',
      }),
    )

    runSteps(world, 60)

    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    const dist = Math.sqrt((tB.x - tA.x) ** 2 + (tB.y - tA.y) ** 2)
    expect(dist).toBeLessThan(5)
    expect(Math.abs(tB.rotation - tA.rotation)).toBeLessThan(0.1)
  })

  it('locked Y only allows free X movement', () => {
    const { world } = createTestWorld(0)
    const idA = addStatic(world, 0, 0, 20, 20)
    const idB = addDynamic(world, 50, 30)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'generic',
        entityA: idA,
        entityB: idB,
        axisLockY: 'locked',
      }),
    )

    const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
    rbB.vx = 100

    runSteps(world, 30)

    // Y should be constrained close to A's Y
    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    expect(Math.abs(tB.y - tA.y)).toBeLessThan(5)
    // X should be free to move
    expect(tB.x).toBeGreaterThan(50)
  })
})

// ── Revolute Angle Limits ───────────────────────────────────────────

describe('revolute joint with angle limits', () => {
  it('constrains rotation within min/max angles', () => {
    const { world } = createTestWorld(0)
    const idA = addStatic(world, 0, 0, 20, 20)
    const idB = addDynamic(world, 0, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'revolute',
        entityA: idA,
        entityB: idB,
        minAngle: -Math.PI / 4, // -45°
        maxAngle: Math.PI / 4, // +45°
      }),
    )

    // Set B rotating fast
    const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
    rbB.angularVelocity = 20

    runSteps(world, 60)

    // B's rotation should be clamped near maxAngle
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    expect(tB.rotation).toBeLessThanOrEqual(Math.PI / 4 + 0.2)
  })
})

// ── Revolute Motor ──────────────────────────────────────────────────

describe('revolute joint with motor', () => {
  it('motor drives angular velocity toward target', () => {
    const { world } = createTestWorld(0)
    const idA = addStatic(world, 0, 0, 20, 20)
    const idB = addDynamic(world, 0, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'revolute',
        entityA: idA,
        entityB: idB,
        motor: {
          mode: 'velocity',
          target: 5, // target 5 rad/s
          stiffness: 10,
          damping: 0,
          maxForce: 0,
        },
      }),
    )

    runSteps(world, 60)

    const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
    // Motor should be pushing angular velocity toward 5
    expect(rbB.angularVelocity).toBeGreaterThan(0)
  })

  it('position motor drives toward target angle', () => {
    const { world } = createTestWorld(0)
    const idA = addStatic(world, 0, 0, 20, 20)
    const idB = addDynamic(world, 0, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'revolute',
        entityA: idA,
        entityB: idB,
        motor: {
          mode: 'position',
          target: Math.PI / 2, // target 90°
          stiffness: 50,
          damping: 5,
          maxForce: 0,
        },
      }),
    )

    runSteps(world, 120)

    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    // Should have rotated toward π/2
    expect(tB.rotation).toBeGreaterThan(0.5)
  })

  it('maxForce limits motor impulse', () => {
    const { world } = createTestWorld(0)
    const idA = addStatic(world, 0, 0, 20, 20)
    const idB = addDynamic(world, 0, 0)

    // Strong motor with low maxForce
    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'revolute',
        entityA: idA,
        entityB: idB,
        motor: {
          mode: 'velocity',
          target: 100,
          stiffness: 1000,
          damping: 0,
          maxForce: 0.1, // very weak limit
        },
      }),
    )

    runSteps(world, 30)

    // With maxForce=0.1, angular velocity should be limited
    const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
    expect(rbB.angularVelocity).toBeGreaterThan(0)
    expect(rbB.angularVelocity).toBeLessThan(50) // not 100
  })
})

// ── Joint Breaking ──────────────────────────────────────────────────

describe('joint breaking', () => {
  it('breaks when force exceeds threshold', () => {
    const { world, events } = createTestWorld(980)

    // Heavy weight hanging from static anchor
    const anchor = addStatic(world, 0, 0, 20, 20)
    const weight = addDynamic(world, 0, 200, 20, 20)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'distance',
        entityA: anchor,
        entityB: weight,
        length: 100,
        breakForce: 0.1, // very low — will break easily
      }),
    )

    const handler = vi.fn()
    events.on('jointBreak', handler)

    runSteps(world, 30)

    const joint = world.getComponent<JointComponent>(jid, 'Joint')!
    expect(joint.broken).toBe(true)
    expect(handler).toHaveBeenCalled()
  })

  it('does not break when force is below threshold', () => {
    const { world } = createTestWorld(0) // no gravity, no forces

    const idA = addDynamic(world, 0, 0)
    const idB = addDynamic(world, 100, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'distance',
        entityA: idA,
        entityB: idB,
        length: 100,
        breakForce: 10000, // very high threshold
      }),
    )

    runSteps(world, 60)

    const joint = world.getComponent<JointComponent>(jid, 'Joint')!
    expect(joint.broken).toBe(false)
  })
})

// ── Joint Enabled/Disabled ──────────────────────────────────────────

describe('joint enabled/disabled', () => {
  it('disabled joint is skipped — bodies move freely', () => {
    const { world } = createTestWorld(0)
    const idA = addDynamic(world, 0, 0)
    const idB = addDynamic(world, 200, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'distance',
        entityA: idA,
        entityB: idB,
        length: 50,
        enabled: false,
      }),
    )

    runSteps(world, 30)

    // Bodies should NOT have been pulled together (joint disabled)
    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    const dist = Math.sqrt((tB.x - tA.x) ** 2 + (tB.y - tA.y) ** 2)
    expect(dist).toBeGreaterThan(150) // still far apart
  })

  it('re-enabling joint reconnects bodies', () => {
    const { world } = createTestWorld(0)
    const idA = addDynamic(world, 0, 0)
    const idB = addDynamic(world, 200, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'distance',
        entityA: idA,
        entityB: idB,
        length: 50,
        enabled: false,
      }),
    )

    runSteps(world, 10) // bodies stay apart

    // Re-enable
    const joint = world.getComponent<JointComponent>(jid, 'Joint')!
    joint.enabled = true

    runSteps(world, 60)

    // Now they should converge
    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    const dist = Math.sqrt((tB.x - tA.x) ** 2 + (tB.y - tA.y) ** 2)
    expect(dist).toBeCloseTo(50, 0)
  })
})

// ── contactsEnabled ─────────────────────────────────────────────────

describe('joint contactsEnabled', () => {
  it('contactsEnabled=false prevents collision response between joined bodies', () => {
    const { world } = createTestWorld(0)
    // Two overlapping bodies joined — should not push each other apart
    const idA = addDynamic(world, 100, 100, 40, 40)
    const idB = addDynamic(world, 110, 100, 40, 40)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'revolute',
        entityA: idA,
        entityB: idB,
        contactsEnabled: false,
      }),
    )

    const tA0 = world.getComponent<TransformComponent>(idA, 'Transform')!.x
    const tB0 = world.getComponent<TransformComponent>(idB, 'Transform')!.x

    runSteps(world, 10)

    // With contacts disabled, the collision impulse should not push them apart
    // They should still be close to where they started (minus joint constraint)
    const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
    const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
    // The key test: they should NOT have been explosively pushed apart
    expect(Math.abs(tA.x - tB.x)).toBeLessThan(30)
  })
})

// ── userData ────────────────────────────────────────────────────────

describe('joint userData', () => {
  it('stores and retrieves arbitrary data', () => {
    const { world } = createTestWorld(0)
    const idA = addDynamic(world, 0, 0)
    const idB = addDynamic(world, 100, 0)

    const jid = world.createEntity()
    world.addComponent(
      jid,
      createJoint({
        jointType: 'distance',
        entityA: idA,
        entityB: idB,
        userData: { tag: 'bridge_segment', index: 3 },
      }),
    )

    const joint = world.getComponent<JointComponent>(jid, 'Joint')!
    expect((joint.userData as any).tag).toBe('bridge_segment')
    expect((joint.userData as any).index).toBe(3)
  })
})

// ── Breakable bridge scenario ───────────────────────────────────────

describe('breakable bridge scenario', () => {
  it('chain of planks connected by fixed joints — heavy load breaks them', () => {
    const { world, events } = createTestWorld(980)

    // 3 planks connected by fixed joints
    const plank1 = addDynamic(world, 0, 0, 60, 10)
    const plank2 = addDynamic(world, 60, 0, 60, 10)
    const plank3 = addDynamic(world, 120, 0, 60, 10)

    // Anchors on left and right side
    const leftAnchor = addStatic(world, -30, 0, 10, 10)
    const rightAnchor = addStatic(world, 150, 0, 10, 10)

    // Connect anchor → plank1
    const j1 = world.createEntity()
    world.addComponent(
      j1,
      createJoint({
        jointType: 'fixed',
        entityA: leftAnchor,
        entityB: plank1,
        breakForce: 5, // low break threshold
      }),
    )

    // Connect plank1 → plank2
    const j2 = world.createEntity()
    world.addComponent(
      j2,
      createJoint({
        jointType: 'fixed',
        entityA: plank1,
        entityB: plank2,
        breakForce: 5,
      }),
    )

    // Connect plank2 → plank3
    const j3 = world.createEntity()
    world.addComponent(
      j3,
      createJoint({
        jointType: 'fixed',
        entityA: plank2,
        entityB: plank3,
        breakForce: 5,
      }),
    )

    // Connect plank3 → right anchor
    const j4 = world.createEntity()
    world.addComponent(
      j4,
      createJoint({
        jointType: 'fixed',
        entityA: plank3,
        entityB: rightAnchor,
        breakForce: 5,
      }),
    )

    const breakHandler = vi.fn()
    events.on('jointBreak', breakHandler)

    // Run with gravity — planks hang and eventually break
    runSteps(world, 120)

    // At least one joint should have broken
    expect(breakHandler).toHaveBeenCalled()
  })
})
