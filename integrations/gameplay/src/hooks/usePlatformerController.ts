import { useContext, useEffect } from 'react'
import { createScript } from '@cubeforge/core'
import type { EntityId, ECSWorld } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import type { RigidBodyComponent } from '@cubeforge/physics'
import type { SpriteComponent } from '@cubeforge/renderer'
import { EngineContext } from '@cubeforge/context'

export interface PlatformerControllerOptions {
  speed?: number
  jumpForce?: number
  maxJumps?: number
  coyoteTime?: number
  jumpBuffer?: number
  jumpCooldown?: number
  /**
   * Horizontal acceleration when input is held (px/s²).
   * `Infinity` (default) = instant velocity assignment (legacy behaviour).
   * Try 800–1600 for smooth, responsive movement.
   */
  acceleration?: number
  /**
   * Velocity multiplier applied each frame when grounded and no horizontal input.
   * 0 = instant stop, 1 = no friction. Default 0.6.
   */
  groundFriction?: number
  /**
   * Velocity multiplier applied each frame when airborne and no horizontal input.
   * 0 = instant stop, 1 = full air control. Default 0.92.
   */
  airFriction?: number
  /** Gamepad index to read (default 0). Set to -1 to disable gamepad input. */
  gamepadIndex?: number
  /** Dead zone for gamepad analog stick axes (default 0.2). */
  gamepadDeadZone?: number
  bindings?: {
    left?: string | string[]
    right?: string | string[]
    jump?: string | string[]
  }
}

interface ControllerState {
  coyoteTimer: number
  jumpBuffer: number
  jumpCooldown: number
  jumpsLeft: number
  prevGpJump: boolean
}

function normalizeKeys(val: string | string[] | undefined, defaults: string[]): string[] {
  if (!val) return defaults
  return Array.isArray(val) ? val : [val]
}

export function usePlatformerController(entityId: EntityId, opts: PlatformerControllerOptions = {}): void {
  const engine = useContext(EngineContext)!

  const {
    speed = 200,
    jumpForce = -500,
    maxJumps = 1,
    coyoteTime = 0.08,
    jumpBuffer = 0.08,
    jumpCooldown = 0.18,
    acceleration = Infinity,
    groundFriction = 0.6,
    airFriction = 0.92,
    gamepadIndex = 0,
    gamepadDeadZone = 0.2,
    bindings,
  } = opts

  const leftKeys = normalizeKeys(bindings?.left, ['ArrowLeft', 'KeyA', 'a'])
  const rightKeys = normalizeKeys(bindings?.right, ['ArrowRight', 'KeyD', 'd'])
  const jumpKeys = normalizeKeys(bindings?.jump, ['Space', 'ArrowUp', 'KeyW', 'w'])

  useEffect(() => {
    const state: ControllerState = {
      coyoteTimer: 0,
      jumpBuffer: 0,
      jumpCooldown: 0,
      jumpsLeft: maxJumps,
      prevGpJump: false,
    }

    const updateFn = (id: EntityId, world: ECSWorld, input: InputManager, dt: number) => {
      if (!world.hasEntity(id)) return
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
      if (!rb) return

      // Gamepad input
      const gp = gamepadIndex >= 0 ? (navigator.getGamepads?.()[gamepadIndex] ?? null) : null
      const gpAxis = gp?.axes[0] ?? 0
      const gpLeft = gpAxis < -gamepadDeadZone || (gp?.buttons[14]?.pressed ?? false)
      const gpRight = gpAxis > gamepadDeadZone || (gp?.buttons[15]?.pressed ?? false)
      const gpJump = gp?.buttons[0]?.pressed ?? false
      const gpJumpPressed = gpJump && !state.prevGpJump
      state.prevGpJump = gpJump

      if (rb.onGround) {
        state.coyoteTimer = coyoteTime
        state.jumpsLeft = maxJumps
      } else state.coyoteTimer = Math.max(0, state.coyoteTimer - dt)

      state.jumpCooldown = Math.max(0, state.jumpCooldown - dt)

      const jumpPressed = jumpKeys.some((k) => input.isPressed(k)) || gpJumpPressed
      const canJumpEarly = state.coyoteTimer > 0 || state.jumpsLeft > 0
      if (jumpPressed && state.jumpCooldown <= 0 && canJumpEarly) state.jumpBuffer = jumpBuffer
      else if (!jumpKeys.some((k) => input.isDown(k)) && !gpJump) state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)

      const left = leftKeys.some((k) => input.isDown(k)) || gpLeft
      const right = rightKeys.some((k) => input.isDown(k)) || gpRight
      if (left || right) {
        const targetVx = left ? -speed : speed
        if (acceleration === Infinity) {
          rb.vx = targetVx
        } else {
          const diff = targetVx - rb.vx
          const maxDelta = acceleration * dt
          rb.vx += Math.abs(diff) <= maxDelta ? diff : Math.sign(diff) * maxDelta
        }
      } else {
        rb.vx *= rb.onGround ? groundFriction : airFriction
      }

      const sprite = world.getComponent<SpriteComponent>(id, 'Sprite')
      if (sprite) {
        if (left) sprite.flipX = true
        if (right) sprite.flipX = false
      }

      const canJump = state.coyoteTimer > 0 || state.jumpsLeft > 0
      if (state.jumpBuffer > 0 && canJump && state.jumpCooldown <= 0) {
        rb.vy = jumpForce
        state.jumpsLeft = Math.max(0, state.jumpsLeft - 1)
        state.coyoteTimer = 0
        state.jumpBuffer = 0
        state.jumpCooldown = jumpCooldown
      }

      const jumpHeld = jumpKeys.some((k) => input.isDown(k)) || gpJump
      if (!jumpHeld && rb.vy < -120) rb.vy += 800 * dt
    }

    engine.ecs.addComponent(entityId, createScript(updateFn))
    return () => engine.ecs.removeComponent(entityId, 'Script')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
