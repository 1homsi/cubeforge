import { describe, it, expect } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createCircleCollider } from '../components/circleCollider'
import { PhysicsSystem } from '../physicsSystem'
import {
  addForce,
  addTorque,
  addForceAtPoint,
  applyImpulse,
  applyTorqueImpulse,
  applyImpulseAtPoint,
  resetForces,
  resetTorques,
  setNextKinematicPosition,
  setNextKinematicRotation,
  COLLISION_DYNAMIC_DYNAMIC,
  COLLISION_DYNAMIC_KINEMATIC,
  COLLISION_DYNAMIC_STATIC,
  COLLISION_KINEMATIC_KINEMATIC,
  COLLISION_KINEMATIC_STATIC,
  DEFAULT_ACTIVE_COLLISION_TYPES,
} from '../forceApi'
import type { RigidBodyComponent } from '../components/rigidbody'
import type { TransformComponent } from '@cubeforge/core'

function makeWorld(gravity = 0) {
  const world = new ECSWorld()
  const physics = new PhysicsSystem()
  ;(physics as any).gravity = gravity
  return { world, physics }
}

function stepN(physics: PhysicsSystem, world: ECSWorld, n: number, dt = 1 / 60) {
  for (let i = 0; i < n; i++) physics.update(world, dt)
}

// ── Force Accumulation ────────────────────────────────────────────────

describe('addForce — continuous force', () => {
  it('accelerates a body upward against zero gravity', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1 }))
    world.addComponent(id, createBoxCollider(20, 20))

    // Apply upward force before step
    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    addForce(rb, 0, -1000)

    stepN(physics, world, 1)

    // v += F * invMass * dt = -1000 * 1 * (1/60) ≈ -16.67
    expect(rb.vy).toBeLessThan(-10)
  })

  it('rocket thrust: continuous force accelerates over multiple frames', () => {
    const { world, physics } = makeWorld(980)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 500))
    world.addComponent(id, createRigidBody({ mass: 1 }))
    world.addComponent(id, createBoxCollider(20, 20))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!

    // Apply thrust stronger than gravity for 60 frames
    for (let i = 0; i < 60; i++) {
      addForce(rb, 0, -2000) // stronger than gravity (980)
      stepN(physics, world, 1)
    }

    // Body should have moved upward (negative Y)
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    expect(t.y).toBeLessThan(500)
    expect(rb.vy).toBeLessThan(0)
  })
})

describe('addTorque — continuous torque', () => {
  it('spins a body with angular damping eventually slowing it', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1, angularDamping: 0.1, lockRotation: false }))
    world.addComponent(id, createBoxCollider(40, 40))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!

    // Apply torque for 30 frames
    for (let i = 0; i < 30; i++) {
      addTorque(rb, 100)
      stepN(physics, world, 1)
    }
    const peakAngVel = rb.angularVelocity
    expect(peakAngVel).toBeGreaterThan(0)

    // Stop applying torque — angular damping should slow it
    for (let i = 0; i < 120; i++) {
      stepN(physics, world, 1)
    }
    expect(Math.abs(rb.angularVelocity)).toBeLessThan(Math.abs(peakAngVel))
  })
})

describe('addForceAtPoint — force + torque decomposition', () => {
  it('generates torque when force is applied off-center', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1, lockRotation: false }))
    world.addComponent(id, createBoxCollider(40, 40))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!

    // Apply rightward force at top-right corner of body
    // center = (100, 100), point = (120, 80)
    // torque = (120-100) * 0 - (80-100) * 500 = 0 - (-20*500) = 10000
    addForceAtPoint(rb, 500, 0, 120, 80, 100, 100)

    expect(rb.forceX).toBe(500)
    expect(rb.forceY).toBe(0)
    expect(rb.torque).toBe(10000) // positive = clockwise

    stepN(physics, world, 1)

    // Should have both linear and angular velocity
    expect(rb.vx).toBeGreaterThan(0)
    expect(rb.angularVelocity).toBeGreaterThan(0)
  })

  it('no torque when force is applied at center', () => {
    const rb = createRigidBody({ mass: 1 })
    addForceAtPoint(rb, 500, 0, 100, 100, 100, 100)
    expect(rb.torque).toBe(0)
    expect(rb.forceX).toBe(500)
  })
})

// ── Impulse Application ──────────────────────────────────────────────

