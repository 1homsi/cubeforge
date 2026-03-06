# Input

Cubeforge provides keyboard and mouse input through `InputManager`. It distinguishes between held, just-pressed, and just-released states, updated once per frame.

## Accessing input

Inside a `<Script>` update function, input is the third argument:

```tsx
<Script update={(id, world, input, dt) => {
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
  if (!rb) return

  if (input.isDown('ArrowLeft'))  rb.vx = -200
  if (input.isDown('ArrowRight')) rb.vx =  200
}} />
```

Outside of a Script, use the `useInput` hook:

```tsx
function PauseButton() {
  const input = useInput()

  useEffect(() => {
    const interval = setInterval(() => {
      if (input.isPressed('Escape')) setPaused(p => !p)
    }, 16)
    return () => clearInterval(interval)
  }, [input])
}
```

## Keyboard methods

| Method | Description |
|---|---|
| `input.isDown(key)` | `true` every frame while the key is held |
| `input.isPressed(key)` | `true` only on the first frame the key is pressed |
| `input.isReleased(key)` | `true` only on the frame the key is released |

**Key values** follow the browser's `KeyboardEvent.code` for most keys (`'Space'`, `'ArrowLeft'`, `'ArrowRight'`, `'ArrowUp'`, `'ArrowDown'`, `'KeyA'`, `'KeyD'`, `'ShiftLeft'`) or `KeyboardEvent.key` for printable characters (`'a'`, `'d'`, `'w'`, `'s'`).

Common examples:

```tsx
input.isDown('ArrowLeft')     // left arrow, held
input.isDown('KeyA')          // A key, held
input.isDown('a')             // A key (by key value, case-sensitive)
input.isPressed('Space')      // spacebar, just pressed
input.isReleased('ShiftLeft') // left shift, just released
input.isDown('Enter')         // enter key
input.isDown('Escape')        // escape key
```

## Mouse input

```tsx
const { mouse } = input

// Position (relative to canvas top-left)
const x = mouse.x
const y = mouse.y

// Buttons: 0 = left, 1 = middle, 2 = right
mouse.isDown(0)      // left button held
mouse.isPressed(0)   // left button just clicked
mouse.isReleased(0)  // left button just released
```

Example — shoot toward the cursor:

```tsx
<Script update={(id, world, input) => {
  const t = world.getComponent<TransformComponent>(id, 'Transform')
  if (!t) return

  if (input.mouse.isPressed(0)) {
    const dx = input.mouse.x - t.x
    const dy = input.mouse.y - t.y
    const len = Math.hypot(dx, dy)
    spawnBullet(world, t.x, t.y, dx / len, dy / len)
  }
}} />
```

## Input in platformer controllers

The `usePlatformerController` hook handles WASD, arrow keys, and Space/Up jump internally. You don't need to manage input yourself for standard platformer movement:

```tsx
function Player() {
  const id = useEntity()
  usePlatformerController(id, { speed: 220, jumpForce: -520, maxJumps: 2 })
  return null
}
```

For custom behaviour on top of the controller, add a second `<Script>` to the same entity:

```tsx
<Entity id="player">
  <Transform x={100} y={300} />
  <Sprite width={32} height={48} color="#4fc3f7" />
  <RigidBody />
  <BoxCollider width={32} height={48} />
  <Player />   {/* contains usePlatformerController */}
  <Script update={(id, world, input) => {
    // Additional logic, e.g. shooting
    if (input.isPressed('KeyF')) fireProjectile(world, id)
  }} />
</Entity>
```

## Frame flushing

Input state is flushed once at the end of each game loop tick. `isPressed` and `isReleased` are only `true` for a single frame — you don't need to reset them manually.
