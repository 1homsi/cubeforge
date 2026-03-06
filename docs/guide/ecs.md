# ECS

Cubeforge's runtime is built on an Entity-Component-System (ECS) architecture. Understanding it helps when you need to query entities, attach custom data, or write systems.

## Core concepts

- **Entity** — a plain integer ID. No data, no logic on its own.
- **Component** — a plain data object with a `type` string. Attached to an entity.
- **System** — a function that runs every frame and processes all entities that have certain components.

In Cubeforge, you rarely touch the ECS directly — the React components do it for you. But `<Script>` gives you full access to the world, so you need to understand queries and component access.

## Querying entities

Inside a `<Script>` update function, `world.query(...types)` returns all entities that have every listed component type:

```tsx
<Script update={(id, world, input, dt) => {
  // All entities with both Transform and RigidBody
  const bodies = world.query('Transform', 'RigidBody')
  for (const eid of bodies) {
    const rb = world.getComponent<RigidBodyComponent>(eid, 'RigidBody')
    if (rb && rb.vy > 1000) {
      // terminal velocity cap
      rb.vy = 1000
    }
  }
}} />
```

`world.queryOne(...types)` returns the first match, or `undefined`:

```tsx
const camId = world.queryOne('Camera2D')
```

Query results are cached per frame — calling `query('Transform', 'RigidBody')` ten times in a frame costs one lookup after the first call. The cache clears at the start of each `update` tick.

## Getting and setting component data

```tsx
const transform = world.getComponent<TransformComponent>(id, 'Transform')
if (transform) {
  transform.x += 1 // mutate in place
}
```

Components are plain mutable objects. Read and write their properties directly — changes are picked up by systems in the same frame.

## Adding and removing components at runtime

You can attach additional components from inside a Script or `init` callback:

```tsx
<Script
  init={(id, world) => {
    // Attach custom data component
    world.addComponent(id, { type: 'Health', current: 100, max: 100 })
  }}
  update={(id, world) => {
    const health = world.getComponent<{ type: 'Health'; current: number; max: number }>(id, 'Health')
    if (health && health.current <= 0) {
      world.destroyEntity(id)
    }
  }}
/>
```

TypeScript won't know the shape of custom components — use a local interface or cast with generics as shown above.

## Checking entity existence

Scripts can outlive entities (e.g. a delayed callback). Always guard with `world.hasEntity(id)`:

```tsx
<Script update={(id, world) => {
  if (!world.hasEntity(id)) return
  // safe to proceed
}} />
```

## Destroying entities from scripts

```tsx
world.destroyEntity(id)
```

Note: destroying an entity from inside a script on that same entity is safe — the entity is removed from the world immediately, and no further systems process it in this tick.

## Tagging entities

Tags are a lightweight way to mark entities for querying without defining a full component:

```tsx
<Entity tags={['enemy', 'flying']}>
```

Query by tag type:

```tsx
const enemies = world.query('Tag')
for (const eid of enemies) {
  const tag = world.getComponent<{ type: 'Tag'; tags: string[] }>(eid, 'Tag')
  if (!tag?.tags.includes('enemy')) continue
  // process enemy
}
```

## The query cache

`world.query()` builds its result set by iterating all entities and checking component maps. On large worlds (hundreds of entities), this can be slow. The cache ensures each unique set of component types is computed at most once per frame.

The cache uses **selective invalidation** — only entries whose component types were modified in the current frame are cleared. On frames where no entities change (static platforms, walls, decorations), the cache is never touched and all queries return instantly. This makes large static scenes essentially free to query.

You don't need to manage the cache manually. It updates automatically when you call `world.addComponent`, `world.removeComponent`, or `world.destroyEntity`.
