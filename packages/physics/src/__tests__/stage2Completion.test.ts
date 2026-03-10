/**
 * Stage 2 completion tests — collision groups + extended spatial queries.
 */

import { describe, it, expect } from 'vitest'
import { ECSWorld, EventBus, createTransform, createTag } from '@cubeforge/core'
import { PhysicsSystem } from '../physicsSystem'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createCircleCollider } from '../components/circleCollider'
import { createCapsuleCollider } from '../components/capsuleCollider'
import { overlapBox, overlapCircle, raycast, raycastAll, sweepBox } from '../queries'

// ── Collision Groups ────────────────────────────────────────────────────────

describe('Collision groups', () => {
  it('entities in the same group do not collide', () => {
    const world = new ECSWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(0, events)

    // Two boxes in the same group moving toward each other
    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody({ vx: 100 }))
    world.addComponent(a, createBoxCollider(20, 20, { group: 'team-a' }))

    const b = world.createEntity()
    world.addComponent(b, createTransform(25, 0))
    world.addComponent(b, createRigidBody({ vx: -100 }))
    world.addComponent(b, createBoxCollider(20, 20, { group: 'team-a' }))

    // Step enough for them to pass through each other
    for (let i = 0; i < 30; i++) physics.update(world, 1 / 60)

    const ta = world.getComponent(a, 'Transform') as any
    const tb = world.getComponent(b, 'Transform') as any
    // They should have passed through — a moved right past b's start, b moved left past a's start
    expect(ta.x).toBeGreaterThan(25)
    expect(tb.x).toBeLessThan(0)
  })

  it('entities in different groups DO collide', () => {
    const world = new ECSWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(0, events)

    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody({ vx: 100 }))
    world.addComponent(a, createBoxCollider(20, 20, { group: 'team-a' }))

    const b = world.createEntity()
    world.addComponent(b, createTransform(25, 0))
    world.addComponent(b, createRigidBody({ vx: -100 }))
    world.addComponent(b, createBoxCollider(20, 20, { group: 'team-b' }))

    for (let i = 0; i < 30; i++) physics.update(world, 1 / 60)

    const ta = world.getComponent(a, 'Transform') as any
    const tb = world.getComponent(b, 'Transform') as any
    // They should have bounced apart
    expect(ta.x).toBeLessThan(tb.x)
  })

  it('empty group string does not prevent collision', () => {
    const world = new ECSWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(0, events)

    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody({ vx: 100 }))
    world.addComponent(a, createBoxCollider(20, 20)) // group defaults to ''

    const b = world.createEntity()
    world.addComponent(b, createTransform(25, 0))
    world.addComponent(b, createRigidBody({ vx: -100 }))
    world.addComponent(b, createBoxCollider(20, 20)) // group defaults to ''

    for (let i = 0; i < 30; i++) physics.update(world, 1 / 60)

    const ta = world.getComponent(a, 'Transform') as any
    const tb = world.getComponent(b, 'Transform') as any
    // Default empty group should still collide
    expect(ta.x).toBeLessThan(tb.x)
  })

  it('circle-circle same group passes through', () => {
    const world = new ECSWorld()
    const events = new EventBus()
    const physics = new PhysicsSystem(0, events)

    const a = world.createEntity()
    world.addComponent(a, createTransform(0, 0))
    world.addComponent(a, createRigidBody({ vx: 100 }))
    world.addComponent(a, createCircleCollider(10, { group: 'bullets' }))

    const b = world.createEntity()
    world.addComponent(b, createTransform(18, 0))
    world.addComponent(b, createRigidBody({ vx: -100 }))
    world.addComponent(b, createCircleCollider(10, { group: 'bullets' }))

    for (let i = 0; i < 30; i++) physics.update(world, 1 / 60)

    const ta = world.getComponent(a, 'Transform') as any
    const tb = world.getComponent(b, 'Transform') as any
    // Should pass through each other
    expect(ta.x).toBeGreaterThan(18)
    expect(tb.x).toBeLessThan(0)
  })
})

// ── Extended Spatial Queries ────────────────────────────────────────────────

