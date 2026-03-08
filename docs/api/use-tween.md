# useTween

Animates a numeric value from `from` to `to` over a given `duration` using `requestAnimationFrame`. Useful for UI animations, camera effects, or any value that needs smooth interpolation outside the ECS game loop.

For in-loop tweening (driven by `dt`), see the lower-level [`tween`](/api/tween) utility.

## Signature

```ts
function useTween(opts: {
  from: number
  to: number
  duration: number
  ease?: (t: number) => number
  onUpdate: (value: number) => void
  onComplete?: () => void
  autoStart?: boolean
}): TweenControls
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `from` | number | required | Start value |
| `to` | number | required | End value |
| `duration` | number | required | Duration in **seconds** |
| `ease` | `(t: number) => number` | `Ease.linear` | Easing function from the `Ease` object (or any custom `(0-1) => number` function) |
| `onUpdate` | `(value: number) => void` | required | Called every frame with the interpolated value |
| `onComplete` | `() => void` | -- | Called once when the tween finishes |
| `autoStart` | boolean | `false` | Start immediately on mount |

## TweenControls

| Property / Method | Type | Description |
|---|---|---|
| `start()` | `() => void` | Start (or restart) the tween |
| `stop()` | `() => void` | Cancel the tween mid-flight |
| `isRunning` | boolean | `true` while the tween is in progress |

## Example -- fade in on mount

```tsx
import { useTween, Ease } from 'cubeforge'
import { useRef } from 'react'

function FadeIn({ children }) {
  const ref = useRef<HTMLDivElement>(null)

  useTween({
    from: 0,
    to: 1,
    duration: 0.6,
    ease: Ease.easeOutCubic,
    onUpdate: (v) => {
      if (ref.current) ref.current.style.opacity = String(v)
    },
    autoStart: true,
  })

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>
}
```

## Example -- trigger on demand

```tsx
import { useTween, Ease, useCamera } from 'cubeforge'

function BossIntro() {
  const cam = useCamera()

  const zoom = useTween({
    from: 1,
    to: 2,
    duration: 1.2,
    ease: Ease.easeInOutQuad,
    onUpdate: (v) => cam.setZoom(v),
    onComplete: () => console.log('zoom complete'),
  })

  // Call zoom.start() when you want to trigger the effect
  return <button onClick={() => zoom.start()}>Start Boss Intro</button>
}
```

## Available easing functions

The `Ease` object provides 25+ standard Robert Penner easings:

| Family | In | Out | InOut |
|---|---|---|---|
| Quad | `easeInQuad` | `easeOutQuad` | `easeInOutQuad` |
| Cubic | `easeInCubic` | `easeOutCubic` | `easeInOutCubic` |
| Quart | `easeInQuart` | `easeOutQuart` | `easeInOutQuart` |
| Quint | `easeInQuint` | `easeOutQuint` | `easeInOutQuint` |
| Sine | `easeInSine` | `easeOutSine` | `easeInOutSine` |
| Expo | `easeInExpo` | `easeOutExpo` | `easeInOutExpo` |
| Circ | `easeInCirc` | `easeOutCirc` | `easeInOutCirc` |
| Back | `easeInBack` | `easeOutBack` | `easeInOutBack` |
| Elastic | `easeInElastic` | `easeOutElastic` | `easeInOutElastic` |
| Bounce | `easeInBounce` | `easeOutBounce` | `easeInOutBounce` |

Plus `linear`. You can also pass any custom function `(t: number) => number`.

## See also

- [tween](/api/tween) -- lower-level, dt-driven tween for use inside `Script` update loops
- [Ease](/api/tween) -- the full set of easing functions
