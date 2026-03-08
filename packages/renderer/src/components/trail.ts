import type { Component } from '@cubeforge/core'

export interface TrailComponent extends Component {
  readonly type: 'Trail'
  /** Maximum number of trail points to keep */
  length: number
  /** CSS color string for the trail */
  color: string
  /** Width of the trail in pixels */
  width: number
  /** Points collected from entity transform positions, newest first */
  points: { x: number; y: number }[]
}

export function createTrail(opts?: Partial<TrailComponent>): TrailComponent {
  return {
    type: 'Trail',
    length: 20,
    color: '#ffffff',
    width: 3,
    points: [],
    ...opts,
  }
}
