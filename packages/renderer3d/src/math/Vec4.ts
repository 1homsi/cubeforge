export class Vec4 {
  x: number
  y: number
  z: number
  w: number

  constructor(x = 0, y = 0, z = 0, w = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }

  clone(): Vec4 {
    return new Vec4(this.x, this.y, this.z, this.w)
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
    return this
  }

  add(v: Vec4): this {
    this.x += v.x
    this.y += v.y
    this.z += v.z
    this.w += v.w
    return this
  }

  sub(v: Vec4): this {
    this.x -= v.x
    this.y -= v.y
    this.z -= v.z
    this.w -= v.w
    return this
  }

  scale(s: number): this {
    this.x *= s
    this.y *= s
    this.z *= s
    this.w *= s
    return this
  }

  dot(v: Vec4): number {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
  }

  length(): number {
    return Math.sqrt(this.lengthSq())
  }

  normalize(): this {
    const len = this.length()
    return len > 0 ? this.scale(1 / len) : this
  }

  lerp(v: Vec4, t: number): this {
    this.x += (v.x - this.x) * t
    this.y += (v.y - this.y) * t
    this.z += (v.z - this.z) * t
    this.w += (v.w - this.w) * t
    return this
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
    return `Vec4(${this.x}, ${this.y}, ${this.z}, ${this.w})`
  }
}
