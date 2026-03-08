import { useMemo } from 'react'
import type { Camera2DComponent } from '@cubeforge/renderer'
import { useGame } from './useGame'

export interface CameraControls {
  /**
   * Trigger a screen-shake effect.
   * @param intensity - Maximum pixel displacement per frame.
   * @param duration  - How long the shake lasts in seconds.
   */
  shake(intensity: number, duration: number): void

  /**
   * Set the world-space offset applied to the camera's follow target.
   * Useful for look-ahead: `setFollowOffset(facing * 80, 0)`.
   */
  setFollowOffset(x: number, y: number): void

  /**
   * Instantly move the camera center to a world-space position.
   * Bypasses smoothing — useful for instant scene cuts.
   */
  setPosition(x: number, y: number): void

  /**
   * Programmatically set the camera zoom level.
   */
  setZoom(zoom: number): void
}

/**
 * Returns controls for the active Camera2D in the scene.
 * Must be used inside `<Game>`.
 *
 * @example
 * ```tsx
 * function HUD() {
 *   const camera = useCamera()
 *   return (
 *     <button onClick={() => camera.shake(8, 0.4)}>Shake!</button>
 *   )
 * }
 * ```
 */
export function useCamera(): CameraControls {
  const engine = useGame()

  return useMemo((): CameraControls => ({
    shake(intensity, duration) {
      engine.renderSystem?.triggerShake(intensity, duration)
    },

    setFollowOffset(x, y) {
      const camId = engine.ecs.queryOne('Camera2D')
      if (camId === undefined) return
      const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')
      if (cam) { cam.followOffsetX = x; cam.followOffsetY = y }
    },

    setPosition(x, y) {
      const camId = engine.ecs.queryOne('Camera2D')
      if (camId === undefined) return
      const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')
      if (cam) { cam.x = x; cam.y = y }
    },

    setZoom(zoom) {
      const camId = engine.ecs.queryOne('Camera2D')
      if (camId === undefined) return
      const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')
      if (cam) cam.zoom = zoom
    },
  }), [engine])
}
