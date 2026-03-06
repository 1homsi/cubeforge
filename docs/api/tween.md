# tween

Creates a tween that interpolates a value from `from` to `to` over `duration` seconds, calling `onUpdate` with the interpolated value each frame. Returns a handle with an `update(dt)` method that you call inside a Script or game loop callback.

## Signature

```ts
function tween(
  from: number,
  to: number,
  duration: number,
  ease?: EaseFn,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
): TweenHandle & { update(dt: number): void }
```

## TweenHandle

| Member | Type | Description |
|---|---|---|
| `update(dt)` | method | Advance the tween by `dt` seconds. Call this every frame. |
| `stop()` | method | Cancel the tween — no further updates or callbacks |
| `isComplete` | boolean | `true` once the tween has reached the end |

## Easing functions

Import from `cubeforge`:

```ts
import { Ease } from 'cubeforge'
```

| Easing | Effect |
|---|---|
| `Ease.linear` | Constant speed |
| `Ease.easeInQuad` | Starts slow, accelerates |
| `Ease.easeOutQuad` | Starts fast, decelerates |
| `Ease.easeInOutQuad` | Slow at both ends |
| `Ease.easeOutBack` | Overshoots slightly before settling |

## Example

```tsx
import { tween, Ease } from 'cubeforge'

function Door() {
  const tweenRef = useRef<ReturnType<typeof tween> | null>(null)
  const { ecs } = useGame()
  const id = useEntity()

  return (
    <Script
      init={(id, world) => {
        // Prepare tween but don't start yet
      }}
      update={(id, world, input, dt) => {
        // Drive the tween
        tweenRef.current?.update(dt)

        // Start tween on E press
        if (input.isPressed('KeyE') && !tweenRef.current?.isComplete) {
          const t = world.getComponent<TransformComponent>(id, 'Transform')
          if (!t) return
          const startY = t.y
          tweenRef.current = tween(
            startY,
            startY - 64,
            0.5,
            Ease.easeOutQuad,
            (v) => { t.y = v },
            () => { console.log('door open') },
          )
        }
      }}
    />
  )
}
```

## Chaining tweens

Chain tweens using `onComplete`:

```tsx
const first = tween(0, 100, 0.3, Ease.easeOutQuad, v => (x = v), () => {
  second = tween(100, 0, 0.3, Ease.easeInQuad, v => (x = v))
})
```

## Notes

- `tween` does not register with the engine automatically — you must call `.update(dt)` inside a Script or equivalent frame callback.
- The easing function receives `t` in the range `[0, 1]` and should return a value in the range `[0, 1]`.
- You can pass any custom easing function: `(t: number) => number`.
- `stop()` does not call `onComplete`.
