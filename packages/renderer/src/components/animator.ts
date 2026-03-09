import type { Component } from '@cubeforge/core'

export type AnimatorParamValue = number | boolean | string

export type AnimatorCondition =
  | { param: string; op: '==' | '!='; value: string | boolean | number }
  | { param: string; op: '>' | '>=' | '<' | '<='; value: number }

export interface AnimatorTransition {
  to: string
  when: AnimatorCondition[]
  /** Higher priority transitions are evaluated first. Default 0. */
  priority?: number
  /** Normalized playback progress (0–1) required before this transition can fire. */
  exitTime?: number
}

export interface AnimatorStateDefinition {
  /** Name of the clip in AnimationState.clips to play for this state. */
  clip: string
  transitions?: AnimatorTransition[]
  onEnter?: () => void
  onExit?: () => void
}

export interface AnimatorComponent extends Component {
  readonly type: 'Animator'
  initialState: string
  currentState: string
  states: Record<string, AnimatorStateDefinition>
  params: Record<string, AnimatorParamValue>
  playing: boolean
  /** Internal: whether onEnter has been called for the current state. */
  _entered: boolean
}
