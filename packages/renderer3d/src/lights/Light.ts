import { Vec3 } from '../math'
import { Object3D } from '../scene'
import { LightShadow } from './LightShadow'

export class Light extends Object3D {
  color: Vec3
  intensity: number
  declare castShadow: boolean
  shadow: LightShadow | null

  constructor(color = new Vec3(1, 1, 1), intensity = 1) {
    super()
    this.color = color
    this.intensity = intensity
    this.castShadow = false
    this.shadow = null
  }
}
