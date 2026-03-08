# Performance

Cubeforge is designed to handle hundreds of entities at 60 FPS out of the box. This guide covers what to watch for and how to keep your game fast as it grows.

## Entity count

The ECS can hold thousands of entities, but every entity with a `RigidBody` and `BoxCollider` adds to the physics workload. General guidelines:

- **< 200 dynamic bodies** — no optimisation needed
- **200–500 dynamic bodies** — use collision layers to limit pair checks
- **500+ dynamic bodies** — consider object pooling (reuse entities instead of creating/destroying)

Static bodies (`isStatic`) are cheap. The broadphase grid skips static-vs-static pairs entirely, so walls, platforms, and decorations cost almost nothing in the physics pass.

### Object pooling pattern

Instead of mounting and unmounting entities (which triggers React reconciliation and ECS allocation), hide inactive entities off-screen and reuse them:

```tsx
function Bullet({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <Entity>
      <Transform x={active ? x : -9999} y={active ? y : -9999} />
      <Sprite width={8} height={4} color="#ff0" visible={active} />
      <RigidBody isStatic={!active} gravityScale={0} />
      <BoxCollider width={8} height={4} layer="bullet" />
    </Entity>
  )
}

// Pre-allocate a pool
const POOL_SIZE = 50
const bullets = Array.from({ length: POOL_SIZE }, () => ({
  x: 0, y: 0, active: false,
}))
```

## Physics optimisation

### Collision layers and masks

Every `BoxCollider` defaults to the `"default"` layer. Without configuration, every dynamic body is checked against every other body in nearby broadphase cells. Use `layer` and `mask` to limit which pairs the physics system evaluates:

```tsx
// Player only collides with ground and enemies
<BoxCollider width={32} height={48} layer="player" mask={['ground', 'enemy']} />

// Enemy only collides with ground and player
<BoxCollider width={24} height={24} layer="enemy" mask={['ground', 'player']} />

// Coins only collide with player (trigger)
<BoxCollider width={16} height={16} layer="pickup" mask="player" isTrigger />
```

With layers, 100 coins and 50 enemies never check against each other — only against the player and ground.

### Broadphase grid

The physics broadphase uses a spatial grid with 128-pixel cells. Only entities in the same or adjacent cells are compared in the narrow phase. This is automatic and requires no configuration.

For best results, keep entity sizes smaller than 128 px. Entities larger than a grid cell span multiple cells and create more broadphase pairs.

### Fixed timestep

Physics runs at a fixed 60 Hz. If the render frame rate drops to 30 FPS, the physics system runs two steps per frame to catch up. At very low frame rates (below 15 FPS), the engine caps the number of physics steps to prevent a death spiral where more physics work causes even lower FPS.

## Render optimisation

### Texture batching

The WebGL2 renderer batches sprites by `(zIndex, texture)`. Consecutive sprites with the same texture and zIndex are drawn in a single `drawArraysInstanced` call, up to 8192 instances per batch.

To maximize batching:

- **Use sprite sheets** — put multiple frames into one image so all animation states share the same texture
- **Minimise zIndex variety** — every zIndex change breaks a batch. Use a small set of layers (e.g. -10, 0, 5, 10) rather than unique values per entity
- **Group similar entities** — if 200 trees use the same sprite, they all batch into one draw call

### What breaks batches

A batch breaks whenever the next sprite has a different texture or zIndex. This means interleaving two textures by zIndex — tree (z=0), rock (z=0), tree (z=0), rock (z=0) — still batches correctly because they share the same zIndex and are sorted by texture.

### Camera culling

Entities outside the camera viewport are not drawn. The renderer checks each sprite's world-space bounding box against the camera's visible area and skips sprites that are fully off-screen. This is automatic.

For large worlds, this means only the ~50–100 visible entities pay rendering cost, regardless of total entity count.

### Text rendering

`<Text>` components render to an offscreen Canvas2D, which is then uploaded as a WebGL texture. The texture is cached and only re-created when the text content, font, or size changes. Avoid changing text every frame (e.g. displaying `Math.random()`) — update text only when the displayed value actually changes.

## Script system best practices

### Avoid allocations in update loops

