export class Vec2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  add(v: Vec2): Vec2 {
    return new Vec2(this.x + v.x, this.y + v.y)
  }
  sub(v: Vec2): Vec2 {
    return new Vec2(this.x - v.x, this.y - v.y)
  }
  scale(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s)
  }
  dot(v: Vec2): number {
    return this.x * v.x + this.y * v.y
  }
  lengthSq(): number {
    return this.x * this.x + this.y * this.y
  }
  length(): number {
    return Math.sqrt(this.lengthSq())
  }
  normalize(): Vec2 {
    const l = this.length()
    return l === 0 ? new Vec2() : this.scale(1 / l)
  }
  clone(): Vec2 {
    return new Vec2(this.x, this.y)
  }
  negate(): Vec2 {
    return new Vec2(-this.x, -this.y)
  }
  lerp(v: Vec2, t: number): Vec2 {
    return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t)
  }

  // Mutating variants (avoid allocation in hot paths)
  addMut(v: Vec2): this {
    this.x += v.x
    this.y += v.y
    return this
  }
  subMut(v: Vec2): this {
    this.x -= v.x
    this.y -= v.y
    return this
  }
  scaleMut(s: number): this {
    this.x *= s
    this.y *= s
    return this
  }
  set(x: number, y: number): this {
    this.x = x
    this.y = y
    return this
  }
  copyFrom(v: Vec2): this {
    this.x = v.x
    this.y = v.y
    return this
  }

  static zero(): Vec2 {
    return new Vec2(0, 0)
  }
  static from(x: number, y: number): Vec2 {
    return new Vec2(x, y)
  }
  static distance(a: Vec2, b: Vec2): number {
    return a.sub(b).length()
  }
}
