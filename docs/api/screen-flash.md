# ScreenFlash

An overlay component that flashes the screen with a colour and then fades out. Used for hit flashes, screen transitions, and visual feedback.

## Usage

`ScreenFlash` uses a ref handle — get the ref with `useRef`, then call `flash()` imperatively.

```tsx
import { useRef } from 'react'
import { ScreenFlash } from 'cubeforge'
import type { ScreenFlashHandle } from 'cubeforge'

function App() {
  const flash = useRef<ScreenFlashHandle>(null)

  return (
    <div style={{ position: 'relative' }}>
      <Game width={800} height={560}>
        {/* game content */}
      </Game>
      <ScreenFlash ref={flash} />
      <button onClick={() => flash.current?.flash('#ef5350', 0.3)}>
        Take damage
      </button>
    </div>
  )
}
```

## ScreenFlashHandle

| Method | Description |
|---|---|
| `flash(color, duration)` | Flash the screen with `color` (any CSS colour string) and fade out over `duration` seconds. |

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `color` | string | Any CSS colour value (`'#ef5350'`, `'white'`, `'rgba(255,255,0,0.5)'`, etc.) |
| `duration` | number | Fade-out duration in seconds. The flash is instant; the fade takes this long. |

## Examples

### Hit flash (red)

```tsx
flash.current?.flash('#ef5350', 0.25)
```

### Power-up flash (white)

```tsx
flash.current?.flash('white', 0.4)
```

### Screen-wipe black

```tsx
flash.current?.flash('black', 0.6)
```

## Notes

- `ScreenFlash` renders a `position: absolute; inset: 0` div. Its parent must have `position: relative` (or another positioning context) for it to cover the game canvas.
- The div has `pointer-events: none` so it never blocks input.
- Calling `flash()` while a fade is in progress immediately restarts with the new colour and duration.
- Import the type with `import type { ScreenFlashHandle } from 'cubeforge'`.
