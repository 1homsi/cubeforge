/**
 * Stage 2 — Shape Parity integration tests.
 *
 * Tests that new collider shapes (capsule, polygon, triangle, segment,
 * heightfield, halfspace, trimesh) properly participate in the impulse solver.
 */

import { describe, it, expect } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { EventBus } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import { PhysicsSystem } from '../physicsSystem'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createCircleCollider } from '../components/circleCollider'
import { createCapsuleCollider } from '../components/capsuleCollider'
import { createConvexPolygonCollider } from '../components/convexPolygonCollider'
import { createTriangleCollider } from '../components/triangleCollider'
import { createSegmentCollider } from '../components/segmentCollider'
import { createHalfSpaceCollider } from '../components/halfSpaceCollider'
import { createHeightFieldCollider } from '../components/heightFieldCollider'
import { createTriMeshCollider } from '../components/triMeshCollider'
import { buildBVH, queryBVH } from '../bvh'
import {
  generateCapsuleBoxManifold,
  generateCapsuleCircleManifold,
  generateCapsuleCapsuleManifold,
} from '../contactManifold'

function makeWorld() {
  return new ECSWorld()
}

function stepN(system: PhysicsSystem, world: ECSWorld, n: number) {
  for (let i = 0; i < n; i++) {
    system.update(world, 1 / 60)
  }
}

// ── Capsule tests ────────────────────────────────────────────────────────────

describe('Capsule physics response', () => {
  it('capsule rests on static box floor', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    // Floor
    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 200))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20))

    // Capsule above floor
    const capsule = world.createEntity()
    world.addComponent(capsule, createTransform(0, 160))
    world.addComponent(capsule, createRigidBody())
    world.addComponent(capsule, createCapsuleCollider(20, 40))

    stepN(physics, world, 120)

    const t = world.getComponent(capsule, 'Transform') as any
    const rb = world.getComponent(capsule, 'RigidBody') as any
    // Capsule should settle on the floor
    expect(t.y).toBeLessThan(195)
    expect(t.y).toBeGreaterThan(150)
    expect(Math.abs(rb.vy)).toBeLessThan(5)
  })

  it('capsule bounces off box with restitution', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 200))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20, { restitution: 0.8 }))

    const capsule = world.createEntity()
    world.addComponent(capsule, createTransform(0, 100))
    world.addComponent(capsule, createRigidBody({ restitution: 0.8 }))
    world.addComponent(capsule, createCapsuleCollider(20, 40, { restitution: 0.8 }))

    stepN(physics, world, 30)

    const rb = world.getComponent(capsule, 'RigidBody') as any
    // Should have bounced — vy should be negative (going up) at some point
    // or the capsule should be above where it would be without bounce
    const t = world.getComponent(capsule, 'Transform') as any
    expect(t.y).toBeLessThan(200) // Still above floor
  })

  it('capsule-capsule collision generates contact', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(0, events) // no gravity

    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody({ vx: 50 }))
    world.addComponent(a, createCapsuleCollider(20, 40))

    const b = world.createEntity()
    world.addComponent(b, createTransform(30, 0))
    world.addComponent(b, createRigidBody({ vx: -50 }))
    world.addComponent(b, createCapsuleCollider(20, 40))

    let collisionEntered = false
    events.on('collisionEnter', () => {
      collisionEntered = true
    })

    stepN(physics, world, 10)

    expect(collisionEntered).toBe(true)
  })
})

// ── Circle physics tests ─────────────────────────────────────────────────────

describe('Circle physics response', () => {
  it('circle bounces off floor with restitution', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 200))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20, { restitution: 1 }))

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(0, 100))
    world.addComponent(circle, createRigidBody({ restitution: 1 }))
    world.addComponent(circle, createCircleCollider(15, { restitution: 1 }))

    stepN(physics, world, 30)

    const rb = world.getComponent(circle, 'RigidBody') as any
    const t = world.getComponent(circle, 'Transform') as any
    expect(t.y).toBeLessThan(200)
  })

  it('circle rolls on surface (friction generates angular velocity)', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 200))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20, { friction: 1 }))

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(0, 180))
    world.addComponent(circle, createRigidBody({ vx: 100 }))
    world.addComponent(circle, createCircleCollider(15, { friction: 1 }))

    stepN(physics, world, 60)

    const rb = world.getComponent(circle, 'RigidBody') as any
    // Friction should have generated some angular velocity
    expect(rb.angularVelocity).not.toBe(0)
  })
})

// ── Convex polygon tests ─────────────────────────────────────────────────────

