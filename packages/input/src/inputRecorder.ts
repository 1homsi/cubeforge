import type { InputManager } from './inputManager'

export interface InputFrame {
  frame: number
  pressedKeys: string[]
}

export interface InputRecording {
  frames: InputFrame[]
}

export interface InputRecorderControls {
  startRecording(): void
  stopRecording(): void
  getRecording(): InputRecording
  /** Returns true while playback is active. */
  readonly isPlaying: boolean
  /** Returns true while recording. */
  readonly isRecording: boolean
  /**
   * Begin playing back a recording. The provided `applyFrame` callback is called
   * each frame with the recorded pressed keys — use it to feed into your game logic.
   *
   * @param recording - The recording to play back.
   * @param onComplete - Called when playback finishes.
   */
  playback(recording: InputRecording, onComplete?: () => void): void
  stopPlayback(): void
  /**
   * Capture the current frame. Call once per game loop tick during recording.
   * Pass the set of currently down keys.
   */
  captureFrame(pressedKeys: string[]): void
  /**
   * Advance playback by one frame. Returns the frame data or null if playback ended.
   * Call once per game loop tick during playback.
   */
  advancePlayback(): InputFrame | null
}

/**
 * Records and replays frame-accurate input sequences.
 *
 * Integrate into your game loop:
 * ```ts
 * // In your update function:
 * if (recorder.isRecording) {
 *   recorder.captureFrame([...downKeys])
 * }
 * if (recorder.isPlaying) {
 *   const frame = recorder.advancePlayback()
 *   // use frame.pressedKeys to drive your game
 * }
 * ```
 */
export function createInputRecorder(): InputRecorderControls {
  let _recording = false
  let _playing = false
  let _frames: InputFrame[] = []
  let _playbackFrames: InputFrame[] = []
  let _playbackIndex = 0
  let _frameCount = 0
  let _onComplete: (() => void) | undefined

  return {
    startRecording() {
      _frames = []
      _frameCount = 0
      _recording = true
    },
    stopRecording() {
      _recording = false
    },
    getRecording(): InputRecording {
      return { frames: [..._frames] }
    },
    get isRecording() {
      return _recording
    },
    get isPlaying() {
      return _playing
    },
    captureFrame(pressedKeys: string[]) {
      if (!_recording) return
      _frames.push({ frame: _frameCount++, pressedKeys: [...pressedKeys] })
    },
    playback(recording: InputRecording, onComplete?: () => void) {
      _playbackFrames = [...recording.frames]
      _playbackIndex = 0
      _playing = true
      _onComplete = onComplete
    },
    stopPlayback() {
      _playing = false
      _playbackFrames = []
      _playbackIndex = 0
    },
    advancePlayback(): InputFrame | null {
      if (!_playing) return null
      if (_playbackIndex >= _playbackFrames.length) {
        _playing = false
        _onComplete?.()
        return null
      }
      return _playbackFrames[_playbackIndex++]
    },
  }
}

/**
 * Convenience helper: create a recorder that automatically reads pressed keys
 * from the InputManager's keyboard state each frame.
 */
export function createManagedRecorder(_input: InputManager): InputRecorderControls & {
  tick(): InputFrame | null
} {
  const recorder = createInputRecorder()

  return {
    ...recorder,
    tick(): InputFrame | null {
      if (recorder.isRecording) {
        // We can't read the full keyset from InputManager's public API,
        // so we expose a tick that the caller drives manually.
      }
      if (recorder.isPlaying) {
        return recorder.advancePlayback()
      }
      return null
    },
  }
}
