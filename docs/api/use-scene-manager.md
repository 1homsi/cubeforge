# useSceneManager

Hook for managing a stack-based scene system. Supports pushing, popping, and replacing scenes with optional transition data.

## Usage

```tsx
import { useSceneManager } from 'cubeforge'

const { current, push, pop, replace, reset } = useSceneManager('mainMenu')
```

## Signature

```ts
function useSceneManager(
  initialScene: string
): SceneManagerControls
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `initialScene` | `string` | The name of the starting scene |

## Return value

`SceneManagerControls`

| Field | Type | Description |
|---|---|---|
| `current` | `string` | The currently active scene name |
| `push` | `(scene: string, data?: any) => void` | Push a new scene onto the stack (the previous scene stays underneath) |
| `pop` | `(data?: any) => void` | Pop the current scene, returning to the one below it |
| `replace` | `(scene: string, data?: any) => void` | Replace the current scene without pushing onto the stack |
| `reset` | `(scene: string) => void` | Clear the entire stack and set a new root scene |
| `data` | `any` | Optional data passed during the last push/pop/replace |

## Example

```tsx
import { useSceneManager } from 'cubeforge'

function MyGame() {
  const { current, push, pop, replace } = useSceneManager('mainMenu')

  return (
    <Game width={800} height={600}>
      <World>
        {current === 'mainMenu' && <MainMenu onStart={() => replace('gameplay')} />}
        {current === 'gameplay' && <Gameplay onPause={() => push('pause')} />}
        {current === 'pause'    && <PauseMenu onResume={() => pop()} />}
      </World>
    </Game>
  )
}
```

### Passing data between scenes

```tsx
// Push with level data
push('gameplay', { level: 3, difficulty: 'hard' })

// Read it in the gameplay scene
const { data } = useSceneManager('gameplay')
// data.level === 3
```
