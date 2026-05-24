import { Vec3 } from '../math'
import { Material } from './Material'

export class LineMaterial extends Material {
  readonly type = 'LineMaterial' as const
  color: Vec3
  linewidth: number
  dashed: boolean
  dashSize: number
  gapSize: number

  constructor() {
    super()
    this.color = new Vec3(1, 1, 1)
    // WebGL2 only supports linewidth > 1 when using custom line geometry (e.g. LineSegments2).
    this.linewidth = 1
    this.dashed = false
    this.dashSize = 3
    this.gapSize = 1
  }
}
