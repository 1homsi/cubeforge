import type { Component, EntityId, ECSWorld } from '../ecs/world'

// ScriptUpdateFn is intentionally generic — callers pass their InputManager
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScriptUpdateFn = (entityId: EntityId, world: ECSWorld, input: any, dt: number) => void

export interface ScriptComponent extends Component {
  readonly type: 'Script'
  update: ScriptUpdateFn
}

export function createScript(update: ScriptUpdateFn): ScriptComponent {
  return { type: 'Script', update }
}
