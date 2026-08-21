import type { Component, EntityId, ECSWorld } from '../ecs/world'

/**
 * Structural shape of the input object passed to scripts. Satisfied by
 * `InputManager` from `@cubeforge/input`; declaring it here keeps the core
 * dependency-free while giving raw-core users real autocomplete.
 */
export interface ScriptInput {
  /** Keyboard/mouse/touch/gamepad key codes ('ArrowLeft', 'gamepad:A', …). */
  isDown(key: string): boolean
  isPressed(key: string): boolean
  isReleased(key: string): boolean
  /** Digital axis between two keys. */
  getAxis(positiveKey: string, negativeKey: string, deadZone?: number): number
  /** Analog gamepad sticks (−1..1, dead-zoned). */
  gamepad?: {
    getStick(stick: 'left' | 'right', axis: 'x' | 'y', playerIndex?: number): number
    getTrigger(side: 'left' | 'right', playerIndex?: number): number
    isConnected(playerIndex?: number): boolean
    vibrate(
      playerIndex?: number,
      options?: { durationMs?: number; strongMagnitude?: number; weakMagnitude?: number },
    ): void
  }
}

/**
 * Script update callback. `TInput` lets hosts pass richer input objects;
 * defaults to the structural {@link ScriptInput} contract.
 */
export type ScriptUpdateFn<TInput = ScriptInput> = (
  entityId: EntityId,
  world: ECSWorld,
  input: TInput,
  dt: number,
) => void

export interface ScriptComponent extends Component {
  readonly type: 'Script'
  update: ScriptUpdateFn<any>
}

export function createScript(update: ScriptUpdateFn<any>): ScriptComponent {
  return { type: 'Script', update }
}
