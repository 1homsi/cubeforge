import { createContext } from 'react'
import type { ECSWorld, EventBus, AssetManager, EntityId, System } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import type { Canvas2DRenderer, RenderSystem } from '@cubeforge/renderer'
import type { PhysicsSystem } from '@cubeforge/physics'
import type { GameLoop } from '@cubeforge/core'

export interface EngineState {
  ecs: ECSWorld
  input: InputManager
  /**
   * Canvas2D renderer instance.
   * @deprecated Only populated when `renderer='canvas2d'` is passed to `<Game>`.
   *             Use `activeRenderSystem` instead for renderer-agnostic access.
   */
  renderer?: Canvas2DRenderer
  /**
   * Canvas2D-based render system.
   * @deprecated Only populated when `renderer='canvas2d'` is passed to `<Game>`.
   *             Use `activeRenderSystem` instead for renderer-agnostic access.
   */
  renderSystem?: RenderSystem
  /** The active render system regardless of renderer type (WebGL2 or Canvas2D). */
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
}

export const EngineContext = createContext<EngineState | null>(null)
export const EntityContext = createContext<EntityId | null>(null)
