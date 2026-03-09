import { useCallback, useContext } from 'react'
import type { Camera2DComponent } from '@cubeforge/renderer'
import { EngineContext } from '../context'

export interface CoordinateHelpers {
  /**
   * Convert a world-space position to canvas pixel coordinates.
   * Takes current camera position and zoom into account.
   */
  worldToScreen(wx: number, wy: number): { x: number; y: number }
  /**
   * Convert canvas pixel coordinates to world-space position.
   * Takes current camera position and zoom into account.
   */
  screenToWorld(sx: number, sy: number): { x: number; y: number }
}

/**
 * Returns helpers for converting between world-space and screen (canvas pixel) coordinates.
 *
 * @example
 * ```tsx
 * function Minimap() {
 *   const { worldToScreen, screenToWorld } = useCoordinates()
 *   // worldToScreen(player.x, player.y) → canvas pixel position of player
 * }
 * ```
 */
export function useCoordinates(): CoordinateHelpers {
  const engine = useContext(EngineContext)!

  const worldToScreen = useCallback(
    (wx: number, wy: number): { x: number; y: number } => {
      const canvas = engine.canvas
      const camId = engine.ecs.queryOne('Camera2D')
      if (camId === undefined) return { x: wx, y: wy }
      const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')!
      const zoom = cam.zoom
      return {
        x: canvas.width / 2 + (wx - cam.x) * zoom,
        y: canvas.height / 2 + (wy - cam.y) * zoom,
      }
    },
    [engine.ecs, engine.canvas],
  )

  const screenToWorld = useCallback(
    (sx: number, sy: number): { x: number; y: number } => {
      const canvas = engine.canvas
      const camId = engine.ecs.queryOne('Camera2D')
      if (camId === undefined) return { x: sx, y: sy }
      const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')!
      const zoom = cam.zoom
      return {
        x: cam.x + (sx - canvas.width / 2) / zoom,
        y: cam.y + (sy - canvas.height / 2) / zoom,
      }
    },
    [engine.ecs, engine.canvas],
  )

  return { worldToScreen, screenToWorld }
}