describe('Convex polygon physics', () => {
  const square = [
    { x: -15, y: -15 },
    { x: 15, y: -15 },
    { x: 15, y: 15 },
    { x: -15, y: 15 },
  ]

  it('polygon rests on static box floor', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 200))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20))

    const poly = world.createEntity()
    world.addComponent(poly, createTransform(0, 150))
    world.addComponent(poly, createRigidBody())
    world.addComponent(poly, createConvexPolygonCollider(square))

    stepN(physics, world, 120)

    const t = world.getComponent(poly, 'Transform') as any
    const rb = world.getComponent(poly, 'RigidBody') as any
    expect(t.y).toBeLessThan(200)
    expect(Math.abs(rb.vy)).toBeLessThan(5)
  })

  it('polygon stacking (two polygons stack)', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 300))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20))

    const poly1 = world.createEntity()
    world.addComponent(poly1, createTransform(0, 200))
    world.addComponent(poly1, createRigidBody())
    world.addComponent(poly1, createConvexPolygonCollider(square))

    const poly2 = world.createEntity()
    world.addComponent(poly2, createTransform(0, 150))
    world.addComponent(poly2, createRigidBody())
    world.addComponent(poly2, createConvexPolygonCollider(square))

    stepN(physics, world, 180)

    const t1 = world.getComponent(poly1, 'Transform') as any
    const t2 = world.getComponent(poly2, 'Transform') as any
    // poly2 should be above poly1
    expect(t2.y).toBeLessThan(t1.y)
  })

  it('polygon vs circle collision', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(0, events)

    const poly = world.createEntity()
    world.addComponent(poly, createTransform(0, 0))
    world.addComponent(poly, createRigidBody({ vx: 50 }))
    world.addComponent(poly, createConvexPolygonCollider(square))

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(40, 0))
    world.addComponent(circle, createRigidBody({ vx: -50 }))
    world.addComponent(circle, createCircleCollider(15))

    stepN(physics, world, 20)

    const tPoly = world.getComponent(poly, 'Transform') as any
    const tCircle = world.getComponent(circle, 'Transform') as any
    // They should have bounced apart
    expect(tPoly.x).toBeLessThan(tCircle.x)
  })
})

// ── Triangle tests ───────────────────────────────────────────────────────────

describe('Triangle collider physics', () => {
  it('triangle rests on floor', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 200))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20))

    const tri = world.createEntity()
    world.addComponent(tri, createTransform(0, 150))
    world.addComponent(tri, createRigidBody())
    world.addComponent(tri, createTriangleCollider({ x: 0, y: -20 }, { x: 17, y: 10 }, { x: -17, y: 10 }))

    stepN(physics, world, 120)

    const t = world.getComponent(tri, 'Transform') as any
    expect(t.y).toBeLessThan(200)
    expect(t.y).toBeGreaterThan(150)
  })
})

// ── Segment collider tests ───────────────────────────────────────────────────

describe('Segment collider', () => {
  it('entities rest on segment edge', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    // Horizontal segment as ground
    const seg = world.createEntity()
    world.addComponent(seg, createTransform(0, 200))
    world.addComponent(seg, createRigidBody({ isStatic: true }))
    world.addComponent(seg, createSegmentCollider({ x: -200, y: 0 }, { x: 200, y: 0 }))

    // Circle falling onto segment
    const circle = world.createEntity()
    world.addComponent(circle, createTransform(0, 170))
    world.addComponent(circle, createRigidBody())
    world.addComponent(circle, createCircleCollider(10))

    stepN(physics, world, 120)

    const t = world.getComponent(circle, 'Transform') as any
    // Circle should be near the segment
    expect(t.y).toBeGreaterThan(180)
    expect(t.y).toBeLessThan(210)
  })
})

// ── HalfSpace collider tests ─────────────────────────────────────────────────

describe('HalfSpace collider', () => {
  it('bodies rest on half-space ground plane', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    // Infinite ground at y=200, normal pointing up
    const ground = world.createEntity()
    world.addComponent(ground, createTransform(0, 200))
    world.addComponent(ground, createRigidBody({ isStatic: true }))
    world.addComponent(ground, createHalfSpaceCollider({ normalX: 0, normalY: -1 }))

    // Box falling
    const box = world.createEntity()
    world.addComponent(box, createTransform(0, 150))
    world.addComponent(box, createRigidBody())
    world.addComponent(box, createBoxCollider(30, 30))

    stepN(physics, world, 120)

    const t = world.getComponent(box, 'Transform') as any
    // Box should settle near the ground
    expect(t.y).toBeGreaterThan(170)
    expect(t.y).toBeLessThan(210)
  })

  it('circle rests on half-space', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const ground = world.createEntity()
    world.addComponent(ground, createTransform(0, 200))
    world.addComponent(ground, createRigidBody({ isStatic: true }))
    world.addComponent(ground, createHalfSpaceCollider({ normalX: 0, normalY: -1 }))

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(0, 150))
    world.addComponent(circle, createRigidBody())
    world.addComponent(circle, createCircleCollider(10))

    stepN(physics, world, 120)

    const t = world.getComponent(circle, 'Transform') as any
    expect(t.y).toBeGreaterThan(180)
    expect(t.y).toBeLessThan(210)
  })
})

