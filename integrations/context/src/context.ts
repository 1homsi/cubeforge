import { createContext } from 'react'
import type { ECSWorld, EventBus, AssetManager, EntityId, System, EngineStats } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import type { PhysicsSystem } from '@cubeforge/physics'
import type { GameLoop } from '@cubeforge/core'
import type { PostProcessStack, DynamicCanvasOptions, ManagedDynamicCanvas } from '@cubeforge/renderer'

export interface EngineState {
  ecs: ECSWorld
  input: InputManager
  /** The active render system (WebGL2, or Canvas2D when the fallback is in use). */
  activeRenderSystem?: System
  /** Which backend `activeRenderSystem` is: 'webgl', or 'canvas2d' when WebGL2 is unavailable or forced off. */
  renderBackend?: 'webgl' | 'canvas2d'
  /** Attached on the first frame after a physics component is created; undefined before. */
  physics?: PhysicsSystem
  /** Current gravity, applied when physics attaches. */
  gravity?: number
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
  /**
   * Live engine stats for the last frame, mutated in place (no per-frame
   * allocation). Copy with `copyEngineStats` if you need to keep a sample.
   */
  stats?: EngineStats
  /**
   * Create a dynamic canvas by id at runtime (no React hook): resizable and
   * disposable, so texture atlases can be created and grown. Wakes an on-demand
   * loop whenever it changes. Draw with `handle.ctx`, call `handle.markDirty(rect?)`,
   * show it with `dynamicSrc: handle.id` on a Sprite or a SpriteLayer atlas.
   */
  createDynamicCanvas?(options: DynamicCanvasOptions): ManagedDynamicCanvas
  /** Returns the live {@link stats} object. */
  getStats?(): EngineStats
}

export const EngineContext = createContext<EngineState | null>(null)
export const EntityContext = createContext<EntityId | null>(null)
