# DevTools & Deterministic Mode

## Time-travel DevTools

Add `devtools` to `<Game>` to enable the time-travel debugging overlay:

```tsx
<Game devtools />
```

The overlay appears at the bottom of the screen:

- **Scrubber** — drag to any recorded frame (ring buffer of 600 frames ≈ 10 seconds at 60 fps)
- **Pause / Resume** — freeze the simulation at any moment
- **◀◀ / ▶▶** — step one frame back or forward while paused
- **Entities panel** — when paused, lists every entity with its component types. Click an entity to inspect all component field values at that frame.
- **Clear** — wipe the recording buffer

When you scrub to a frame, `world.restoreSnapshot()` replays the exact world state. When you resume, the simulation continues forward from that restored state.

The ring buffer keeps the last 600 frames in memory. Older frames are discarded automatically.

## Deterministic simulation

Enable deterministic mode to make your simulation fully reproducible:

```tsx
<Game deterministic seed={12345} />
```

In this mode:

- All internal randomness (camera shake, particle spawning) uses a seeded 32-bit LCG RNG
- Physics runs the same regardless of the order entities were created
- Calling `world.rng()` from your own `<Script>` code also uses the seeded generator

The same seed + same input sequence always produces identical output. This is the foundation for:

- **Replays** — record inputs, replay from seed
- **Regression tests** — assert final positions after N frames
- **Multiplayer rollback** — see `@cubeforge/net`

### Using `world.rng()` in scripts

Replace `Math.random()` calls with `world.rng()` in any script that should be reproducible:

```tsx
const spawnUpdate: ScriptUpdateFn = (id, world, input, dt) => {
  if (world.rng() < 0.01) {
    // spawn something — deterministic in deterministic mode
  }
}
```

In non-deterministic mode, `world.rng()` falls back to `Math.random()`.

## Snapshots

Both features rely on `ECSWorld.getSnapshot()` / `restoreSnapshot()`:

```ts
const snap = world.getSnapshot()
// ... later ...
world.restoreSnapshot(snap)
```

A snapshot is a plain JSON-serialisable object containing all entity IDs, all component data, the next entity ID counter, and the current RNG state. It deep-clones all component values so the snapshot is immutable.
