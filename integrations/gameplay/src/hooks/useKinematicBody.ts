import { useContext, useCallback } from 'react'
import type { RigidBodyComponent } from '@cubeforge/physics'
import type { TransformComponent } from '@cubeforge/core'
import { EngineContext, EntityContext } from '@cubeforge/context'

export interface KinematicBodyControls {
  moveAndCollide(dx: number, dy: number): { dx: number; dy: number }
  setVelocity(vx: number, vy: number): void
}

export function useKinematicBody(): KinematicBodyControls {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  const moveAndCollide = useCallback(
    (dx: number, dy: number): { dx: number; dy: number } => {
      const transform = engine.ecs.getComponent<TransformComponent>(entityId, 'Transform')
      if (!transform) return { dx: 0, dy: 0 }

      const startX = transform.x
      const startY = transform.y
      transform.x += dx
      transform.y += dy

      const BoxCollider = engine.ecs.getComponent(entityId, 'BoxCollider') as
        | {
            type: 'BoxCollider'
            width: number
            height: number
            offsetX: number
            offsetY: number
          }
        | undefined
      if (BoxCollider) {
        const hw = BoxCollider.width / 2
        const hh = BoxCollider.height / 2
        for (const sid of engine.ecs.query('Transform', 'RigidBody', 'BoxCollider')) {
          if (sid === entityId) continue
          const rb = engine.ecs.getComponent<RigidBodyComponent>(sid, 'RigidBody')
          if (!rb?.isStatic) continue
          const st = engine.ecs.getComponent<TransformComponent>(sid, 'Transform')!
          const sc = engine.ecs.getComponent<{
            type: 'BoxCollider'
            width: number
            height: number
            offsetX: number
            offsetY: number
          }>(sid, 'BoxCollider')!

          const acx = transform.x + BoxCollider.offsetX
          const acy = transform.y + BoxCollider.offsetY
          const bcx = st.x + sc.offsetX
          const bcy = st.y + sc.offsetY
          const ox = hw + sc.width / 2 - Math.abs(acx - bcx)
          const oy = hh + sc.height / 2 - Math.abs(acy - bcy)
          if (ox <= 0 || oy <= 0) continue
          if (ox < oy) {
            transform.x += acx < bcx ? -ox : ox
          } else {
            transform.y += acy < bcy ? -oy : oy
          }
        }
      }

      return { dx: transform.x - startX, dy: transform.y - startY }
    },
    [engine.ecs, entityId],
  )

  const setVelocity = useCallback(
    (vx: number, vy: number): void => {
      const rb = engine.ecs.getComponent<RigidBodyComponent>(entityId, 'RigidBody')
      if (rb) {
        rb.vx = vx
        rb.vy = vy
      }
    },
    [engine.ecs, entityId],
  )

  return { moveAndCollide, setVelocity }
}
