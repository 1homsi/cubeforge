import { Vec3 } from '../math'
import { Object3D } from '../scene'
import { Texture } from '../core'

export interface SpriteMaterial {
  map: Texture | null
  color: Vec3
  opacity: number
  sizeAttenuation: boolean
  rotation: number
  depthTest: boolean
  depthWrite: boolean
  blending: 'normal' | 'additive'
}

const DEFAULT_SPRITE_MATERIAL: SpriteMaterial = {
  map: null,
  color: new Vec3(1, 1, 1),
  opacity: 1,
  sizeAttenuation: true,
  rotation: 0,
  depthTest: true,
  depthWrite: false,
  blending: 'normal',
}

const EPSILON = 1e-8

// Billboard rendering is handled by WebGLRenderer3D via its billboard pass.
// The renderer detects Sprite3D instances by checking `isSprite === true` during
// scene traversal, then renders them as camera-facing quads in a dedicated pass.
export class Sprite3D extends Object3D {
  readonly isSprite = true as const
  material: SpriteMaterial
  center: { x: number; y: number }

  constructor(material?: Partial<SpriteMaterial>) {
    super()
    this.material = { ...DEFAULT_SPRITE_MATERIAL, ...material }
    // color and map are references; clone color so instances don't share it
    this.material.color = material?.color
      ? new Vec3(material.color.x, material.color.y, material.color.z)
      : new Vec3(1, 1, 1)
    this.center = { x: 0.5, y: 0.5 }
  }

  // Ray–billboard intersection: treat the sprite as an axis-aligned disc of radius 0.5
  // in world space (scaled by this.scale.x). Returns the closest hit point if any.
  raycast(origin: Vec3, direction: Vec3): { distance: number; point: Vec3 } | null {
    this.updateWorldMatrix(true, false)

    // Sprite world-space center
    const cx = this.matrixWorld.elements[12]
    const cy = this.matrixWorld.elements[13]
    const cz = this.matrixWorld.elements[14]

    // Intersect the ray with the plane whose normal faces the ray origin (billboard plane).
    // We approximate by using the plane normal = -direction (always faces the camera).
    // This gives the point on the plane closest to the sprite center along the ray.
    const nx = -direction.x,
      ny = -direction.y,
      nz = -direction.z
    const denom = nx * direction.x + ny * direction.y + nz * direction.z
    if (Math.abs(denom) < EPSILON) return null

    const t = (nx * (cx - origin.x) + ny * (cy - origin.y) + nz * (cz - origin.z)) / denom
    if (t < EPSILON) return null

    const px = origin.x + direction.x * t
    const py = origin.y + direction.y * t
    const pz = origin.z + direction.z * t

    const radius = 0.5 * Math.max(this.scale.x, this.scale.y)
    const dx = px - cx,
      dy = py - cy,
      dz = pz - cz
    const distSq = dx * dx + dy * dy + dz * dz

    if (distSq > radius * radius) return null

    return { distance: t, point: new Vec3(px, py, pz) }
  }
}
