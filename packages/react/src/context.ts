import { createContext } from 'react'
import type { ECSWorld, EventBus, AssetManager, EntityId } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import type { Canvas2DRenderer } from '@cubeforge/renderer'
import type { PhysicsSystem } from '@cubeforge/physics'
import type { GameLoop } from '@cubeforge/core'

export interface EngineState {
  ecs: ECSWorld
  input: InputManager
  renderer: Canvas2DRenderer
  physics: PhysicsSystem
  events: EventBus
  assets: AssetManager
  loop: GameLoop
  canvas: HTMLCanvasElement
  /** Maps string entity IDs (e.g. "player") to numeric ECS EntityIds */
  entityIds: Map<string, EntityId>
}

export const EngineContext = createContext<EngineState | null>(null)
export const EntityContext = createContext<EntityId | null>(null)
