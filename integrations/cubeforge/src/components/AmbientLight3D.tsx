import { useContext, useEffect, useRef } from 'react'
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

  const lightRef = useRef<AmbientLight | null>(null)

  useEffect(() => {
    if (!parent) return

    const light = new AmbientLight(new Vec3(color[0], color[1], color[2]), intensity)
    lightRef.current = light
    parent.add(light)

    return () => {
      parent.remove(light)
      lightRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-sync color and intensity
  useEffect(() => {
    const light = lightRef.current
    if (!light) return
    light.color.set(color[0], color[1], color[2])
    light.intensity = intensity
  }, [color, intensity])

  return null
}
