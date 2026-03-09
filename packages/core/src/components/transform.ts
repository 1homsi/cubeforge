import type { Component } from '../ecs/world'

export interface TransformComponent extends Component {
  readonly type: 'Transform'
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export function createTransform(x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1): TransformComponent {
  return { type: 'Transform', x, y, rotation, scaleX, scaleY }
}
