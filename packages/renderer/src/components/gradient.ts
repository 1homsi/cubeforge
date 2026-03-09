import type { Component } from '@cubeforge/core'

export type GradientType = 'linear' | 'radial'

export interface GradientStop {
  offset: number // 0-1
  color: string
}

export interface GradientComponent extends Component {
  readonly type: 'Gradient'
  gradientType: GradientType
  stops: GradientStop[]
  /** For linear: angle in radians (0 = left to right) */
  angle: number
  /** For radial: inner radius ratio (0-1) */
  innerRadius: number
  visible: boolean
  zIndex: number
  width: number
  height: number
  /** Anchor point X 0-1 */
  anchorX: number
  /** Anchor point Y 0-1 */
  anchorY: number
}

export function createGradient(opts?: Partial<Omit<GradientComponent, 'type'>>): GradientComponent {
  return {
    type: 'Gradient',
    gradientType: 'linear',
    stops: [],
    angle: 0,
    innerRadius: 0,
    visible: true,
    zIndex: 0,
    width: 100,
    height: 100,
    anchorX: 0.5,
    anchorY: 0.5,
    ...opts,
  }
}
