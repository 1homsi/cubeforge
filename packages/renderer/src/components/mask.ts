import type { Component } from '@cubeforge/core'

export type MaskShape = 'rect' | 'circle' | 'sprite'

export interface MaskComponent extends Component {
  readonly type: 'Mask'
  shape: MaskShape
  /** For rect mask */
  width: number
  height: number
  /** For circle mask */
  radius: number
  /** Whether to invert the mask (show outside, hide inside) */
  inverted: boolean
  /** Mask anchor 0-1 */
  anchorX: number
  anchorY: number
  visible: boolean
}

export function createMask(opts?: Partial<Omit<MaskComponent, 'type'>>): MaskComponent {
  return {
    type: 'Mask',
    shape: opts?.shape ?? 'rect',
    width: opts?.width ?? 64,
    height: opts?.height ?? 64,
    radius: opts?.radius ?? 32,
    inverted: opts?.inverted ?? false,
    anchorX: opts?.anchorX ?? 0.5,
    anchorY: opts?.anchorY ?? 0.5,
    visible: opts?.visible ?? true,
  }
}
