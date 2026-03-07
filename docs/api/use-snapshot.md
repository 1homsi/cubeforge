# useSnapshot

Returns save/restore controls for the ECS world snapshot system. Must be used inside `<Game>`.

## Signature

```ts
function useSnapshot(): SnapshotControls
```

## Returns

| Method | Signature | Description |
|---|---|---|
| `save` | `() => WorldSnapshot` | Capture full ECS state (all entities + components) |
| `restore` | `(snapshot: WorldSnapshot) => void` | Replace all ECS state with the snapshot |

## Example

```tsx
function SaveLoadUI() {
  const { save, restore } = useSnapshot()
  const [slot, setSlot] = useState<WorldSnapshot | null>(null)

  return (
    <div>
      <button onClick={() => setSlot(save())}>Save</button>
      <button onClick={() => slot && restore(slot)} disabled={!slot}>Load</button>
    </div>
  )
}
```

## Persisting to localStorage

```tsx
const { save, restore } = useSnapshot()

// Save
const data = save()
localStorage.setItem('save', JSON.stringify(data))

// Load
const raw = localStorage.getItem('save')
if (raw) restore(JSON.parse(raw))
```

## Caveats

- Only ECS data is restored. React component state, refs, and timers are **not** rolled back.
- For a complete game restart (including React state), prefer remounting `<Game>` via a key change: `<Game key={gameKey} ...>`.
- Snapshot data is JSON-serialisable but can be large for worlds with many entities. For time-travel debugging, see `<Game devtools>`.
- After `restore`, the physics system's contact pair tracking is reset, so `triggerEnter`/`collisionEnter` events will re-fire on the next step for existing overlaps.
