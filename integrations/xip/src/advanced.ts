/**
 * `xipjs/advanced` — low-level physics and determinism primitives.
 *
 * These exports are intentionally kept out of the main `xipjs` barrel to
 * reduce noise in IDE autocomplete for typical game development. Use this
 * subpath only when you need to:
 *
 * - Write custom broad-phase or narrow-phase collision detection
 * - Implement deterministic lockstep netcode
 * - Build specialized physics tooling (debuggers, solvers, joint prototypes)
 * - Hook into time-of-impact or continuous collision detection directly
 *
 * The APIs here are more volatile than those in the main export — breaking
 * changes may ship in minor versions if the underlying implementation changes.
 *
 * @example
 * ```ts
 * import { gjk, epa, SweepAndPrune } from 'xipjs/advanced'
 * ```
 */

// ── Deterministic math & entity ordering ────────────────────────────────────
export {
  sortEntities,
  generateDeterministicPairs,
  pairKey,
  deterministicAtan2,
  deterministicSqrt,
  deterministicSin,
  deterministicCos,
  setDeterministicMode,
  isDeterministicMode,
  dMath,
  KahanSum,
} from '@xip/physics'

// ── GJK / EPA narrow phase ──────────────────────────────────────────────────
export { gjk, epa, gjkEpaQuery, circleShape, boxShape, capsuleShape, polygonShape } from '@xip/physics'
export type { ConvexShape, GJKResult, EPAResult, GJKContactManifold } from '@xip/physics'

// ── Broad phase ─────────────────────────────────────────────────────────────
export { SweepAndPrune } from '@xip/physics'
export type { BroadPhaseAABB, BroadPhasePair } from '@xip/physics'

// ── Sleeping / islands ──────────────────────────────────────────────────────
export { IslandDetector } from '@xip/physics'
export type { Island } from '@xip/physics'

// ── Time-of-impact / CCD ────────────────────────────────────────────────────
export { computeTOI, resolveTOI } from '@xip/physics'
export type { TOIBody, TOIResult } from '@xip/physics'

// ── Pools & memory ──────────────────────────────────────────────────────────
export { ObjectPool as PhysicsObjectPool, Float64Pool, resetAllPools } from '@xip/physics'

// ── Multibody articulation ──────────────────────────────────────────────────
export { MultibodyArticulation, createMultibody, createLink } from '@xip/physics'
export type { MultibodyLink, Spatial3, SpatialInertia3 } from '@xip/physics'

// ── BVH ─────────────────────────────────────────────────────────────────────
export { buildBVH, queryBVH, queryBVHCircle } from '@xip/physics'
export type { BVH, Triangle2D } from '@xip/physics'

// Headless rendering for unit tests and benchmarks (no GPU).
export { RecordingGL, createRecordingCanvas, decodeInstances, installHeadlessCanvasDOM } from '@xip/renderer'
export { Canvas2DRenderSystem } from '@xip/renderer/canvas2d'
export type { RecordedDraw, RecordedInstance, RecordedTexture, RecordingCanvas } from '@xip/renderer'
