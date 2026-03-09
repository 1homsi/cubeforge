import type { Component } from '@cubeforge/core'
import type { Sampling } from '../textureFilter'

export type BlendMode = 'normal' | 'additive' | 'multiply' | 'screen'

export interface SpriteComponent extends Component {
  readonly type: 'Sprite'
  width: number
  height: number
  /** Fallback color when no image is loaded */
  color: string
  /** Optional image source URL */
  src?: string
  /** Loaded image element (populated by renderer) */
  image?: HTMLImageElement
  /** Horizontal draw offset from anchor point */
  offsetX: number
  /** Vertical draw offset from anchor point */
  offsetY: number
  /** Draw order — higher values render on top */
  zIndex: number
  /** Whether the sprite is visible */
  visible: boolean
  /** Horizontal flip */
  flipX: boolean
  /** Vertical flip */
  flipY: boolean
  /** Anchor X: 0=left edge, 0.5=center, 1=right edge — default 0.5 */
  anchorX: number
  /** Anchor Y: 0=top edge, 0.5=center, 1=bottom edge — default 0.5 */
  anchorY: number
  /** Which frame to show (0-based) — default 0 */
  frameIndex: number
  /** Width of a single frame on the sprite sheet */
  frameWidth?: number
  /** Height of a single frame on the sprite sheet */
  frameHeight?: number
  /** How many columns in the sprite sheet */
  frameColumns?: number
  /** Legacy sprite sheet: source region on the sheet (still supported) */
  frame?: { sx: number; sy: number; sw: number; sh: number }
  /** Tile the image horizontally instead of stretching it */
  tileX?: boolean
  /** Tile the image vertically instead of stretching it */
  tileY?: boolean
  /** Width of each tile when tiling horizontally (default: source image width) */
  tileSizeX?: number
  /** Height of each tile when tiling vertically (default: source image height) */
  tileSizeY?: number
  /** Texture sampling mode — controls how the sprite is filtered when scaled */
  sampling?: Sampling
  /** Blend mode used when drawing this sprite */
  blendMode: BlendMode
  /** Render layer name — sprites are sorted by layer order first, then zIndex */
  layer: string
  /** Color tint applied on top of the image (multiplied). e.g. '#ff0000' for red tint */
  tint?: string
  /** Tint opacity 0-1 */
  tintOpacity?: number
}

export function createSprite(opts: Partial<SpriteComponent> & { width: number; height: number }): SpriteComponent {
  return {
    type: 'Sprite',
    color: '#ffffff',
    offsetX: 0,
    offsetY: 0,
    zIndex: 0,
    visible: true,
    flipX: false,
    flipY: false,
    anchorX: 0.5,
    anchorY: 0.5,
    frameIndex: 0,
    blendMode: 'normal',
    layer: 'default',
    ...opts,
  }
}
