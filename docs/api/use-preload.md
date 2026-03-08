# usePreload

Tracks loading progress for a list of assets. Returns `{ progress, loaded, error }`.

## Signature

```ts
function usePreload(assets: string[]): PreloadState
```

## PreloadState

| Field | Type | Description |
|---|---|---|
| `progress` | number | 0–1 loading fraction |
| `loaded` | boolean | True when all assets have finished loading |
| `error` | Error \| null | First error encountered, or null |

## Example

```tsx
import { usePreload } from 'cubeforge'

const ASSETS = ['/hero.png', '/tiles.png', '/jump.wav']

function LoadingGate({ children }) {
  const { loaded, progress } = usePreload(ASSETS)

  if (!loaded) {
    return <div>Loading… {Math.round(progress * 100)}%</div>
  }

  return <>{children}</>
}
```

## Notes

- For a declarative version, see `<AssetLoader>`.
- Assets are loaded via `AssetManager.loadImage` and `loadAudio`. Audio preloading requires a prior user gesture due to browser autoplay policies.
