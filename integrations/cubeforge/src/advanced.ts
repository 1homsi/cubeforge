/**
 * `cubeforge/advanced` — low-level physics and determinism primitives.
 *
 * These exports are intentionally kept out of the main `cubeforge` barrel to
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
 * import { gjk, epa, SweepAndPrune } from 'cubeforge/advanced'
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
} from '@cubeforge/physics'

// ── GJK / EPA narrow phase ──────────────────────────────────────────────────
export { gjk, epa, gjkEpaQuery, circleShape, boxShape, capsuleShape, polygonShape } from '@cubeforge/physics'
export type { ConvexShape, GJKResult, EPAResult, GJKContactManifold } from '@cubeforge/physics'

// ── Broad phase ─────────────────────────────────────────────────────────────
export { SweepAndPrune } from '@cubeforge/physics'
export type { BroadPhaseAABB, BroadPhasePair } from '@cubeforge/physics'

// ── Sleeping / islands ──────────────────────────────────────────────────────
export { IslandDetector } from '@cubeforge/physics'
export type { Island } from '@cubeforge/physics'

// ── Time-of-impact / CCD ────────────────────────────────────────────────────
export { computeTOI, resolveTOI } from '@cubeforge/physics'
export type { TOIBody, TOIResult } from '@cubeforge/physics'

// ── Pools & memory ──────────────────────────────────────────────────────────
export { ObjectPool as PhysicsObjectPool, Float64Pool, resetAllPools } from '@cubeforge/physics'

// ── Multibody articulation ──────────────────────────────────────────────────
export { MultibodyArticulation, createMultibody, createLink } from '@cubeforge/physics'
export type { MultibodyLink, Spatial3, SpatialInertia3 } from '@cubeforge/physics'

// ── BVH ─────────────────────────────────────────────────────────────────────
export { buildBVH, queryBVH, queryBVHCircle } from '@cubeforge/physics'
export type { BVH, Triangle2D } from '@cubeforge/physics'
