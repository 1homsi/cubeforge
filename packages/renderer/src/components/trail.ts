import type { Component } from '@cubeforge/core'

export interface TrailComponent extends Component {
  readonly type: 'Trail'
  /** Maximum number of trail points to keep */
  length: number
  /** CSS color string for the trail (used when colorOverLife is not set) */
  color: string
  /** Width of the trail in pixels (used when widthOverLife is not set) */
  width: number
  /** Points collected from entity transform positions, newest first */
  points: { x: number; y: number }[]
  /**
   * Array of CSS color strings to interpolate through over the trail length.
   * Index 0 = newest (head), last index = oldest (tail).
   * When set, overrides `color`.
   */
  colorOverLife?: string[]
  /**
   * Interpolate width from start (head/newest) to end (tail/oldest).
   * When set, overrides `width`.
   */
  widthOverLife?: { start: number; end: number }
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
