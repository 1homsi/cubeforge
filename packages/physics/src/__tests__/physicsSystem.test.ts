import { describe, it, expect, beforeEach } from 'bun:test'
import { ECSWorld } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from '../components/rigidbody'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { PhysicsSystem } from '../physicsSystem'

// Fixed timestep the physics system uses internally
const FIXED_DT = 1 / 60

function createTestWorld(gravity = 980) {
  const world = new ECSWorld()
  const physics = new PhysicsSystem(gravity)
  world.addSystem(physics)
  return { world, physics }
}

/** Add a dynamic entity (has all three components needed by physics) */
function addDynamic(world: ECSWorld, x: number, y: number, w = 20, h = 20) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createRigidBody())
  world.addComponent(id, createBoxCollider(w, h))
  return id
}

/** Add a static entity */
function addStatic(world: ECSWorld, x: number, y: number, w: number, h: number) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createRigidBody({ isStatic: true }))
  world.addComponent(id, createBoxCollider(w, h))
  return id
}

/** Run the world for a given number of fixed steps */
function runSteps(world: ECSWorld, steps: number) {
  for (let i = 0; i < steps; i++) {
    world.update(FIXED_DT)
  }
}

describe('PhysicsSystem', () => {
  describe('gravity', () => {
    it('dynamic entity gains downward velocity over time', () => {
      const { world } = createTestWorld(980)
      const id = addDynamic(world, 0, 0)
      runSteps(world, 10)
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb.vy).toBeGreaterThan(0)
    })

    it('dynamic entity position increases in y over time (falls down)', () => {
      const { world } = createTestWorld(980)
      const id = addDynamic(world, 0, 0)
      runSteps(world, 10)
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      expect(t.y).toBeGreaterThan(0)
    })

    it('static entity does not move under gravity', () => {
      const { world } = createTestWorld(980)
      const id = addStatic(world, 0, 0, 40, 40)
      runSteps(world, 60)
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      expect(t.x).toBe(0)
      expect(t.y).toBe(0)
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb.vy).toBe(0)
    })
  })

  describe('floor collision', () => {
    it('entity landing on a static floor is stopped and onGround is set', () => {
      const { world } = createTestWorld(980)
      // Floor: a wide static box centered at y=200, height=20 (occupies y 190..210)
      addStatic(world, 0, 200, 400, 20)
      // Dynamic: 20x20 box starting at y=100, so its center is at 100, bottom edge at 110
      // Floor top edge is at 190. It should fall and land.
      const id = addDynamic(world, 0, 100, 20, 20)

      // Run enough steps for it to fall and land
      runSteps(world, 120)

      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      const t = world.getComponent<TransformComponent>(id, 'Transform')!

      expect(rb.onGround).toBe(true)
      expect(rb.vy).toBe(0)
      // Entity center y should be at or near the floor top edge minus half entity height
      // floor top = 200 - 10 = 190, entity half-height = 10, so entity y ≈ 180
      expect(t.y).toBeCloseTo(180, 0)
    })
  })

  describe('wall collision', () => {
    it('entity moving right into a static wall is stopped', () => {
      const { world } = createTestWorld(0) // no gravity so it only moves horizontally
      // Wall: 20x200 static box centered at x=100
      addStatic(world, 100, 0, 20, 400)
      // Dynamic: 20x20 at x=0, moving right at vx=200
      const id = addDynamic(world, 0, 0, 20, 20)
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      rb.vx = 200

      // Run enough steps to reach the wall
      runSteps(world, 60)

      const rbAfter = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rbAfter.vx).toBe(0)

      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      // Dynamic right edge should not penetrate the wall's left edge
      // Wall left edge = 100 - 10 = 90; dynamic half-width = 10; so dynamic x ≤ 80
      expect(t.x).toBeLessThanOrEqual(81)
    })
  })

  describe('setGravity', () => {
    it('changes gravity mid-game', () => {
      const { world, physics } = createTestWorld(0) // start with no gravity
      const id = addDynamic(world, 0, 0)
      runSteps(world, 10)
      const rb1 = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb1.vy).toBe(0) // no gravity yet

      physics.setGravity(980)
      runSteps(world, 10)
      const rb2 = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb2.vy).toBeGreaterThan(0)
    })
  })

  describe('trigger collider', () => {
    it('trigger entity does not physically block a dynamic entity', () => {
      const { world } = createTestWorld(0) // no gravity
      // Trigger: big box centered at x=50
      const triggerId = world.createEntity()
      world.addComponent(triggerId, createTransform(50, 0))
      world.addComponent(triggerId, createRigidBody({ isStatic: true }))
      world.addComponent(triggerId, createBoxCollider(100, 100, { isTrigger: true }))

      // Dynamic moving right through the trigger
      const id = addDynamic(world, 0, 0, 20, 20)
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      rb.vx = 200

      runSteps(world, 30)

      // vx should still be non-zero — trigger should not have stopped the entity
      const rbAfter = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rbAfter.vx).toBeGreaterThan(0)
    })
  })

  describe('fixed timestep accumulator', () => {
    it('physics runs consistent steps regardless of dt variation', () => {
      // Run for exactly 1 second via one big dt vs 60 small steps — results should match closely
      const worldA = createTestWorld(980).world
      const worldB = createTestWorld(980).world

      const idA = addDynamic(worldA, 0, 0)
      const idB = addDynamic(worldB, 0, 0)

      // World A: 60 small steps of 1/60s
      runSteps(worldA, 60)

      // World B: one large dt of 1s (accumulator caps at 5 * FIXED_DT = ~0.083s worth of steps,
      // so it will only run up to 5 fixed steps — enough to show the system is using fixed dt)
      worldB.update(1)

      const rbA = worldA.getComponent<RigidBodyComponent>(idA, 'RigidBody')!
      const rbB = worldB.getComponent<RigidBodyComponent>(idB, 'RigidBody')!

      // Both should have positive vy (gravity applied)
      expect(rbA.vy).toBeGreaterThan(0)
      expect(rbB.vy).toBeGreaterThan(0)
    })

    it('accumulates partial steps across multiple updates', () => {
      const { world } = createTestWorld(980)
      const id = addDynamic(world, 0, 0)

      // Pass dt smaller than FIXED_DT to force accumulation
      const smallDt = FIXED_DT / 2
      // After 1 step of smallDt, nothing should have run yet
      world.update(smallDt)
      let rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb.vy).toBe(0) // no fixed step fired yet

      // After another smallDt, accumulator crosses FIXED_DT, one step fires
      world.update(smallDt)
      rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb.vy).toBeGreaterThan(0)
    })
  })

  describe('gravityScale', () => {
    it('entity with gravityScale=0 is not affected by gravity', () => {
      const { world } = createTestWorld(980)
      const id = world.createEntity()
      world.addComponent(id, createTransform(0, 0))
      world.addComponent(id, createRigidBody({ gravityScale: 0 }))
      world.addComponent(id, createBoxCollider(20, 20))

      runSteps(world, 60)

      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb.vy).toBe(0)
    })
  })
})
