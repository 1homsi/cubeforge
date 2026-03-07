# Checkpoint

A physics-backed trigger zone that fires `onActivate` once when a player-tagged entity enters its `BoxCollider`. Internally uses `useTriggerEnter` — no polling or distance checks.

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

The checkpoint owns a `BoxCollider isTrigger` that participates in the physics trigger system. When any entity tagged `'player'` enters the zone, `onActivate` fires exactly once. The visual remains in the scene — conditional rendering in the parent controls whether the checkpoint is shown.

## Notes

- The checkpoint renders as a visible coloured sprite. For an invisible trigger, set `color="transparent"` or build one with `<BoxCollider isTrigger>` and `useTriggerEnter`.
- Detection requires the player entity to have the `'player'` tag: `<Entity tags={['player']}>`.
- The component does not self-destruct — it fires `onActivate` once per mount and stays in the scene. Remove it from your render tree via state to hide it.
