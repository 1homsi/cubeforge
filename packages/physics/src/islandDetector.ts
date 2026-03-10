/**
 * Island Detector — connected-component grouping for physics simulation.
 *
 * Groups dynamically-interacting bodies into islands via contacts and joints,
 * allowing the solver to process each island independently. This improves cache
 * locality and enables island-level sleeping: when every dynamic body in an
 * island is below the velocity threshold the entire island can be put to sleep.
 *
 * Uses Union-Find (disjoint set) with path compression and union by rank,
 * giving amortized O(α(n)) per merge — effectively constant time.
 */

import type { EntityId } from '@cubeforge/core'
import type { ContactManifold } from './contactManifold'

// ── Public types ──────────────────────────────────────────────────────────────

export interface Island {
  /** All dynamic entity IDs in this island. */
  bodies: EntityId[]
  /** Indices into the manifolds array for contacts belonging to this island. */
  manifoldIndices: number[]
  /** Whether all dynamic bodies in this island are candidates for sleeping. */
  canSleep: boolean
}

// ── IslandDetector ────────────────────────────────────────────────────────────

/**
 * Island Detector — builds connected-component islands from contact manifolds
 * and joint connections.
 *
 * Uses Union-Find (disjoint set) for efficient O(α(n)) amortized merging.
 */
export class IslandDetector {
  /** Union-Find parent pointers. */
  private parent: Map<EntityId, EntityId> = new Map()
  /** Union-Find rank (tree depth upper bound). */
  private rank: Map<EntityId, number> = new Map()

  // Reusable scratch structures — cleared each frame, never reallocated.
  private readonly islandBodies: Map<EntityId, EntityId[]> = new Map()
  private readonly islandManifolds: Map<EntityId, number[]> = new Map()
  private readonly islands: Island[] = []

  // ── Union-Find primitives ───────────────────────────────────────────────

  /** Initialise an entity as its own singleton set. */
  private makeSet(id: EntityId): void {
    this.parent.set(id, id)
    this.rank.set(id, 0)
  }

  /** Find the root representative with path compression. */
  private find(x: EntityId): EntityId {
    let root = x
    // Walk to root
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!
    }
    // Path compression — point every node on the path directly at the root
    let current = x
    while (current !== root) {
      const next = this.parent.get(current)!
      this.parent.set(current, root)
      current = next
    }
    return root
  }

  /** Merge two sets by rank. */
  private union(a: EntityId, b: EntityId): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA === rootB) return

    const rankA = this.rank.get(rootA)!
    const rankB = this.rank.get(rootB)!

    if (rankA < rankB) {
      this.parent.set(rootA, rootB)
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA)
    } else {
      this.parent.set(rootB, rootA)
      this.rank.set(rootA, rankA + 1)
    }
  }

  // ── Main detection ──────────────────────────────────────────────────────

  /**
   * Build islands from contact manifolds and joint connections.
   *
   * @param dynamicBodies   All dynamic body entity IDs (not static/kinematic —
   *                        those don't participate in islands).
   * @param manifolds       All contact manifolds from narrow phase.
   * @param jointPairs      Pairs of entity IDs connected by joints:
   *                        `[entityA, entityB][]`.
   * @param isStaticOrKinematic  Predicate — returns true for static/kinematic
   *                             bodies. These act as island anchors but are not
   *                             moved by the solver.
   * @param isSleepCandidate     Predicate — returns true when a body's velocity
   *                             is below the sleep threshold.
   * @returns Array of islands, one per connected component.
   */
  detect(
    dynamicBodies: EntityId[],
    manifolds: ContactManifold[],
    jointPairs: [EntityId, EntityId][],
    isStaticOrKinematic: (id: EntityId) => boolean,
    isSleepCandidate: (id: EntityId) => boolean,
  ): Island[] {
    // ── Reset reusable structures ────────────────────────────────────────
    this.parent.clear()
    this.rank.clear()
    this.islandBodies.clear()
    this.islandManifolds.clear()
    this.islands.length = 0

    // Early-out: nothing to do if there are no dynamic bodies.
    if (dynamicBodies.length === 0) return this.islands

    // ── 1. Initialise each dynamic body as its own set ───────────────────
    for (let i = 0; i < dynamicBodies.length; i++) {
      this.makeSet(dynamicBodies[i])
    }

    // ── 2. Merge sets via contact manifolds ──────────────────────────────
    // Only union two bodies when both are dynamic. If one side is
    // static/kinematic the dynamic body stays in its current set — the
    // manifold will still be associated with the island later.
    for (let i = 0; i < manifolds.length; i++) {
      const m = manifolds[i]
      const aStatic = isStaticOrKinematic(m.entityA)
      const bStatic = isStaticOrKinematic(m.entityB)

      if (!aStatic && !bStatic) {
        // Both dynamic — merge their sets.
        this.union(m.entityA, m.entityB)
      }
      // Mixed (one dynamic, one static) or both static: handled below when
      // we assign manifold indices to islands.
    }

    // ── 3. Merge sets via joint pairs ────────────────────────────────────
    for (let i = 0; i < jointPairs.length; i++) {
      const [a, b] = jointPairs[i]
      const aStatic = isStaticOrKinematic(a)
      const bStatic = isStaticOrKinematic(b)

      if (!aStatic && !bStatic) {
        this.union(a, b)
      }
    }

    // ── 4. Group bodies by their root representative ─────────────────────
    for (let i = 0; i < dynamicBodies.length; i++) {
      const id = dynamicBodies[i]
      const root = this.find(id)

      let bodies = this.islandBodies.get(root)
      if (bodies === undefined) {
        bodies = []
        this.islandBodies.set(root, bodies)
      }
      bodies.push(id)
    }

    // ── 5. Assign manifold indices to islands ────────────────────────────
    // A manifold belongs to an island if at least one of its entities is a
    // dynamic body in that island.
    for (let i = 0; i < manifolds.length; i++) {
      const m = manifolds[i]
      const aStatic = isStaticOrKinematic(m.entityA)
      const bStatic = isStaticOrKinematic(m.entityB)

      // Skip manifolds between two static/kinematic bodies — they don't
      // need solving.
      if (aStatic && bStatic) continue

      // Determine the island root from the dynamic side.
      const dynamicId = aStatic ? m.entityB : m.entityA
      const root = this.find(dynamicId)

      let indices = this.islandManifolds.get(root)
      if (indices === undefined) {
        indices = []
        this.islandManifolds.set(root, indices)
      }
      indices.push(i)
    }

    // ── 6. Build final Island objects ────────────────────────────────────
    for (const [root, bodies] of this.islandBodies) {
      // Determine sleep eligibility — all bodies must be candidates.
      let canSleep = true
      for (let i = 0; i < bodies.length; i++) {
        if (!isSleepCandidate(bodies[i])) {
          canSleep = false
          break
        }
      }

      this.islands.push({
        bodies,
        manifoldIndices: this.islandManifolds.get(root) ?? [],
        canSleep,
      })
    }

    return this.islands
  }
}