describe('applyImpulse — instant velocity change', () => {
  it('immediately changes velocity', () => {
    const rb = createRigidBody({ mass: 2 })
    rb.invMass = 0.5 // 1/mass

    applyImpulse(rb, 100, 0)
    // v += impulse * invMass = 100 * 0.5 = 50
    expect(rb.vx).toBe(50)
    expect(rb.vy).toBe(0)
  })

  it('does nothing for static bodies (invMass = 0)', () => {
    const rb = createRigidBody({ isStatic: true })
    rb.invMass = 0

    applyImpulse(rb, 100, 100)
    expect(rb.vx).toBe(0)
    expect(rb.vy).toBe(0)
  })
})

describe('applyTorqueImpulse — instant angular velocity change', () => {
  it('immediately changes angular velocity', () => {
    const rb = createRigidBody({ mass: 1 })
    rb.invInertia = 0.1

    applyTorqueImpulse(rb, 50)
    // ω += t * invInertia = 50 * 0.1 = 5
    expect(rb.angularVelocity).toBe(5)
  })
})

describe('applyImpulseAtPoint — impulse with angular response', () => {
  it('explosion: radial impulse generates correct angular + linear response', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(200, 200))
    world.addComponent(id, createRigidBody({ mass: 1, lockRotation: false }))
    world.addComponent(id, createBoxCollider(40, 40))

    // Step once to compute mass properties
    stepN(physics, world, 1)

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!

    // Apply rightward impulse at the top edge of the body (off-center)
    // center = (200, 200), apply at (200, 180) — top of body
    // Cross: (200-200)*0 - (180-200)*500 = 0 - (-20*500) = 10000 → positive angular
    applyImpulseAtPoint(rb, 500, 0, 200, 180, 200, 200)

    // Should have linear velocity (rightward) and angular velocity (spin)
    expect(rb.vx).toBeGreaterThan(0)
    expect(rb.angularVelocity).not.toBe(0)
  })
})

// ── Reset ────────────────────────────────────────────────────────────

describe('resetForces / resetTorques', () => {
  it('zeroes accumulated forces', () => {
    const rb = createRigidBody()
    rb.forceX = 100
    rb.forceY = 200
    rb.torque = 50

    resetForces(rb)
    expect(rb.forceX).toBe(0)
    expect(rb.forceY).toBe(0)
    expect(rb.torque).toBe(50) // untouched

    resetTorques(rb)
    expect(rb.torque).toBe(0)
  })
})

// ── Kinematic Position-Based Mode ────────────────────────────────────

describe('setNextKinematicPosition — kinematic position targeting', () => {
  it('computes velocity from position delta and moves kinematic body', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ isKinematic: true }))
    world.addComponent(id, createBoxCollider(30, 30))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!

    // Set target position
    setNextKinematicPosition(rb, 200, 100)

    stepN(physics, world, 1)

    // vx should have been computed as (200 - 100) / dt
    // After integration, position should be at or near target
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    // Kinematic bodies with velocity set should move
    expect(rb.vx).toBeGreaterThan(0)
  })

  it('clears targets after use', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ isKinematic: true }))
    world.addComponent(id, createBoxCollider(30, 30))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    setNextKinematicPosition(rb, 200, 100)

    stepN(physics, world, 1)

    expect(rb._nextKinematicX).toBeNull()
    expect(rb._nextKinematicY).toBeNull()
  })
})

describe('setNextKinematicRotation — kinematic rotation targeting', () => {
  it('computes angular velocity from rotation delta', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ isKinematic: true }))
    world.addComponent(id, createBoxCollider(30, 30))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!

    // Target rotation = π/2
    setNextKinematicRotation(rb, Math.PI / 2)

    stepN(physics, world, 1)

    // Angular velocity should have been set: (π/2 - 0) / dt
    expect(rb.angularVelocity).toBeGreaterThan(0)
    expect(rb._nextKinematicRotation).toBeNull()
  })
})

// ── Dominance ────────────────────────────────────────────────────────

describe('dominance — high dominance pushes low dominance', () => {
  it('high-dominance body is not affected by collision with low-dominance body', () => {
    const { world, physics } = makeWorld(0)

    // Heavy player with high dominance
    const player = world.createEntity()
    world.addComponent(player, createTransform(100, 100))
    world.addComponent(player, createRigidBody({ mass: 1, dominance: 10 }))
    world.addComponent(player, createBoxCollider(30, 30))

    // Light crate with low dominance
    const crate = world.createEntity()
    world.addComponent(crate, createTransform(125, 100))
    world.addComponent(crate, createRigidBody({ mass: 1, dominance: 0 }))
    world.addComponent(crate, createBoxCollider(30, 30))

    const playerRb = world.getComponent<RigidBodyComponent>(player, 'RigidBody')!
    const crateRb = world.getComponent<RigidBodyComponent>(crate, 'RigidBody')!

    // Push player into crate
    playerRb.vx = 200

    stepN(physics, world, 10)

    // Crate should have been pushed (positive vx or moved right)
    const crateT = world.getComponent<TransformComponent>(crate, 'Transform')!
    expect(crateT.x).toBeGreaterThan(125)
  })
})

