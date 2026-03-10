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
