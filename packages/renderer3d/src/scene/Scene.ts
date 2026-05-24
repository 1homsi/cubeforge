import { Vec3 } from '../math'
import { Object3D } from './Object3D'

export class Scene extends Object3D {
  background: Vec3 | null
  fog: { color: Vec3; near: number; far: number } | null
  ambientColor: Vec3

  constructor() {
    super()
    this.name = 'Scene'
    this.background = null
    this.fog = null
    this.ambientColor = new Vec3(0.1, 0.1, 0.1)
  }
}
