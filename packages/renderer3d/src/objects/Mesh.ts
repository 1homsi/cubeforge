import { Vec3 } from '../math'
import { Object3D } from '../scene'
import { BufferGeometry } from '../geometry'
import { Material } from '../material'

const EPSILON = 1e-8

export class Mesh extends Object3D {
  readonly isMesh = true as const
  geometry: BufferGeometry
  material: Material | Material[]

  /**
   * Per-morph-target blend weights. Populated by the GLTFLoader when morph
   * targets are present; otherwise empty. Indices correspond to
   * geometry.morphAttributes entries.
   */
  morphTargetInfluences: number[] = []

  constructor(geometry: BufferGeometry, material: Material | Material[]) {
    super()
    this.geometry = geometry
    this.material = material
  }

  clone(recursive = true): this {
    const m = new (this.constructor as new (g: BufferGeometry, mat: Material | Material[]) => this)(
      this.geometry,
      this.material,
    )
    m.name = this.name
    m.position.set(this.position.x, this.position.y, this.position.z)
    m.quaternion.set(this.quaternion.x, this.quaternion.y, this.quaternion.z, this.quaternion.w)
    m.scale.set(this.scale.x, this.scale.y, this.scale.z)
    m.matrix.copy(this.matrix)
    m.matrixWorld.copy(this.matrixWorld)
    m.matrixAutoUpdate = this.matrixAutoUpdate
    m.visible = this.visible
    m.castShadow = this.castShadow
    m.receiveShadow = this.receiveShadow
    m.frustumCulled = this.frustumCulled
    m.renderOrder = this.renderOrder
    m.userData = JSON.parse(JSON.stringify(this.userData))

    if (recursive) {
      for (const child of this.children) {
        m.add(child.clone(true))
      }
    }

    return m
  }

  raycast(origin: Vec3, direction: Vec3): { distance: number; point: Vec3 } | null {
    const posAttr = this.geometry.getAttribute('position')
    if (!posAttr) return null

    const idx = this.geometry.index

    const vA = new Vec3()
    const vB = new Vec3()
    const vC = new Vec3()
    const edge1 = new Vec3()
    const edge2 = new Vec3()
    const h = new Vec3()
    const s = new Vec3()
    const q = new Vec3()

    let closest: { distance: number; point: Vec3 } | null = null

    const testTriangle = (ai: number, bi: number, ci: number): void => {
      vA.set(posAttr.getX(ai), posAttr.getY(ai), posAttr.getZ(ai))
      vB.set(posAttr.getX(bi), posAttr.getY(bi), posAttr.getZ(bi))
      vC.set(posAttr.getX(ci), posAttr.getY(ci), posAttr.getZ(ci))

      // Möller–Trumbore
      edge1.set(vB.x - vA.x, vB.y - vA.y, vB.z - vA.z)
      edge2.set(vC.x - vA.x, vC.y - vA.y, vC.z - vA.z)

      h.set(
        direction.y * edge2.z - direction.z * edge2.y,
        direction.z * edge2.x - direction.x * edge2.z,
        direction.x * edge2.y - direction.y * edge2.x,
      )

      const det = edge1.x * h.x + edge1.y * h.y + edge1.z * h.z
      if (Math.abs(det) < EPSILON) return

      const invDet = 1 / det

      s.set(origin.x - vA.x, origin.y - vA.y, origin.z - vA.z)
      const u = (s.x * h.x + s.y * h.y + s.z * h.z) * invDet
      if (u < 0 || u > 1) return

      q.set(s.y * edge1.z - s.z * edge1.y, s.z * edge1.x - s.x * edge1.z, s.x * edge1.y - s.y * edge1.x)
      const v = (direction.x * q.x + direction.y * q.y + direction.z * q.z) * invDet
      if (v < 0 || u + v > 1) return

      const t = (edge2.x * q.x + edge2.y * q.y + edge2.z * q.z) * invDet
      if (t < EPSILON) return

      if (closest === null || t < closest.distance) {
        closest = {
          distance: t,
          point: new Vec3(origin.x + direction.x * t, origin.y + direction.y * t, origin.z + direction.z * t),
        }
      }
    }

    if (idx !== null) {
      for (let i = 0; i < idx.count; i += 3) {
        testTriangle(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2))
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        testTriangle(i, i + 1, i + 2)
      }
    }

    return closest
  }
}