The `update` function in `<Script>` runs every frame. Avoid creating objects, arrays, or closures inside it:

```tsx
// Bad — allocates a new object every frame
<Script update={(id, world) => {
  const pos = { x: 100, y: 200 }
  // ...
}} />

// Good — reuse or mutate existing component data
<Script update={(id, world) => {
  const transform = world.getComponent<TransformComponent>(id, 'Transform')
  if (transform) {
    transform.x = 100
    transform.y = 200
  }
}} />
```

### Cache query results within a frame

`world.query()` results are cached per frame, so calling the same query multiple times is free. But if you need to filter results further, do it once and store the result in a local variable rather than re-filtering:

```tsx
<Script update={(id, world) => {
  const enemies = world.query('Tag', 'Transform')
  // Process enemies once — don't call query() in a nested loop
  for (const eid of enemies) {
    // ...
  }
}} />
```

### Keep update functions as module-level references

Define update functions outside your component to avoid re-creating them on every React render:

```tsx
// Good — stable function reference
const playerUpdate: ScriptUpdateFn = (id, world, input, dt) => {
  // ...
}

function Player() {
  return (
    <Entity id="player">
      <Script update={playerUpdate} />
    </Entity>
  )
}

// Bad — new function every render
function Player() {
  return (
    <Entity id="player">
      <Script update={(id, world, input, dt) => {
        // recreated every React render
      }} />
    </Entity>
  )
}
```

## Particle emitters

### Set maxParticles

Every `<ParticleEmitter>` allocates a particle pool. Without `maxParticles`, the pool can grow unbounded if the emission rate exceeds the particle lifetime:

```tsx
// Always set a cap
<ParticleEmitter rate={50} particleLife={1} maxParticles={200} />
```

### Toggle active instead of mounting/unmounting

Mounting a `<ParticleEmitter>` allocates the pool. Unmounting deallocates it. If the effect fires frequently (dust on landing, hit sparks), keep the emitter mounted and toggle `active`:

```tsx
<ParticleEmitter preset="dust" active={justLanded} maxParticles={30} />
```

## DevTools profiling

Enable the DevTools overlay to see per-system timing:

```tsx
<Game devtools>
```

The **system timing panel** shows how many milliseconds each system (Script, Physics, Render) takes per frame. Use this to identify which system is the bottleneck:

- **Script heavy** — your update functions are doing too much work. Profile individual scripts by adding `performance.now()` calls.
- **Physics heavy** — too many dynamic bodies or missing layer/mask filtering. Reduce collision pairs.
- **Render heavy** — too many draw calls. Check batch count via the debug overlay (`<Game debug>`), consolidate textures, and reduce zIndex variety.

## Memory management

### Destroyed entities

When you call `world.destroyEntity(id)`, all components on that entity are removed and the entity ID is freed. However, if you hold a reference to the entity ID in a closure or a React ref, the ID becomes stale. Always guard with `world.hasEntity(id)`:

```tsx
<Script update={(id, world) => {
  if (!world.hasEntity(targetId)) {
    targetId = null
    return
  }
  // safe to use targetId
}} />
```

### Event listeners

Hooks like `useEvent`, `useTriggerEnter`, and `useCollisionEnter` clean up automatically when the component unmounts. If you subscribe manually via `events.on(...)`, always return the cleanup function:

```tsx
useEffect(() => {
  const unsub = events.on('trigger', handler)
  return unsub
}, [events])
```

### Snapshots and devtools

When `devtools` is enabled, the engine stores up to 600 snapshots (10 seconds at 60 FPS) in a ring buffer. Each snapshot deep-clones all component data. For games with many entities or large component payloads, this increases memory usage. Disable `devtools` in production builds.

## Quick reference

| Area | Tip |
|---|---|
| Entity count | < 200 dynamic bodies needs no tuning |
| Physics | Use `layer` and `mask` to reduce collision pairs |
| Rendering | Same texture + same zIndex = one draw call |
| Scripts | Define update functions at module scope |
| Particles | Always set `maxParticles`; toggle `active` instead of mount/unmount |
| Text | Only update when the displayed value changes |
| DevTools | Use system timing panel to find the bottleneck |
| Production | Remove `devtools` and `debug` props from `<Game>` |
