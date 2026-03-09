import { describe, it, expect } from 'vitest'

/**
 * Unit tests for the platformer controller jump logic.
 *
 * Since usePlatformerController is a React hook, we replicate its core
 * update logic here with minimal mocks to validate cooldown and maxJumps
 * behaviour without mounting React components.
 */

interface ControllerState {
  coyoteTimer: number
  jumpBuffer: number
  jumpCooldown: number
  jumpsLeft: number
}

interface MockRigidBody {
  vx: number
  vy: number
  onGround: boolean
}

interface MockInput {
  pressed: Set<string>
  down: Set<string>
}

/**
 * Mirrors the update closure inside usePlatformerController with the same
 * branching logic (post-fix). Opts use the same defaults as the real hook.
 */
function runControllerTick(
  state: ControllerState,
  rb: MockRigidBody,
  input: MockInput,
  dt: number,
  opts: {
    jumpForce?: number
    maxJumps?: number
    coyoteTime?: number
    jumpBuffer?: number
    jumpCooldown?: number
  } = {},
): void {
  const { jumpForce = -500, maxJumps = 1, coyoteTime = 0.08, jumpBuffer = 0.08, jumpCooldown = 0.18 } = opts

  // Ground reset
  if (rb.onGround) {
    state.coyoteTimer = coyoteTime
    state.jumpsLeft = maxJumps
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt)
  }

  // Cooldown tick
  state.jumpCooldown = Math.max(0, state.jumpCooldown - dt)

  // Jump buffer (fixed: also checks canJumpEarly and cooldown)
  const jumpPressed = input.pressed.has('Space')
  const canJumpEarly = state.coyoteTimer > 0 || state.jumpsLeft > 0
  if (jumpPressed && state.jumpCooldown <= 0 && canJumpEarly) {
    state.jumpBuffer = jumpBuffer
  } else if (!input.down.has('Space')) {
    state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)
  }

  // Jump execution (fixed: also checks cooldown)
  const canJump = state.coyoteTimer > 0 || state.jumpsLeft > 0
  if (state.jumpBuffer > 0 && canJump && state.jumpCooldown <= 0) {
    rb.vy = jumpForce
    state.jumpsLeft = Math.max(0, state.jumpsLeft - 1)
    state.coyoteTimer = 0
    state.jumpBuffer = 0
    state.jumpCooldown = jumpCooldown
  }
}

function createState(maxJumps = 1): ControllerState {
  return { coyoteTimer: 0, jumpBuffer: 0, jumpCooldown: 0, jumpsLeft: maxJumps }
}

function createRb(onGround = true): MockRigidBody {
  return { vx: 0, vy: 0, onGround }
}

function noInput(): MockInput {
  return { pressed: new Set(), down: new Set() }
}

function jumpInput(): MockInput {
  return { pressed: new Set(['Space']), down: new Set(['Space']) }
}

const DT = 1 / 60

describe('platformer controller jump logic', () => {
  describe('jump cooldown prevents immediate re-jump', () => {
    it('blocks a second jump within the cooldown window', () => {
      const state = createState(1)
      const rb = createRb(true)
      const cooldown = 0.18

      // Frame 1: press jump on ground -> should jump
      runControllerTick(state, rb, jumpInput(), DT, { jumpCooldown: cooldown })
      expect(rb.vy).toBe(-500)
      expect(state.jumpCooldown).toBe(cooldown)

      // Reset vy to simulate next frame, still on ground
      rb.vy = 0
      state.jumpsLeft = 1 // ground resets jumps

      // Frame 2: press jump again immediately -> cooldown should block it
      runControllerTick(state, rb, jumpInput(), DT, { jumpCooldown: cooldown })
      expect(rb.vy).toBe(0) // did NOT jump again
      expect(state.jumpCooldown).toBeGreaterThan(0)
    })

    it('allows jump after cooldown fully expires', () => {
      const state = createState(1)
      const rb = createRb(true)
      const cooldown = 0.18

      // First jump
      runControllerTick(state, rb, jumpInput(), DT, { jumpCooldown: cooldown })
      expect(rb.vy).toBe(-500)

      // Wait out the cooldown (no jump input)
      rb.vy = 0
      const ticksToExpire = Math.ceil(cooldown / DT) + 1
      for (let i = 0; i < ticksToExpire; i++) {
        runControllerTick(state, rb, noInput(), DT, { jumpCooldown: cooldown })
      }
      expect(state.jumpCooldown).toBe(0)

      // Now jump should work
      runControllerTick(state, rb, jumpInput(), DT, { jumpCooldown: cooldown })
      expect(rb.vy).toBe(-500)
    })
  })

  describe('maxJumps=2 allows exactly 2 jumps in air', () => {
    it('allows a double jump and blocks a third', () => {
      const maxJumps = 2
      const cooldown = 0.05 // short cooldown for this test
      const state = createState(maxJumps)
      const rb = createRb(true)

      // Jump 1: on ground
      runControllerTick(state, rb, jumpInput(), DT, { maxJumps, jumpCooldown: cooldown })
      expect(rb.vy).toBe(-500)
      expect(state.jumpsLeft).toBe(1) // ground gave 2, used 1

      // Leave ground
      rb.onGround = false
      rb.vy = -400

      // Wait for cooldown to expire
      const ticksToExpire = Math.ceil(cooldown / DT) + 1
      for (let i = 0; i < ticksToExpire; i++) {
        runControllerTick(state, rb, noInput(), DT, { maxJumps, jumpCooldown: cooldown })
      }
      expect(state.jumpCooldown).toBe(0)

      // Jump 2: in air (double jump)
      runControllerTick(state, rb, jumpInput(), DT, { maxJumps, jumpCooldown: cooldown })
      expect(rb.vy).toBe(-500)
      expect(state.jumpsLeft).toBe(0)

      // Wait for cooldown again
      rb.vy = -400
      for (let i = 0; i < ticksToExpire; i++) {
        runControllerTick(state, rb, noInput(), DT, { maxJumps, jumpCooldown: cooldown })
      }

      // Jump 3: should be BLOCKED (no jumps left, not on ground)
      rb.vy = -200
      runControllerTick(state, rb, jumpInput(), DT, { maxJumps, jumpCooldown: cooldown })
      expect(rb.vy).toBe(-200) // unchanged — jump was blocked
      expect(state.jumpsLeft).toBe(0)
    })

    it('resets jumps on landing', () => {
      const maxJumps = 2
      const cooldown = 0.05
      const state = createState(maxJumps)
      const rb = createRb(false)

      // Use up both jumps in the air
      state.jumpsLeft = 0
      state.coyoteTimer = 0

      // Land
      rb.onGround = true
      runControllerTick(state, rb, noInput(), DT, { maxJumps, jumpCooldown: cooldown })
      expect(state.jumpsLeft).toBe(maxJumps)
    })
  })
})
