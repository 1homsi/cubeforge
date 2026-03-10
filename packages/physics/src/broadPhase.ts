/**
 * Sweep-and-Prune (SAP) broad phase for 2D physics.
 *
 * Maintains a sorted list of interval endpoints on the X-axis and uses
 * insertion sort each frame (O(n) amortized for nearly-sorted data).
 * Candidate pairs from the X sweep are validated against Y-axis overlap
 * before being reported.
 *
 * This replaces the naive O(n²) brute-force used in CollisionPipeline and
 * supplements the spatial grid in PhysicsSystem.
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

// ── Pair key helpers ──────────────────────────────────────────────────────

/**
 * Canonical string key for an unordered entity pair.
 * The smaller ID always comes first so the key is order-independent.
 */
function pairKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

/**
 * Extract the two entity IDs encoded in a pair key.
 */
function splitKey(key: string): [EntityId, EntityId] {
  const sep = key.indexOf(':')
  return [Number(key.slice(0, sep)) as EntityId, Number(key.slice(sep + 1)) as EntityId]
}

// ── SweepAndPrune ─────────────────────────────────────────────────────────

/**
 * Sweep-and-Prune broad phase.
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
  /** Pooled endpoint array — reused across frames to avoid allocation. */
  private endpoints: Endpoint[] = []

  /** Number of valid endpoints in the pool (always 2 × entity count). */
  private endpointCount = 0

  /** AABB lookup for Y-axis validation. */
  private aabbs: Map<EntityId, BroadPhaseAABB> = new Map()

  /** Active overlapping pairs that passed both X and Y checks. */
  private activePairs: Set<string> = new Set()

  /** Tracks which entities currently have endpoints in the list. */
  private entitySet: Set<EntityId> = new Set()

  /** Cached result array — rebuilt on each query(). */
  private resultCache: BroadPhasePair[] = []
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

    // Track which entities are present this frame for pruning.
    const incoming = new Set<EntityId>()
    for (let i = 0; i < aabbs.length; i++) {
      incoming.add(aabbs[i].entityId)
    }

    // Remove stale entities that are no longer in the input.
    for (const existingId of this.entitySet) {
      if (!incoming.has(existingId)) {
        this.removeInternal(existingId)
      }
    }

    // Upsert AABBs.
    for (let i = 0; i < aabbs.length; i++) {
      const aabb = aabbs[i]
      this.aabbs.set(aabb.entityId, aabb)

      if (!this.entitySet.has(aabb.entityId)) {
        // New entity — append two endpoints from the pool.
        this.insertEndpoints(aabb)
        this.entitySet.add(aabb.entityId)
      } else {
        // Existing entity — update endpoint values in place.
        this.updateEndpointValues(aabb)
      }
    }

    // Sort endpoints with insertion sort and incrementally update pairs.
    this.sortAndSweep()
  }

  /**
   * Get all overlapping pairs that passed both X and Y overlap tests.
   * Must call `update()` first.
   */
  query(): BroadPhasePair[] {
    if (!this.resultDirty) return this.resultCache

    this.resultCache.length = 0
    for (const key of this.activePairs) {
      const [a, b] = splitKey(key)
      this.resultCache.push({ entityA: a, entityB: b })
    }

    this.resultDirty = false
    return this.resultCache
  }

  /**
   * Remove a single entity from the broad phase.
   * Any pairs involving this entity are also removed.
   */
  remove(entityId: EntityId): void {
    if (!this.entitySet.has(entityId)) return
    this.removeInternal(entityId)
    this.resultDirty = true
  }

  /**
   * Clear all internal state.
   */
  clear(): void {
    this.endpointCount = 0
    this.aabbs.clear()
    this.activePairs.clear()
    this.entitySet.clear()
    this.resultCache.length = 0
    this.resultDirty = true
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /**
   * Allocate (or reuse) two endpoint slots from the pool and initialise
   * them for the given AABB.
   */
  private insertEndpoints(aabb: BroadPhaseAABB): void {
    const idx = this.endpointCount

    // Grow pool if needed.
    while (this.endpoints.length < idx + 2) {
      this.endpoints.push({ entityId: 0 as EntityId, value: 0, isMin: true })
    }

    // Min endpoint.
    const epMin = this.endpoints[idx]
    epMin.entityId = aabb.entityId
    epMin.value = aabb.minX
    epMin.isMin = true

    // Max endpoint.
    const epMax = this.endpoints[idx + 1]
    epMax.entityId = aabb.entityId
    epMax.value = aabb.maxX
    epMax.isMin = false

    this.endpointCount += 2
  }

  /**
   * Scan the endpoint array and update the values for a known entity.
   */
  private updateEndpointValues(aabb: BroadPhaseAABB): void {
    let found = 0
    for (let i = 0; i < this.endpointCount && found < 2; i++) {
      const ep = this.endpoints[i]
      if (ep.entityId === aabb.entityId) {
        ep.value = ep.isMin ? aabb.minX : aabb.maxX
        found++
      }
    }
  }

  /**
   * Remove an entity's endpoints and purge its pairs.
   */
  private removeInternal(entityId: EntityId): void {
    // Remove endpoints by compacting in-place.
    let dst = 0
    for (let src = 0; src < this.endpointCount; src++) {
      if (this.endpoints[src].entityId !== entityId) {
        if (dst !== src) {
          const tmp = this.endpoints[dst]
          this.endpoints[dst] = this.endpoints[src]
          this.endpoints[src] = tmp
        }
        dst++
      }
    }
    this.endpointCount = dst

    // Purge active pairs involving this entity.
    const prefix1 = `${entityId}:`
    const suffix1 = `:${entityId}`
    for (const key of this.activePairs) {
      if (key.startsWith(prefix1) || key.endsWith(suffix1)) {
        this.activePairs.delete(key)
      }
    }

    this.aabbs.delete(entityId)
    this.entitySet.delete(entityId)
  }

  /**
   * Insertion-sort the endpoint array and incrementally maintain the
   * active-pair set.
   *
   * When a min endpoint moves left past another entity's max endpoint, a
   * new X-overlap begins. When a max endpoint moves right past another
   * entity's min endpoint, the overlap was already tracked. The inverse
   * motions signal the end of an overlap.
   *
   * After sorting, the pair set is pruned against Y-axis overlap.
   */
  private sortAndSweep(): void {
    const eps = this.endpoints
    const n = this.endpointCount

    // Insertion sort — O(n) when nearly sorted (typical for frame-coherent data).
    for (let i = 1; i < n; i++) {
      const current = eps[i]
      let j = i - 1

      while (j >= 0 && eps[j].value > current.value) {
        // `current` is moving left past `eps[j]`.
        // Detect pair creation/destruction from the swap.
        const other = eps[j]

        if (current.entityId !== other.entityId) {
          this.onSwap(current, other)
        }

        // Shift right.
        eps[j + 1] = other
        j--
      }

      eps[j + 1] = current
    }

    // Rebuild active pairs from scratch on the X-axis to avoid
    // accumulated drift from incremental swaps, then filter by Y.
    this.rebuildPairsFromSortedAxis()
  }

  /**
   * Incremental swap handler (used during insertion sort).
   *
   * When a min endpoint passes left over a max endpoint (or vice-versa),
   * it signals a potential overlap change on the X-axis.
   */
  private onSwap(moving: Endpoint, stationary: Endpoint): void {
    // A min endpoint moving left past a max endpoint → new X overlap.
    // A max endpoint moving left past a min endpoint → X overlap lost.
    // (The sort moves `moving` leftward past `stationary`.)

    if (moving.isMin && !stationary.isMin) {
      // moving.min passed left of stationary.max → overlap begins on X
      this.tryAddPair(moving.entityId, stationary.entityId)
    } else if (!moving.isMin && stationary.isMin) {
      // moving.max passed left of stationary.min → overlap ends on X
      this.activePairs.delete(pairKey(moving.entityId, stationary.entityId))
    }
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
   * incremental swap accuracy (floating-point edge cases, teleportation,
   * etc.).
   */
  private rebuildPairsFromSortedAxis(): void {
    this.activePairs.clear()

    // Set of entity IDs whose min endpoint has been seen but max has not.
    const active = new Set<EntityId>()
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

  /**
   * Attempt to add a pair after confirming Y-axis overlap.
   */
  private tryAddPair(a: EntityId, b: EntityId): void {
    if (a === b) return

    const aabbA = this.aabbs.get(a)
    const aabbB = this.aabbs.get(b)
    if (!aabbA || !aabbB) return

    // Y-axis overlap check.
    if (aabbA.maxY < aabbB.minY || aabbB.maxY < aabbA.minY) return

    this.activePairs.add(pairKey(a, b))
  }
}
