import type { Component } from '@cubeforge/core'

export interface ParallaxLayerComponent extends Component {
  readonly type: 'ParallaxLayer'
  /** Image URL */
  src: string
  /** 0 = fixed, 1 = moves with camera, 0.3 = slow parallax */
  speedX: number
  speedY: number
  /** Tile horizontally */
  repeatX: boolean
  /** Tile vertically */
  repeatY: boolean
  /** Render order — use negative values for background */
  zIndex: number
  /** Manual horizontal offset */
  offsetX: number
  /** Manual vertical offset */
  offsetY: number
  /** Set after image loads; used for tiling calculations */
  imageWidth: number
  /** Set after image loads; used for tiling calculations */
  imageHeight: number
}

export function createParallaxLayer(opts: Omit<ParallaxLayerComponent, 'type'>): ParallaxLayerComponent {
  return {
    type: 'ParallaxLayer',
    ...opts,
  }
}
