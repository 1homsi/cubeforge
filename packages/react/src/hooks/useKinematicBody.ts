import { useContext, useCallback } from 'react'
import type { RigidBodyComponent } from '@cubeforge/physics'
import type { TransformComponent } from '@cubeforge/core'
import { EngineContext, EntityContext } from '../context'

export interface KinematicBodyControls {
  /**
   * Move the entity by `(dx, dy)` pixels this frame, resolving collisions.
   * Call from a Script update function each frame.
   *
   * Returns the actual displacement after collision resolution.
   */
  moveAndCollide(dx: number, dy: number): { dx: number; dy: number }
  /**
   * Set the intended velocity (pixels/second). The Script update function
   * should then call `moveAndCollide(vx * dt, vy * dt)` each frame.
   */
  setVelocity(vx: number, vy: number): void
}

/**
 * Controls a kinematic body — an entity whose RigidBody has `isKinematic: true`.
 *
 * Kinematic bodies skip gravity and physics integration. You move them
 * manually each frame via `moveAndCollide`, which resolves static collisions.
 *
 * Must be used inside an `<Entity>` that has a `<RigidBody isKinematic />`.
 *
 * @example
 * ```tsx
 * function Door() {
 *   const kinematic = useKinematicBody()
 *   return (
 *     <Entity id="door">
 *       <RigidBody isKinematic />
 *       <BoxCollider width={20} height={60} />
 *       <Script update={(id, world, input, dt) => {
 *         kinematic.moveAndCollide(openSpeed * dt, 0)
 *       }} />
 *     </Entity>
 *   )
 * }
 * ```
 */
export function useKinematicBody(): KinematicBodyControls {
  const engine   = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  const moveAndCollide = useCallback((dx: number, dy: number): { dx: number; dy: number } => {
    const transform = engine.ecs.getComponent<TransformComponent>(entityId, 'Transform')
    if (!transform) return { dx: 0, dy: 0 }

    const startX = transform.x
    const startY = transform.y
    transform.x += dx
    transform.y += dy

    // Simple static collision resolution: push out of any overlapping static BoxColliders
    const BoxCollider = engine.ecs.getComponent(entityId, 'BoxCollider') as {
      type: 'BoxCollider'; width: number; height: number; offsetX: number; offsetY: number
    } | undefined
    if (BoxCollider) {
      const hw = BoxCollider.width / 2
      const hh = BoxCollider.height / 2
      for (const sid of engine.ecs.query('Transform', 'RigidBody', 'BoxCollider')) {
        if (sid === entityId) continue
        const rb = engine.ecs.getComponent<RigidBodyComponent>(sid, 'RigidBody')
        if (!rb?.isStatic) continue
        const st = engine.ecs.getComponent<TransformComponent>(sid, 'Transform')!
        const sc = engine.ecs.getComponent<{ type: 'BoxCollider'; width: number; height: number; offsetX: number; offsetY: number }>(sid, 'BoxCollider')!

        const acx = transform.x + BoxCollider.offsetX
        const acy = transform.y + BoxCollider.offsetY
        const bcx = st.x + sc.offsetX
        const bcy = st.y + sc.offsetY
        const ox = (hw + sc.width / 2) - Math.abs(acx - bcx)
        const oy = (hh + sc.height / 2) - Math.abs(acy - bcy)
        if (ox <= 0 || oy <= 0) continue
        // Resolve minimum axis
        if (ox < oy) {
          transform.x += acx < bcx ? -ox : ox
        } else {
          transform.y += acy < bcy ? -oy : oy
        }
      }
    }

    return { dx: transform.x - startX, dy: transform.y - startY }
  }, [engine.ecs, entityId])

  const setVelocity = useCallback((vx: number, vy: number): void => {
    const rb = engine.ecs.getComponent<RigidBodyComponent>(entityId, 'RigidBody')
    if (rb) { rb.vx = vx; rb.vy = vy }
  }, [engine.ecs, entityId])

  return { moveAndCollide, setVelocity }
}
