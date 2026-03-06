# Checkpoint

A trigger zone that fires `onActivate` once when a player-tagged entity enters it, then destroys itself. Internally it combines `Entity`, `Transform`, `Sprite`, `BoxCollider`, and `Script`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `x` | number | — | **Required.** World X position |
| `y` | number | — | **Required.** World Y position |
| `width` | number | `24` | Zone width in pixels |
| `height` | number | `48` | Zone height in pixels |
| `color` | string | `'#ffd54f'` | Visual indicator colour |
| `onActivate` | `() => void` | — | Called once when a player enters the zone |

## Example

```tsx
function Level() {
  const [saveX, setSaveX] = useState(100)

  const handleRespawn = () => {
    // use saveX to respawn player at the checkpoint position
  }

  return (
    <World>
      <Player x={saveX} y={300} />
      <Checkpoint x={500} y={440} onActivate={() => setSaveX(500)} />
      <Checkpoint x={900} y={350} onActivate={() => setSaveX(900)} />
    </World>
  )
}
```

## Behaviour

The checkpoint detects proximity to entities tagged with `'player'`. When the player's center comes within range, `onActivate` is called and the checkpoint entity is destroyed — it only fires once.

## Notes

- The checkpoint renders as a visible coloured sprite. If you want an invisible trigger, set `color="transparent"` or build your own trigger using `<BoxCollider isTrigger>` and `useEvent`.
- Detecting a player requires the player entity to have the `'player'` tag: `<Entity tags={['player']}>`.
- After activation the entity self-destructs. Remove it from your game state if you track checkpoints in an array.
