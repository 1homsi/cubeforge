import type { Component } from '@cubeforge/core'

export interface NineSliceComponent extends Component {
  readonly type: 'NineSlice'
  src: string
  width: number
  height: number
  borderTop: number
  borderRight: number
  borderBottom: number
  borderLeft: number
  zIndex: number
}

export function createNineSlice(
  src: string,
  width: number,
  height: number,
  opts?: Partial<Omit<NineSliceComponent, 'type' | 'src' | 'width' | 'height'>>,
): NineSliceComponent {
  return {
    type: 'NineSlice',
    src,
    width,
    height,
    borderTop: 8,
    borderRight: 8,
    borderBottom: 8,
    borderLeft: 8,
    zIndex: 0,
    ...opts,
  }
}
