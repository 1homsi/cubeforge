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
}
