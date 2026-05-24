import type { Mat4 } from './Mat4'
import type { Quat } from './Quat'

export class Vec3 {
  x: number
  y: number
  z: number

  constructor(x = 0, y = 0, z = 0) {
    this.x = x
    this.y = y
    this.z = z
  }

  static readonly ZERO = Object.freeze(new Vec3(0, 0, 0))
  static readonly ONE = Object.freeze(new Vec3(1, 1, 1))
  static readonly UP = Object.freeze(new Vec3(0, 1, 0))
  static readonly RIGHT = Object.freeze(new Vec3(1, 0, 0))
  static readonly FORWARD = Object.freeze(new Vec3(0, 0, -1))

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z)
  }

  set(x: number, y: number, z: number): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }

  add(v: Vec3): this {
    this.x += v.x
    this.y += v.y
    this.z += v.z
    return this
  }

  sub(v: Vec3): this {
    this.x -= v.x
    this.y -= v.y
    this.z -= v.z
    return this
  }

  mul(v: Vec3): this {
    this.x *= v.x
    this.y *= v.y
    this.z *= v.z
    return this
  }

  scale(s: number): this {
    this.x *= s
    this.y *= s
    this.z *= s
    return this
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z
  }

  cross(v: Vec3): this {
    const ax = this.x,
      ay = this.y,
      az = this.z
    this.x = ay * v.z - az * v.y
    this.y = az * v.x - ax * v.z
    this.z = ax * v.y - ay * v.x
    return this
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z
  }

  length(): number {
    return Math.sqrt(this.lengthSq())
  }

  normalize(): this {
    const len = this.length()
    return len > 0 ? this.scale(1 / len) : this
  }

  lerp(v: Vec3, t: number): this {
    this.x += (v.x - this.x) * t
    this.y += (v.y - this.y) * t
    this.z += (v.z - this.z) * t
    return this
  }

  distanceSqTo(v: Vec3): number {
    const dx = this.x - v.x
    const dy = this.y - v.y
    const dz = this.z - v.z
    return dx * dx + dy * dy + dz * dz
  }

  distanceTo(v: Vec3): number {
    return Math.sqrt(this.distanceSqTo(v))
  }

  negate(): this {
    this.x = -this.x
    this.y = -this.y
    this.z = -this.z
    return this
  }

  equals(v: Vec3, eps = 1e-6): boolean {
    return Math.abs(this.x - v.x) <= eps && Math.abs(this.y - v.y) <= eps && Math.abs(this.z - v.z) <= eps
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z]
  }

  fromArray(arr: ArrayLike<number>, offset = 0): this {
    this.x = arr[offset]
    this.y = arr[offset + 1]
    this.z = arr[offset + 2]
    return this
  }

  applyMat4(m: Mat4): this {
    const e = m.elements
    const x = this.x,
      y = this.y,
      z = this.z
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15])
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w
    return this
  }

  applyQuat(q: Quat): this {
    const x = this.x,
      y = this.y,
      z = this.z
    const qx = q.x,
      qy = q.y,
      qz = q.z,
      qw = q.w
    const ix = qw * x + qy * z - qz * y
    const iy = qw * y + qz * x - qx * z
    const iz = qw * z + qx * y - qy * x
    const iw = -qx * x - qy * y - qz * z
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx
    return this
  }

  transformDirection(m: Mat4): this {
    const e = m.elements
    const x = this.x,
      y = this.y,
      z = this.z
    this.x = e[0] * x + e[4] * y + e[8] * z
    this.y = e[1] * x + e[5] * y + e[9] * z
    this.z = e[2] * x + e[6] * y + e[10] * z
    return this.normalize()
  }

  reflect(normal: Vec3): this {
    const dot2 = 2 * this.dot(normal)
    this.x -= dot2 * normal.x
    this.y -= dot2 * normal.y
    this.z -= dot2 * normal.z
    return this
  }

  project(onto: Vec3): this {
    const scalar = this.dot(onto) / onto.lengthSq()
    this.x = onto.x * scalar
    this.y = onto.y * scalar
    this.z = onto.z * scalar
    return this
  }

  toString(): string {
    return `Vec3(${this.x}, ${this.y}, ${this.z})`
  }
}
