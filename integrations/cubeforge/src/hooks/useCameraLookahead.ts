import { useContext, useEffect } from 'react'
import type { EntityId, ECSWorld } from '@cubeforge/core'
import { createScript } from '@cubeforge/core'
import type { Camera2DComponent } from '@cubeforge/renderer'
import type { RigidBodyComponent } from '@cubeforge/physics'
import { EngineContext } from '@cubeforge/context'

export interface CameraLookaheadOptions {
  /**
   * Maximum lookahead offset in world pixels (default 100).
   * The camera leads by this many pixels in the entity's movement direction.
   */
  distance?: number
  /**
   * Lerp factor per second controlling how quickly the offset follows velocity (default 3).
   * Higher = snappier, lower = smoother.
   */
  smoothing?: number
  /**
   * Whether to apply vertical lookahead in addition to horizontal (default false).
   * Useful for top-down or platformers with vertical sections.
   */
  vertical?: boolean
}

/**
 * Automatically adjusts the active Camera2D's follow offset based on the
 * tracked entity's velocity, creating a smooth look-ahead effect.
 *
 * Must be used inside `<Game>`. The entity must have a `RigidBody` component.
 *
 * @example
 * function Player() {
 *   const id = useEntity()
 *   useCameraLookahead(id, { distance: 120, smoothing: 4 })
 *   return <RigidBody /><BoxCollider />
 * }
 */
export function useCameraLookahead(entityId: EntityId, opts: CameraLookaheadOptions = {}): void {
  const engine = useContext(EngineContext)!
  const { distance = 100, smoothing = 3, vertical = false } = opts

  useEffect(() => {
    let offsetX = 0
    let offsetY = 0

    const script = createScript((id: EntityId, world: ECSWorld, _input: unknown, dt: number) => {
      if (!world.hasEntity(id)) return
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
      if (!rb) return

      const cam = engine.ecs.queryOne('Camera2D')
      if (cam === undefined) return
      const camera = engine.ecs.getComponent<Camera2DComponent>(cam, 'Camera2D')
      if (!camera) return

      const targetX = Math.sign(rb.vx) * (Math.abs(rb.vx) > 10 ? distance : 0)
      const targetY = vertical ? Math.sign(rb.vy) * (Math.abs(rb.vy) > 10 ? distance : 0) : 0

      const t = Math.min(1, smoothing * dt)
      offsetX += (targetX - offsetX) * t
      offsetY += (targetY - offsetY) * t

      camera.followOffsetX = offsetX
      camera.followOffsetY = offsetY
    })

    engine.ecs.addComponent(entityId, script)
    return () => {
      // Reset offset when unmounted
      const cam = engine.ecs.queryOne('Camera2D')
      if (cam !== undefined) {
        const camera = engine.ecs.getComponent<Camera2DComponent>(cam, 'Camera2D')
        if (camera) {
          camera.followOffsetX = 0
          camera.followOffsetY = 0
        }
      }
      engine.ecs.removeComponent(entityId, 'Script')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distance, smoothing, vertical])
}
