import { useContext, useEffect } from 'react'
import { createScript } from '@cubeforge/core'
import type { EntityId, ECSWorld } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import type { RigidBodyComponent } from '@cubeforge/physics'
import { EngineContext } from '@cubeforge/context'

export interface TopDownMovementOptions {
  speed?: number
  normalizeDiagonal?: boolean
  /**
   * How fast the entity reaches target speed when input is held (px/s²).
   * Higher = snappier. `Infinity` (default) = instant velocity assignment (legacy behaviour).
   */
  acceleration?: number
  /**
   * How fast the entity slows to zero when input is released (px/s²).
   * Defaults to `acceleration`. `Infinity` = instant stop (legacy behaviour).
   */
  deceleration?: number
}

function moveToward(current: number, target: number, maxDelta: number): number {
  const diff = target - current
  if (Math.abs(diff) <= maxDelta) return target
  return current + Math.sign(diff) * maxDelta
}

export function useTopDownMovement(entityId: EntityId, opts: TopDownMovementOptions = {}): void {
  const engine = useContext(EngineContext)!
  const { speed = 200, normalizeDiagonal = true, acceleration = Infinity, deceleration = acceleration } = opts

  useEffect(() => {
    const updateFn = (id: EntityId, world: ECSWorld, input: InputManager, dt: number) => {
      if (!world.hasEntity(id)) return
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
      if (!rb) return

      const left = input.isDown('ArrowLeft') || input.isDown('KeyA') || input.isDown('a') ? -1 : 0
      const right = input.isDown('ArrowRight') || input.isDown('KeyD') || input.isDown('d') ? 1 : 0
      const up = input.isDown('ArrowUp') || input.isDown('KeyW') || input.isDown('w') ? -1 : 0
      const down = input.isDown('ArrowDown') || input.isDown('KeyS') || input.isDown('s') ? 1 : 0

      let dx = left + right
      let dy = up + down

      if (normalizeDiagonal && dx !== 0 && dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy)
        dx /= len
        dy /= len
      }

      const targetVx = dx * speed
      const targetVy = dy * speed

      if (acceleration === Infinity && deceleration === Infinity) {
        // Legacy instant mode
        rb.vx = targetVx
        rb.vy = targetVy
      } else {
        const hasInput = dx !== 0 || dy !== 0
        const rate = hasInput ? acceleration : deceleration
        if (rate === Infinity) {
          rb.vx = targetVx
          rb.vy = targetVy
        } else {
          const maxDelta = rate * dt
          rb.vx = moveToward(rb.vx, targetVx, maxDelta)
          rb.vy = moveToward(rb.vy, targetVy, maxDelta)
        }
      }
    }

    engine.ecs.addComponent(entityId, createScript(updateFn))
    return () => engine.ecs.removeComponent(entityId, 'Script')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
