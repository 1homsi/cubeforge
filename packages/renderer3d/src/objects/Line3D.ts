import { Object3D } from '../scene'
import { BufferGeometry, BufferAttribute } from '../geometry'
import { Material } from '../material'
import { LineMaterial } from '../material'
import { Vec3 } from '../math'

export class Line3D extends Object3D {
  readonly isLine = true as const
  geometry: BufferGeometry
  material: Material

  constructor(geometry?: BufferGeometry, material?: Material) {
    super()
    this.geometry = geometry ?? new BufferGeometry()
    this.material = material ?? new LineMaterial()
  }

  setPoints(points: Vec3[]): void {
    const data = new Float32Array(points.length * 3)
    for (let i = 0; i < points.length; i++) {
      data[i * 3] = points[i].x
      data[i * 3 + 1] = points[i].y
      data[i * 3 + 2] = points[i].z
    }
    this.geometry.setAttribute('position', new BufferAttribute(data, 3))
  }

  computeLineDistances(): this {
    const posAttr = this.geometry.getAttribute('position')
    if (!posAttr) return this

    const count = posAttr.count
    const distances = new Float32Array(count)
    distances[0] = 0

    for (let i = 1; i < count; i++) {
      const dx = posAttr.getX(i) - posAttr.getX(i - 1)
      const dy = posAttr.getY(i) - posAttr.getY(i - 1)
      const dz = posAttr.getZ(i) - posAttr.getZ(i - 1)
      distances[i] = distances[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz)
    }

    this.geometry.setAttribute('lineDistance', new BufferAttribute(distances, 1))
    return this
  }
}

// Rendered as GL_LINES (pairs of vertices form independent segments).
export class LineSegments extends Line3D {
  readonly isLineSegments = true as const
}

// Rendered as GL_LINE_LOOP (last vertex connects back to first).
export class LineLoop extends Line3D {
  readonly isLineLoop = true as const
}
