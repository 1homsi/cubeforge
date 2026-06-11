import { useContext } from 'react'
import { Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

export interface Camera3DControls {
  position: Vec3
  setPosition(x: number, y: number, z: number): void
  lookAt(x: number, y: number, z: number): void
  setFov(fov: number): void
}

export function useCamera3D(): Camera3DControls {
  const engine = useContext(Engine3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] useCamera3D must be called inside a <Game3D>.')
    }
  }

  return {
    get position() {
      return engine!.camera.position
    },
    setPosition(x: number, y: number, z: number) {
      engine!.camera.position.set(x, y, z)
    },
    lookAt(x: number, y: number, z: number) {
      engine!.camera.lookAt(new Vec3(x, y, z))
    },
    setFov(fov: number) {
      engine!.camera.fov = fov
      engine!.camera.updateProjectionMatrix()
    },
  }
}
