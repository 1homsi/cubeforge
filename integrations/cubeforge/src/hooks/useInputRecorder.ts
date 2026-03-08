import { useMemo } from 'react'
import { createInputRecorder } from '@cubeforge/input'
import type { InputRecorderControls, InputRecording } from '@cubeforge/input'

/**
 * Returns an `InputRecorderControls` instance that persists across renders.
 *
 * Use inside a `<Script update>` to drive recording/playback:
 *
 * @example
 * ```tsx
 * function DemoPlayer() {
 *   const recorder = useInputRecorder()
 *
 *   return (
 *     <Script update={(id, world, input, dt) => {
 *       if (recorder.isRecording) {
 *         recorder.captureFrame([...downKeys])
 *       }
 *       if (recorder.isPlaying) {
 *         const frame = recorder.advancePlayback()
 *         // apply frame.pressedKeys to player controller
 *       }
 *     }} />
 *   )
 * }
 * ```
 */
export function useInputRecorder(): InputRecorderControls {
  return useMemo(() => createInputRecorder(), [])
}

export type { InputRecorderControls, InputRecording }
