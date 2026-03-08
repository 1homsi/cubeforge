# AssetLoader

Declarative asset loading boundary. Shows a fallback UI while assets are loading, then renders children once everything is ready.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `assets` | string[] | — | List of asset URLs to preload |
| `fallback` | ReactNode | `null` | Shown while loading |
| `onError` | (err: Error) => void | — | Called if any asset fails to load |
| `children` | ReactNode | — | Rendered once all assets are loaded |

## Example

```tsx
import { AssetLoader } from 'cubeforge'

function App() {
  return (
    <Game>
      <AssetLoader
        assets={['/hero.png', '/tiles.png', '/jump.wav']}
        fallback={<div className="loading-screen">Loading…</div>}
        onError={err => console.error('Asset failed:', err)}
      >
        <World>
          <Player />
        </World>
      </AssetLoader>
    </Game>
  )
}
```

## Notes

- For programmatic progress tracking (e.g. a progress bar), use `usePreload` instead.
- `<AssetLoader>` can be nested — each instance tracks only its own asset list.
