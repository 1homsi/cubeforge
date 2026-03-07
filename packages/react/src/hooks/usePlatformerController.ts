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
  /**
   * Minimum seconds between jumps — prevents multi-jump spam when holding the
   * jump key with double-jump enabled (default 0.18)
   */
  jumpCooldown?: number
  /**
   * Override the default key bindings. Each action accepts a single key code
   * or an array of key codes.
   *
   * Defaults:
   *   left:  ['ArrowLeft', 'KeyA', 'a']
   *   right: ['ArrowRight', 'KeyD', 'd']
   *   jump:  ['Space', 'ArrowUp', 'KeyW', 'w']
   */
  bindings?: {
    left?:  string | string[]
    right?: string | string[]
    jump?:  string | string[]
  }
}

interface ControllerState {
  coyoteTimer:  number
  jumpBuffer:   number
  jumpCooldown: number
  jumpsLeft:    number
}

function normalizeKeys(val: string | string[] | undefined, defaults: string[]): string[] {
  if (!val) return defaults
  return Array.isArray(val) ? val : [val]
}

/**
 * Attaches platformer movement (customisable keys + Space/Up to jump) to an entity.
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
    speed        = 200,
    jumpForce    = -500,
    maxJumps     = 1,
    coyoteTime   = 0.08,
    jumpBuffer   = 0.08,
    jumpCooldown = 0.18,
    bindings,
  } = opts

  const leftKeys  = normalizeKeys(bindings?.left,  ['ArrowLeft',  'KeyA', 'a'])
  const rightKeys = normalizeKeys(bindings?.right, ['ArrowRight', 'KeyD', 'd'])
  const jumpKeys  = normalizeKeys(bindings?.jump,  ['Space', 'ArrowUp', 'KeyW', 'w'])

  useEffect(() => {
    const state: ControllerState = {
      coyoteTimer:  0,
      jumpBuffer:   0,
      jumpCooldown: 0,
      jumpsLeft:    maxJumps,
    }

    const updateFn = (id: EntityId, world: ECSWorld, input: InputManager, dt: number) => {
      if (!world.hasEntity(id)) return
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
      if (!rb) return

      // Ground tracking
      if (rb.onGround) { state.coyoteTimer = coyoteTime; state.jumpsLeft = maxJumps }
      else              state.coyoteTimer = Math.max(0, state.coyoteTimer - dt)

      // Jump cooldown
      state.jumpCooldown = Math.max(0, state.jumpCooldown - dt)

      // Jump buffer — only queue if not in cooldown
      const jumpPressed = jumpKeys.some(k => input.isPressed(k))
      if (jumpPressed && state.jumpCooldown === 0) state.jumpBuffer = jumpBuffer
      else if (!jumpKeys.some(k => input.isDown(k))) state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)

      // Horizontal movement
      const left  = leftKeys.some(k => input.isDown(k))
      const right = rightKeys.some(k => input.isDown(k))
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
        rb.vy             = jumpForce
        state.jumpsLeft   = Math.max(0, state.jumpsLeft - 1)
        state.coyoteTimer = 0
        state.jumpBuffer  = 0
        state.jumpCooldown = jumpCooldown
      }

      // Variable jump height — release early to cut arc
      const jumpHeld = jumpKeys.some(k => input.isDown(k))
      if (!jumpHeld && rb.vy < -120) rb.vy += 800 * dt
    }

    engine.ecs.addComponent(entityId, createScript(updateFn))
    return () => engine.ecs.removeComponent(entityId, 'Script')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
