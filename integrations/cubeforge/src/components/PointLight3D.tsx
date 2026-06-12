import { useContext, useEffect, useRef } from 'react'
import { PointLight, Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface PointLight3DProps {
  color?: [r: number, g: number, b: number]
  intensity?: number
  position?: [x: number, y: number, z: number]
  distance?: number
  decay?: number
}

export function PointLight3D({
  color = [1, 1, 1],
  intensity = 1,
  position = [0, 0, 0],
  distance = 0,
  decay = 2,
}: PointLight3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <PointLight3D> must be inside a <Game3D>.')
    }
  }

  const lightRef = useRef<PointLight | null>(null)

  useEffect(() => {
    if (!parent) return

    const light = new PointLight(new Vec3(color[0], color[1], color[2]), intensity, distance, decay)
    light.position.set(position[0], position[1], position[2])
    lightRef.current = light
    parent.add(light)

    return () => {
      parent.remove(light)
      lightRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const light = lightRef.current
    if (!light) return
    light.color.set(color[0], color[1], color[2])
    light.intensity = intensity
    light.position.set(position[0], position[1], position[2])
    light.distance = distance
    light.decay = decay
  }, [color, intensity, position, distance, decay])

  return null
}
