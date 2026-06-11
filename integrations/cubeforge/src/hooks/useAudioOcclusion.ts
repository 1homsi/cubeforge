import { useContext, useEffect, useRef, useState } from 'react'
import { AudioOcclusion, type AudioOcclusionOptions, Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

/**
 * Creates (or returns the nearest ancestor's) AudioOcclusion singleton and
 * hooks it into the Game3D frame loop so:
 *   - The listener follows the active camera each frame.
 *   - Occlusion raycasts run automatically.
 *
 * Call from inside a <Game3D> component tree. Returns `null` until the engine
 * is ready.
 *
 * @param opts       AudioOcclusion options — stable reference recommended (useMemo).
 * @param occluders  Scene objects used as occluders (updated each frame if provided).
 */
export function useAudioOcclusion(
  opts?: AudioOcclusionOptions,
  occluders?: import('@cubeforge/renderer3d').Object3D[],
): AudioOcclusion | null {
  const engine = useContext(Engine3DContext)
  const [occlusion, setOcclusion] = useState<AudioOcclusion | null>(null)
  const occlusionRef = useRef<AudioOcclusion | null>(null)
  const occludersRef = useRef(occluders ?? [])
  occludersRef.current = occluders ?? []

  useEffect(() => {
    if (!engine) return

    const ao = new AudioOcclusion(opts)
    occlusionRef.current = ao
    setOcclusion(ao)

    const _camForward = new Vec3()
    const _camUp = new Vec3()
    const _camPos = new Vec3()

    const frameListener = (dt: number) => {
      const cam = engine.camera
      cam.updateMatrixWorld(false)
      const e = cam.matrixWorld.elements

      // Camera world position (column 3)
      _camPos.set(e[12], e[13], e[14])

      // Camera forward = negative Z column of world matrix
      _camForward.set(-e[8], -e[9], -e[10])

      // Camera up = Y column of world matrix
      _camUp.set(e[4], e[5], e[6])

      ao.setListener(_camPos, _camForward, _camUp)
      ao.update(occludersRef.current, dt)
    }

    engine._frameListeners.add(frameListener)

    return () => {
      engine._frameListeners.delete(frameListener)
      ao.dispose()
      occlusionRef.current = null
      setOcclusion(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  return occlusion
}
