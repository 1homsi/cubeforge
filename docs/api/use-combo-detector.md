# useComboDetector

Hook for detecting input combo sequences, commonly used in fighting games, beat-em-ups, or any game that rewards sequential button presses.

## Usage

```tsx
import { useComboDetector } from 'cubeforge'

const combo = useComboDetector({
  sequences: {
    hadouken: ['down', 'downRight', 'right', 'punch'],
    shoryuken: ['right', 'down', 'downRight', 'punch'],
    kick3x: ['kick', 'kick', 'kick'],
  },
  timeout: 500,
})
```

## Signature

```ts
function useComboDetector(
  options: ComboDetectorOptions
): ComboDetectorState
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `sequences` | `Record<string, string[]>` | — | **Required.** Map of combo names to their action sequences |
| `timeout` | `number` | `500` | Maximum time (ms) between consecutive inputs before the combo resets |
| `onCombo` | `(name: string) => void` | — | Callback fired when a combo completes |

## Return value

`ComboDetectorState`

| Field | Type | Description |
|---|---|---|
| `lastCombo` | `string \| null` | Name of the most recently completed combo, or `null` |
| `progress` | `Record<string, number>` | Number of steps completed for each combo |
| `reset` | `() => void` | Manually reset all combo progress |

## Example

```tsx
import { useComboDetector } from 'cubeforge'

function Fighter() {
  const combo = useComboDetector({
    sequences: {
      uppercut:    ['down', 'up', 'punch'],
      spinKick:    ['left', 'right', 'kick'],
      superPunch:  ['punch', 'punch', 'punch'],
    },
    timeout: 400,
    onCombo: (name) => {
      if (name === 'superPunch') dealDamage(50)
      if (name === 'uppercut')   dealDamage(30)
      if (name === 'spinKick')   dealDamage(35)
    },
  })

  return (
    <Script update={() => {
      // The hook handles detection automatically
      // Use combo.lastCombo for animation triggers
      if (combo.lastCombo === 'superPunch') {
        playAnimation('superPunch')
      }
    }} />
  )
}
```
