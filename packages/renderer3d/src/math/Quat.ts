import type { Vec3 } from './Vec3'
import type { Mat4 } from './Mat4'

export class Quat {
  x: number
  y: number
  z: number
  w: number

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }

  static readonly IDENTITY = Object.freeze(new Quat(0, 0, 0, 1))

  clone(): Quat {
    return new Quat(this.x, this.y, this.z, this.w)
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
    return this
  }

  identity(): this {
    return this.set(0, 0, 0, 1)
  }

  multiply(q: Quat): this {
    return this._multiplyQuaternions(this, q)
  }

  premultiply(q: Quat): this {
    return this._multiplyQuaternions(q, this)
  }

  private _multiplyQuaternions(a: Quat, b: Quat): this {
    const ax = a.x,
      ay = a.y,
      az = a.z,
      aw = a.w
    const bx = b.x,
      by = b.y,
      bz = b.z,
      bw = b.w
    this.x = ax * bw + aw * bx + ay * bz - az * by
    this.y = ay * bw + aw * by + az * bx - ax * bz
    this.z = az * bw + aw * bz + ax * by - ay * bx
    this.w = aw * bw - ax * bx - ay * by - az * bz
    return this
  }

  setFromEuler(ex: number, ey: number, ez: number, order = 'XYZ'): this {
    const cx = Math.cos(ex / 2),
      sx = Math.sin(ex / 2)
    const cy = Math.cos(ey / 2),
      sy = Math.sin(ey / 2)
    const cz = Math.cos(ez / 2),
      sz = Math.sin(ez / 2)

    switch (order) {
      case 'XYZ':
        this.x = sx * cy * cz + cx * sy * sz
        this.y = cx * sy * cz - sx * cy * sz
        this.z = cx * cy * sz + sx * sy * cz
        this.w = cx * cy * cz - sx * sy * sz
        break
      case 'YXZ':
        this.x = sx * cy * cz + cx * sy * sz
        this.y = cx * sy * cz - sx * cy * sz
        this.z = cx * cy * sz - sx * sy * cz
        this.w = cx * cy * cz + sx * sy * sz
        break
      case 'ZXY':
        this.x = sx * cy * cz - cx * sy * sz
        this.y = cx * sy * cz + sx * cy * sz
        this.z = cx * cy * sz + sx * sy * cz
        this.w = cx * cy * cz - sx * sy * sz
        break
      case 'ZYX':
        this.x = sx * cy * cz - cx * sy * sz
        this.y = cx * sy * cz + sx * cy * sz
        this.z = cx * cy * sz - sx * sy * cz
        this.w = cx * cy * cz + sx * sy * sz
        break
      case 'YZX':
        this.x = sx * cy * cz + cx * sy * sz
        this.y = cx * sy * cz + sx * cy * sz
        this.z = cx * cy * sz - sx * sy * cz
        this.w = cx * cy * cz - sx * sy * sz
        break
      case 'XZY':
        this.x = sx * cy * cz - cx * sy * sz
        this.y = cx * sy * cz - sx * cy * sz
        this.z = cx * cy * sz + sx * sy * cz
        this.w = cx * cy * cz + sx * sy * sz
        break
      default:
        throw new Error(`Unknown Euler order: ${order}`)
    }
    return this
  }

  setFromAxisAngle(axis: Vec3, angle: number): this {
    const halfAngle = angle / 2
    const s = Math.sin(halfAngle)
    this.x = axis.x * s
    this.y = axis.y * s
    this.z = axis.z * s
    this.w = Math.cos(halfAngle)
    return this
  }

  setFromRotationMatrix(m: Mat4): this {
    const e = m.elements
    const m11 = e[0],
      m12 = e[4],
      m13 = e[8]
    const m21 = e[1],
      m22 = e[5],
      m23 = e[9]
    const m31 = e[2],
      m32 = e[6],
      m33 = e[10]
    const trace = m11 + m22 + m33

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0)
      this.w = 0.25 / s
      this.x = (m32 - m23) * s
      this.y = (m13 - m31) * s
      this.z = (m21 - m12) * s
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33)
      this.w = (m32 - m23) / s
      this.x = 0.25 * s
      this.y = (m12 + m21) / s
      this.z = (m13 + m31) / s
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33)
      this.w = (m13 - m31) / s
      this.x = (m12 + m21) / s
      this.y = 0.25 * s
      this.z = (m23 + m32) / s
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22)
      this.w = (m21 - m12) / s
      this.x = (m13 + m31) / s
      this.y = (m23 + m32) / s
      this.z = 0.25 * s
    }
    return this
  }

  setFromUnitVectors(from: Vec3, to: Vec3): this {
    let r = from.x * to.x + from.y * to.y + from.z * to.z + 1

    if (r < 1e-8) {
      r = 0
      if (Math.abs(from.x) > Math.abs(from.z)) {
        this.x = -from.y
        this.y = from.x
        this.z = 0
        this.w = r
      } else {
        this.x = 0
        this.y = -from.z
        this.z = from.y
        this.w = r
      }
    } else {
      this.x = from.y * to.z - from.z * to.y
      this.y = from.z * to.x - from.x * to.z
      this.z = from.x * to.y - from.y * to.x
      this.w = r
    }
    return this.normalize()
  }

  invert(): this {
    return this.conjugate()
  }

  conjugate(): this {
    this.x = -this.x
    this.y = -this.y
    this.z = -this.z
    return this
  }

  dot(q: Quat): number {
    return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
  }

  length(): number {
    return Math.sqrt(this.lengthSq())
  }

  normalize(): this {
    const len = this.length()
    if (len === 0) {
      this.x = 0
      this.y = 0
      this.z = 0
      this.w = 1
    } else {
      const inv = 1 / len
      this.x *= inv
      this.y *= inv
      this.z *= inv
      this.w *= inv
    }
    return this
  }

  slerp(qb: Quat, t: number): this {
    if (t === 0) return this
    if (t === 1) return this.copy(qb)

    const ax = this.x,
      ay = this.y,
      az = this.z,
      aw = this.w
    let bx = qb.x,
      by = qb.y,
      bz = qb.z,
      bw = qb.w

    let cosHalfTheta = aw * bw + ax * bx + ay * by + az * bz

    if (cosHalfTheta < 0) {
      bx = -bx
      by = -by
      bz = -bz
      bw = -bw
      cosHalfTheta = -cosHalfTheta
    }

    if (cosHalfTheta >= 1.0) {
      this.x = ax
      this.y = ay
      this.z = az
      this.w = aw
      return this
    }

    const sqrSinHalfTheta = 1.0 - cosHalfTheta * cosHalfTheta
    if (sqrSinHalfTheta <= Number.EPSILON) {
      const s = 1 - t
      this.w = s * aw + t * bw
      this.x = s * ax + t * bx
      this.y = s * ay + t * by
      this.z = s * az + t * bz
      return this.normalize()
    }

    const sinHalfTheta = Math.sqrt(sqrSinHalfTheta)
    const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta)
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta

    this.w = aw * ratioA + bw * ratioB
    this.x = ax * ratioA + bx * ratioB
    this.y = ay * ratioA + by * ratioB
    this.z = az * ratioA + bz * ratioB
    return this
  }

  slerpQuaternions(qa: Quat, qb: Quat, t: number): this {
    return this.copy(qa).slerp(qb, t)
  }

  copy(q: Quat): this {
    this.x = q.x
    this.y = q.y
    this.z = q.z
    this.w = q.w
    return this
  }

  toEuler(order = 'XYZ'): [number, number, number] {
    const x = this.x,
      y = this.y,
      z = this.z,
      w = this.w
    const x2 = x * x,
      y2 = y * y,
      z2 = z * z,
      w2 = w * w

    switch (order) {
      case 'XYZ': {
        const ex = Math.atan2(2 * (x * w - y * z), w2 - x2 - y2 + z2)
        const ey = Math.asin(Math.max(-1, Math.min(1, 2 * (x * z + y * w))))
        const ez = Math.atan2(2 * (z * w - x * y), w2 + x2 - y2 - z2)
        return [ex, ey, ez]
      }
      case 'YXZ': {
        const ex = Math.asin(Math.max(-1, Math.min(1, 2 * (x * w - y * z))))
        const ey = Math.atan2(2 * (x * z + y * w), w2 - x2 - y2 + z2)
        const ez = Math.atan2(2 * (x * y + z * w), w2 - x2 + y2 - z2)
        return [ex, ey, ez]
      }
      case 'ZXY': {
        const ex = Math.asin(Math.max(-1, Math.min(1, 2 * (x * w + y * z))))
        const ey = Math.atan2(2 * (y * w - x * z), w2 - x2 - y2 + z2)
        const ez = Math.atan2(2 * (z * w - x * y), w2 - x2 + y2 - z2)
        return [ex, ey, ez]
      }
      case 'ZYX': {
        const ex = Math.atan2(2 * (x * w + z * y), w2 - x2 - y2 + z2)
        const ey = Math.asin(Math.max(-1, Math.min(1, 2 * (y * w - x * z))))
        const ez = Math.atan2(2 * (x * y + z * w), w2 + x2 - y2 - z2)
        return [ex, ey, ez]
      }
      case 'YZX': {
        const ex = Math.atan2(2 * (x * w - z * y), w2 - x2 + y2 - z2)
        const ey = Math.atan2(2 * (y * w - x * z), w2 + x2 - y2 - z2)
        const ez = Math.asin(Math.max(-1, Math.min(1, 2 * (x * y + z * w))))
        return [ex, ey, ez]
      }
      case 'XZY': {
        const ex = Math.atan2(2 * (x * w + y * z), w2 - x2 + y2 - z2)
        const ey = Math.atan2(2 * (x * z + y * w), w2 + x2 - y2 - z2)
        const ez = Math.asin(Math.max(-1, Math.min(1, 2 * (z * w - x * y))))
        return [ex, ey, ez]
      }
      default:
        throw new Error(`Unknown Euler order: ${order}`)
    }
  }

  angleTo(other: Quat): number {
    return 2 * Math.acos(Math.abs(Math.max(-1, Math.min(1, this.dot(other)))))
  }

  rotateTowards(target: Quat, step: number): this {
    const angle = this.angleTo(target)
    if (angle === 0) return this
    const t = Math.min(1, step / angle)
    return this.slerp(target, t)
  }

  equals(q: Quat, eps = 1e-6): boolean {
    return (
      Math.abs(this.x - q.x) <= eps &&
      Math.abs(this.y - q.y) <= eps &&
      Math.abs(this.z - q.z) <= eps &&
      Math.abs(this.w - q.w) <= eps
    )
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w]
  }

  fromArray(arr: ArrayLike<number>, offset = 0): this {
    this.x = arr[offset]
    this.y = arr[offset + 1]
    this.z = arr[offset + 2]
    this.w = arr[offset + 3]
    return this
  }

  toString(): string {
    return `Quat(${this.x}, ${this.y}, ${this.z}, ${this.w})`
  }
}
