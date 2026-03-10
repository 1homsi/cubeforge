# What is Cubeforge?

Cubeforge is a React-first 2D browser game engine. It lets you build games the same way you build UIs — with components, props, and state — without learning a separate scene editor, scripting API, or build pipeline.

```tsx
<Game width={800} height={500} gravity={980}>
  <World background="#1a1a2e">
    <Camera2D followEntity="player" smoothing={0.85} />

    <Entity id="player" tags={['player']}>
      <Transform x={100} y={300} />
      <Sprite width={32} height={48} color="#4fc3f7" />
      <RigidBody />
      <BoxCollider width={32} height={48} />
      <Script update={playerUpdate} />
    </Entity>

    <Entity tags={['ground']}>
      <Transform x={400} y={480} />
      <Sprite width={800} height={32} color="#37474f" />
      <RigidBody isStatic />
      <BoxCollider width={800} height={32} />
    </Entity>
  </World>
</Game>
```

## The React-first philosophy

Most game engines are imperative. You call `scene.add()`, manage object lifetimes manually, and wire update loops by hand. Cubeforge takes the opposite approach.

**Mounting a component creates an entity. Unmounting it destroys the entity.**

This means:

- Show enemies when a level loads → render them conditionally with `{enemies.map(e => <Enemy key={e.id} {...e} />)}`
- Remove a coin when collected → set `active` state to false in a React callback
- Spawn a particle burst → mount `<ParticleEmitter active />` for a moment, then unmount
- Pause the game → call `controls.pause()` from the `onReady` callback

Your entire game state is React state. You can use `useState`, `useEffect`, `useContext`, Redux, Zustand — whatever you already know.

## How it works

Under the hood, Cubeforge runs a traditional game loop:

1. **Script system** — calls every entity's `update` function
2. **Physics system** — AABB collision detection and resolution at fixed 60 Hz
3. **Render system** — WebGL2 instanced draw calls sorted by `zIndex`

The React component tree is a declarative control surface over this loop. When you add a `<Sprite>` inside an `<Entity>`, it registers a `Sprite` component on the ECS entity in a `useEffect`. When you remove it, the `useEffect` cleanup removes the component.

## How it differs from alternatives

### vs Phaser

Phaser uses a class-based, imperative API. You extend `Phaser.Scene`, call `this.physics.add.sprite()`, and manage everything in lifecycle methods. Cubeforge uses React components. If you already know React, you know most of Cubeforge.

### vs Three.js / Pixi.js

These are rendering libraries, not game engines. They don't include physics, a game loop, input management, entity systems, or cameras. Cubeforge includes all of that out of the box, built specifically for 2D browser games.

### vs Unity WebGL

Unity exports ship a large runtime and require a separate editor workflow. Cubeforge is an npm package you add to any existing project. No editor, no separate pipeline, no loading screen while the runtime initialises.

## What you can build

Cubeforge works well for:

- **Platformers** — scrolling levels, coyote time, double jump, moving platforms, tilemaps
- **Top-down games** — dungeon crawlers, twin-stick shooters, RPG overworlds
- **Arcade games** — breakout, flappy bird, endless runners, shoot-em-ups
- **Mini-games in apps** — embed a playable game in a marketing page, onboarding flow, or dashboard
- **Game jams** — fast to set up, familiar stack if you know React

See the [examples repository](https://github.com/1homsi/cubeforge-examples) for six fully playable games including a Mario clone, a top-down dungeon, and a scrolling shooter.
