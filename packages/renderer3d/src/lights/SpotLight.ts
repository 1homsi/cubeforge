import { Vec3 } from '../math'
import { Object3D } from '../scene'
import { Light } from './Light'

export class SpotLight extends Light {
  target: Object3D
  angle: number
  penumbra: number
  distance: number
  decay: number

  constructor(color = new Vec3(1, 1, 1), intensity = 1, distance = 0, angle = Math.PI / 4, penumbra = 0, decay = 2) {
    super(color, intensity)
    this.target = new Object3D()
    this.angle = angle
    this.penumbra = penumbra
    this.distance = distance
    this.decay = decay
  }
}
