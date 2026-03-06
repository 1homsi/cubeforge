# World

Sets world-level configuration. All game entities should be placed inside `<World>`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `background` | string | `'#1a1a2e'` | Canvas background colour (CSS colour value) |
| `gravity` | number | — | Override the gravity set on `<Game>`. Useful for per-level gravity changes. |
| `children` | ReactNode | — | Entities and other game components |

## Example

```tsx
<Game width={800} height={500} gravity={980}>
  <World background="#0d1b2a">
    <Camera2D followEntity="player" />
    <Player />
    <Ground />
  </World>
</Game>
```

## Changing gravity per level

You can override gravity at the World level without touching the Game component. This is useful for level-specific physics, like a low-gravity space level:

```tsx
const [level, setLevel] = useState<'normal' | 'moon'>('normal')

<Game width={800} height={500} gravity={980}>
  <World
    background={level === 'moon' ? '#111' : '#1a1a2e'}
    gravity={level === 'moon' ? 160 : 980}
  >
    {/* entities */}
  </World>
</Game>
```

## Notes

- If both `<Game gravity>` and `<World gravity>` are set, the World value takes precedence.
- Background colour is applied to the camera's clear pass each frame. If there is no `<Camera2D>`, it falls back to the canvas element's CSS background.
