import type { Component } from '@cubeforge/core'

export interface SquashStretchComponent extends Component {
  readonly type: 'SquashStretch'
  /** How much to squash/stretch (default 0.2) */
  intensity: number
  /** How fast it returns to 1.0 (lerp speed, default 8.0) */
  recovery: number
  /** Current applied X scale modifier */
  currentScaleX: number
  /** Current applied Y scale modifier */
  currentScaleY: number
}
