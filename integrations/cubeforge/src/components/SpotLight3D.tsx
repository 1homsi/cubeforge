import { useContext, useEffect } from 'react'
import { SpotLight, Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface SpotLight3DProps {
  color?: [r: number, g: number, b: number]
  intensity?: number
  position?: [x: number, y: number, z: number]
  target?: [x: number, y: number, z: number]
  angle?: number
  penumbra?: number
  distance?: number
  decay?: number
  castShadow?: boolean
}

export function SpotLight3D({
  color = [1, 1, 1],
  intensity = 1,
  position = [0, 10, 0],
  target,
  angle = Math.PI / 4,
  penumbra = 0,
  distance = 0,
  decay = 2,
  castShadow = false,
}: SpotLight3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <SpotLight3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!parent) return

    const light = new SpotLight(new Vec3(color[0], color[1], color[2]), intensity, distance, angle, penumbra, decay)
    light.position.set(position[0], position[1], position[2])
    light.castShadow = castShadow
    if (target) light.target.position.set(target[0], target[1], target[2])
    parent.add(light)
    parent.add(light.target)

    return () => {
      parent.remove(light)
      parent.remove(light.target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
