import { describe, it, expect } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createCircleCollider } from '../components/circleCollider'
import { createCapsuleCollider } from '../components/capsuleCollider'
import { CharacterController } from '../characterController'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from '../components/rigidbody'

function makeWorld() {
  return new ECSWorld()
}

function addBox(
  world: ECSWorld,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { isStatic?: boolean; mass?: number; isTrigger?: boolean },
) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createRigidBody({ mass: opts?.mass ?? 1, isStatic: opts?.isStatic ?? true }))
  world.addComponent(id, createBoxCollider(w, h, { isTrigger: opts?.isTrigger }))
  return id
}

// ── Basic Movement ────────────────────────────────────────────────────

describe('CharacterController — basic movement', () => {
  it('moves freely when no obstacles', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    const cc = new CharacterController()

    const result = cc.move(world, player, 10, 5)
    expect(result.dx).toBeCloseTo(10)
    expect(result.dy).toBeCloseTo(5)
    expect(result.grounded).toBe(false)
    expect(result.collisions).toHaveLength(0)
  })

  it('returns zero when entity has no Transform', () => {
    const world = makeWorld()
    const id = world.createEntity()
    const cc = new CharacterController()

    const result = cc.move(world, id, 10, 5)
    expect(result.dx).toBe(0)
    expect(result.dy).toBe(0)
  })

  it('returns zero when entity has no collider', () => {
    const world = makeWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(0, 0))
    world.addComponent(id, createRigidBody({ mass: 1 }))
    const cc = new CharacterController()

    const result = cc.move(world, id, 10, 5)
    expect(result.dx).toBe(0)
    expect(result.dy).toBe(0)
  })
})

// ── Collision Resolution ──────────────────────────────────────────────

describe('CharacterController — collision resolution', () => {
  it('stops when hitting a wall on the right', () => {
    const world = makeWorld()
    // Player at 100, wall at 130 (wall half-width 10, player half-width 10 → gap of 10)
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    addBox(world, 130, 100, 20, 40) // tall wall

    const cc = new CharacterController({ offset: 0 })
    const result = cc.move(world, player, 20, 0) // try to move 20 right, but wall is 10 away

    // Should be stopped — dx < 20
    expect(result.dx).toBeLessThan(20)
    expect(result.collisions.length).toBeGreaterThan(0)
  })

  it('detects grounded state when landing on platform', () => {
    const world = makeWorld()
    // Player at y=80, platform top at y=100 (platform center y=110, hh=10)
    const player = addBox(world, 100, 80, 20, 20, { isStatic: false })
    addBox(world, 100, 110, 200, 20) // wide platform below

    const cc = new CharacterController({ offset: 0 })
    const result = cc.move(world, player, 0, 20) // move down into platform

    expect(result.grounded).toBe(true)
    expect(result.collisions.length).toBeGreaterThan(0)
  })

  it('does not collide with self', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    const cc = new CharacterController()

    // Just the player entity — should move freely
    const result = cc.move(world, player, 50, 50)
    expect(result.dx).toBeCloseTo(50)
    expect(result.dy).toBeCloseTo(50)
    expect(result.collisions).toHaveLength(0)
  })
})

// ── Auto-step (stairs) ───────────────────────────────────────────────

describe('CharacterController — auto-step', () => {
  it('steps up onto a small ledge', () => {
    const world = makeWorld()
    // Player at y=90, step at y=96 (step hh=4, top at 92)
    // Player hh=10, bottom at 100. Step top at 92.
    // When moving right, X overlap triggers. oy = small → step up
    const player = addBox(world, 100, 90, 20, 20, { isStatic: false })
    // Small step right of player: center at (122, 96), w=20 h=8
    addBox(world, 122, 96, 20, 8)

    const cc = new CharacterController({ maxStepHeight: 10, offset: 0, minStepWidth: 1 })
    const result = cc.move(world, player, 15, 0)

    // Should have stepped up — grounded should be true
    expect(result.grounded).toBe(true)
  })

  it('does not step if obstacle is too tall', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    // Tall wall
    addBox(world, 125, 100, 10, 40)

    const cc = new CharacterController({ maxStepHeight: 5, offset: 0 })
    const result = cc.move(world, player, 20, 0)

    // Blocked, not stepped
    expect(result.dx).toBeLessThan(20)
  })

  it('respects minStepWidth — too narrow to step on', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 90, 20, 20, { isStatic: false })
    // Very narrow ledge (width=2)
    addBox(world, 122, 96, 2, 8)

    const cc = new CharacterController({ maxStepHeight: 10, offset: 0, minStepWidth: 8 })
    const result = cc.move(world, player, 15, 0)

    // Should NOT step — ledge is too narrow (2 < minStepWidth 8)
    expect(result.grounded).toBe(false)
  })
})

// ── Snap to Ground ───────────────────────────────────────────────────

describe('CharacterController — snap to ground', () => {
  it('snaps downward to ground when slightly airborne', () => {
    const world = makeWorld()
    // Player at y=90, platform surface at y=105 (center 110, hh=5)
    // Player bottom = 90 + 10 = 100, platform top = 105
    // Gap = 5px
    const player = addBox(world, 100, 90, 20, 20, { isStatic: false })
    addBox(world, 100, 110, 200, 10) // platform

    const cc = new CharacterController({ snapToGroundDistance: 10, offset: 0 })
    const result = cc.move(world, player, 5, 0) // horizontal movement only

    expect(result.grounded).toBe(true)
    expect(result.dy).toBeGreaterThan(0) // snapped downward
  })

  it('does not snap when jumping (negative dy)', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 90, 20, 20, { isStatic: false })
    addBox(world, 100, 110, 200, 10)

    const cc = new CharacterController({ snapToGroundDistance: 10, offset: 0 })
    // Moving upward (jumping) — desiredDy < 0
    const result = cc.move(world, player, 0, -5)

    // Should not snap — we're jumping
    // (grounded could be false or true depending on direct collision, but snap should not activate)
    // The key check: snap only activates when desiredDy >= 0
    expect(result.dy).toBeLessThan(0) // moved upward, not snapped down
  })
})

