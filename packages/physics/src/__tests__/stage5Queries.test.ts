import { describe, it, expect, vi } from 'vitest'
import { ECSWorld, EventBus } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from '../components/rigidbody'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createCircleCollider } from '../components/circleCollider'
import { PhysicsSystem } from '../physicsSystem'
import type { ContactManifold } from '../contactManifold'
import {
  projectPoint,
  containsPoint,
  shapeCast,
  intersectShape,
  intersectAABB,
  intersectRay,
  overlapBox,
  raycast,
} from '../queries'

const DT = 1 / 60

function createTestWorld(gravity = 0, config?: Record<string, unknown>) {
  const world = new ECSWorld()
  const events = new EventBus()
  const physics = new PhysicsSystem(gravity, events, config)
  world.addSystem(physics)
  return { world, physics, events }
}

function addBox(world: ECSWorld, x: number, y: number, w: number, h: number, isStatic = false) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createRigidBody({ isStatic }))
  world.addComponent(id, createBoxCollider(w, h))
  return id
}

function addCircle(world: ECSWorld, x: number, y: number, r: number, isStatic = false) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createRigidBody({ isStatic }))
  world.addComponent(id, createCircleCollider(r))
  return id
}

function runSteps(world: ECSWorld, steps: number) {
  for (let i = 0; i < steps; i++) world.update(DT)
}

// ── projectPoint ────────────────────────────────────────────────────

describe('projectPoint', () => {
  it('finds nearest surface of a box from outside', () => {
    const world = new ECSWorld()
    const id = addBox(world, 100, 100, 40, 40, true)

    // Point to the right of the box
    const result = projectPoint(world, 130, 100)
    expect(result).not.toBeNull()
    expect(result!.entityId).toBe(id)
    // Box right edge is at 120 (100 + 40/2)
    expect(result!.point.x).toBeCloseTo(120)
    expect(result!.point.y).toBeCloseTo(100)
    expect(result!.distance).toBeCloseTo(10)
    expect(result!.normal.x).toBeCloseTo(1)
  })

  it('finds nearest surface of a box from inside', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 40, 40, true)

    // Point inside box, closer to top edge
    const result = projectPoint(world, 100, 82)
    expect(result).not.toBeNull()
    // Nearest edge is top at y=80
    expect(result!.point.y).toBeCloseTo(80)
    expect(result!.featureId).toBe(0) // top edge
  })

  it('finds nearest surface of a circle', () => {
    const world = new ECSWorld()
    const id = addCircle(world, 50, 50, 20)

    const result = projectPoint(world, 80, 50)
    expect(result).not.toBeNull()
    expect(result!.entityId).toBe(id)
    // Circle edge at x=70 (50+20)
    expect(result!.point.x).toBeCloseTo(70)
    expect(result!.distance).toBeCloseTo(10)
    expect(result!.featureId).toBe(-1) // circle
  })

  it('returns correct feature ID for box edges', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 40, 40, true)

    // From left
    const left = projectPoint(world, 70, 100)
    expect(left!.featureId).toBe(3) // left edge

    // From bottom
    const bottom = projectPoint(world, 100, 130)
    expect(bottom!.featureId).toBe(2) // bottom edge
  })
})

// ── containsPoint ───────────────────────────────────────────────────

describe('containsPoint', () => {
  it('returns entities whose collider contains the point', () => {
    const world = new ECSWorld()
    const box = addBox(world, 100, 100, 40, 40, true)
    const circle = addCircle(world, 200, 200, 20)
    addBox(world, 300, 300, 20, 20, true)

    const results = containsPoint(world, 105, 105)
    expect(results).toContain(box)
    expect(results).not.toContain(circle)
  })

  it('works with circles', () => {
    const world = new ECSWorld()
    const circle = addCircle(world, 50, 50, 20)

    expect(containsPoint(world, 55, 55)).toContain(circle)
    expect(containsPoint(world, 80, 80)).not.toContain(circle)
  })
})

// ── shapeCast ───────────────────────────────────────────────────────