describe('overlapBox with circle colliders', () => {
  it('detects circle colliders within the box', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(50, 50))
    world.addComponent(circle, createCircleCollider(10))

    const box = world.createEntity()
    world.addComponent(box, createTransform(200, 200))
    world.addComponent(box, createBoxCollider(20, 20))

    const results = overlapBox(world, 50, 50, 30, 30)
    expect(results).toContain(circle)
    expect(results).not.toContain(box) // box at 200,200 is NOT in overlap range
  })

  it('does not include out-of-range circles', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(200, 200))
    world.addComponent(circle, createCircleCollider(10))

    const results = overlapBox(world, 0, 0, 30, 30)
    expect(results).not.toContain(circle)
  })

  it('detects capsule colliders', () => {
    const world = new ECSWorld()

    const capsule = world.createEntity()
    world.addComponent(capsule, createTransform(10, 10))
    world.addComponent(capsule, createRigidBody())
    world.addComponent(capsule, createCapsuleCollider(20, 40))

    const results = overlapBox(world, 10, 10, 30, 30)
    expect(results).toContain(capsule)
  })
})

describe('overlapCircle with circle colliders', () => {
  it('detects circle-circle overlap', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(15, 0))
    world.addComponent(circle, createCircleCollider(10))

    const results = overlapCircle(world, 0, 0, 10)
    expect(results).toContain(circle) // circles overlap (distance=15, total radii=20)
  })

  it('does not include non-overlapping circles', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(25, 0))
    world.addComponent(circle, createCircleCollider(10))

    const results = overlapCircle(world, 0, 0, 10)
    expect(results).not.toContain(circle) // distance=25, total radii=20
  })

  it('detects box colliders within range', () => {
    const world = new ECSWorld()

    const box = world.createEntity()
    world.addComponent(box, createTransform(10, 0))
    world.addComponent(box, createBoxCollider(20, 20))

    const results = overlapCircle(world, 0, 0, 5)
    expect(results).toContain(box) // box extends from 0 to 20, circle at 0 with r=5
  })
})

describe('raycast with circle colliders', () => {
  it('hits a circle collider', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(50, 0))
    world.addComponent(circle, createCircleCollider(10))

    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 100)
    expect(hit).not.toBeNull()
    expect(hit!.entityId).toBe(circle)
    expect(hit!.distance).toBeCloseTo(40, 0) // circle at x=50, r=10 → hit at x=40
  })

  it('returns closest of box and circle', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(80, 0))
    world.addComponent(circle, createCircleCollider(10))

    const box = world.createEntity()
    world.addComponent(box, createTransform(40, 0))
    world.addComponent(box, createBoxCollider(20, 20))

    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 200)
    expect(hit).not.toBeNull()
    expect(hit!.entityId).toBe(box) // box is closer (at x=30..50 vs circle at x=70..90)
  })

  it('circle normal points outward from center', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(50, 0))
    world.addComponent(circle, createCircleCollider(10))

    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 100)
    expect(hit).not.toBeNull()
    // Normal should point back toward the ray origin (leftward)
    expect(hit!.normal.x).toBeLessThan(0)
  })
})

describe('raycastAll with mixed shapes', () => {
  it('returns all hits sorted by distance', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(80, 0))
    world.addComponent(circle, createCircleCollider(10))

    const box = world.createEntity()
    world.addComponent(box, createTransform(40, 0))
    world.addComponent(box, createBoxCollider(20, 20))

    const hits = raycastAll(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 200)
    expect(hits.length).toBe(2)
    expect(hits[0].entityId).toBe(box) // closer
    expect(hits[1].entityId).toBe(circle) // farther
    expect(hits[0].distance).toBeLessThan(hits[1].distance)
  })
})

describe('sweepBox with circle colliders', () => {
  it('detects sweep hitting a circle', () => {
    const world = new ECSWorld()

    const circle = world.createEntity()
    world.addComponent(circle, createTransform(80, 0))
    world.addComponent(circle, createCircleCollider(10))

    const hit = sweepBox(world, 0, 0, 20, 20, 200, 0)
    expect(hit).not.toBeNull()
    expect(hit!.entityId).toBe(circle)
    expect(hit!.distance).toBeLessThan(80)
  })
})
