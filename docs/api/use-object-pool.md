# useObjectPool

Generic object pooling hook. Reuses objects instead of allocating new ones every frame, reducing garbage collection pressure in hot paths like bullet spawning.

## Usage

```tsx
import { useObjectPool } from 'cubeforge'

function BulletManager() {
  const bullets = useObjectPool(
    () => ({ x: 0, y: 0, vx: 0, vy: 0, active: false }),
    (b) => { b.x = 0; b.y = 0; b.vx = 0; b.vy = 0; b.active = false },
    50, // prewarm 50 bullets on mount
  )

  // Acquire a bullet from the pool (or create one if empty)
  const b = bullets.acquire()
  b.x = 100; b.y = 200; b.vx = 5; b.vy = 0; b.active = true

  // Return it when done
  bullets.release(b)

  console.log(bullets.activeCount) // currently acquired objects
  console.log(bullets.poolSize)    // idle objects in pool
}
```

## Signature

```ts
function useObjectPool<T>(
  factory: () => T,
  reset: (obj: T) => void,
  initialSize?: number,
): ObjectPool<T>
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `factory` | `() => T` | Creates a new object when the pool is empty. |
| `reset` | `(obj: T) => void` | Resets an object before it is returned to the pool. |
| `initialSize` | `number` | If provided, pre-creates this many objects on mount. |

## Return value — `ObjectPool<T>`

| Member | Type | Description |
|---|---|---|
| `acquire()` | `() => T` | Takes an object from the pool, or creates one via `factory` if the pool is empty. |
| `release(obj)` | `(obj: T) => void` | Calls `reset(obj)` then returns the object to the pool. |
| `prewarm(count)` | `(count: number) => void` | Pre-creates `count` objects into the pool. |
| `activeCount` | `number` | Number of currently acquired (in-use) objects. |
| `poolSize` | `number` | Number of idle objects sitting in the pool. |

## Tips

- The returned `ObjectPool` object is **referentially stable** (wrapped in `useMemo`), so it is safe to pass as a dependency or prop without causing re-renders.
- Call `prewarm()` during a loading screen to avoid allocation hitches during gameplay.
- The pool grows unbounded on `acquire` — it will never reject a request. Objects are only reclaimed when you call `release`.
