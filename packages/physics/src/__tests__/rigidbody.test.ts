import { describe, it, expect } from 'vitest'
import { createRigidBody } from '../components/rigidbody'

describe('createRigidBody', () => {
  describe('default values', () => {
    const rb = createRigidBody()

    it('type is RigidBody', () => {
      expect(rb.type).toBe('RigidBody')
    })

    it('default velocity is (0, 0)', () => {
      expect(rb.vx).toBe(0)
      expect(rb.vy).toBe(0)
    })

    it('default mass is 0 (auto-compute)', () => {
      expect(rb.mass).toBe(0)
    })

    it('default gravityScale is 1', () => {
      expect(rb.gravityScale).toBe(1)
    })

    it('default isStatic is false', () => {
      expect(rb.isStatic).toBe(false)
    })

    it('default onGround is false', () => {
      expect(rb.onGround).toBe(false)
    })

    it('default isNearGround is false', () => {
      expect(rb.isNearGround).toBe(false)
    })

    it('default bounce is 0', () => {
      expect(rb.bounce).toBe(0)
    })

    it('default friction is 0.85', () => {
      expect(rb.friction).toBe(0.85)
    })

    it('default lockX/lockY are false', () => {
      expect(rb.lockX).toBe(false)
      expect(rb.lockY).toBe(false)
    })

    it('default lockRotation is true', () => {
      expect(rb.lockRotation).toBe(true)
    })

    it('default isKinematic is false', () => {
      expect(rb.isKinematic).toBe(false)
    })

    it('default dropThrough is 0', () => {
      expect(rb.dropThrough).toBe(0)
    })

    it('default ccd is false', () => {
      expect(rb.ccd).toBe(false)
    })

    it('default angularVelocity is 0', () => {
      expect(rb.angularVelocity).toBe(0)
    })

    it('default damping values are 0', () => {
      expect(rb.angularDamping).toBe(0)
      expect(rb.linearDamping).toBe(0)
    })

    it('default sleeping is false', () => {
      expect(rb.sleeping).toBe(false)
    })

    it('default sleep config', () => {
      expect(rb.sleepTimer).toBe(0)
      expect(rb.sleepThreshold).toBe(0)
      expect(rb.sleepDelay).toBe(0)
    })

    it('default density is 1', () => {
      expect(rb.density).toBe(1)
    })

    it('default inverse mass/inertia are 0', () => {
      expect(rb.invMass).toBe(0)
      expect(rb.invInertia).toBe(0)
      expect(rb.inertia).toBe(0)
    })

    it('default forces are 0', () => {
      expect(rb.forceX).toBe(0)
      expect(rb.forceY).toBe(0)
      expect(rb.torque).toBe(0)
    })

    it('default restitution is 0', () => {
      expect(rb.restitution).toBe(0)
    })

    it('default dominance is 0', () => {
      expect(rb.dominance).toBe(0)
    })

    it('default enabled is true', () => {
      expect(rb.enabled).toBe(true)
    })

    it('default max velocities are 0 (unlimited)', () => {
      expect(rb.maxLinearVelocity).toBe(0)
      expect(rb.maxAngularVelocity).toBe(0)
    })

    it('default userData is null', () => {
      expect(rb.userData).toBeNull()
    })

    it('default additionalSolverIterations is 0', () => {
      expect(rb.additionalSolverIterations).toBe(0)
    })

    it('default kinematic targets are null', () => {
      expect(rb._nextKinematicX).toBeNull()
      expect(rb._nextKinematicY).toBeNull()
      expect(rb._nextKinematicRotation).toBeNull()
    })

    it('default activeCollisionTypes is 0b00111', () => {
      expect(rb.activeCollisionTypes).toBe(0b00111)
    })

    it('default _massPropertiesDirty is true', () => {
      expect(rb._massPropertiesDirty).toBe(true)
    })
  })

  describe('custom values', () => {
    it('accepts isStatic', () => {
      const rb = createRigidBody({ isStatic: true })
      expect(rb.isStatic).toBe(true)
    })

    it('accepts isKinematic', () => {
      const rb = createRigidBody({ isKinematic: true })
      expect(rb.isKinematic).toBe(true)
    })

    it('accepts lockRotation=false', () => {
      const rb = createRigidBody({ lockRotation: false })
      expect(rb.lockRotation).toBe(false)
    })

    it('accepts mass', () => {
      const rb = createRigidBody({ mass: 10 })
      expect(rb.mass).toBe(10)
    })

    it('accepts velocity', () => {
      const rb = createRigidBody({ vx: 100, vy: -50 })
      expect(rb.vx).toBe(100)
      expect(rb.vy).toBe(-50)
    })

    it('accepts gravityScale', () => {
      const rb = createRigidBody({ gravityScale: 0 })
      expect(rb.gravityScale).toBe(0)
    })

    it('accepts ccd', () => {
      const rb = createRigidBody({ ccd: true })
      expect(rb.ccd).toBe(true)
    })

    it('accepts damping values', () => {
      const rb = createRigidBody({ linearDamping: 0.5, angularDamping: 0.3 })
      expect(rb.linearDamping).toBe(0.5)
      expect(rb.angularDamping).toBe(0.3)
    })

    it('accepts density', () => {
      const rb = createRigidBody({ density: 2.5 })
      expect(rb.density).toBe(2.5)
    })

    it('accepts restitution', () => {
      const rb = createRigidBody({ restitution: 0.8 })
      expect(rb.restitution).toBe(0.8)
    })

    it('accepts dominance', () => {
      const rb = createRigidBody({ dominance: 5 })
      expect(rb.dominance).toBe(5)
    })

    it('accepts enabled=false', () => {
      const rb = createRigidBody({ enabled: false })
      expect(rb.enabled).toBe(false)
    })

    it('accepts userData', () => {
      const rb = createRigidBody({ userData: { name: 'player' } })
      expect(rb.userData).toEqual({ name: 'player' })
    })

    it('accepts sleep config', () => {
      const rb = createRigidBody({ sleepThreshold: 0.1, sleepDelay: 2.0 })
      expect(rb.sleepThreshold).toBe(0.1)
      expect(rb.sleepDelay).toBe(2.0)
    })

    it('accepts maxLinearVelocity', () => {
      const rb = createRigidBody({ maxLinearVelocity: 500 })
      expect(rb.maxLinearVelocity).toBe(500)
    })
  })
})
