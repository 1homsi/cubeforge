import type { WebGLRenderer3D } from '../renderer'
import type { Scene } from '../scene'
import type { Camera } from '../scene'

export interface RenderSystem3DOptions {
  renderer: WebGLRenderer3D
  scene: Scene
  camera: Camera
}

export class RenderSystem3D {
  private renderer: WebGLRenderer3D
  private scene: Scene
  private camera: Camera

  constructor(opts: RenderSystem3DOptions) {
    this.renderer = opts.renderer
    this.scene = opts.scene
    this.camera = opts.camera
  }

  update(_world: unknown, _dt: number): void {
    this.renderer.render(this.scene, this.camera)
  }
}
