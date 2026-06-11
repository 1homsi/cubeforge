import { Material } from './Material'
import type { Texture } from '../core/Texture'

/**
 * Depth material — used by the renderer for shadow and depth pre-passes.
 * Renders only depth; no color output.
 *
 * Renderer behaviour:
 *  - Binds the shadow/depth shader program (shadow.vert + shadow.frag or depth.vert + depth.frag)
 *  - Disables color writes (gl.colorMask(false, false, false, false)) for the depth pre-pass
 *  - Re-enables color writes afterward
 */
export class MeshDepthMaterial extends Material {
  override readonly type = 'MeshDepthMaterial'

  /**
   * Optional alpha map — pixels with alpha below `alphaTest` are discarded,
   * which punches holes in the shadow of foliage, fences, etc.
   */
  alphaMap: Texture | null = null

  /** Discard fragments with alpha below this threshold (0 = disabled) */
  alphaTest = 0

  constructor(name = '') {
    super(name)
    // Depth material never needs alpha blending
    this.transparent = false
    this.depthWrite = true
    this.depthTest = true
  }
}
