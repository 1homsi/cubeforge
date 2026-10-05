import type { Component } from '@cubeforge/core'
import { registerTextEntityRenderer } from '../layerRegistry'
import { createEntityTextBatcher } from '../textEntities'

export interface TextComponent extends Component {
  readonly type: 'Text'
  text: string
  fontSize: number
  fontFamily: string
  /** CSS font weight ('bold', 600...). Default normal. */
  fontWeight?: string | number
  /** 'italic' for an italic face. */
  fontStyle?: 'normal' | 'italic'
  color: string
  align: CanvasTextAlign
  baseline: CanvasTextBaseline
  zIndex: number
  /**
   * Render layer to sort with sprites by (with `zIndex`). Unset (the default):
   * text draws above all sprites, ordered among texts by `zIndex`.
   */
  layer?: string
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
}

export function createText(opts: Partial<Omit<TextComponent, 'type'>> & { text: string }): TextComponent {
  // Text entities batch through the shared glyph atlas; bundled only when Text is used.
  registerTextEntityRenderer(createEntityTextBatcher)
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