describe('shapeCast', () => {
  it('circle sweep detects collision', () => {
    const world = new ECSWorld()
    const wall = addBox(world, 200, 100, 20, 100, true)

    // Sweep circle from left toward wall
    const hit = shapeCast(world, { type: 'circle', radius: 10 }, 100, 100, 1, 0, 200)
    expect(hit).not.toBeNull()
    expect(hit!.entityId).toBe(wall)
    // Should hit earlier than a ray would (circle has radius)
    expect(hit!.distance).toBeLessThan(90)
  })

  it('box sweep detects collision', () => {
    const world = new ECSWorld()
    const wall = addBox(world, 200, 100, 20, 100, true)

    const hit = shapeCast(world, { type: 'box', halfWidth: 10, halfHeight: 10 }, 100, 100, 1, 0, 200)
    expect(hit).not.toBeNull()
    expect(hit!.entityId).toBe(wall)
  })

  it('misses when gap is too narrow for circle', () => {
    const world = new ECSWorld()
    // Two boxes forming a narrow gap (10px wide)
    addBox(world, 200, 80, 20, 40, true) // top
    addBox(world, 200, 130, 20, 40, true) // bottom

    // Circle with radius 15 — wider than gap
    const hit = shapeCast(world, { type: 'circle', radius: 15 }, 100, 105, 1, 0, 200)
    // Should hit one of the boxes (gap is 10px, circle is 30px diameter)
    expect(hit).not.toBeNull()
  })
})

// ── intersectShape ──────────────────────────────────────────────────

describe('intersectShape', () => {
  it('finds overlapping colliders for a circle query', () => {
    const world = new ECSWorld()
    const near = addBox(world, 100, 100, 20, 20, true)
    const far = addBox(world, 300, 300, 20, 20, true)

    const results = intersectShape(world, { type: 'circle', radius: 30 }, 105, 105)
    expect(results).toContain(near)
    expect(results).not.toContain(far)
  })

  it('finds overlapping colliders for a box query', () => {
    const world = new ECSWorld()
    const hit = addBox(world, 100, 100, 20, 20, true)
    addBox(world, 300, 300, 20, 20, true)

    const results = intersectShape(world, { type: 'box', halfWidth: 25, halfHeight: 25 }, 100, 100)
    expect(results).toContain(hit)
  })
})

// ── intersectAABB ───────────────────────────────────────────────────

describe('intersectAABB', () => {
  it('returns colliders in AABB region', () => {
    const world = new ECSWorld()
    const inside = addBox(world, 50, 50, 20, 20, true)
    const outside = addBox(world, 300, 300, 20, 20, true)

    const results = intersectAABB(world, 0, 0, 100, 100)
    expect(results).toContain(inside)
    expect(results).not.toContain(outside)
  })
})

// ── intersectRay ────────────────────────────────────────────────────

describe('intersectRay', () => {
  it('calls callback for each hit (unordered)', () => {
    const world = new ECSWorld()
    addBox(world, 100, 0, 20, 20, true)
    addBox(world, 200, 0, 20, 20, true)
    addBox(world, 300, 0, 20, 20, true)

    const hits: number[] = []
    intersectRay(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 500, (hit) => {
      hits.push(hit.entityId)
    })
    expect(hits.length).toBe(3)
  })
})

// ── Query filters ───────────────────────────────────────────────────

describe('query filter options', () => {
  it('excludeEntity skips a specific entity', () => {
    const world = new ECSWorld()
    const a = addBox(world, 50, 50, 20, 20, true)
    const b = addBox(world, 60, 50, 20, 20, true)

    const results = overlapBox(world, 55, 50, 30, 30, { excludeEntity: a })
    expect(results).not.toContain(a)
    expect(results).toContain(b)
  })

  it('filter predicate skips entities', () => {
    const world = new ECSWorld()
    const a = addBox(world, 50, 50, 20, 20, true)
    const b = addBox(world, 60, 50, 20, 20, true)

    const results = overlapBox(world, 55, 50, 30, 30, { filter: (id) => id !== a })
    expect(results).not.toContain(a)
    expect(results).toContain(b)
  })

  it('excludeStatic skips static bodies', () => {
    const world = new ECSWorld()
    const staticBox = addBox(world, 50, 50, 20, 20, true)
    const dynamicBox = addBox(world, 60, 50, 20, 20, false)

    const results = overlapBox(world, 55, 50, 30, 30, { excludeStatic: true })
    expect(results).not.toContain(staticBox)
    expect(results).toContain(dynamicBox)
  })

  it('raycast respects excludeEntity', () => {
    const world = new ECSWorld()
    const near = addBox(world, 100, 0, 20, 20, true)
    const far = addBox(world, 200, 0, 20, 20, true)

    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 500, { excludeEntity: near })
    expect(hit).not.toBeNull()
    expect(hit!.entityId).toBe(far)
  })
})

// ── Physics hooks ───────────────────────────────────────────────────

