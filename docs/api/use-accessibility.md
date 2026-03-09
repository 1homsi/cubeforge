# useAccessibility

Hook for managing accessibility features in your game. Provides colorblind mode simulation, font scaling, reduced motion support, and screen reader announcements.

## Usage

```tsx
import { useAccessibility } from 'cubeforge'

const a11y = useAccessibility()
```

## Signature

```ts
function useAccessibility(): AccessibilityControls
```

## Return value

`AccessibilityControls`

| Field | Type | Description |
|---|---|---|
| `colorblindMode` | `'none' \| 'protanopia' \| 'deuteranopia' \| 'tritanopia'` | Current colorblind simulation mode |
| `setColorblindMode` | `(mode: string) => void` | Set the active colorblind mode |
| `fontScale` | `number` | Current font scale multiplier (default `1`) |
| `setFontScale` | `(scale: number) => void` | Set the font scale multiplier |
| `reduceMotion` | `boolean` | Whether reduced motion is active |
| `setReduceMotion` | `(enabled: boolean) => void` | Enable or disable reduced motion |
| `announce` | `(message: string) => void` | Send a message to the screen reader live region |

## Example

### Accessibility options menu

```tsx
import { useAccessibility } from 'cubeforge'

function AccessibilityMenu() {
  const { colorblindMode, setColorblindMode, fontScale, setFontScale, reduceMotion, setReduceMotion } =
    useAccessibility()

  return (
    <Entity>
      {/* Colorblind mode toggle */}
      <Script update={(id, world, input) => {
        if (input.isPressed('KeyC')) {
          const modes = ['none', 'protanopia', 'deuteranopia', 'tritanopia']
          const next = modes[(modes.indexOf(colorblindMode) + 1) % modes.length]
          setColorblindMode(next)
        }
        if (input.isPressed('Equal')) setFontScale(Math.min(fontScale + 0.1, 2))
        if (input.isPressed('Minus')) setFontScale(Math.max(fontScale - 0.1, 0.5))
        if (input.isPressed('KeyM')) setReduceMotion(!reduceMotion)
      }} />
    </Entity>
  )
}
```

### Screen reader announcements

```tsx
const { announce } = useAccessibility()

// Announce game events
function onLevelComplete() {
  announce('Level 3 complete! Starting level 4.')
}

function onDamage(amount) {
  announce(`Took ${amount} damage. Health: ${currentHp}.`)
}
```

### Reduced motion

```tsx
const { reduceMotion } = useAccessibility()

// Skip particle effects and screen shake when reduced motion is on
if (!reduceMotion) {
  camera.shake(5, 200)
  spawnParticles()
}
```
