import { useContext, useEffect } from 'react'
import { createScript } from '@cubeforge/core'
import type { EntityId, ECSWorld } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import type { RigidBodyComponent } from '@cubeforge/physics'
import type { SpriteComponent } from '@cubeforge/renderer'
import { EngineContext } from '../context'

export interface PlatformerControllerOptions {
  /** Horizontal move speed in px/s (default 200) */
  speed?: number
  /** Upward impulse on jump (default -500) */
  jumpForce?: number
  /** Max consecutive jumps, e.g. 2 for double jump (default 1) */
  maxJumps?: number
  /** Seconds after leaving ground the player can still jump (default 0.08) */
  coyoteTime?: number
  /** Seconds to buffer a jump input before landing (default 0.08) */
  jumpBuffer?: number
}

interface ControllerState {
  coyoteTimer: number
  jumpBuffer: number
  jumpsLeft: number
}

/**
 * Attaches platformer movement (WASD/Arrows + Space/Up to jump) to an entity.
 * The entity must already have a RigidBody component.
 *
 * @example
 * function Player() {
 *   const id = useEntity()
 *   usePlatformerController(id, { speed: 220, maxJumps: 2 })
 *   return (
 *     <Entity id="player">
 *       <Transform x={100} y={300} />
 *       <Sprite width={28} height={40} color="#4fc3f7" />
 *       <RigidBody />
 *       <BoxCollider width={26} height={40} />
 *     </Entity>
 *   )
 * }
 */
export function usePlatformerController(entityId: EntityId, opts: PlatformerControllerOptions = {}): void {
  const engine = useContext(EngineContext)!

  const {
    speed      = 200,
    jumpForce  = -500,
    maxJumps   = 1,
    coyoteTime = 0.08,
    jumpBuffer = 0.08,
  } = opts

  useEffect(() => {
    const state: ControllerState = { coyoteTimer: 0, jumpBuffer: 0, jumpsLeft: maxJumps }

    const updateFn = (id: EntityId, world: ECSWorld, input: InputManager, dt: number) => {
      if (!world.hasEntity(id)) return
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
      if (!rb) return

      // Ground tracking
      if (rb.onGround) { state.coyoteTimer = coyoteTime; state.jumpsLeft = maxJumps }
      else              state.coyoteTimer = Math.max(0, state.coyoteTimer - dt)

      // Jump buffer
      const jumpPressed =
        input.isPressed('Space') || input.isPressed('ArrowUp') ||
        input.isPressed('KeyW')  || input.isPressed('w')
      if (jumpPressed) state.jumpBuffer = jumpBuffer
      else             state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)

      // Horizontal movement
      const left  = input.isDown('ArrowLeft')  || input.isDown('KeyA') || input.isDown('a')
      const right = input.isDown('ArrowRight') || input.isDown('KeyD') || input.isDown('d')
      if (left)       rb.vx = -speed
      else if (right) rb.vx =  speed
      else            rb.vx *= rb.onGround ? 0.6 : 0.92

      // Sprite flip
      const sprite = world.getComponent<SpriteComponent>(id, 'Sprite')
      if (sprite) {
        if (left)  sprite.flipX = true
        if (right) sprite.flipX = false
      }

      // Jump
      const canJump = state.coyoteTimer > 0 || state.jumpsLeft > 0
      if (state.jumpBuffer > 0 && canJump) {
        rb.vy              = jumpForce
        state.jumpsLeft    = Math.max(0, state.jumpsLeft - 1)
        state.coyoteTimer  = 0
        state.jumpBuffer   = 0
      }

      // Variable jump height — release early to cut arc
      const jumpHeld =
        input.isDown('Space') || input.isDown('ArrowUp') ||
        input.isDown('KeyW')  || input.isDown('w')
      if (!jumpHeld && rb.vy < -120) rb.vy += 800 * dt
    }

    engine.ecs.addComponent(entityId, createScript(updateFn))
    return () => engine.ecs.removeComponent(entityId, 'Script')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
