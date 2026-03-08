# Audio Volume Groups

The audio system routes all sounds through a shared Web Audio gain graph. You can control volume for individual groups or the master output independently.

## Graph structure

```
each sound → group gain (any name) → master gain → speakers
```

## Functions

```ts
import { setGroupVolume, setMasterVolume, getGroupVolume } from 'cubeforge'
```

| Function | Description |
|---|---|
| `setGroupVolume(group, volume)` | Set the volume for any group (e.g. `'sfx'`, `'music'`, `'ambient'`) (0–1) |
| `setMasterVolume(volume)` | Set the master volume affecting all sounds (0–1) |
| `getGroupVolume(group)` | Read the current volume for a group or `'master'` |

## Assigning a sound to a group

Pass the `group` option to `useSound`:

```tsx
// Background music — routed through the 'music' group
const music = useSound('/music/theme.ogg', { loop: true, group: 'music' })

// Sound effects — routed through the 'sfx' group
const { play: playJump } = useSound('/sfx/jump.wav', { group: 'sfx' })
const { play: playCoin } = useSound('/sfx/coin.wav', { group: 'sfx' })
```

## Example — music/SFX volume slider

```tsx
import { setGroupVolume, setMasterVolume } from 'cubeforge'

function AudioSettings() {
  return (
    <div>
      <label>
        Master
        <input type="range" min={0} max={1} step={0.01} defaultValue={1}
          onChange={e => setMasterVolume(Number(e.target.value))} />
      </label>
      <label>
        Music
        <input type="range" min={0} max={1} step={0.01} defaultValue={1}
          onChange={e => setGroupVolume('music', Number(e.target.value))} />
      </label>
      <label>
        SFX
        <input type="range" min={0} max={1} step={0.01} defaultValue={1}
          onChange={e => setGroupVolume('sfx', Number(e.target.value))} />
      </label>
    </div>
  )
}
```

## Mute all

```tsx
setMasterVolume(0) // mute
setMasterVolume(1) // restore
```

## Custom groups

The `group` parameter accepts any string, not just `'sfx'` and `'music'`. Custom groups are created on first use:

```tsx
// Custom 'ambient' group
const rain = useSound('/sounds/rain.ogg', { loop: true, group: 'ambient' })
const wind = useSound('/sounds/wind.ogg', { loop: true, group: 'ambient' })

// Custom 'voice' group
const dialogue = useSound('/vo/greeting.ogg', { group: 'voice' })

// Control custom groups the same way as built-in ones
setGroupVolume('ambient', 0.3)
setGroupVolume('voice', 0.9)
```

## Notes

- Group names are arbitrary strings. Built-in groups `'sfx'` and `'music'` have no special behaviour — they are simply conventional names.
- Group and master gain nodes are created lazily on first use — calling `setGroupVolume` before any sound plays still works.
- Setting volume on a group does not affect the per-sound `volume` option or `setVolume()` on `SoundControls` — they are multiplied together in the graph.
- Sounds with no `group` connect directly to the master gain node and are unaffected by `setGroupVolume`.

## See also

- [useSound](/api/use-sound) — load and play individual sounds
