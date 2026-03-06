import { Vec2 } from './vec2'

export class Rect {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}

  get left(): number { return this.x - this.width / 2 }
  get right(): number { return this.x + this.width / 2 }
  get top(): number { return this.y - this.height / 2 }
  get bottom(): number { return this.y + this.height / 2 }

  contains(v: Vec2): boolean {
    return v.x >= this.left && v.x <= this.right && v.y >= this.top && v.y <= this.bottom
  }

  intersects(other: Rect): boolean {
    return this.left < other.right &&
      this.right > other.left &&
      this.top < other.bottom &&
      this.bottom > other.top
  }

  clone(): Rect {
    return new Rect(this.x, this.y, this.width, this.height)
  }
}
