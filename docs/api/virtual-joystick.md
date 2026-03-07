# VirtualJoystick / useVirtualInput

On-screen virtual joystick and button overlay for touch / mobile. Render `<VirtualJoystick>` as a sibling of `<Game>`, then read the state with `useVirtualInput()` inside any entity.

## VirtualJoystick

```tsx
import { VirtualJoystick } from 'cubeforge'
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | number | `120` | Diameter of the joystick base in pixels |
| `position` | `'left' \| 'right'` | `'left'` | Screen corner to anchor to |
| `actionButton` | boolean | `false` | Show a circular action button (e.g. jump) |
| `actionLabel` | string | `'A'` | Label shown on the action button |
| `actionName` | string | `'action'` | Virtual button name read by `useVirtualInput().button()` |
| `style` | CSSProperties | — | Extra CSS applied to the outer container |

### Usage

Place `<VirtualJoystick>` inside a `position: relative` container that wraps the canvas:

```tsx
<div style={{ position: 'relative' }}>
  <Game width={800} height={560}>
    <World>
      <Player />
    </World>
  </Game>
  <VirtualJoystick position="left" actionButton actionLabel="Jump" />
</div>
```

---

## useVirtualInput

```ts
function useVirtualInput(): VirtualInputState
```

### VirtualInputState

| Property / Method | Type | Description |
|---|---|---|
| `axisX` | number | Left–right axis in [−1, 1]. Positive = right. |
| `axisY` | number | Up–down axis in [−1, 1]. Positive = down. |
| `button(name)` | `(s: string) => boolean` | Whether a named virtual button is pressed |

### Example

```tsx
import { useVirtualInput, useInput } from 'cubeforge'

function Player() {
  const input = useInput()
  const virt  = useVirtualInput()

  return (
    <Entity>
      <Script update={(id, world, input, dt) => {
        // Combine keyboard + touch input
        const moveX = input.isDown('ArrowRight') ? 1
                    : input.isDown('ArrowLeft')  ? -1
                    : virt.axisX

        const jump = input.isPressed('Space') || virt.button('action')

        // use moveX and jump...
      }} />
    </Entity>
  )
}
```

## Full mobile setup example

```tsx
function App() {
  return (
    <div style={{ position: 'relative', width: 800, height: 560 }}>
      <Game width={800} height={560} gravity={980}>
        <World>
          <Player />
        </World>
      </Game>
      {/* Left joystick for movement, right button for jump */}
      <VirtualJoystick position="left" />
      <VirtualJoystick
        position="right"
        size={80}
        actionButton
        actionLabel="↑"
        actionName="jump"
      />
    </div>
  )
}
```

## Notes

- `useVirtualInput` reads synchronously from a module-level store. It does **not** trigger React re-renders — safe to call every frame from a Script.
- Multiple `<VirtualJoystick>` instances share the same axis store. Use the second one only for buttons (`actionButton`) if you need a separate jump button.
- The joystick uses pointer events (`setPointerCapture`) for reliable multi-touch handling.
- The overlay divs have `touchAction: none` and `userSelect: none` set automatically.
