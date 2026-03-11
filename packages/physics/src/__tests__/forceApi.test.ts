import { describe, it, expect } from 'vitest'
import { createRigidBody } from '../components/rigidbody'
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

describe('Force API', () => {
  describe('addForce', () => {
    it('accumulates force on rb', () => {
      const rb = createRigidBody()
      addForce(rb, 10, 20)
      expect(rb.forceX).toBe(10)
      expect(rb.forceY).toBe(20)
    })

    it('adds to existing forces', () => {
      const rb = createRigidBody()
      addForce(rb, 10, 20)
      addForce(rb, 5, 3)
      expect(rb.forceX).toBe(15)
      expect(rb.forceY).toBe(23)
    })
  })

  describe('addTorque', () => {
    it('accumulates torque', () => {
      const rb = createRigidBody()
      addTorque(rb, 5)
      expect(rb.torque).toBe(5)
    })

    it('adds to existing torque', () => {
      const rb = createRigidBody()
      addTorque(rb, 3)
      addTorque(rb, 7)
      expect(rb.torque).toBe(10)
    })
  })

  describe('addForceAtPoint', () => {
    it('adds force and computes torque from offset', () => {
      const rb = createRigidBody()
      // Force (0, 10) at point (5, 0), center (0, 0)
      // torque = (5-0)*10 - (0-0)*0 = 50
      addForceAtPoint(rb, 0, 10, 5, 0, 0, 0)
      expect(rb.forceX).toBe(0)
      expect(rb.forceY).toBe(10)
      expect(rb.torque).toBe(50)
    })

    it('generates no torque when force is applied at center', () => {
      const rb = createRigidBody()
      addForceAtPoint(rb, 10, 0, 0, 0, 0, 0)
      expect(rb.torque).toBe(0)
    })
  })

  describe('applyImpulse', () => {
    it('changes velocity based on invMass', () => {
      const rb = createRigidBody({ invMass: 0.5 })
      applyImpulse(rb, 10, 20)
      expect(rb.vx).toBe(5)
      expect(rb.vy).toBe(10)
    })

    it('does nothing when invMass is 0 (static)', () => {
      const rb = createRigidBody({ invMass: 0 })
      applyImpulse(rb, 100, 200)
      expect(rb.vx).toBe(0)
      expect(rb.vy).toBe(0)
    })
  })

  describe('applyTorqueImpulse', () => {
    it('changes angular velocity based on invInertia', () => {
      const rb = createRigidBody({ invInertia: 0.25 })
      applyTorqueImpulse(rb, 8)
      expect(rb.angularVelocity).toBe(2)
    })

    it('does nothing when invInertia is 0', () => {
      const rb = createRigidBody({ invInertia: 0 })
      applyTorqueImpulse(rb, 100)
      expect(rb.angularVelocity).toBe(0)
    })
  })

  describe('applyImpulseAtPoint', () => {
    it('changes linear and angular velocity', () => {
      const rb = createRigidBody({ invMass: 1, invInertia: 1 })
      // Impulse (0, 10) at point (5, 0), center (0, 0)
      // vx += 0*1 = 0, vy += 10*1 = 10
      // angular = ((5-0)*10 - (0-0)*0) * 1 = 50
      applyImpulseAtPoint(rb, 0, 10, 5, 0, 0, 0)
      expect(rb.vx).toBe(0)
      expect(rb.vy).toBe(10)
      expect(rb.angularVelocity).toBe(50)
    })

    it('generates no angular velocity when applied at center', () => {
      const rb = createRigidBody({ invMass: 1, invInertia: 1 })
      applyImpulseAtPoint(rb, 10, 0, 0, 0, 0, 0)
      expect(rb.angularVelocity).toBe(0)
    })
  })

  describe('resetForces', () => {
    it('zeroes force accumulator', () => {
      const rb = createRigidBody()
      addForce(rb, 100, 200)
      resetForces(rb)
      expect(rb.forceX).toBe(0)
      expect(rb.forceY).toBe(0)
    })
  })

  describe('resetTorques', () => {
    it('zeroes torque accumulator', () => {
      const rb = createRigidBody()
      addTorque(rb, 50)
      resetTorques(rb)
      expect(rb.torque).toBe(0)
    })
  })

  describe('setNextKinematicPosition', () => {
    it('sets kinematic position targets', () => {
      const rb = createRigidBody()
      setNextKinematicPosition(rb, 100, 200)
      expect(rb._nextKinematicX).toBe(100)
      expect(rb._nextKinematicY).toBe(200)
    })
  })

  describe('setNextKinematicRotation', () => {
    it('sets kinematic rotation target', () => {
      const rb = createRigidBody()
      setNextKinematicRotation(rb, Math.PI)
      expect(rb._nextKinematicRotation).toBeCloseTo(Math.PI)
    })
  })

  describe('collision type constants', () => {
    it('has correct bit values', () => {
      expect(COLLISION_DYNAMIC_DYNAMIC).toBe(1)
      expect(COLLISION_DYNAMIC_KINEMATIC).toBe(2)
      expect(COLLISION_DYNAMIC_STATIC).toBe(4)
      expect(COLLISION_KINEMATIC_KINEMATIC).toBe(8)
      expect(COLLISION_KINEMATIC_STATIC).toBe(16)
    })

    it('DEFAULT_ACTIVE_COLLISION_TYPES includes dynamic pairs', () => {
      expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_DYNAMIC_DYNAMIC).toBeTruthy()
      expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_DYNAMIC_KINEMATIC).toBeTruthy()
      expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_DYNAMIC_STATIC).toBeTruthy()
    })

    it('DEFAULT_ACTIVE_COLLISION_TYPES excludes kinematic pairs', () => {
      expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_KINEMATIC_KINEMATIC).toBeFalsy()
      expect(DEFAULT_ACTIVE_COLLISION_TYPES & COLLISION_KINEMATIC_STATIC).toBeFalsy()
    })

    it('DEFAULT_ACTIVE_COLLISION_TYPES equals 0b00111', () => {
      expect(DEFAULT_ACTIVE_COLLISION_TYPES).toBe(0b00111)
    })
  })
})
