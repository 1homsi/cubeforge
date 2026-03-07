# Text

Renders a text string on the canvas at the entity's transform position. Sorted by `zIndex` along with sprites.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `text` | string | — | **Required.** The string to render |
| `fontSize` | number | `16` | Font size in pixels |
| `fontFamily` | string | `'monospace'` | CSS font family string |
| `color` | string | `'#ffffff'` | Text fill colour |
| `align` | CanvasTextAlign | `'center'` | Horizontal alignment: `'left'`, `'center'`, or `'right'` |
| `baseline` | CanvasTextBaseline | `'middle'` | Vertical alignment: `'top'`, `'middle'`, `'bottom'`, `'alphabetic'`, etc. |
| `zIndex` | number | `10` | Draw order — higher values render on top |
| `visible` | boolean | `true` | If false, the text is not drawn |
| `maxWidth` | number | — | Maximum render width in pixels. Text is scaled down if wider. |
| `offsetX` | number | `0` | Horizontal draw offset relative to transform position |
| `offsetY` | number | `0` | Vertical draw offset relative to transform position |

## Example

```tsx
import { Entity, Transform, Text } from 'cubeforge'

function ScoreLabel({ score }: { score: number }) {
  return (
    <Entity>
      <Transform x={400} y={30} />
      <Text
        text={`Score: ${score}`}
        fontSize={20}
        fontFamily='"Press Start 2P", monospace'
        color="#ffd700"
        align="center"
        baseline="top"
        zIndex={100}
      />
    </Entity>
  )
}
```

## Mutable props

`text`, `color`, `visible`, and `zIndex` are synced every render — drive them from React state. `fontSize`, `fontFamily`, `align`, `baseline`, `maxWidth`, `offsetX`, and `offsetY` are set on mount and not updated dynamically.

## Notes

- `<Text>` must be inside an `<Entity>` with a `<Transform>`.
- Text is drawn in screen space after the camera transform, so world coordinates apply.
- For HUD elements that stay fixed on screen, position them relative to the camera viewport using the camera's world position plus a fixed screen offset.
