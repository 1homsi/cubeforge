import { useContext, useEffect } from 'react'
import { AmbientLight, Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface AmbientLight3DProps {
  color?: [r: number, g: number, b: number]
  intensity?: number
}

export function AmbientLight3D({ color = [1, 1, 1], intensity = 1 }: AmbientLight3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <AmbientLight3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!parent) return

    const light = new AmbientLight(new Vec3(color[0], color[1], color[2]), intensity)
    parent.add(light)

    return () => {
      parent.remove(light)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-sync color and intensity
  useEffect(() => {
    // Stateless component — re-mount via key to change color/intensity
  }, [color, intensity])

  return null
}
