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
}
