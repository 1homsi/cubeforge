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

  setScalar(s: number): this {
    this.x = s
    this.y = s
    this.z = s
    return this
  }

  copy(v: Vec3): this {
    this.x = v.x
    this.y = v.y
    this.z = v.z
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

  // ── Allocation-free binary ops (write result into `this`) ──────────────────

  addVectors(a: Vec3, b: Vec3): this {
    this.x = a.x + b.x
    this.y = a.y + b.y
    this.z = a.z + b.z
    return this
  }

  subVectors(a: Vec3, b: Vec3): this {
    this.x = a.x - b.x
    this.y = a.y - b.y
    this.z = a.z - b.z
    return this
  }

  /** this += v * s — the workhorse for integrators without a temp allocation. */
  addScaledVector(v: Vec3, s: number): this {
    this.x += v.x * s
    this.y += v.y * s
    this.z += v.z * s
    return this
  }

  addScalar(s: number): this {
    this.x += s
    this.y += s
    this.z += s
    return this
  }

  crossVectors(a: Vec3, b: Vec3): this {
    const ax = a.x,
      ay = a.y,
      az = a.z
    const bx = b.x,
      by = b.y,
      bz = b.z
    this.x = ay * bz - az * by
    this.y = az * bx - ax * bz
    this.z = ax * by - ay * bx
    return this
  }

  multiplyScalar(s: number): this {
    return this.scale(s)
  }

  divideScalar(s: number): this {
    return s !== 0 ? this.scale(1 / s) : this.set(0, 0, 0)
  }

  divide(v: Vec3): this {
    this.x /= v.x
    this.y /= v.y
    this.z /= v.z
    return this
  }

  lerpVectors(a: Vec3, b: Vec3, t: number): this {
    this.x = a.x + (b.x - a.x) * t
    this.y = a.y + (b.y - a.y) * t
    this.z = a.z + (b.z - a.z) * t
    return this
  }

  // ── Component-wise clamping / rounding ─────────────────────────────────────

  min(v: Vec3): this {
    this.x = Math.min(this.x, v.x)
    this.y = Math.min(this.y, v.y)
    this.z = Math.min(this.z, v.z)
    return this
  }

  max(v: Vec3): this {
    this.x = Math.max(this.x, v.x)
    this.y = Math.max(this.y, v.y)
    this.z = Math.max(this.z, v.z)
    return this
  }

  clamp(min: Vec3, max: Vec3): this {
    this.x = Math.max(min.x, Math.min(max.x, this.x))
    this.y = Math.max(min.y, Math.min(max.y, this.y))
    this.z = Math.max(min.z, Math.min(max.z, this.z))
    return this
  }

  clampScalar(minVal: number, maxVal: number): this {
    this.x = Math.max(minVal, Math.min(maxVal, this.x))
    this.y = Math.max(minVal, Math.min(maxVal, this.y))
    this.z = Math.max(minVal, Math.min(maxVal, this.z))
    return this
  }

  /** Clamp the vector's length into `[min, max]`, preserving direction. */
  clampLength(min: number, max: number): this {
    const len = this.length()
    if (len === 0) return this
    const clamped = Math.max(min, Math.min(max, len))
    return this.scale(clamped / len)
  }

  setLength(len: number): this {
    return this.normalize().scale(len)
  }

  floor(): this {
    this.x = Math.floor(this.x)
    this.y = Math.floor(this.y)
    this.z = Math.floor(this.z)
    return this
  }

  ceil(): this {
    this.x = Math.ceil(this.x)
    this.y = Math.ceil(this.y)
    this.z = Math.ceil(this.z)
    return this
  }

  round(): this {
    this.x = Math.round(this.x)
    this.y = Math.round(this.y)
    this.z = Math.round(this.z)
    return this
  }

  abs(): this {
    this.x = Math.abs(this.x)
    this.y = Math.abs(this.y)
    this.z = Math.abs(this.z)
    return this
  }

  // ── Scalar queries ─────────────────────────────────────────────────────────

  manhattanLength(): number {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z)
  }

  /** Unsigned angle to another vector in radians (numerically clamped). */
  angleTo(v: Vec3): number {
    const denom = Math.sqrt(this.lengthSq() * v.lengthSq())
    if (denom === 0) return Math.PI / 2
    const t = this.dot(v) / denom
    return Math.acos(Math.max(-1, Math.min(1, t)))
  }

  // ── Matrix / spherical helpers ─────────────────────────────────────────────

  setFromMatrixPosition(m: Mat4): this {
    const e = m.elements
    this.x = e[12]
    this.y = e[13]
    this.z = e[14]
    return this
  }

  setFromMatrixColumn(m: Mat4, index: number): this {
    return this.fromArray(m.elements, index * 4)
  }

  /** Extract the world-space scale magnitude of each axis from a matrix. */
  setFromMatrixScale(m: Mat4): this {
    const e = m.elements
    this.x = Math.hypot(e[0], e[1], e[2])
    this.y = Math.hypot(e[4], e[5], e[6])
    this.z = Math.hypot(e[8], e[9], e[10])
    return this
  }

  setFromSphericalCoords(radius: number, phi: number, theta: number): this {
    const sinPhiRadius = Math.sin(phi) * radius
    this.x = sinPhiRadius * Math.sin(theta)
    this.y = Math.cos(phi) * radius
    this.z = sinPhiRadius * Math.cos(theta)
    return this
  }

  applyAxisAngle(axis: Vec3, angle: number): this {
    // Rodrigues' rotation, allocation-free.
    const half = angle / 2
    const s = Math.sin(half)
    const qx = axis.x * s
    const qy = axis.y * s
    const qz = axis.z * s
    const qw = Math.cos(half)
    const x = this.x,
      y = this.y,
      z = this.z
    const ix = qw * x + qy * z - qz * y
    const iy = qw * y + qz * x - qx * z
    const iz = qw * z + qx * y - qy * x
    const iw = -qx * x - qy * y - qz * z
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx
    return this
  }

  isZero(eps = 0): boolean {
    return Math.abs(this.x) <= eps && Math.abs(this.y) <= eps && Math.abs(this.z) <= eps
  }

  toString(): string {
    return `Vec3(${this.x}, ${this.y}, ${this.z})`
  }
}
