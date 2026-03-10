---
layout: home

hero:
  name: Cubeforge
  text: Build browser games with React.
  tagline: A declarative 2D game engine. Mount a component, spawn an entity. Unmount it, the entity is gone.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View Examples
      link: https://1homsi.github.io/cubeforge-examples/

features:
  - title: Declarative
    details: Your game world is a JSX tree. Entities are components, state is React state, lifecycle is component lifecycle.
  - title: Composable
    details: Build reusable game objects — Player, Enemy, MovingPlatform — as plain React components that encapsulate their own logic.
  - title: Lightweight
    details: No heavy runtime dependencies. ECS, physics, renderer, and input are all purpose-built and small. Loads instantly.
  - title: TypeScript-first
    details: Every component, hook, and callback is fully typed. Autocomplete works everywhere — props, Script callbacks, query results.
  - title: Embeddable
    details: Drop a game into any existing React app with a single component. No separate build pipeline, no iframe.
  - title: Debug-ready
    details: Add debug for collider wireframes and FPS. Add devtools for a full time-travel debugger — scrub frames, inspect entities, step forward/back.
  - title: WebGL2 renderer
    details: "The default renderer uses WebGL2 instanced draw calls — one GPU call per texture group. No configuration needed."
  - title: Multiplayer
    details: "@cubeforge/net provides transport-agnostic helpers — Room, syncEntity, useNetworkInput, and ClientPrediction — for building real-time multiplayer games."
---
