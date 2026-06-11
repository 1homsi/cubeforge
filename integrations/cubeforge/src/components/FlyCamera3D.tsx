import { useContext, useEffect, useRef } from 'react'
import { FlyCamera, type FlyCameraOptions } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

export interface FlyCamera3DProps {
  speed?: number
  fastSpeed?: number
  lookSensitivity?: number
  minY?: number
  enabled?: boolean
  onPositionChange?: (x: number, y: number, z: number) => void
}

export function FlyCamera3D({
  speed,
  fastSpeed,
  lookSensitivity,
  minY,
  enabled = true,
  onPositionChange,
}: FlyCamera3DProps) {
  const engine = useContext(Engine3DContext)
  const flyCameraRef = useRef<FlyCamera | null>(null)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <FlyCamera3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!engine) return

    const opts: FlyCameraOptions = {
      speed,
      fastSpeed,
      lookSensitivity,
      minY,
    }

    const flyCamera = new FlyCamera(engine.camera, engine.canvas, opts)
    flyCamera.enabled = enabled
    flyCameraRef.current = flyCamera

    const frameListener = (dt: number) => {
      flyCamera.update(dt)
      if (onPositionChange) {
        const { x, y, z } = engine.camera.position
        onPositionChange(x, y, z)
      }
    }

    engine._frameListeners.add(frameListener)

    return () => {
      engine._frameListeners.delete(frameListener)
      flyCamera.dispose()
      flyCameraRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-sync enabled flag without remounting
  useEffect(() => {
    if (flyCameraRef.current) {
      flyCameraRef.current.enabled = enabled
    }
  }, [enabled])

  return null
}
