# Migration Guide

This guide covers breaking changes and migration steps between Cubeforge versions.

## 0.1.x to 0.2.x — Monorepo restructure

### Package rename

The React integration moved from `packages/react` to `integrations/cubeforge`. The published npm package name changed from `@cubeforge/react` to `cubeforge`.

**Before:**

```tsx
import { Game, World, Entity, Sprite } from '@cubeforge/react'
```

**After:**

```tsx
import { Game, World, Entity, Sprite } from 'cubeforge'
```

Update your `package.json`:

```diff
- "@cubeforge/react": "^0.1.9"
+ "cubeforge": "^0.2.0"
```

All types, components, hooks, and utilities are re-exported from the single `cubeforge` package. You no longer need to install internal packages like `@cubeforge/core`, `@cubeforge/physics`, or `@cubeforge/renderer` — they are bundled automatically.

### ScriptSystem entity safety

Starting in 0.2.1, `ScriptSystem` skips destroyed entities mid-iteration. If your scripts relied on processing entities that were destroyed earlier in the same frame, that behaviour is gone. In practice this was always a source of bugs, so no code changes should be needed.

## 0.2.x to 0.3.x — WebGL2 default renderer

### WebGL2 is now the default

As of 0.3.0, `<Game>` uses the WebGL2 instanced renderer. The `renderer` prop has been removed — WebGL2 is always used.

**Before (0.2.x):**

```tsx
// Canvas2D was the default
<Game width={800} height={600}>

// WebGL2 required an explicit renderer prop
import { WebGLRenderer } from 'cubeforge'
<Game width={800} height={600} renderer={WebGLRenderer}>
```

**After (0.3.x):**

```tsx
// WebGL2 is now the only renderer — no prop needed
<Game width={800} height={600}>
```

If your game worked fine on 0.2.x, it should work identically on 0.3.x — the WebGL2 renderer supports everything Canvas2D did.

### Sprite tiling

Sprite tiling (`tileX`, `tileY`) now works correctly in the WebGL renderer. If you had workarounds for tiling in Canvas2D mode, you can remove them.

### Layer mask handling

`BoxCollider`'s `mask` prop now correctly handles a single string value in addition to arrays. If you were wrapping single masks in arrays as a workaround, both forms now work:

```tsx
// Both are valid in 0.3.4+
<BoxCollider mask="enemies" />
<BoxCollider mask={['enemies', 'projectiles']} />
```

## New features by version

### 0.1.x additions

| Version | Features |
|---|---|
| 0.1.8 | `useHealth`, `useDamageZone`, `useAnimationController`, `usePersistedBindings`, `VirtualJoystick`, audio volume groups |
| 0.1.9 | `circleExit` fix, `useInputMap` stale binding fix, circle layer filter |

### 0.2.x additions

| Version | Features |
|---|---|
| 0.2.0 | Monorepo restructure, single `cubeforge` package |
| 0.2.1 | ScriptSystem skips destroyed entities mid-iteration |
| 0.2.2 | Package READMEs for npm |

### 0.3.x additions

| Version | Features |
|---|---|
| 0.3.0 | WebGL2 default renderer, Canvas2D opt-in |
| 0.3.4 | Single-string mask fix, `tileX`/`tileY` WebGL tiling |
| 0.3.5–0.3.7 | Package export fixes, `type: module` for Vite compatibility |
| 0.3.8 | Sprite discoloration fix, `:repeat` URL fix, camera teleport snap |

## Staged feature rollout (0.1.x)

Several major features were added in staged commits during the 0.1.x cycle. If you are upgrading from an early 0.1.x release, these are now available:

- **Stage 2 — Physics:** `useTriggerStay`, `useCollisionStay`, `CapsuleCollider`, `useKinematicBody`, `useDropThrough`, `sweepBox`, `overlapCircle`, `raycastAll`
- **Stage 3 — Input:** Axis bindings, `useInputContext`, `usePlayerInput`, `useLocalMultiplayer`, `useInputRecorder`
- **Stage 4 — Animation/Rendering/Camera:** `frameEvents` on Animation, `CameraZone`, `Trail`, `useCoordinates`
- **Stage 5 — Audio/Assets:** `fadeIn`/`fadeOut`/`crossfade` on `useSound`, group volume control, `preloadManifest`, `AssetLoader`
- **Stage 6 — Content:** `useSave`, `usePathfinding`, `useAISteering`, `navGrid`/`spawnLayer` Tilemap props
- **Stage 7 — State:** `useLevelTransition`, `useGameStateMachine`, `useRestart`, plugin `priority`/`requires`/`onDestroy`
- **Stage 8 — DevTools:** Expanded DevTools overlay, system timing panel, nav grid and contact flash overlays

## Checklist

When upgrading to the latest version:

1. Change your import from `@cubeforge/react` to `cubeforge` (if on 0.1.x)
2. Remove any explicit `renderer={WebGLRenderer}` prop — WebGL2 is now the default
3. Remove workarounds for single-string `mask` props
4. Remove workarounds for sprite tiling in Canvas2D mode
5. Run `pnpm install` (or your package manager) and verify your game loads
6. Enable `<Game debug>` to confirm colliders and rendering look correct
