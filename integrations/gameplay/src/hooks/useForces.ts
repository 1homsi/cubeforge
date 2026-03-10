import { useContext, useMemo } from 'react'
import type { RigidBodyComponent } from '@cubeforge/physics'
import {
  addForce as _addForce,
  addTorque as _addTorque,
  addForceAtPoint as _addForceAtPoint,
  applyImpulse as _applyImpulse,
  applyTorqueImpulse as _applyTorqueImpulse,
  applyImpulseAtPoint as _applyImpulseAtPoint,
  resetForces as _resetForces,
  resetTorques as _resetTorques,
  setNextKinematicPosition as _setNextKinematicPosition,
  setNextKinematicRotation as _setNextKinematicRotation,
} from '@cubeforge/physics'
import type { TransformComponent } from '@cubeforge/core'
import { EngineContext, EntityContext } from '@cubeforge/context'

export interface ForceControls {
  /** Add a force (continuous — call every frame). Accumulated until next step. */
  addForce(fx: number, fy: number): void
  /** Add torque (continuous — call every frame). */
  addTorque(t: number): void
  /** Add a force at a world-space point, generating both force and torque. */
  addForceAtPoint(fx: number, fy: number, px: number, py: number): void
  /** Apply an instant impulse (one-time velocity change). */
  applyImpulse(ix: number, iy: number): void
  /** Apply an instant torque impulse. */
  applyTorqueImpulse(t: number): void
  /** Apply an impulse at a world-space point. */
  applyImpulseAtPoint(ix: number, iy: number, px: number, py: number): void
  /** Zero the force accumulator. */
  resetForces(): void
  /** Zero the torque accumulator. */
  resetTorques(): void
  /** Set kinematic position target — engine computes velocity from delta. */
  setNextKinematicPosition(x: number, y: number): void
  /** Set kinematic rotation target — engine computes angular velocity from delta. */
  setNextKinematicRotation(angle: number): void
  /** Set velocity directly. */
  setVelocity(vx: number, vy: number): void
  /** Set angular velocity directly. */
  setAngularVelocity(w: number): void
}

/**
 * Returns force/impulse controls bound to the current entity.
 *
 * ```tsx
 * function Rocket() {
 *   const { addForce } = useForces()
 *   return <Script update={(id, world, input, dt) => {
 *     if (input.isKeyDown('ArrowUp')) addForce(0, -1000)
 *   }} />
 * }
 * ```
 */
export function useForces(): ForceControls {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  return useMemo(() => {
    const getRb = () => engine.ecs.getComponent<RigidBodyComponent>(entityId, 'RigidBody')
    const getTransform = () => engine.ecs.getComponent<TransformComponent>(entityId, 'Transform')

    // Compute center — use transform position (center of mass approximation)
    const getCenter = (): { cx: number; cy: number } => {
      const t = getTransform()
      return t ? { cx: t.x, cy: t.y } : { cx: 0, cy: 0 }
    }

    return {
      addForce(fx: number, fy: number) {
        const rb = getRb()
        if (rb) _addForce(rb, fx, fy)
      },
      addTorque(t: number) {
        const rb = getRb()
        if (rb) _addTorque(rb, t)
      },
      addForceAtPoint(fx: number, fy: number, px: number, py: number) {
        const rb = getRb()
        if (!rb) return
        const { cx, cy } = getCenter()
        _addForceAtPoint(rb, fx, fy, px, py, cx, cy)
      },
      applyImpulse(ix: number, iy: number) {
        const rb = getRb()
        if (rb) _applyImpulse(rb, ix, iy)
      },
      applyTorqueImpulse(t: number) {
        const rb = getRb()
        if (rb) _applyTorqueImpulse(rb, t)
      },
      applyImpulseAtPoint(ix: number, iy: number, px: number, py: number) {
        const rb = getRb()
        if (!rb) return
        const { cx, cy } = getCenter()
        _applyImpulseAtPoint(rb, ix, iy, px, py, cx, cy)
      },
      resetForces() {
        const rb = getRb()
        if (rb) _resetForces(rb)
      },
      resetTorques() {
        const rb = getRb()
        if (rb) _resetTorques(rb)
      },
      setNextKinematicPosition(x: number, y: number) {
        const rb = getRb()
        if (rb) _setNextKinematicPosition(rb, x, y)
      },
      setNextKinematicRotation(angle: number) {
        const rb = getRb()
        if (rb) _setNextKinematicRotation(rb, angle)
      },
      setVelocity(vx: number, vy: number) {
        const rb = getRb()
        if (rb) {
          rb.vx = vx
          rb.vy = vy
        }
      },
      setAngularVelocity(w: number) {
        const rb = getRb()
        if (rb) rb.angularVelocity = w
      },
    }
  }, [engine.ecs, entityId])
}