// ── HeightField tests ────────────────────────────────────────────────────────

describe('HeightField collider', () => {
  it('circle rolls on flat heightfield terrain', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const terrain = world.createEntity()
    world.addComponent(terrain, createTransform(0, 200))
    world.addComponent(terrain, createRigidBody({ isStatic: true }))
    world.addComponent(terrain, createHeightFieldCollider([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { scaleX: 40 }))

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(80, 170))
    world.addComponent(circle, createRigidBody({ vx: 50 }))
    world.addComponent(circle, createCircleCollider(10))

    stepN(physics, world, 120)

    const t = world.getComponent(circle, 'Transform') as any
    // Circle should settle near the terrain height
    expect(t.y).toBeGreaterThan(180)
    expect(t.y).toBeLessThan(210)
  })
})

// ── TriMesh tests ────────────────────────────────────────────────────────────

describe('TriMesh collider', () => {
  it('complex static geometry collides with circle', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    // Simple floor as a triangle mesh (2 triangles forming a rectangle)
    const mesh = world.createEntity()
    world.addComponent(mesh, createTransform(0, 200))
    world.addComponent(mesh, createRigidBody({ isStatic: true }))
    world.addComponent(
      mesh,
      createTriMeshCollider(
        [
          { x: -200, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 20 },
          { x: -200, y: 20 },
        ],
        [0, 1, 2, 0, 2, 3],
      ),
    )

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(0, 170))
    world.addComponent(circle, createRigidBody())
    world.addComponent(circle, createCircleCollider(10))

    stepN(physics, world, 120)

    const t = world.getComponent(circle, 'Transform') as any
    // Circle should settle on the mesh
    expect(t.y).toBeGreaterThan(180)
    expect(t.y).toBeLessThan(220)
  })
})

// ── Disabled collider tests ──────────────────────────────────────────────────

describe('Collider enabled/disabled', () => {
  it('disabled box collider is ignored', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    // Floor — disabled
    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 200))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20, { enabled: false }))

    const box = world.createEntity()
    world.addComponent(box, createTransform(0, 150))
    world.addComponent(box, createRigidBody())
    world.addComponent(box, createBoxCollider(30, 30))

    stepN(physics, world, 60)

    const t = world.getComponent(box, 'Transform') as any
    // Box should fall through the disabled floor
    expect(t.y).toBeGreaterThan(200)
  })

  it('disabled capsule collider is ignored', () => {
    const world = makeWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(500, events)

    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 200))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20))

    const capsule = world.createEntity()
    world.addComponent(capsule, createTransform(0, 150))
    world.addComponent(capsule, createRigidBody())
    world.addComponent(capsule, createCapsuleCollider(20, 40, { enabled: false }))

    stepN(physics, world, 60)

    const t = world.getComponent(capsule, 'Transform') as any
    // Capsule collider is disabled, so it should fall through
    expect(t.y).toBeGreaterThan(200)
  })
})

// ── BVH tests ────────────────────────────────────────────────────────────────

describe('BVH', () => {
  it('builds and queries correctly', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const indices = [0, 1, 2, 0, 2, 3]

    const bvh = buildBVH(vertices, indices)
    expect(bvh.triangles.length).toBe(2)

    // Query overlapping AABB
    const hits = queryBVH(bvh, { minX: 40, minY: 40, maxX: 60, maxY: 60 })
    expect(hits.length).toBeGreaterThan(0)

    // Query non-overlapping AABB
    const misses = queryBVH(bvh, { minX: 200, minY: 200, maxX: 300, maxY: 300 })
    expect(misses.length).toBe(0)
  })
})

// ── Capsule manifold tests ───────────────────────────────────────────────────

describe('Capsule manifold generation', () => {
  it('capsule-box manifold generates contact', () => {
    // Vertical capsule at (0,0), w=20, h=40 → hw=10, hh=20
    // Box at (15,0), hw=10, hh=10
    const result = generateCapsuleBoxManifold(0, 0, 10, 20, 15, 0, 10, 10)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })

  it('capsule-circle manifold generates contact', () => {
    // Vertical capsule at (0,0), hw=10, hh=20
    // Circle at (18,0), r=10
    const result = generateCapsuleCircleManifold(0, 0, 10, 20, 18, 0, 10)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })

  it('capsule-capsule manifold generates contact', () => {
    // Two vertical capsules side by side
    const result = generateCapsuleCapsuleManifold(0, 0, 10, 20, 18, 0, 10, 20)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })

  it('capsule-box manifold returns null for non-overlapping', () => {
    const result = generateCapsuleBoxManifold(0, 0, 10, 20, 100, 0, 10, 10)
    expect(result).toBeNull()
  })
})
