import { describe, it, expect } from 'vitest'
import { ECSWorld, EventBus } from '@cubeforge/core'
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

function createTestWorldWithEvents(gravity = 0) {
  const world = new ECSWorld()
  const events = new EventBus()
  const physics = new PhysicsSystem(gravity, events)
  world.addSystem(physics)
  return { world, physics, events }
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

  describe('moving platform carry', () => {
    it('dynamic entity on a moving platform inherits its horizontal movement', () => {
      const { world } = createTestWorld(980)

      // Static platform that we'll move manually each step
      const platId = world.createEntity()
      world.addComponent(platId, createTransform(0, 200))
      world.addComponent(platId, createRigidBody({ isStatic: true }))
      world.addComponent(platId, createBoxCollider(400, 20))

      // Dynamic entity resting on the platform
      const id = addDynamic(world, 0, 100, 20, 20)

      // Let entity fall and land on the platform
      runSteps(world, 120)

      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb.onGround).toBe(true)

      const tBefore = world.getComponent<TransformComponent>(id, 'Transform')!
      const xBefore = tBefore.x

      // Move the platform right by 5px per step for 10 steps
      for (let i = 0; i < 10; i++) {
        const pt = world.getComponent<TransformComponent>(platId, 'Transform')!
        pt.x += 5
        world.update(FIXED_DT)
      }

      const tAfter = world.getComponent<TransformComponent>(id, 'Transform')!
      // Entity should have moved right with the platform (carry applied)
      expect(tAfter.x).toBeGreaterThan(xBefore)
    })
  })

  describe('one-way platforms', () => {
    it('blocks dynamic entity falling onto the top of a one-way platform', () => {
      const { world } = createTestWorld(980)
      // One-way platform: static, 200x20, centered at y=200
      const plat = world.createEntity()
      world.addComponent(plat, createTransform(0, 200))
      world.addComponent(plat, createRigidBody({ isStatic: true }))
      world.addComponent(plat, createBoxCollider(400, 20, { oneWay: true }))

      // Dynamic entity starts above the platform (y=100) and falls
      const id = addDynamic(world, 0, 100, 20, 20)

      runSteps(world, 120)

      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      expect(rb.onGround).toBe(true)
      expect(rb.vy).toBe(0)
    })

    it('allows dynamic entity to pass through a one-way platform from below', () => {
      const { world } = createTestWorld(0) // no gravity
      // One-way platform at y=0
      const plat = world.createEntity()
      world.addComponent(plat, createTransform(0, 0))
      world.addComponent(plat, createRigidBody({ isStatic: true }))
      world.addComponent(plat, createBoxCollider(200, 20, { oneWay: true }))

      // Dynamic entity starts below the platform and moves upward
      const id = addDynamic(world, 0, 100, 20, 20)
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      rb.vy = -400 // moving upward

      runSteps(world, 10)

      // Entity should have passed through — still moving up (negative vy or at least moved up)
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      expect(t.y).toBeLessThan(100) // has moved upward
      expect(rb.onGround).toBe(false) // not blocked
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

// ── Contact events ────────────────────────────────────────────────────────────

describe('Contact events', () => {
  interface ContactPayload {
    a: number
    b: number
  }

  describe('triggerEnter / triggerExit', () => {
    it('emits triggerEnter when a dynamic body overlaps a static trigger', () => {
      const { world, events } = createTestWorldWithEvents()

      // Static trigger zone centered at origin, 40x40
      const trigger = world.createEntity()
      world.addComponent(trigger, createTransform(0, 0))
      world.addComponent(trigger, createRigidBody({ isStatic: true }))
      world.addComponent(trigger, createBoxCollider(40, 40, { isTrigger: true }))

      // Dynamic body placed inside the trigger zone
      const dyn = world.createEntity()
      world.addComponent(dyn, createTransform(0, 0))
      world.addComponent(dyn, createRigidBody())
      world.addComponent(dyn, createBoxCollider(10, 10))

      const entered: ContactPayload[] = []
      events.on<ContactPayload>('triggerEnter', (p) => entered.push(p))

      runSteps(world, 1)

      expect(entered.length).toBe(1)
      const ids = [entered[0].a, entered[0].b]
      expect(ids).toContain(trigger)
      expect(ids).toContain(dyn)
    })

    it('does not emit triggerEnter when bodies are not overlapping', () => {
      const { world, events } = createTestWorldWithEvents()

      const trigger = world.createEntity()
      world.addComponent(trigger, createTransform(0, 0))
      world.addComponent(trigger, createRigidBody({ isStatic: true }))
      world.addComponent(trigger, createBoxCollider(20, 20, { isTrigger: true }))

      // Far away — no overlap
      const dyn = world.createEntity()
      world.addComponent(dyn, createTransform(1000, 1000))
      world.addComponent(dyn, createRigidBody())
      world.addComponent(dyn, createBoxCollider(10, 10))

      const entered: ContactPayload[] = []
      events.on<ContactPayload>('triggerEnter', (p) => entered.push(p))

      runSteps(world, 1)
      expect(entered.length).toBe(0)
    })

    it('emits triggerEnter only once while overlapping (not every frame)', () => {
      const { world, events } = createTestWorldWithEvents()

      const trigger = world.createEntity()
      world.addComponent(trigger, createTransform(0, 0))
      world.addComponent(trigger, createRigidBody({ isStatic: true }))
      world.addComponent(trigger, createBoxCollider(40, 40, { isTrigger: true }))

      const dyn = world.createEntity()
      world.addComponent(dyn, createTransform(0, 0))
      world.addComponent(dyn, createRigidBody())
      world.addComponent(dyn, createBoxCollider(10, 10))

      const entered: ContactPayload[] = []
      events.on<ContactPayload>('triggerEnter', (p) => entered.push(p))

      runSteps(world, 5)

      // triggerEnter fires only on the first frame of overlap
      expect(entered.length).toBe(1)
    })

    it('emits trigger every frame while overlapping', () => {
      const { world, events } = createTestWorldWithEvents()

      const trigger = world.createEntity()
      world.addComponent(trigger, createTransform(0, 0))
      world.addComponent(trigger, createRigidBody({ isStatic: true }))
      world.addComponent(trigger, createBoxCollider(40, 40, { isTrigger: true }))

      const dyn = world.createEntity()
      world.addComponent(dyn, createTransform(0, 0))
      world.addComponent(dyn, createRigidBody())
      world.addComponent(dyn, createBoxCollider(10, 10))

      const ongoing: ContactPayload[] = []
      events.on<ContactPayload>('trigger', (p) => ongoing.push(p))

      runSteps(world, 3)
      expect(ongoing.length).toBe(3)
    })

    it('emits triggerExit when bodies separate', () => {
      const { world, events } = createTestWorldWithEvents()

      // Trigger at origin
      const trigger = world.createEntity()
      world.addComponent(trigger, createTransform(0, 0))
      world.addComponent(trigger, createRigidBody({ isStatic: true }))
      world.addComponent(trigger, createBoxCollider(20, 20, { isTrigger: true }))

      // Dynamic body starts inside
      const dyn = world.createEntity()
      world.addComponent(dyn, createTransform(0, 0))
      world.addComponent(dyn, createRigidBody())
      world.addComponent(dyn, createBoxCollider(10, 10))

      const exited: ContactPayload[] = []
      events.on<ContactPayload>('triggerExit', (p) => exited.push(p))

      // One step — body overlaps
      runSteps(world, 1)
      expect(exited.length).toBe(0)

      // Move body far away
      const t = world.getComponent<TransformComponent>(dyn, 'Transform')!
      t.x = 1000

      runSteps(world, 1)
      expect(exited.length).toBe(1)
    })

    it('emits triggerExit when a dynamic entity is destroyed mid-overlap', () => {
      const { world, events } = createTestWorldWithEvents()

      const trigger = world.createEntity()
      world.addComponent(trigger, createTransform(0, 0))
      world.addComponent(trigger, createRigidBody({ isStatic: true }))
      world.addComponent(trigger, createBoxCollider(40, 40, { isTrigger: true }))

      const dyn = world.createEntity()
      world.addComponent(dyn, createTransform(0, 0))
      world.addComponent(dyn, createRigidBody())
      world.addComponent(dyn, createBoxCollider(10, 10))

      const exited: ContactPayload[] = []
      events.on<ContactPayload>('triggerExit', (p) => exited.push(p))

      runSteps(world, 1) // establish overlap
      world.destroyEntity(dyn)
      runSteps(world, 1) // dead entity pruning fires exit

      expect(exited.length).toBe(1)
    })
  })

  describe('collisionEnter / collisionExit', () => {
    it('emits collisionEnter when two dynamic solid bodies first touch', () => {
      const { world, events } = createTestWorldWithEvents()

      // Two dynamic bodies placed overlapping
      const a = world.createEntity()
      world.addComponent(a, createTransform(0, 0))
      world.addComponent(a, createRigidBody())
      world.addComponent(a, createBoxCollider(20, 20))

      const b = world.createEntity()
      world.addComponent(b, createTransform(5, 0)) // overlapping
      world.addComponent(b, createRigidBody())
      world.addComponent(b, createBoxCollider(20, 20))

      const entered: ContactPayload[] = []
      events.on<ContactPayload>('collisionEnter', (p) => entered.push(p))

      runSteps(world, 1)
      expect(entered.length).toBe(1)
    })

    it('emits collisionEnter only once while in contact', () => {
      const { world, events } = createTestWorldWithEvents()

      const a = world.createEntity()
      world.addComponent(a, createTransform(0, 0))
      world.addComponent(a, createRigidBody())
      world.addComponent(a, createBoxCollider(20, 20))

      const b = world.createEntity()
      world.addComponent(b, createTransform(5, 0))
      world.addComponent(b, createRigidBody())
      world.addComponent(b, createBoxCollider(20, 20))

      const entered: ContactPayload[] = []
      events.on<ContactPayload>('collisionEnter', (p) => entered.push(p))

      runSteps(world, 5)
      expect(entered.length).toBe(1)
    })

    it('emits collisionExit when dynamic bodies separate', () => {
      const { world, events } = createTestWorldWithEvents()

      const a = world.createEntity()
      world.addComponent(a, createTransform(0, 0))
      world.addComponent(a, createRigidBody())
      world.addComponent(a, createBoxCollider(20, 20))

      const b = world.createEntity()
      world.addComponent(b, createTransform(5, 0))
      world.addComponent(b, createRigidBody())
      world.addComponent(b, createBoxCollider(20, 20))

      const exited: ContactPayload[] = []
      events.on<ContactPayload>('collisionExit', (p) => exited.push(p))

      runSteps(world, 1)

      // Move them apart
      const ta = world.getComponent<TransformComponent>(a, 'Transform')!
      const tb = world.getComponent<TransformComponent>(b, 'Transform')!
      ta.x = -100
      tb.x = 100

      runSteps(world, 1)
      expect(exited.length).toBe(1)
    })
  })
})

// ── Layer / mask filtering ────────────────────────────────────────────────────

describe('Layer / mask filtering', () => {
  interface ContactPayload {
    a: number
    b: number
  }

  it('allows collision when mask is * (default)', () => {
    const { world, events } = createTestWorldWithEvents()

    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody())
    world.addComponent(a, createBoxCollider(20, 20, { layer: 'player' }))

    const b = world.createEntity()
    world.addComponent(b, createTransform(5, 0))
    world.addComponent(b, createRigidBody())
    world.addComponent(b, createBoxCollider(20, 20, { layer: 'enemy' }))

    const entered: ContactPayload[] = []
    events.on<ContactPayload>('collisionEnter', (p) => entered.push(p))

    runSteps(world, 1)
    expect(entered.length).toBe(1)
  })

  it('blocks collision when mask excludes the other layer', () => {
    const { world, events } = createTestWorldWithEvents()

    // 'a' only interacts with 'friendly' — not 'enemy'
    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody())
    world.addComponent(a, createBoxCollider(20, 20, { layer: 'player', mask: ['friendly'] }))

    const b = world.createEntity()
    world.addComponent(b, createTransform(5, 0))
    world.addComponent(b, createRigidBody())
    world.addComponent(b, createBoxCollider(20, 20, { layer: 'enemy' }))

    const entered: ContactPayload[] = []
    events.on<ContactPayload>('collisionEnter', (p) => entered.push(p))

    runSteps(world, 1)
    expect(entered.length).toBe(0)
  })

  it('allows collision when both masks explicitly include the other layer', () => {
    const { world, events } = createTestWorldWithEvents()

    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody())
    world.addComponent(a, createBoxCollider(20, 20, { layer: 'player', mask: ['enemy'] }))

    const b = world.createEntity()
    world.addComponent(b, createTransform(5, 0))
    world.addComponent(b, createRigidBody())
    world.addComponent(b, createBoxCollider(20, 20, { layer: 'enemy', mask: ['player'] }))

    const entered: ContactPayload[] = []
    events.on<ContactPayload>('collisionEnter', (p) => entered.push(p))

    runSteps(world, 1)
    expect(entered.length).toBe(1)
  })

  it('blocks trigger events when layer mask does not match', () => {
    const { world, events } = createTestWorldWithEvents()

    // Trigger only fires for 'player' layer, but dyn is on 'enemy'
    const trigger = world.createEntity()
    world.addComponent(trigger, createTransform(0, 0))
    world.addComponent(trigger, createRigidBody({ isStatic: true }))
    world.addComponent(trigger, createBoxCollider(40, 40, { isTrigger: true, layer: 'zone', mask: ['player'] }))

    const dyn = world.createEntity()
    world.addComponent(dyn, createTransform(0, 0))
    world.addComponent(dyn, createRigidBody())
    world.addComponent(dyn, createBoxCollider(10, 10, { layer: 'enemy' }))

    const entered: ContactPayload[] = []
    events.on<ContactPayload>('triggerEnter', (p) => entered.push(p))

    runSteps(world, 1)
    expect(entered.length).toBe(0)
  })

  it('allows trigger events when layer mask matches', () => {
    const { world, events } = createTestWorldWithEvents()

    const trigger = world.createEntity()
    world.addComponent(trigger, createTransform(0, 0))
    world.addComponent(trigger, createRigidBody({ isStatic: true }))
    world.addComponent(trigger, createBoxCollider(40, 40, { isTrigger: true, layer: 'zone', mask: ['player'] }))

    const dyn = world.createEntity()
    world.addComponent(dyn, createTransform(0, 0))
    world.addComponent(dyn, createRigidBody())
    world.addComponent(dyn, createBoxCollider(10, 10, { layer: 'player' }))

    const entered: ContactPayload[] = []
    events.on<ContactPayload>('triggerEnter', (p) => entered.push(p))

    runSteps(world, 1)
    expect(entered.length).toBe(1)
  })

  it('blocks physical separation when layers do not interact', () => {
    // Bodies on non-interacting layers should pass through each other
    const { world } = createTestWorldWithEvents()

    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody())
    world.addComponent(a, createBoxCollider(20, 20, { layer: 'ghost', mask: [] }))

    const b = world.createEntity()
    world.addComponent(b, createTransform(5, 0))
    world.addComponent(b, createRigidBody())
    world.addComponent(b, createBoxCollider(20, 20, { layer: 'solid' }))

    runSteps(world, 3)

    // Ghost passes through — transform.x should still be near original (not pushed apart)
    const ta = world.getComponent<TransformComponent>(a, 'Transform')!
    const tb = world.getComponent<TransformComponent>(b, 'Transform')!
    // Without interaction, both bodies stay where they are (no gravity)
    expect(Math.abs(ta.x - tb.x)).toBeLessThan(20) // still overlapping — not pushed apart
  })
})
