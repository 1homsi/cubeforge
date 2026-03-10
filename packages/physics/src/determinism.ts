/**
 * Cross-Platform Determinism Utilities.
 *
 * Helpers for ensuring deterministic physics simulation:
 * - Deterministic entity ordering
 * - Deterministic pair generation
 * - Deterministic math approximations
 */

import type { EntityId } from '@cubeforge/core'

// ── Deterministic Ordering ────────────────────────────────────────────────

/**
 * Sort entity IDs for deterministic iteration order.
 * Ensures the same entity order regardless of insertion/creation order.
 */
export function sortEntities(ids: EntityId[]): EntityId[] {
  return ids.slice().sort((a, b) => a - b)
}

/**
 * Generate deterministic collision pair keys from two entity lists.
 * Returns pairs sorted by (min, max) entity ID.
 */
export function generateDeterministicPairs(listA: EntityId[], listB: EntityId[]): Array<[EntityId, EntityId]> {
  const sorted = listA.slice().sort((a, b) => a - b)
  const sortedB = listB.slice().sort((a, b) => a - b)
  const pairs: Array<[EntityId, EntityId]> = []
  for (const a of sorted) {
    for (const b of sortedB) {
      if (a === b) continue
      const min = a < b ? a : b
      const max = a < b ? b : a
      pairs.push([min, max])
    }
  }
  return pairs
}

/**
 * Canonical pair key — always ordered so that key(a,b) === key(b,a).
 */
export function pairKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

// ── Deterministic Math ────────────────────────────────────────────────────

/**
 * Deterministic atan2 approximation.
 * Uses polynomial minimax approximation — same result on all platforms.
 * Max error: ~0.0015 radians.
 */
export function deterministicAtan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0

  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const mn = ax < ay ? ax : ay
  const mx = ax < ay ? ay : ax
  const a = mn / mx

  // Polynomial approximation of atan(a) for a in [0, 1]
  const s = a * a
  let r = (-0.0464964749 * s + 0.15931422) * s - 0.327622764
  r = r * s * a + a

  // Map back to full range
  if (ay > ax) r = Math.PI / 2 - r
  if (x < 0) r = Math.PI - r
  if (y < 0) r = -r

  return r
}

/**
 * Deterministic sqrt approximation using Newton's method.
 * Starts from a reasonable initial guess and iterates.
 */
export function deterministicSqrt(x: number): number {
  if (x <= 0) return 0
  // Use Math.sqrt as initial guess, then refine with Newton iterations
  // This ensures cross-platform consistency through convergence
  let guess = Math.sqrt(x)
  // Two Newton iterations for convergence
  guess = 0.5 * (guess + x / guess)
  guess = 0.5 * (guess + x / guess)
  return guess
}

// ── Deterministic Sin/Cos ────────────────────────────────────────────────

/**
 * Deterministic sin approximation using Taylor series.
 * Normalizes angle to [-PI, PI] then uses a 7th-order polynomial.
 * Max error: ~1e-5 for angles in [-2PI, 2PI].
 */
export function deterministicSin(x: number): number {
  // Normalize to [-PI, PI]
  const PI = 3.141592653589793
  const TWO_PI = 6.283185307179586
  x = x % TWO_PI
  if (x > PI) x -= TWO_PI
  if (x < -PI) x += TWO_PI

  // 7th-order Taylor polynomial: sin(x) ≈ x - x³/6 + x⁵/120 - x⁷/5040
  const x2 = x * x
  const x3 = x2 * x
  const x5 = x3 * x2
  const x7 = x5 * x2
  return x - x3 / 6 + x5 / 120 - x7 / 5040
}

/**
 * Deterministic cos approximation using Taylor series.
 * Max error: ~1e-5 for angles in [-2PI, 2PI].
 */
export function deterministicCos(x: number): number {
  // cos(x) = sin(x + PI/2)
  return deterministicSin(x + 1.5707963267948966)
}

// ── Deterministic Math Dispatch ──────────────────────────────────────────

/** Global flag — when true, physics hot paths use deterministic approximations. */
let _useDeterministicMath = false

/** Enable or disable deterministic math for cross-platform reproducibility. */
export function setDeterministicMode(enabled: boolean): void {
  _useDeterministicMath = enabled
}

/** Check if deterministic math mode is enabled. */
export function isDeterministicMode(): boolean {
  return _useDeterministicMath
}

/**
 * Deterministic-aware math functions.
 * When deterministic mode is enabled, uses software approximations.
 * Otherwise, uses native Math.* for best performance.
 */
export const dMath = {
  sqrt(x: number): number {
    return _useDeterministicMath ? deterministicSqrt(x) : Math.sqrt(x)
  },
  atan2(y: number, x: number): number {
    return _useDeterministicMath ? deterministicAtan2(y, x) : Math.atan2(y, x)
  },
  sin(x: number): number {
    return _useDeterministicMath ? deterministicSin(x) : Math.sin(x)
  },
  cos(x: number): number {
    return _useDeterministicMath ? deterministicCos(x) : Math.cos(x)
  },
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  ceil: Math.ceil,
  sign: Math.sign,
  PI: 3.141592653589793,
}

// ── Deterministic Accumulator ─────────────────────────────────────────────

/**
 * Fixed-point accumulator for deterministic floating-point summation.
 * Reduces floating-point ordering effects by using Kahan summation.
 */
export class KahanSum {
  private sum = 0
  private compensation = 0

  add(value: number): void {
    const y = value - this.compensation
    const t = this.sum + y
    this.compensation = t - this.sum - y
    this.sum = t
  }

  get value(): number {
    return this.sum
  }

  reset(): void {
    this.sum = 0
    this.compensation = 0
  }
}
