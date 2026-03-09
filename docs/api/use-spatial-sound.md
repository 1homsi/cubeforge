# useSpatialSound

Hook for playing positional audio that attenuates based on distance from the listener (typically the camera or player). Creates an immersive audio experience where sounds get quieter the further away they are.

## Usage

```tsx
import { useSpatialSound } from 'cubeforge'

const sound = useSpatialSound('/audio/fire.mp3', {
  maxDistance: 300,
  refDistance: 50,
})
```

## Signature

```ts
function useSpatialSound(
  src: string,
  options?: SpatialSoundOptions
): SpatialSoundControls
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `src` | `string` | **Required.** Path to the audio file |
| `options` | `SpatialSoundOptions` | Configuration for distance attenuation |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `maxDistance` | `number` | `500` | Distance at which the sound is fully silent |
| `refDistance` | `number` | `50` | Distance at which the sound starts to attenuate |
| `rolloff` | `number` | `1` | How quickly the sound fades with distance (higher = faster fade) |
| `loop` | `boolean` | `false` | Whether the sound loops |
| `volume` | `number` | `1` | Base volume (0 to 1) before distance attenuation |

## Return value

`SpatialSoundControls`

| Field | Type | Description |
|---|---|---|
| `play` | `(x: number, y: number) => void` | Play the sound at a world-space position |
| `stop` | `() => void` | Stop playback |
| `setPosition` | `(x: number, y: number) => void` | Update the sound source position (for moving sources) |
| `setVolume` | `(v: number) => void` | Update the base volume |
| `isPlaying` | `boolean` | Whether the sound is currently playing |

## Example

### Ambient fire

```tsx
import { Entity, Transform, Script, useSpatialSound } from 'cubeforge'

function Campfire({ x, y }) {
  const fire = useSpatialSound('/audio/fire-crackle.mp3', {
    maxDistance: 200,
    refDistance: 30,
    loop: true,
  })

  return (
    <Entity>
      <Transform x={x} y={y} />
      <Script
        init={() => fire.play(x, y)}
      />
    </Entity>
  )
}
```

### Moving sound source

```tsx
function Helicopter({ x, y }) {
  const rotor = useSpatialSound('/audio/rotor.mp3', {
    maxDistance: 400,
    loop: true,
  })

  return (
    <Entity>
      <Transform x={x} y={y} />
      <Script
        init={() => rotor.play(x, y)}
        update={(id, world) => {
          const t = world.getComponent(id, 'Transform')
          rotor.setPosition(t.x, t.y)
        }}
      />
    </Entity>
  )
}
```

## See also

- [useSound](/api/use-sound) — non-positional sound playback
- [Audio Groups](/api/audio-groups) — volume grouping and management
