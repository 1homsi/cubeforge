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
  /** Internal flag to prevent onComplete from firing more than once per playthrough. */
  _completed: boolean
}
