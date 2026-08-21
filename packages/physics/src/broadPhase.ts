/**
 * Sweep-and-Prune (SAP) broad phase for 2D physics.
 *
 * Maintains a sorted list of interval endpoints on the X-axis and uses
 * insertion sort each frame (O(n) amortized for nearly-sorted data).
 * Candidate pairs from the X sweep are validated against Y-axis overlap
 * before being reported.
 *
 * Performance notes (vs. the original implementation):
 * - Each entity owns its two Endpoint objects; the axis array holds
 * references to them, so per-frame position updates write straight into
 * the objects (O(1)) instead of rescanning the whole axis per entity,
 * which made updates O(n²).
 * - Overlap pairs are keyed by packed numbers, not `${a}:${b}` strings —
 *   zero string allocation per candidate pair per frame.
 * - The sweep's "active" set and per-entity pair indexes are reused across
 *   frames instead of reallocated.
 */

import type { EntityId } from '@cubeforge/core'

// ── Public types ──────────────────────────────────────────────────────────

export interface BroadPhaseAABB {
  entityId: EntityId
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface BroadPhasePair {
  entityA: EntityId
  entityB: EntityId
}

// ── Internal types ────────────────────────────────────────────────────────

/**
 * A single endpoint on the X-axis.
 * `isMin` distinguishes the left edge (true) from the right edge (false).
 */
interface Endpoint {
  entityId: EntityId
  value: number
  isMin: boolean
}

/** Per-entity bookkeeping: the caller's AABB plus owned endpoints + stamp. */
interface SAPRecord {
  aabb: BroadPhaseAABB
  minEp: Endpoint
  maxEp: Endpoint
  /** Frame stamp of the last update() that included this entity. */
  seen: number
}

// ── Pair key packing ──────────────────────────────────────────────────────
// Unordered pair (a, b) with a < b packs as a * PAIR_MUL + b. Exact in
// float64 well past 2^53, so entity IDs up to PAIR_MUL - 1 (~2.1 million,
// far beyond practical world sizes) are losslessly encoded/decoded.
const PAIR_MUL = 0x200000 // 2^21

function packPair(a: EntityId, b: EntityId): number {
  return a < b ? a * PAIR_MUL + b : b * PAIR_MUL + a
}

function unpackPairA(key: number): EntityId {
  return Math.floor(key / PAIR_MUL) as EntityId
}

function unpackPairB(key: number): EntityId {
  return (key % PAIR_MUL) as EntityId
}

// ── SweepAndPrune ─────────────────────────────────────────────────────────

/**
 * Sweep-and-prune broad phase.
 *
 * Maintains sorted axis lists for efficient overlap detection.
 * Much better than O(n²) for large worlds — amortised O(n + k) per frame
 * where k is the number of overlapping pairs.
 *
 * Usage:
 * ```ts
 * const sap = new SweepAndPrune()
 * // every physics tick:
 * sap.update(allAABBs)
 * const pairs = sap.query()
 * ```
 */
export class SweepAndPrune {
  /** Pooled endpoint array — holds references to per-entity endpoints. */
  private endpoints: Endpoint[] = []

  /** Number of valid endpoints in the pool (always 2 × tracked entities). */
  private endpointCount = 0

  /** Per-entity record: AABB reference + owned endpoints + freshness stamp. */
  private records: Map<EntityId, SAPRecord> = new Map()

  /** Active overlapping pairs that passed both X and Y checks (packed keys). */
  private activePairs: Set<number> = new Set()

  /** Reverse index: entity → packed keys of pairs involving it. Rebuilt with activePairs. */
  private pairsByEntity: Map<EntityId, Set<number>> = new Map()

  /** Monotonic frame stamp used to prune entities absent from update(). */
  private frameStamp = 0

  /** Cached result array + pooled pair objects — rebuilt on each query(). */
  private resultCache: BroadPhasePair[] = []
  private pairPool: BroadPhasePair[] = []
  private resultDirty = true

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Update/insert AABBs for the current frame.
   * Call once per frame with **all** active colliders.
   *
   * Entities present in the previous frame but absent from `aabbs` are
   * automatically removed.
   */
  update(aabbs: BroadPhaseAABB[]): void {
    this.resultDirty = true
    const stamp = ++this.frameStamp

    // Upsert AABBs. Endpoint objects are owned per entity, so position
    // updates are direct writes — no axis rescan.
    for (let i = 0; i < aabbs.length; i++) {
      const aabb = aabbs[i]
      let rec = this.records.get(aabb.entityId)
      if (!rec) {
        rec = {
          aabb,
          minEp: { entityId: aabb.entityId, value: aabb.minX, isMin: true },
          maxEp: { entityId: aabb.entityId, value: aabb.maxX, isMin: false },
          seen: stamp,
        }
        this.records.set(aabb.entityId, rec)
        // Append the two new endpoints to the axis pool.
        this.endpoints.push(rec.minEp, rec.maxEp)
      } else {
        rec.aabb = aabb
        rec.minEp.value = aabb.minX
        rec.maxEp.value = aabb.maxX
        rec.seen = stamp
      }
    }
    this.endpointCount = this.endpoints.length

    // Prune entities absent from this frame's input (deleting from a Map
    // while iterating it is safe).
    for (const [id, rec] of this.records) {
      if (rec.seen !== stamp) this.removeInternal(id)
    }

    // Sort endpoints with insertion sort and incrementally update pairs.
    this.sortAndSweep()
  }

