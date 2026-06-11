import { useContext, useEffect } from 'react'
import { DirectionalLight, Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface DirectionalLight3DProps {
  color?: [r: number, g: number, b: number]
  intensity?: number
  position?: [x: number, y: number, z: number]
  castShadow?: boolean
  shadowMapSize?: number
}

export function DirectionalLight3D({
  color = [1, 1, 1],
  intensity = 1,
  position = [5, 10, 5],
  castShadow = false,
  shadowMapSize,
}: DirectionalLight3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <DirectionalLight3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!parent) return

    const light = new DirectionalLight(new Vec3(color[0], color[1], color[2]), intensity)
    light.position.set(position[0], position[1], position[2])
    light.castShadow = castShadow
    if (shadowMapSize !== undefined) {
      light.shadow.mapSize = { width: shadowMapSize, height: shadowMapSize }
    }
    parent.add(light)

    return () => {
      parent.remove(light)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
