# useSound

Loads and plays an audio file via the Web Audio API. Returns controls to play, stop, and adjust volume.

## Signature

```ts
function useSound(
  src: string,
  opts?: { volume?: number; loop?: boolean; group?: AudioGroup }
): SoundControls
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `volume` | number | `1` | Initial volume (0–1) |
| `loop` | boolean | `false` | Whether the sound loops continuously |
| `group` | string | — | Audio group name (e.g. `'sfx'`, `'music'`, or any custom string). Sounds in the same group share a volume control via `setGroupVolume`. |

## SoundControls

| Method | Description |
|---|---|
| `play(opts?)` | Start playing. Pass `{ delay: seconds }` to schedule playback after a delay (uses `AudioContext.currentTime` for sample-accurate timing). If already playing (non-looping), restarts from the beginning. |
| `stop()` | Stop current playback. |
| `setVolume(v)` | Set the volume (0–1) immediately, even while playing. |
| `fadeIn(duration)` | Ramp gain from 0 to the current volume over `duration` seconds. Starts playback. |
| `fadeOut(duration)` | Ramp gain to 0 over `duration` seconds, then stop. |
| `crossfadeTo(src, duration)` | Fade out the current sound while fading in a new source over `duration` seconds. |

## Examples

### One-shot sound effect

```tsx
import { useSound } from 'cubeforge'

function JumpScript() {
  const { play } = useSound('/sounds/jump.wav', { volume: 0.8 })

  // call play() from a Script update or event handler
  return null
}
```

### Looping background music

```tsx
function BackgroundMusic() {
  const music = useSound('/music/theme.ogg', { loop: true, volume: 0.4 })

  useEffect(() => {
    music.play()
    return () => music.stop()
  }, [])

  return null
}
```

### Mute / unmute

```tsx
function MuteButton() {
  const [muted, setMuted] = useState(false)
  const { setVolume } = useSound('/music/theme.ogg', { loop: true })

  const toggle = () => {
    const next = !muted
    setMuted(next)
    setVolume(next ? 0 : 1)
  }

  return <button onClick={toggle}>{muted ? 'Unmute' : 'Mute'}</button>
}
```

### Delayed playback

```tsx
const { play } = useSound('/sfx/explosion.wav', { group: 'sfx' })

// Play after a 0.5-second delay (sample-accurate via AudioContext scheduling)
play({ delay: 0.5 })
```

### Custom audio group

```tsx
const ambient = useSound('/sounds/rain.ogg', { loop: true, group: 'ambient' })

// Control the custom group's volume
setGroupVolume('ambient', 0.3)
```

## Notes

- The `AudioContext` is created lazily on first use. Browsers require a user gesture before audio can play — the first call to `play()` will resume a suspended context automatically.
- Audio buffers are cached by URL — re-using the same `src` does not re-fetch the file.
- `useSound` does not need to be inside an `<Entity>`. It can be used anywhere inside `<Game>`.
- The `group` parameter accepts any string, not just `'sfx'` and `'music'`. Custom groups are created on first use and can be controlled with `setGroupVolume`, `setGroupMute`, etc.
