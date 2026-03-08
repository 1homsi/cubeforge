# useInputRecorder

Records and plays back input sequences. Useful for demos, replay systems, and automated testing.

## Signature

```ts
function useInputRecorder(): InputRecorderControls
```

## InputRecorderControls

| Method / Property | Description |
|---|---|
| `isRecording` | True while actively recording. |
| `isPlayingBack` | True while replaying a recording. |
| `startRecording()` | Begin capturing frames. |
| `stopRecording()` | Stop recording and return the `InputRecording`. |
| `captureFrame(pressedKeys)` | Record one frame manually (called each game tick). |
| `playback(recording)` | Start replaying a previously captured recording. |
| `advancePlayback()` | Advance playback by one frame. Returns the frame or null when done. |

## Example

```tsx
import { useInputRecorder, createInputRecorder } from 'cubeforge'

function RecordingDemo() {
  const recorder = useInputRecorder()

  return (
    <Script update={(_id, _world, input) => {
      if (recorder.isRecording) {
        // Capture whatever keys are pressed this frame
        const held = Array.from((input.keyboard as any).held ?? [])
        recorder.captureFrame(held)
      }
      if (recorder.isPlayingBack) {
        const frame = recorder.advancePlayback()
        if (frame) {
          // Re-apply frame.pressedKeys to your input map
        }
      }
    }} />
  )
}
```

## Notes

- `InputRecording` is a plain JSON-serialisable array — safe to store in `localStorage` or send over the network.
- Use `useSave` to persist recordings between sessions.
