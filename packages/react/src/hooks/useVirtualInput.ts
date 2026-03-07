// Module-level store — written by VirtualJoystick, read by useVirtualInput.
// Using a plain object avoids React re-renders on every frame.

const _axes    = { x: 0, y: 0 }
const _buttons: Record<string, boolean> = {}

/** Called by VirtualJoystick — not part of the public API. */
export function setVirtualAxis(x: number, y: number): void {
  _axes.x = x
  _axes.y = y
}

/** Called by VirtualJoystick / VirtualButton — not part of the public API. */
export function setVirtualButton(name: string, pressed: boolean): void {
  _buttons[name] = pressed
}

export interface VirtualInputState {
  /** Left–right axis in [−1, 1]. Positive = right. */
  readonly axisX: number
  /** Up–down axis in [−1, 1]. Positive = down. */
  readonly axisY: number
  /** Whether a named virtual button is currently pressed. */
  button(name: string): boolean
}

/**
 * Returns the current state of the on-screen virtual joystick and buttons.
 * Reads synchronously from the module-level store — safe to call in a Script
 * update function every frame without triggering React re-renders.
 *
 * Combine with keyboard or gamepad input for multi-input support:
 *
 * @example
 * function MobilePlayer() {
 *   const input = useInput()
 *   const virt  = useVirtualInput()
 *
 *   // Script update:
 *   const moveX = input.isHeld('ArrowRight') ? 1
 *               : input.isHeld('ArrowLeft')  ? -1
 *               : virt.axisX
 *   const jump  = input.isPressed('Space') || virt.button('action')
 * }
 */
export function useVirtualInput(): VirtualInputState {
  return {
    get axisX() { return _axes.x },
    get axisY() { return _axes.y },
    button: (name: string) => _buttons[name] ?? false,
  }
}