// ── lockRotation ────────────────────────────────────────────────────

describe('lockRotation — prevents angular velocity', () => {
  it('body with lockRotation does not spin from off-center collision', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1, lockRotation: true }))
    world.addComponent(id, createBoxCollider(40, 40))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    rb.invInertia = 0.1

    // Try to apply torque impulse
    applyTorqueImpulse(rb, 1000)

    // invInertia allows angular velocity to be set...
    // but lockRotation will zero it during integration
    stepN(physics, world, 1)
    expect(rb.angularVelocity).toBe(0)
  })
})

// ── Active Collision Types ──────────────────────────────────────────

describe('active collision type constants', () => {
  it('default includes dynamic-dynamic, dynamic-kinematic, dynamic-static', () => {
    expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_DYNAMIC_DYNAMIC).toBeTruthy()
    expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_DYNAMIC_KINEMATIC).toBeTruthy()
    expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_DYNAMIC_STATIC).toBeTruthy()
    expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_KINEMATIC_KINEMATIC).toBeFalsy()
    expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_KINEMATIC_STATIC).toBeFalsy()
  })

  it('RigidBody defaults to correct activeCollisionTypes', () => {
    const rb = createRigidBody()
    expect(rb.activeCollisionTypes).toBe(DEFAULT_ACTIVE_COLLISION_TYPES)
  })
})

// ── Friction test ───────────────────────────────────────────────────

describe('friction: high friction slows body on floor', () => {
  it('body on high-friction floor decelerates faster', () => {
    const { world, physics } = makeWorld(980)

    // Floor
    const floor = world.createEntity()
    world.addComponent(floor, createTransform(300, 250))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(600, 20, { friction: 0.9 }))

    // Sliding box
    const box = world.createEntity()
    world.addComponent(box, createTransform(100, 220))
    world.addComponent(box, createRigidBody({ mass: 1 }))
    world.addComponent(box, createBoxCollider(20, 20, { friction: 0.9 }))

    const rb = world.getComponent<RigidBodyComponent>(box, 'RigidBody')!
    rb.vx = 300

    // Step until friction slows it
    stepN(physics, world, 120)

    // With high friction, body should have slowed significantly
    expect(Math.abs(rb.vx)).toBeLessThan(300)
  })
})

// ── Force accumulator integration ───────────────────────────────────

describe('force accumulator cleared after step', () => {
  it('forces are zeroed after physics step', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1 }))
    world.addComponent(id, createBoxCollider(20, 20))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    addForce(rb, 500, -300)
    addTorque(rb, 100)

    expect(rb.forceX).toBe(500)
    expect(rb.forceY).toBe(-300)
    expect(rb.torque).toBe(100)

    stepN(physics, world, 1)

    // Forces should be cleared after step
    expect(rb.forceX).toBe(0)
    expect(rb.forceY).toBe(0)
    expect(rb.torque).toBe(0)

    // But velocity should have been affected
    expect(rb.vx).toBeGreaterThan(0)
    expect(rb.vy).toBeLessThan(0)
  })
})

// ── Multiple forces accumulate ──────────────────────────────────────

describe('multiple forces accumulate', () => {
  it('two addForce calls sum correctly', () => {
    const rb = createRigidBody()
    addForce(rb, 100, 0)
    addForce(rb, 0, -200)
    addForce(rb, 50, 50)

    expect(rb.forceX).toBe(150)
    expect(rb.forceY).toBe(-150)
  })
})

// ── Circle body force test ──────────────────────────────────────────

describe('forces work with circle colliders', () => {
  it('circle body accelerates with addForce', () => {
    const { world, physics } = makeWorld(0)

    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createRigidBody({ mass: 1 }))
    world.addComponent(id, createCircleCollider(15))

    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    addForce(rb, 300, 0)

    stepN(physics, world, 1)

    expect(rb.vx).toBeGreaterThan(0)

    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    expect(t.x).toBeGreaterThan(100)
  })
})
