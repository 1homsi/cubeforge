import { useEffect, useContext } from 'react'
import { EngineContext } from '@cubeforge/context'
import { setListenerPosition } from '@cubeforge/audio'
import { createScript } from '@cubeforge/core'

interface Camera2DComponent {
  type: 'Camera2D'
  x: number
  y: number
}

/**
 * Automatically syncs the Web Audio API listener position to the Camera2D
 * entity each frame, enabling accurate positional audio for spatial sounds.
 *
 * Must be used inside a `<Game>` component. Cleans up on unmount.
 *
 * @example
 * ```tsx
 * function GameScene() {
 *   useAudioListener()
 *   return <Camera2D followEntity="player" />
 * }
 * ```
 */
export function useAudioListener(): void {
  const engine = useContext(EngineContext)!

  useEffect(() => {
    const eid = engine.ecs.createEntity()
    engine.ecs.addComponent(
      eid,
      createScript((_id, world) => {
        const camId = world.queryOne('Camera2D')
        if (camId === undefined) return
        const cam = world.getComponent<Camera2DComponent>(camId, 'Camera2D')
        if (!cam) return
        setListenerPosition(cam.x, cam.y)
      }),
    )
    return () => {
      if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
    }
  }, [engine.ecs])
}