  /**
   * Get all overlapping pairs that passed both X and Y overlap tests.
   * Must call `update()` first.
   *
   * The returned array (and its contents) is reused across calls — treat it
   * as valid only until the next update()/query().
   */
  query(): BroadPhasePair[] {
    if (!this.resultDirty) return this.resultCache

    const out = this.resultCache
    out.length = 0
    let i = 0
    for (const key of this.activePairs) {
      let pair = this.pairPool[i]
      if (!pair) {
        pair = { entityA: 0 as EntityId, entityB: 0 as EntityId }
        this.pairPool[i] = pair
      }
      pair.entityA = unpackPairA(key)
      pair.entityB = unpackPairB(key)
      out.push(pair)
      i++
    }

    this.resultDirty = false
    return out
  }

  /**
   * Remove a single entity from the broad phase.
   * Any pairs involving this entity are also removed.
   */
  remove(entityId: EntityId): void {
    if (!this.records.has(entityId)) return
    this.removeInternal(entityId)
    this.resultDirty = true
  }

  /**
   * Clear all internal state.
   */
  clear(): void {
    this.endpointCount = 0
    this.endpoints.length = 0
    this.records.clear()
    this.activePairs.clear()
    this.pairsByEntity.clear()
    this.frameStamp++
    this.resultCache.length = 0
    this.resultDirty = true
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /**
   * Remove one entity's endpoints, record and pairs.
   * The record must belong to `entityId`.
   */
  private removeInternal(entityId: EntityId): void {
    // Compact the endpoint array in place, dropping both of this entity's
    // endpoints in a single pass.
    const eps = this.endpoints
    let dst = 0
    for (let src = 0; src < eps.length; src++) {
      const ep = eps[src]
      if (ep.entityId !== entityId) {
        if (dst !== src) {
          eps[dst] = ep
        }
        dst++
      }
    }
    eps.length = dst
    this.endpointCount = dst

    // Purge pairs involving this entity via the reverse index — no full scan.
    const keys = this.pairsByEntity.get(entityId)
    if (keys) {
      for (const key of keys) {
        this.activePairs.delete(key)
        const other = unpackPairA(key) === entityId ? unpackPairB(key) : unpackPairA(key)
        this.pairsByEntity.get(other)?.delete(key)
      }
      this.pairsByEntity.delete(entityId)
    }

    this.records.delete(entityId)
  }

  /**
   * Insertion-sort the endpoint array, then rebuild the active-pair set
   * from the sorted axis.
   *
   * The sort itself doesn't track pair changes as it goes — the subsequent
   * rebuild unconditionally recomputes the full pair set from the sorted
   * endpoints, so mid-sort bookkeeping would only be discarded.
   */
  private sortAndSweep(): void {
    const eps = this.endpoints
    const n = this.endpointCount

    // Insertion sort — O(n) when nearly sorted (typical for frame-coherent data).
    for (let i = 1; i < n; i++) {
      const current = eps[i]
      const value = current.value
      let j = i - 1
      while (j >= 0 && eps[j].value > value) {
        eps[j + 1] = eps[j]
        j--
      }
      eps[j + 1] = current
    }

    // Rebuild active pairs from scratch on the X-axis, then filter by Y.
    this.rebuildPairsFromSortedAxis()
  }

  /**
   * Full rebuild of the active pair set from the sorted endpoint list.
   *
   * Walks the sorted X endpoints left to right, maintaining an "active"
   * set of entities whose interval is currently open. Any two entities
   * that are both active at the same time overlap on X and are tested
   * against Y before being added.
   *
   * This is called every frame to ensure correctness regardless of
   * floating-point edge cases or teleportation.
   */
  private rebuildPairsFromSortedAxis(): void {
    this.activePairs.clear()
    this.pairsByEntity.clear()

    // Set of entity IDs whose min endpoint has been seen but max has not.
    // Reused across frames — clearing beats reallocating.
    const active = this._sweepActive
    active.clear()

    const eps = this.endpoints
    const n = this.endpointCount

    for (let i = 0; i < n; i++) {
      const ep = eps[i]

      if (ep.isMin) {
        // This entity's interval is opening. Every currently active entity
        // overlaps with it on the X axis.
        for (const otherId of active) {
          this.tryAddPair(ep.entityId, otherId)
        }
        active.add(ep.entityId)
      } else {
        // This entity's interval is closing.
        active.delete(ep.entityId)
      }
    }
  }

  /** Open-interval entity set used by the sweep; reused across frames. */
  private _sweepActive: Set<EntityId> = new Set()

  /**
   * Attempt to add a pair after confirming Y-axis overlap.
   */
  private tryAddPair(a: EntityId, b: EntityId): void {
    if (a === b) return

    const recA = this.records.get(a)
    const recB = this.records.get(b)
    if (!recA || !recB) return

    // Y-axis overlap check.
    if (recA.aabb.maxY < recB.aabb.minY || recB.aabb.maxY < recA.aabb.minY) return

    const key = packPair(a, b)
    this.activePairs.add(key)

    let setA = this.pairsByEntity.get(a)
    if (!setA) {
      setA = new Set()
      this.pairsByEntity.set(a, setA)
    }
    setA.add(key)

    let setB = this.pairsByEntity.get(b)
    if (!setB) {
      setB = new Set()
      this.pairsByEntity.set(b, setB)
    }
    setB.add(key)
  }
}
