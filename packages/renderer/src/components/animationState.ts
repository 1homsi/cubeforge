import type { Component } from '@cubeforge/core'

/** A single named animation clip definition. */
export interface AnimationClipDefinition {
  frames: number[]
  fps?: number
  loop?: boolean
  /** Clip to auto-transition to when this non-looping clip completes. */
  next?: string
  onComplete?: () => void
  frameEvents?: Record<number, () => void>
}

export interface AnimationStateComponent extends Component {
  readonly type: 'AnimationState'

  // ── Resolved playback state (consumed by the renderer each tick) ──

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
   */
  frameEvents?: Record<number, () => void>
  /** Internal flag to prevent onComplete from firing more than once per playthrough. */
  _completed: boolean

  // ── Named clip layer (optional) ──

  /** Map of clip name → clip definition. Set by AnimatedSprite multi-clip mode or manually. */
  clips?: Record<string, AnimationClipDefinition>
  /** The currently active clip name. Set this from a Script to switch clips at the ECS level. */
  currentClip?: string
  /** Internal: tracks the last resolved clip name so the engine detects changes. */
  _resolvedClip?: string
}