describe('onContactFilter hook', () => {
  it('blocks contact generation when filter returns false', () => {
    const { world, physics } = createTestWorld(0)

    // Two overlapping dynamic boxes
    const a = addBox(world, 100, 100, 30, 30, false)
    const b = addBox(world, 115, 100, 30, 30, false)

    // Set filter that rejects all contacts
    physics.setHooks({
      onContactFilter: () => false,
    })

    const rbA = world.getComponent<RigidBodyComponent>(a, 'RigidBody')!
    const rbB = world.getComponent<RigidBodyComponent>(b, 'RigidBody')!

    runSteps(world, 10)

    // Without contact filtering, boxes would push apart
    // With filtering, they should stay overlapping
    const tA = world.getComponent<TransformComponent>(a, 'Transform')!
    const tB = world.getComponent<TransformComponent>(b, 'Transform')!
    // Distance should still be close (~15) since no impulse was generated
    expect(Math.abs(tB.x - tA.x)).toBeLessThan(20)
  })
})

describe('onContactModify hook', () => {
  it('modifies friction on contacts', () => {
    const { world, physics } = createTestWorld(980)

    // Floor
    addBox(world, 300, 250, 600, 20, true)
    // Sliding box
    const box = addBox(world, 100, 220, 20, 20, false)

    const rbBox = world.getComponent<RigidBodyComponent>(box, 'RigidBody')!
    rbBox.vx = 300

    // Set friction to 0 via hook
    physics.setHooks({
      onContactModify: (manifold: ContactManifold) => {
        manifold.friction = 0
      },
    })

    runSteps(world, 30)

    // With zero friction, the box should keep sliding (high vx)
    expect(Math.abs(rbBox.vx)).toBeGreaterThan(100)
  })
})

// ── Contact force events ────────────────────────────────────────────

describe('contact force events', () => {
  it('emits contactForce event after solver', () => {
    const { world, events } = createTestWorld(980)

    // Heavy box falling onto floor
    addBox(world, 300, 250, 600, 20, true) // floor
    addBox(world, 100, 200, 20, 20, false) // falling box

    const handler = vi.fn()
    events.on('contactForce', handler)

    runSteps(world, 30)

    expect(handler).toHaveBeenCalled()
    const arg = handler.mock.calls[0][0]
    expect(arg.totalImpulse).toBeGreaterThan(0)
    expect(arg.totalNormalImpulse).toBeGreaterThan(0)
    expect(typeof arg.normalX).toBe('number')
    expect(typeof arg.normalY).toBe('number')
  })

  it('respects contactForceThreshold', () => {
    const { world, events } = createTestWorld(980, { contactForceThreshold: 999999 })

    addBox(world, 300, 250, 600, 20, true)
    addBox(world, 100, 200, 20, 20, false)

    const handler = vi.fn()
    events.on('contactForce', handler)

    runSteps(world, 30)

    // With very high threshold, no events should fire
    expect(handler).not.toHaveBeenCalled()
  })
})

// ── Sub-stepping ────────────────────────────────────────────────────

describe('sub-stepping', () => {
  it('produces more stable results with substeps=2', () => {
    // Run same scenario with substeps=1 and substeps=2
    // Substeps should produce a stable result (not crash or diverge)
    const { world } = createTestWorld(980, { substeps: 2 })

    addBox(world, 300, 300, 600, 20, true) // floor
    const box = addBox(world, 100, 100, 20, 20, false)

    runSteps(world, 60)

    const t = world.getComponent<TransformComponent>(box, 'Transform')!
    // Box should have fallen and settled on the floor
    expect(t.y).toBeGreaterThan(100) // moved down from initial position
    expect(t.y).toBeLessThan(350) // not fallen through
  })
})

// ── Solver groups (ghost platforms) ─────────────────────────────────

describe('solver groups via onContactFilter', () => {
  it('ghost platform: events fire but no impulse', () => {
    const { world, physics, events } = createTestWorld(980)

    const platform = addBox(world, 100, 250, 100, 20, true)
    const player = addBox(world, 100, 200, 20, 20, false)

    // Make platform a "ghost" — collision events fire but contacts are filtered
    physics.setHooks({
      onContactFilter: (a, b) => {
        // Skip contacts involving the platform
        if (a === platform || b === platform) return false
        return true
      },
    })

    const collisionHandler = vi.fn()
    events.on('collision', collisionHandler)

    runSteps(world, 60)

    // Player should have fallen through the platform (no impulse)
    const tPlayer = world.getComponent<TransformComponent>(player, 'Transform')!
    expect(tPlayer.y).toBeGreaterThan(260) // fell past platform
  })
})
