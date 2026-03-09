/**
 * Texture filtering constants for controlling how sprites are sampled.
 *
 * @example
 * ```tsx
 * import { TextureFilter } from 'cubeforge'
 *
 * // Pixel-art crisp scaling
 * <Sprite sampling={TextureFilter.NEAREST} />
 *
 * // Smooth scaling
 * <Sprite sampling={TextureFilter.LINEAR} />
 *
 * // Independent min/mag control
 * <Sprite sampling={{ min: TextureFilter.LINEAR_MIPMAP_LINEAR, mag: TextureFilter.LINEAR }} />
 * ```
 */
export const TextureFilter = {
  /** Nearest-neighbor — sharp pixels, ideal for pixel art */
  NEAREST: 'nearest',
  /** Bilinear — smooth interpolation */
  LINEAR: 'linear',
  /** Nearest on nearest mipmap level */
  NEAREST_MIPMAP_NEAREST: 'nearest-mipmap-nearest',
  /** Bilinear on nearest mipmap level */
  LINEAR_MIPMAP_NEAREST: 'linear-mipmap-nearest',
  /** Nearest, blending between two mipmap levels */
  NEAREST_MIPMAP_LINEAR: 'nearest-mipmap-linear',
  /** Trilinear — bilinear + mipmap blending, smoothest downscaling */
  LINEAR_MIPMAP_LINEAR: 'linear-mipmap-linear',
} as const

/** Any single filter value from TextureFilter */
export type TextureFilterValue = (typeof TextureFilter)[keyof typeof TextureFilter]

/** Filter modes valid for MAG_FILTER (no mipmap options) */
export type MagFilterValue = 'nearest' | 'linear'

/** Per-sprite or global sampling configuration */
export type Sampling = TextureFilterValue | { min: TextureFilterValue; mag: MagFilterValue }

/** Default sampling preset */
export const DEFAULT_SAMPLING: TextureFilterValue = TextureFilter.NEAREST

/**
 * Resolve a Sampling value into separate min/mag GL-friendly strings.
 * If a mipmap value is passed for mag, the mipmap part is stripped.
 */
export function resolveSampling(
  sampling: Sampling | undefined,
  fallback: Sampling = DEFAULT_SAMPLING,
): { min: TextureFilterValue; mag: MagFilterValue } {
  const s = sampling ?? fallback
  if (typeof s === 'string') {
    // For mag, strip mipmap suffix — mag only supports nearest/linear
    const mag: MagFilterValue = s.startsWith('linear') ? 'linear' : 'nearest'
    return { min: s, mag }
  }
  return { min: s.min, mag: s.mag }
}

/** Map engine filter string → WebGL constant */
export function toGLMinFilter(gl: WebGL2RenderingContext, filter: TextureFilterValue): GLenum {
  switch (filter) {
    case 'nearest':
      return gl.NEAREST
    case 'linear':
      return gl.LINEAR
    case 'nearest-mipmap-nearest':
      return gl.NEAREST_MIPMAP_NEAREST
    case 'linear-mipmap-nearest':
      return gl.LINEAR_MIPMAP_NEAREST
    case 'nearest-mipmap-linear':
      return gl.NEAREST_MIPMAP_LINEAR
    case 'linear-mipmap-linear':
      return gl.LINEAR_MIPMAP_LINEAR
    default:
      return gl.NEAREST
  }
}

/** Map engine mag filter string → WebGL constant */
export function toGLMagFilter(gl: WebGL2RenderingContext, filter: MagFilterValue): GLenum {
  return filter === 'linear' ? gl.LINEAR : gl.NEAREST
}

/** Whether this filter mode requires mipmaps to be generated */
export function needsMipmap(filter: TextureFilterValue): boolean {
  return filter !== 'nearest' && filter !== 'linear'
}
