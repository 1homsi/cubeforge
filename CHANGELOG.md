# Changelog

## v0.4.8

### New Features

#### Steering Behaviors
- **`pursuit(pos, targetPos, targetVel, speed, lookAhead?)`** — seek a moving target by predicting its future position
- **`evade(pos, threatPos, threatVel, speed, lookAhead?)`** — flee from a moving threat by predicting where it will be
- **`separation(pos, neighbors, speed, radius)`** — boids repulsion: push away from nearby agents, weighted by distance
- **`cohesion(pos, neighbors, speed)`** — boids cohesion: steer toward the centroid of nearby agents
- **`alignment(neighborVelocities, speed)`** — boids alignment: match the average velocity direction of nearby agents
- All five available on `useAISteering()` hook and exported from `cubeforge`

#### Path Smoothing
- **`smoothPath(grid, path)`** — prune redundant A* waypoints using Bresenham line-of-sight. Agents now move in natural diagonal lines instead of staircase patterns. Available from `cubeforge` and `usePathfinding()`.

#### Tween Options
- **`repeat`** — replay a tween N additional times (`Infinity` for a loop)
- **`yoyo`** — reverse direction on each repeat (ping-pong)
- **`delay`** — wait N seconds before the tween starts; delay overshoot is carried into tween time so no frames are lost
```ts
tween(0, 100, 0.5, Ease.easeInOutSine, v => x = v, undefined, {
  repeat: Infinity,
  yoyo: true,
  delay: 1,
})
```

#### Trail Improvements
- **`colorOverLife: string[]`** — interpolate through a color palette from head (newest) to tail (oldest)
- **`widthOverLife: { start, end }`** — vary segment width from head to tail
```tsx
<Trail length={30} colorOverLife={['#ffff00', '#ff4400', '#00000000']} widthOverLife={{ start: 6, end: 1 }} />
```

#### useSquashStretch Hook
- New **`useSquashStretch()`** hook with `trigger(scaleX, scaleY)` — manually trigger squash-stretch from code (jump, land, hit, etc.)
- No longer requires a `RigidBody` — works on any entity with a `<SquashStretch />` component
```tsx
const ss = useSquashStretch()
// On land:
ss.trigger(1.4, 0.6)
// On jump:
ss.trigger(0.7, 1.3)
```

### Fixed

#### Particle System
- **`colorOverLife`** was defined but silently ignored — now correctly interpolates color across the particle lifetime
- **`sizeOverLife`** was defined but silently ignored — now correctly scales particle size from `start` to `end`
- **`rotation` and `enableRotation`** were defined but not applied — particles now rotate each frame via `rotationSpeed`
- Spawned particles now correctly initialize `startSize`, `endSize`, `rotation`, and `rotationSpeed` from pool config

#### Sprite Opacity and Tint
- `opacity` prop now correctly multiplies the alpha channel of the final color
- `tint` + `tintOpacity` now blend into the rgb channels correctly

### Other
- 1744 tests passing (up from 786 at v0.4.2)

---

## v0.4.7

### Fixed
- **Sprite shapes now render correctly** — shape drawing (circle, triangle, star, pentagon, hexagon, ellipse, roundedRect) moved from Canvas2D (debug-only) to the WebGL render system
- Shape textures generated on offscreen canvas and cached as WebGL textures for efficient instanced rendering
- Canvas2D render system cleaned up — no longer contains dead shape code

---

## v0.4.6

### New
- Sprite `shape` prop: `'circle' | 'triangle' | 'pentagon' | 'hexagon' | 'star' | 'ellipse' | 'roundedRect'`
- Sprite `strokeColor` and `strokeWidth` props
- Sprite `customDraw` prop — escape hatch for arbitrary Canvas2D drawing

---

## v0.4.4

### Fixed
- Transparent background (`background="transparent"`) now correctly clears the canvas each frame instead of leaving ghost trails

---

## v0.4.3

### New
- `<Camera2D bounds={{ x, y, width, height }} />` — clamp camera position to world-space bounds
- `useCoordinates()` — `worldToScreen(wx, wy)` and `screenToWorld(sx, sy)` helpers
- `<CameraZone />` — trigger-based camera override zones
- `<Trail />` component and `TrailComponent`
- Frame events on animations: `frameEvents?: Record<number, () => void>`

---

## v0.4.2

### New
- Full impulse-based rigid body physics engine
- `CapsuleCollider`, `CompoundCollider`, `ConvexCollider`, `TriangleCollider`, `SegmentCollider`
- `useKinematicBody()` and `moveAndCollide(dx, dy)`
- `useDropThrough()` — one-way platform drop-through
- `raycastAll()`, `overlapCircle()`, `sweepBox()` spatial queries
- `useTriggerStay`, `useCollisionStay`, `useCircleStay` contact events
- Input: axis bindings, dead zones, input contexts, per-player input maps, input recording/playback
- Audio: `fadeIn`, `fadeOut`, `crossfadeTo`, `duck`, `setGroupMute`, `stopGroup`
- `AssetLoader` component with progress tracking
- A* pathfinding (`createNavGrid`, `findPath`, `setWalkable`) and AI steering (`seek`, `flee`, `arrive`, `patrol`, `wander`)
- `useSave` — localStorage persistence with versioning and migration
- `useLevelTransition`, `useGameStateMachine`, `useRestart`
- `lockRotation: true` default, `friction: 0` default, sleep disabled by default
