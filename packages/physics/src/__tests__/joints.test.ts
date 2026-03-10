import { describe, it, expect } from 'vitest'
import { ECSWorld, EventBus } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from '../components/rigidbody'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createJoint } from '../components/joint'
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
  for (let i = 0; i < steps; i++) {
    world.update(FIXED_DT)
  }
}

describe('Joints', () => {
  describe('distance joint', () => {
    it('maintains distance between two bodies', () => {
      const { world } = createTestWorld(0)
      const idA = addDynamic(world, 0, 0)
      const idB = addDynamic(world, 200, 0)

      // Create a joint entity with distance constraint of 100
      const jointId = world.createEntity()
      world.addComponent(
        jointId,
        createJoint({
          jointType: 'distance',
          entityA: idA,
          entityB: idB,
          length: 100,
        }),
      )

      runSteps(world, 60)

      const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
      const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
      const dist = Math.sqrt((tB.x - tA.x) ** 2 + (tB.y - tA.y) ** 2)
      // After many iterations, distance should be close to the target length
      expect(dist).toBeCloseTo(100, 0)
    })

    it('pulls bodies closer when they are too far apart', () => {
      const { world } = createTestWorld(0)
      const idA = addDynamic(world, 0, 0)
      const idB = addDynamic(world, 300, 0)

      const jointId = world.createEntity()
      world.addComponent(
        jointId,
        createJoint({
          jointType: 'distance',
          entityA: idA,
          entityB: idB,
          length: 100,
        }),
      )

      const tBBefore = world.getComponent<TransformComponent>(idB, 'Transform')!
      const initialX = tBBefore.x

      runSteps(world, 10)

      const tBAfter = world.getComponent<TransformComponent>(idB, 'Transform')!
      // B should have moved toward A
      expect(tBAfter.x).toBeLessThan(initialX)
    })
  })

  describe('spring joint', () => {
    it('applies force proportional to displacement', () => {
      const { world } = createTestWorld(0)
      const idA = addDynamic(world, 0, 0)
      const idB = addDynamic(world, 200, 0)

      // Create a spring joint with known stiffness
      const jointId = world.createEntity()
      world.addComponent(
        jointId,
        createJoint({
          jointType: 'spring',
          entityA: idA,
          entityB: idB,
          length: 100,
          stiffness: 2.0,
          damping: 0.1,
        }),
      )

      runSteps(world, 1)

      // After one step, body A should have gained positive velocity (pulled toward B)
      // and body B should have gained negative velocity (pulled toward A)
      const rbA = world.getComponent<RigidBodyComponent>(idA, 'RigidBody')!
      const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
      expect(rbA.vx).toBeGreaterThan(0)
      expect(rbB.vx).toBeLessThan(0)
    })
  })

  describe('rope joint', () => {
    it('allows slack — does not enforce distance when within maxLength', () => {
      const { world } = createTestWorld(0)
      const idA = addDynamic(world, 0, 0)
      const idB = addDynamic(world, 50, 0) // 50 apart, maxLength 100

      const jointId = world.createEntity()
      world.addComponent(
        jointId,
        createJoint({
          jointType: 'rope',
          entityA: idA,
          entityB: idB,
          length: 100,
          maxLength: 100,
        }),
      )

      runSteps(world, 10)

      // Bodies should not have moved since they are within the rope's slack
      const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
      const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
      expect(tA.x).toBeCloseTo(0, 1)
      expect(tB.x).toBeCloseTo(50, 1)
    })

    it('prevents stretch beyond maxLength', () => {
      const { world } = createTestWorld(0)
      const idA = addDynamic(world, 0, 0)
      const idB = addDynamic(world, 200, 0) // 200 apart, maxLength 100

      const jointId = world.createEntity()
      world.addComponent(
        jointId,
        createJoint({
          jointType: 'rope',
          entityA: idA,
          entityB: idB,
          length: 100,
          maxLength: 100,
        }),
      )

      runSteps(world, 60)

      const tA = world.getComponent<TransformComponent>(idA, 'Transform')!
      const tB = world.getComponent<TransformComponent>(idB, 'Transform')!
      const dist = Math.sqrt((tB.x - tA.x) ** 2 + (tB.y - tA.y) ** 2)
      // Distance should have been corrected to maxLength
      expect(dist).toBeCloseTo(100, 0)
    })
  })
})

describe('Body Sleeping', () => {
  it('body goes to sleep after being still for sleepDelay', () => {
    const { world } = createTestWorld(0) // no gravity
    const id = addDynamic(world, 100, 100)

    // Body starts with zero velocity — should go to sleep after sleepDelay
    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    rb.sleepDelay = 0.5 // half second
    rb.sleepThreshold = 5

    expect(rb.sleeping).toBe(false)

    // Run for slightly over 0.5 seconds (31 steps at 60fps to handle floating point)
    runSteps(world, 31)

    expect(rb.sleeping).toBe(true)
  })

  it('body does not sleep while moving', () => {
    const { world } = createTestWorld(0)
    const id = addDynamic(world, 100, 100)

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    rb.vx = 100 // moving fast
    rb.sleepDelay = 0.5

    runSteps(world, 60)

    expect(rb.sleeping).toBe(false)
  })

  it('sleeping body does not move under gravity', () => {
    const { world } = createTestWorld(980)
    const id = addDynamic(world, 100, 100)

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    rb.sleeping = true // force asleep
    rb.sleepThreshold = 5
    rb.sleepDelay = 1

    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    const initialY = t.y

    runSteps(world, 10)

    expect(t.y).toBe(initialY) // should not have moved
  })

  it('collision wakes sleeping body', () => {
    const { world } = createTestWorld(0)
    // Two dynamic bodies overlapping — collision should wake them
    const idA = addDynamic(world, 100, 100, 40, 40)
    const idB = addDynamic(world, 110, 100, 40, 40)

    const rbA = world.getComponent<RigidBodyComponent>(idA, 'RigidBody')!
    const rbB = world.getComponent<RigidBodyComponent>(idB, 'RigidBody')!
    rbA.sleeping = true
    rbB.sleeping = true

    // They overlap, so collision detection in Phase 6 should wake them
    runSteps(world, 1)

    expect(rbA.sleeping).toBe(false)
    expect(rbB.sleeping).toBe(false)
    expect(rbA.sleepTimer).toBe(0)
    expect(rbB.sleepTimer).toBe(0)
  })
})
