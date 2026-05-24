import { Material } from './Material'
import type { Vec3 } from '../math/Vec3'
import type { Texture } from '../core/Texture'

/**
 * Unlit material — renders geometry with a flat color or texture,
 * no lighting calculations applied.
 */
export class MeshBasicMaterial extends Material {
  override readonly type = 'MeshBasicMaterial'

  /** Flat color (linear RGB). Multiplied with map if provided. */
  color: Vec3

  /** Optional albedo texture. */
  map: Texture | null = null

  /** Whether to render geometry as wireframe. */
  override wireframe = false

  constructor(name = '') {
    super(name)
    this.color = { x: 1, y: 1, z: 1 } as Vec3
  }

  override clone(): this {
    const copy = super.clone()
    copy.color = { ...this.color } as Vec3
    return copy
  }
}
