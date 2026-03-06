import type { Component } from '@cubeforge/core'

export interface Camera2DComponent extends Component {
  readonly type: 'Camera2D'
  /** Current world-space camera center (updated each frame when following) */
  x: number
  y: number
  zoom: number
  /** String ID of entity to follow */
  followEntityId?: string
  /** Lerp factor for smooth follow (0 = instant, values like 0.85 = smooth) */
  smoothing: number
  /** Background fill color */
  background: string
}

export function createCamera2D(opts?: Partial<Camera2DComponent>): Camera2DComponent {
  return {
    type: 'Camera2D',
    x: 0,
    y: 0,
    zoom: 1,
    smoothing: 0,
    background: '#1a1a2e',
    ...opts,
  }
}
