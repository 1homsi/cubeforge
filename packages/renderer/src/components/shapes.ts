import type { Component } from '@cubeforge/core'

export interface CircleShapeComponent extends Component {
  readonly type: 'CircleShape'
  radius: number
  color: string
  strokeColor?: string
  strokeWidth?: number
  zIndex: number
  visible: boolean
  /** Fill opacity 0-1 */
  opacity: number
}

export interface LineShapeComponent extends Component {
  readonly type: 'LineShape'
  /** End point relative to transform position */
  endX: number
  endY: number
  color: string
  lineWidth: number
  zIndex: number
  visible: boolean
  opacity: number
  /** Line cap style */
  lineCap: CanvasLineCap
}

export interface PolygonShapeComponent extends Component {
  readonly type: 'PolygonShape'
  /** Points relative to transform position */
  points: { x: number; y: number }[]
  color: string
  strokeColor?: string
  strokeWidth?: number
  zIndex: number
  visible: boolean
  opacity: number
  /** Whether to close the polygon path */
  closed: boolean
}

export function createCircleShape(opts?: Partial<Omit<CircleShapeComponent, 'type'>>): CircleShapeComponent {
  return {
    type: 'CircleShape',
    radius: 16,
    color: '#ffffff',
    zIndex: 0,
    visible: true,
    opacity: 1,
    ...opts,
  }
}

export function createLineShape(opts?: Partial<Omit<LineShapeComponent, 'type'>>): LineShapeComponent {
  return {
    type: 'LineShape',
    endX: 0,
    endY: 0,
    color: '#ffffff',
    lineWidth: 2,
    zIndex: 0,
    visible: true,
    opacity: 1,
    lineCap: 'round',
    ...opts,
  }
}

export function createPolygonShape(opts?: Partial<Omit<PolygonShapeComponent, 'type'>>): PolygonShapeComponent {
  return {
    type: 'PolygonShape',
    points: [],
    color: '#ffffff',
    zIndex: 0,
    visible: true,
    opacity: 1,
    closed: true,
    ...opts,
  }
}
