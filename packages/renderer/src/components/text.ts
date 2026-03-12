import type { Component } from '@cubeforge/core'

export interface TextComponent extends Component {
  readonly type: 'Text'
  text: string
  fontSize: number
  fontFamily: string
  color: string
  align: CanvasTextAlign
  baseline: CanvasTextBaseline
  zIndex: number
  visible: boolean
  maxWidth?: number
  offsetX: number
  offsetY: number
  /** Outline/stroke color */
  strokeColor?: string
  /** Outline/stroke width in pixels */
  strokeWidth?: number
  /** Shadow color */
  shadowColor?: string
  /** Shadow X offset */
  shadowOffsetX?: number
  /** Shadow Y offset */
  shadowOffsetY?: number
  /** Shadow blur radius */
  shadowBlur?: number
  /** Enable word wrapping at maxWidth */
  wordWrap?: boolean
  /** Line height multiplier for wrapped text (default 1.2) */
  lineHeight?: number
  /** Opacity 0-1 */
  opacity?: number
  /**
   * Enable SDF (Signed Distance Field) rendering for sharper, scale-independent
   * text. Textures are generated once and cached per font+text combination.
   */
  sdf?: boolean
  /**
   * SDF spread in pixels — controls the distance field range around each glyph
   * edge. Larger = wider soft zone (useful for glow / thick outlines). Default 8.
   * Only used when `sdf: true`.
   */
  sdfSpread?: number
}

export function createText(opts: Partial<Omit<TextComponent, 'type'>> & { text: string }): TextComponent {
  return {
    type: 'Text',
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#ffffff',
    align: 'center',
    baseline: 'middle',
    zIndex: 10,
    visible: true,
    offsetX: 0,
    offsetY: 0,
    wordWrap: false,
    lineHeight: 1.2,
    ...opts,
  }
}
