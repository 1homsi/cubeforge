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
  /**
   * Manual trigger target X scale. When set, overrides velocity-based calculation
   * for one frame and then recovers normally. Set via useSquashStretch().trigger().
   */
  _manualTargetX?: number
  /** Manual trigger target Y scale. Pair with _manualTargetX. */
  _manualTargetY?: number
}
