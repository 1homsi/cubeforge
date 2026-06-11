import { useContext } from 'react'
import { Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'
import type { WebGLRenderer3D, Scene } from '@cubeforge/renderer3d'

export interface Scene3DControls {
  scene: Scene
  renderer: WebGLRenderer3D
  setBackground(r: number, g: number, b: number): void
  setFog(near: number, far: number, color?: [number, number, number]): void
}

export function useScene3D(): Scene3DControls {
  const engine = useContext(Engine3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] useScene3D must be called inside a <Game3D>.')
    }
  }

  return {
    get scene() {
      return engine!.scene
    },
    get renderer() {
      return engine!.renderer
    },
    setBackground(r: number, g: number, b: number) {
      engine!.scene.background = new Vec3(r, g, b)
    },
    setFog(near: number, far: number, color?: [number, number, number]) {
      const fogColor = color ? new Vec3(color[0], color[1], color[2]) : new Vec3(0.5, 0.5, 0.5)
      engine!.scene.fog = { color: fogColor, near, far }
    },
  }
}
