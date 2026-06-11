import { createContext } from 'react'
import type { WebGLRenderer3D, Scene, PerspectiveCamera, Object3D } from '@cubeforge/renderer3d'
import type { GameLoop } from '@cubeforge/core'

export interface Engine3DState {
  renderer: WebGLRenderer3D
  scene: Scene
  camera: PerspectiveCamera
  loop: GameLoop
  canvas: HTMLCanvasElement
  time: number // accumulated seconds, updated each frame
  /** @internal — registered per-frame callbacks added by 3D components */
  _frameListeners: Set<(dt: number) => void>
}

// Null = not yet initialized (before useEffect runs)
export const Engine3DContext = createContext<Engine3DState | null>(null)

// Current parent Object3D for nesting (defaults to scene root).
// When a <Transform3D> mounts, it provides its own Object3D as this context
// so child Mesh3D / Light / etc. get added to the right parent.
export const ParentObject3DContext = createContext<Object3D | null>(null)
