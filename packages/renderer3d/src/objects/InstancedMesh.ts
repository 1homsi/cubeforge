import { Vec3, Mat4, Quat } from '../math'
import { BufferGeometry, BufferAttribute } from '../geometry'
import { Material } from '../material'
import { Mesh } from './Mesh'

const _m = new Mat4()

/**
 * A single geometry drawn `count` times in one GPU draw call, each instance
 * carrying its own transform (and optional color). This is the primary tool
 * for putting a very large number of characters/props on screen at once:
 * one buffer, one draw, thousands of instances.
 */
export class InstancedMesh extends Mesh {
  readonly isInstancedMesh = true as const
  /** Number of instances actually drawn (`0 <= count <= capacity`). */
  count: number
  /** Allocated instance capacity — may exceed {@link count}. */
  capacity: number
  instanceMatrix: BufferAttribute
  instanceColor: BufferAttribute | null
  /** Optional bounding sphere covering all active instances, for frustum culling. */
  boundingSphere: { center: Vec3; radius: number } | null

  constructor(geometry: BufferGeometry, material: Material | Material[], count: number) {
    super(geometry, material)
    this.count = count
    this.capacity = count

    const matrixData = new Float32Array(count * 16)
    // Initialise every instance to identity so unset instances are valid.
    for (let i = 0; i < count; i++) {
      matrixData[i * 16] = 1
      matrixData[i * 16 + 5] = 1
      matrixData[i * 16 + 10] = 1
      matrixData[i * 16 + 15] = 1
    }
    this.instanceMatrix = new BufferAttribute(matrixData, 16)
    this.instanceMatrix.usage = 35048 // DYNAMIC_DRAW

    this.instanceColor = null
    this.boundingSphere = null
  }

  private _checkIndex(index: number): void {
    if (index < 0 || index >= this.capacity) {
      throw new RangeError(`InstancedMesh index ${index} out of range [0, ${this.capacity})`)
    }
  }

  setMatrixAt(index: number, matrix: Mat4): void {
    this._checkIndex(index)
    ;(this.instanceMatrix.data as Float32Array).set(matrix.elements, index * 16)
    this.instanceMatrix.needsUpdate = true
  }

  getMatrixAt(index: number, target: Mat4): Mat4 {
    target.fromArray(this.instanceMatrix.data, index * 16)
    return target
  }

  /** Compose position/quaternion/scale directly into an instance slot. */
  setTransformAt(index: number, position: Vec3, quaternion: Quat, scale: Vec3): void {
    _m.compose(position, quaternion, scale)
    this.setMatrixAt(index, _m)
  }

  /** Set only the translation of an instance, leaving rotation/scale intact. */
  setPositionAt(index: number, x: number, y: number, z: number): void {
    this._checkIndex(index)
    const d = this.instanceMatrix.data as Float32Array
    const o = index * 16
    d[o + 12] = x
    d[o + 13] = y
    d[o + 14] = z
    this.instanceMatrix.needsUpdate = true
  }

  setColorAt(index: number, color: Vec3): void {
    this._checkIndex(index)
    if (this.instanceColor === null) {
      const data = new Float32Array(this.capacity * 3)
      data.fill(1)
      this.instanceColor = new BufferAttribute(data, 3)
      this.instanceColor.usage = 35048 // DYNAMIC_DRAW
    }
    this.instanceColor.setXYZ(index, color.x, color.y, color.z)
    this.instanceColor.needsUpdate = true
  }

  getColorAt(index: number, target: Vec3): Vec3 {
    if (this.instanceColor === null) {
      return target.set(1, 1, 1)
    }
    return target.set(this.instanceColor.getX(index), this.instanceColor.getY(index), this.instanceColor.getZ(index))
  }

  /**
   * Grow instance capacity, preserving existing data. Existing GPU buffers are
   * reallocated lazily on the next draw via the `needsUpdate` version bump.
   * No-op when `newCapacity <= capacity`.
   */
  resize(newCapacity: number): this {
    if (newCapacity <= this.capacity) return this
    const m = new Float32Array(newCapacity * 16)
    m.set(this.instanceMatrix.data as Float32Array)
    for (let i = this.capacity; i < newCapacity; i++) {
      m[i * 16] = 1
      m[i * 16 + 5] = 1
      m[i * 16 + 10] = 1
      m[i * 16 + 15] = 1
    }
    this.instanceMatrix = new BufferAttribute(m, 16)
    this.instanceMatrix.usage = 35048
    this.instanceMatrix.needsUpdate = true

    if (this.instanceColor) {
      const c = new Float32Array(newCapacity * 3)
      c.fill(1)
      c.set(this.instanceColor.data as Float32Array)
      this.instanceColor = new BufferAttribute(c, 3)
      this.instanceColor.usage = 35048
      this.instanceColor.needsUpdate = true
    }

    this.capacity = newCapacity
    return this
  }

  /** Set the number of drawn instances, clamped to `[0, capacity]`. */
  setCount(count: number): this {
    this.count = Math.max(0, Math.min(count, this.capacity))
    return this
  }

  /**
   * Recompute {@link boundingSphere} from the geometry bounding sphere and every
   * active instance's translation. Used by the render queue for frustum culling
   * the fleet as a whole.
   */
  computeBoundingSphere(): void {
    const geo = this.geometry
    if (!geo.boundingSphere) geo.computeBoundingSphere()
    const geoRadius = geo.boundingSphere ? geo.boundingSphere.radius : 0
    const d = this.instanceMatrix.data as Float32Array

    if (this.count === 0) {
      this.boundingSphere = { center: new Vec3(), radius: 0 }
      return
    }

    // Centroid of instance translations.
    let cx = 0
    let cy = 0
    let cz = 0
    for (let i = 0; i < this.count; i++) {
      const o = i * 16
      cx += d[o + 12]
      cy += d[o + 13]
      cz += d[o + 14]
    }
    const inv = 1 / this.count
    cx *= inv
    cy *= inv
    cz *= inv

    // Farthest instance translation plus per-instance scale-adjusted geo radius.
    let maxR = 0
    for (let i = 0; i < this.count; i++) {
      const o = i * 16
      const dx = d[o + 12] - cx
      const dy = d[o + 13] - cy
      const dz = d[o + 14] - cz
      const sx = Math.hypot(d[o], d[o + 1], d[o + 2])
      const sy = Math.hypot(d[o + 4], d[o + 5], d[o + 6])
      const sz = Math.hypot(d[o + 8], d[o + 9], d[o + 10])
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + geoRadius * Math.max(sx, sy, sz)
      if (r > maxR) maxR = r
    }

    this.boundingSphere = { center: new Vec3(cx, cy, cz), radius: maxR }
  }
}
