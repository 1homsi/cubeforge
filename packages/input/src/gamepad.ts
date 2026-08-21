/**
 * Gamepad input via the standard W3C Gamepad API mapping.
 *
 * Buttons and sticks are exposed through string codes so they flow through
 * the same plumbing as keyboard keys — `InputManager.isDown('gamepad:A')`,
 * InputMap action bindings, recorders, everything — with no special cases.
 *
 * Codes:
 * - Buttons:  'gamepad:A', 'gamepad:B', 'gamepad:X', 'gamepad:Y',
 *             'gamepad:LB', 'gamepad:RB', 'gamepad:LT', 'gamepad:RT',
 *             'gamepad:Back', 'gamepad:Start', 'gamepad:L3', 'gamepad:R3',
 *             'gamepad:Up', 'gamepad:Down', 'gamepad:Left', 'gamepad:Right',
 *             'gamepad:Home'
 * - Sticks:   'gamepad:LX+' / 'gamepad:LX-' / 'gamepad:LY+' / 'gamepad:LY-'
 *             (same for R*). Digital ±1 past the dead zone; use getStick()
 *             for analog values.
 *
 * Analog values are available directly: getStick(), getTrigger().
 */

export const GAMEPAD_PREFIX = 'gamepad:'

/** W3C standard-mapping button indices. */
export const GamepadButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Back: 8,
  Start: 9,
  L3: 10,
  R3: 11,
  DPadUp: 12,
  DPadDown: 13,
  DPadLeft: 14,
  DPadRight: 15,
  Home: 16,
} as const

const BUTTON_CODES = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'Back',
  'Start',
  'L3',
  'R3',
  'Up',
  'Down',
  'Left',
  'Right',
  'Home',
] as const

/** Build a gamepad button code from a standard index or name. */
export function gamepadButtonCode(button: number | keyof typeof GamepadButton): string {
  const name = typeof button === 'number' ? (BUTTON_CODES[button] ?? String(button)) : button
  return GAMEPAD_PREFIX + name
}

interface PadState {
  held: Set<number>
  justPressed: Set<number>
  justReleased: Set<number>
  /** Left/right stick X/Y, dead-zone applied for digital reads. */
  axes: Float64Array // [lx, ly, rx, ry] raw −1..1
  triggers: Float64Array // [lt, rt] raw 0..1
  connected: boolean
  vibrationUntil: number
}

function createPadState(): PadState {
  return {
    held: new Set(),
    justPressed: new Set(),
    justReleased: new Set(),
    axes: new Float64Array(4),
    triggers: new Float64Array(2),
    connected: false,
    vibrationUntil: 0,
  }
}

export interface VibrationOptions {
  durationMs?: number
  strongMagnitude?: number
  weakMagnitude?: number
}

/**
 * Polls the Gamepad API once per frame (via flush()) with keyboard-style
 * edge detection. Supports up to 4 pads; all methods take an optional
 * player index (default 0).
 */
export class GamepadInput {
  private pads: PadState[] = [createPadState(), createPadState(), createPadState(), createPadState()]
  private deadZone = 0.15

  attach(): void {}
  detach(): void {}

  /**
   * Poll all connected gamepads and update edge state.
   * Must be called once at the START of each frame (InputManager.flush does this).
   */
  flush(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return
    const pads = navigator.getGamepads()
    for (let i = 0; i < this.pads.length; i++) {
      const state = this.pads[i]
      state.justPressed.clear()
      state.justReleased.clear()
      const gp = pads[i]
      if (!gp) {
        if (state.connected) {
          // Disconnected mid-session: clear everything so held buttons don't stick.
          state.held.clear()
          state.connected = false
        }
        continue
      }
      state.connected = true
      for (let b = 0; b < gp.buttons.length && b < 17; b++) {
        const pressed = gp.buttons[b].pressed
        if (pressed && !state.held.has(b)) state.justPressed.add(b)
        else if (!pressed && state.held.has(b)) state.justReleased.add(b)
        if (pressed) state.held.add(b)
        else state.held.delete(b)
      }
      // Normalise sticks: browsers may report slightly off-zero at rest.
      const dz = this.deadZone
      for (let a = 0; a < 4 && a < gp.axes.length; a++) {
        const raw = gp.axes[a]
        state.axes[a] = Math.abs(raw) < dz ? 0 : raw
      }
      if (gp.buttons.length > 6) state.triggers[0] = gp.buttons[6].value
      if (gp.buttons.length > 7) state.triggers[1] = gp.buttons[7].value
    }
  }

  /** Whether a pad is connected at this player index. */
  isConnected(playerIndex = 0): boolean {
    return this.pads[playerIndex]?.connected ?? false
  }

  /** True every frame the button is held. Accepts a code or standard index. */
  isDown(button: number | string, playerIndex = 0): boolean {
    return this.pads[playerIndex]?.held.has(this.resolve(button)) ?? false
  }

  /** True only on the first frame the button was pressed. */
  isPressed(button: number | string, playerIndex = 0): boolean {
    return this.pads[playerIndex]?.justPressed.has(this.resolve(button)) ?? false
  }

  /** True only on the frame the button was released. */
  isReleased(button: number | string, playerIndex = 0): boolean {
    return this.pads[playerIndex]?.justReleased.has(this.resolve(button)) ?? false
  }

  /** Analog trigger value 0..1 ('left' = LT, 'right' = RT). */
  getTrigger(side: 'left' | 'right', playerIndex = 0): number {
    const pad = this.pads[playerIndex]
    if (!pad) return 0
    return side === 'left' ? pad.triggers[0] : pad.triggers[1]
  }

  /**
   * Analog stick axis −1..1 with dead zone applied.
   * @param axis 'x' or 'y'. +y is DOWN (screen convention).
   */
  getStick(stick: 'left' | 'right', axis: 'x' | 'y', playerIndex = 0): number {
    const pad = this.pads[playerIndex]
    if (!pad) return 0
    const idx = (stick === 'left' ? 0 : 2) + (axis === 'x' ? 0 : 1)
    let v = pad.axes[idx] ?? 0
    if (stick === 'left' || stick === 'right') {
      // Browser Y axis: −1 = up. Flip so +y means down, matching screen space.
      if (axis === 'y') v = -v
    }
    return v
  }

  /** Dead zone for stick reads (default 0.15). */
  setDeadZone(zone: number): void {
    this.deadZone = zone
  }

  /**
   * Fire a haptic pulse. No-op when the pad or browser lacks vibration support.
   */
  vibrate(playerIndex = 0, options: VibrationOptions = {}): void {
    const gp = typeof navigator !== 'undefined' ? navigator.getGamepads?.()[playerIndex] : undefined
    const actuator = (
      gp as { vibrationActuator?: { playEffect?(type: string, opts: object): Promise<unknown> } | null }
    )?.vibrationActuator
    if (!actuator?.playEffect) return
    void actuator.playEffect('dual-rumble', {
      startDelay: 0,
      duration: options.durationMs ?? 120,
      strongMagnitude: Math.min(1, Math.max(0, options.strongMagnitude ?? 1)),
      weakMagnitude: Math.min(1, Math.max(0, options.weakMagnitude ?? 0.5)),
    })
  }

  /** Map a button code/index to its numeric index; unknown codes → −1. */
  private resolve(button: number | string): number {
    if (typeof button === 'number') return button
    const name = button.startsWith(GAMEPAD_PREFIX) ? button.slice(GAMEPAD_PREFIX.length) : button
    const idx = BUTTON_CODES.indexOf(name as (typeof BUTTON_CODES)[number])
    return idx !== -1 ? idx : Number(name)
  }
}