// ── Push Dynamic Bodies ──────────────────────────────────────────────

describe('CharacterController — push dynamic bodies', () => {
  it('applies impulse to dynamic body on collision', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    const crate = world.createEntity()
    world.addComponent(crate, createTransform(125, 100))
    world.addComponent(crate, createRigidBody({ mass: 2, invMass: 0.5 }))
    world.addComponent(crate, createBoxCollider(20, 40))

    const cc = new CharacterController({ pushForce: 1.0, offset: 0 })
    cc.move(world, player, 20, 0)

    const rb = world.getComponent<RigidBodyComponent>(crate, 'RigidBody')!
    // Impulse should have been applied in the push direction
    expect(rb.vx).not.toBe(0)
  })

  it('does not push static bodies', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    const wall = addBox(world, 125, 100, 20, 40, { isStatic: true })

    const cc = new CharacterController({ pushForce: 1.0, offset: 0 })
    cc.move(world, player, 20, 0)

    const rb = world.getComponent<RigidBodyComponent>(wall, 'RigidBody')!
    expect(rb.vx).toBe(0)
    expect(rb.vy).toBe(0)
  })

  it('respects pushForce = 0 (no pushing)', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    const crate = addBox(world, 125, 100, 20, 40, { isStatic: false, mass: 2 })

    const cc = new CharacterController({ pushForce: 0, offset: 0 })
    cc.move(world, player, 20, 0)

    const rb = world.getComponent<RigidBodyComponent>(crate, 'RigidBody')!
    expect(rb.vx).toBe(0)
    expect(rb.vy).toBe(0)
  })
})

// ── Circle & Capsule colliders ───────────────────────────────────────

describe('CharacterController — circle collider', () => {
  it('works with circle collider character', () => {
    const world = makeWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1 }))
    world.addComponent(id, createCircleCollider(10))

    const cc = new CharacterController()
    const result = cc.move(world, id, 10, 0)
    expect(result.dx).toBeCloseTo(10)
  })

  it('circle character collides with box obstacle', () => {
    const world = makeWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1 }))
    world.addComponent(id, createCircleCollider(10))

    // Wide, tall wall far enough that character hits it but doesn't pass through
    // Circle hw=10, wall hw=50, wall at x=160. Edge of wall = 110.
    // Moving 30 right → circle cx = 130, extends to 140. Wall starts at 110 → huge overlap.
    addBox(world, 160, 100, 100, 100)

    const cc = new CharacterController({ offset: 0 })
    const result = cc.move(world, id, 30, 0)
    expect(result.collisions.length).toBeGreaterThan(0)
  })
})

describe('CharacterController — capsule collider', () => {
  it('works with capsule collider character', () => {
    const world = makeWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1 }))
    world.addComponent(id, createCapsuleCollider(16, 32))

    const cc = new CharacterController()
    const result = cc.move(world, id, 10, 0)
    expect(result.dx).toBeCloseTo(10)
  })
})

// ── Filter ───────────────────────────────────────────────────────────

describe('CharacterController — filtering', () => {
  it('excludes entities via custom filter', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    const ghost = addBox(world, 120, 100, 20, 40)

    const cc = new CharacterController({ filter: (id) => id !== ghost, offset: 0 })
    const result = cc.move(world, player, 30, 0)

    // Ghost wall should be ignored
    expect(result.dx).toBeCloseTo(30)
    expect(result.collisions).toHaveLength(0)
  })

  it('excludes trigger colliders by default', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    addBox(world, 120, 100, 20, 40, { isTrigger: true })

    const cc = new CharacterController({ offset: 0 })
    const result = cc.move(world, player, 30, 0)

    // Trigger should be ignored
    expect(result.dx).toBeCloseTo(30)
  })

  it('includes triggers when excludeSensors is false', () => {
    const world = makeWorld()
    const player = addBox(world, 100, 100, 20, 20, { isStatic: false })
    // Large trigger wall ahead — player hw=10, wall hw=50 at x=160, edge at 110
    addBox(world, 160, 100, 100, 100, { isTrigger: true })

    const cc = new CharacterController({ excludeSensors: false, offset: 0 })
    const result = cc.move(world, player, 30, 0)

    // Now the trigger blocks
    expect(result.collisions.length).toBeGreaterThan(0)
  })
})

// ── Config defaults ──────────────────────────────────────────────────

describe('CharacterController — config', () => {
  it('uses sensible defaults', () => {
    const cc = new CharacterController()
    // Just verify it constructs without errors
    expect(cc).toBeDefined()
  })

  it('accepts all config options', () => {
    const cc = new CharacterController({
      upX: 0,
      upY: -1,
      offset: 0.5,
      maxSlopeClimbAngle: Math.PI / 6,
      minSlopeSlideAngle: Math.PI / 2,
      maxStepHeight: 12,
      minStepWidth: 4,
      stepOnDynamic: true,
      snapToGroundDistance: 8,
      pushForce: 2.0,
      filter: () => true,
      excludeSensors: false,
    })
    expect(cc).toBeDefined()
  })
})
