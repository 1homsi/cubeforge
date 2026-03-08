import type { Component } from '@cubeforge/core'

export interface AnimationStateComponent extends Component {
  readonly type: 'AnimationState'
  frames: number[]
  fps: number
  loop: boolean
  playing: boolean
  /** Index into the frames array (not the frame index itself) */
  currentIndex: number
  timer: number
  /** Called once when a non-looping animation reaches its last frame. */
  onComplete?: () => void
  /**
   * Map of frame index (0-based position in the frames array) → callback.
   * Fired once each time the animation advances to that frame.
   *
   * @example
   * frameEvents={{ 2: () => playFootstep(), 5: () => playFootstep() }}
   */
  frameEvents?: Record<number, () => void>
  /** Internal flag to prevent onComplete from firing more than once per playthrough. */
  _completed: boolean
}
