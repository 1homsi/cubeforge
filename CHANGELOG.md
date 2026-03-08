# Changelog

All notable changes to Cubeforge are documented here.

## Unreleased

### Stage 1 — Foundation and Production Discipline
- CI: added `pnpm run build` and `pnpm run docs:build` steps to catch broken builds before merge
- Tests: migrated from `bun:test` to `vitest`; added root-level `vitest.config.ts` with `happy-dom`
- Tests: added React integration tests for `Entity` lifecycle, hooks (`useHealth`, `useInputMap`, `createTimer`), and `Animation` component
- Tooling: added `scripts/check-exports.ts` — informational export-to-doc coverage checker

### Stage 2 — Physics and Collision System Maturity
- Physics: added `triggerStay`, `collisionStay`, `circleStay` per-frame events
- Hooks: added `useTriggerStay`, `useCollisionStay`, `useCircleStay`
- Physics: added `CapsuleCollider` component (pill-shape collision)
- React: added `<CapsuleCollider>` component
- Physics: added kinematic body mode (`isKinematic` on `RigidBody`)
- Hooks: added `useKinematicBody` — move-and-collide control for kinematic bodies
- Physics: added drop-through one-way platform mechanism (`dropThrough` frames on `RigidBody`)
- Hooks: added `useDropThrough` — trigger drop-through for N frames
- Queries: added `raycastAll`, `overlapCircle`, `sweepBox`
- Exports: all new query functions exported from `cubeforge`

### Stage 3 — Input System Parity
- Input: added `AxisBinding` type — positive/negative key arrays with dead zone
- Input: `getAxis()` method on `InputManager` and `BoundInputMap`
- Input: added stack-based `InputContext` system (`push`, `pop`, `active`)
- Hooks: added `useInputContext` — context stack management with auto-pop on unmount
- Input: added `createPlayerInput` / `PlayerInput` for local multiplayer
- Hooks: added `usePlayerInput`, `useLocalMultiplayer`
- Input: added `InputRecorder` — frame-accurate record and playback
- Hooks: added `useInputRecorder`

### Stage 4 — Animation, Rendering, and Camera
- Animation: added `frameEvents` prop — fire callbacks on specific frame indices
- Camera: `bounds` clamping was already present; confirmed working in RenderSystem
- Camera: added `CameraZone` component — enter zone to override camera follow target
- Rendering: added `Trail` component — fading polyline that follows entity position
- Hooks: added `useCoordinates` — `worldToScreen` / `screenToWorld` helpers

### Stage 5 — Audio and Asset Pipeline
- Audio: added `fadeIn(duration)`, `fadeOut(duration)`, `crossfadeTo(src, duration)` to `useSound`
- Audio: added `setGroupMute`, `stopGroup`, `duck` group controls
- Assets: added `getProgress()`, `onProgress(cb)` to `AssetManager`
- Assets: added `preloadManifest` utility
- Hooks: added `usePreload`
- Components: added `<AssetLoader>` — suspense-style loading boundary

### Stage 6 — Content Workflow
- Hooks: added `useSave` — localStorage-backed save/load with versioning and migration
- Core: added `createNavGrid`, `setWalkable`, `findPath` — A* pathfinding
- Core: added steering functions — `seek`, `flee`, `arrive`, `patrol`, `wander`
- Hooks: added `usePathfinding`, `useAISteering`

### Stage 7 — UI, Game State, and Systems Layer
- Hooks: added `useLevelTransition` — fade/instant level transitions
- Hooks: added `useGameStateMachine` — typed state machine with enter/exit/update hooks
- Hooks: added `useRestart` — force-remount World/Entity tree
- Plugin: added `onDestroy`, `priority`, `requires` to Plugin interface

### Stage 8 — Tooling, Inspector, and Developer Experience
- DevTools: expanded with system timing bars, input monitor, contact log, asset monitor, perf stats
- Game: system timing tracked per-system per-frame (`engine.systemTimings`)
- RenderSystem: added `debugNavGrid` overlay and `debugContacts` flash

---

## 0.1.8 — 2026-02-15
- Added `useHealth`, `useDamageZone`, `useAnimationController`, `usePersistedBindings`
- Added `VirtualJoystick`, `useVirtualInput`
- Added audio volume groups (`setGroupVolume`, `setMasterVolume`, `getGroupVolume`)

## 0.1.7 — 2026-01-20
- Added `Text` component
- Added sprite tiling mode
- Added `useSound`, `createTimer`, `useGamepad`, `usePause`
- Fixed `usePlatformerController` jump cooldown and custom bindings
