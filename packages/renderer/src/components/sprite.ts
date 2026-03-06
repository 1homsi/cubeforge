import type { Component } from '@cubeforge/core'

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
  /** Horizontal draw offset from transform center */
  offsetX: number
  /** Vertical draw offset from transform center */
  offsetY: number
  /** Draw order — higher values render on top */
  zIndex: number
  /** Whether the sprite is visible */
  visible: boolean
  /** Horizontal flip */
  flipX: boolean
  /** Sprite sheet: source region on the sheet */
  frame?: { sx: number; sy: number; sw: number; sh: number }
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
    ...opts,
  }
}
