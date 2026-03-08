import { createContext } from 'react'
import type { ECSWorld, EventBus, AssetManager, EntityId, System } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import type { PhysicsSystem } from '@cubeforge/physics'
import type { GameLoop } from '@cubeforge/core'
import type { PostProcessStack } from '@cubeforge/renderer'

export interface EngineState {
  ecs: ECSWorld
  input: InputManager
  /** The active WebGL2 render system. */
  activeRenderSystem?: System
  physics: PhysicsSystem
  events: EventBus
  assets: AssetManager
  loop: GameLoop
  canvas: HTMLCanvasElement
  /** Maps string entity IDs (e.g. "player") to numeric ECS EntityIds */
  entityIds: Map<string, EntityId>
  /**
   * Per-system timing in milliseconds from the last frame.
   * Keys are system names (e.g. "ScriptSystem", "PhysicsSystem", "RenderSystem").
   */
  systemTimings: Map<string, number>
  /** Post-processing effect stack applied after each frame. */
  postProcessStack: PostProcessStack
}

export const EngineContext = createContext<EngineState | null>(null)
export const EntityContext = createContext<EntityId | null>(null)
