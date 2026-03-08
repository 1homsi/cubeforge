import { useEffect, useRef, useState } from 'react'

export interface GamepadState {
  /** Whether a gamepad is connected at this player index. */
  connected: boolean
  /**
   * Normalised axis values (typically −1 to +1).
   * Index 0 = left stick X, 1 = left stick Y, 2 = right stick X, 3 = right stick Y
   * (varies by browser / controller).
   */
  axes: readonly number[]
  /**
   * Button pressed states.
   * Standard mapping: 0=A/Cross, 1=B/Circle, 2=X/Square, 3=Y/Triangle,
   * 4=LB, 5=RB, 12=DPad-Up, 13=DPad-Down, 14=DPad-Left, 15=DPad-Right
   */
  buttons: readonly boolean[]
}

const EMPTY_STATE: GamepadState = { connected: false, axes: [], buttons: [] }

/**
 * Polls the Gamepad API every frame and returns the current state.
 *
 * @param playerIndex - Which gamepad slot to read (0–3). Default 0.
 *
 * @example
 * function MoveWithGamepad() {
 *   const gp = useGamepad()
 *   // gp.axes[0] = left stick horizontal
 *   // gp.buttons[0] = A button
 * }
 */
export function useGamepad(playerIndex = 0): GamepadState {
  const [state, setState] = useState<GamepadState>(EMPTY_STATE)
  const rafRef = useRef(0)

  useEffect(() => {
    const poll = () => {
      const gp = navigator.getGamepads()[playerIndex]
      if (gp) {
        setState({
          connected: true,
          axes:    Array.from(gp.axes),
          buttons: Array.from(gp.buttons).map(b => b.pressed),
        })
      } else {
        setState(s => s.connected ? EMPTY_STATE : s)
      }
      rafRef.current = requestAnimationFrame(poll)
    }
    rafRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playerIndex])

  return state
}
