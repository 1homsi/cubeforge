import { useContext, useEffect } from 'react'
import { createScript } from '@cubeforge/core'
import type { EntityId, ECSWorld } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import type { RigidBodyComponent } from '@cubeforge/physics'
import { EngineContext } from '@cubeforge/context'

export interface TopDownMovementOptions {
  speed?: number
  normalizeDiagonal?: boolean
}

export function useTopDownMovement(entityId: EntityId, opts: TopDownMovementOptions = {}): void {
  const engine = useContext(EngineContext)!
  const { speed = 200, normalizeDiagonal = true } = opts

  useEffect(() => {
    const updateFn = (id: EntityId, world: ECSWorld, input: InputManager) => {
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

      rb.vx = dx * speed
      rb.vy = dy * speed
    }

    engine.ecs.addComponent(entityId, createScript(updateFn))
    return () => engine.ecs.removeComponent(entityId, 'Script')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
