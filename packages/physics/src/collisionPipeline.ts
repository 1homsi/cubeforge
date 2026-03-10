/**
 * Collision-Only Pipeline — runs collision detection without dynamics.
 *
 * Useful for spatial queries, overlap detection, and sensor-only scenarios
 * where you need contact manifolds but no velocity/position solving.
 */

import type { ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { BoxColliderComponent } from './components/boxCollider'
import type { CircleColliderComponent } from './components/circleCollider'
import type { CapsuleColliderComponent } from './components/capsuleCollider'
import type { JointComponent } from './components/joint'
import type { ContactManifold } from './contactManifold'
import {
  generateBoxBoxManifold,
  generateCircleCircleManifold,
  generateCircleBoxManifold,
  generateCapsuleBoxManifold,
  generateCapsuleCircleManifold,
  generateCapsuleCapsuleManifold,
} from './contactManifold'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CollisionPair {
  entityA: EntityId
  entityB: EntityId
}

export interface CollisionPipelineResult {
  /** All contact manifolds from narrow phase. */
  manifolds: ContactManifold[]
  /** All broad-phase collision pairs (before narrow phase filtering). */
  broadPhasePairs: CollisionPair[]
  /** Intersection pairs involving at least one sensor/trigger. */
  intersectionPairs: CollisionPair[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface AABB {
  cx: number
  cy: number
  hw: number
  hh: number
}

function getAABB(t: TransformComponent, col: BoxColliderComponent): AABB {
  return { cx: t.x + col.offsetX, cy: t.y + col.offsetY, hw: col.width / 2, hh: col.height / 2 }
}

function getCircleAABB(t: TransformComponent, col: CircleColliderComponent): AABB {
  return { cx: t.x + col.offsetX, cy: t.y + col.offsetY, hw: col.radius, hh: col.radius }
}

function getCapsuleAABB(t: TransformComponent, col: CapsuleColliderComponent): AABB {
  return { cx: t.x + col.offsetX, cy: t.y + col.offsetY, hw: col.width / 2, hh: col.height / 2 }
}

function aabbOverlaps(a: AABB, b: AABB): boolean {
  return Math.abs(a.cx - b.cx) < a.hw + b.hw && Math.abs(a.cy - b.cy) < a.hh + b.hh
}

function maskAllows(mask: string | string[], layer: string): boolean {
  if (mask === '*') return true
  if (Array.isArray(mask)) return mask.includes(layer)
  return mask === layer
}

function canInteract(
  aLayer: string,
  aMask: string | string[],
  bLayer: string,
  bMask: string | string[],
  aGroup?: string,
  bGroup?: string,
): boolean {
  if (aGroup && bGroup && aGroup === bGroup) return false
  return maskAllows(aMask, bLayer) && maskAllows(bMask, aLayer)
}

function pairKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

// ── Collision Pipeline ─────────────────────────────────────────────────────

export class CollisionPipeline {
  /**
   * Run collision detection on the world without applying any dynamics.
   * Returns all contact manifolds and broad-phase/intersection pairs.
   */
  detect(world: ECSWorld): CollisionPipelineResult {
    const manifolds: ContactManifold[] = []
    const broadPhasePairs: CollisionPair[] = []
    const intersectionPairs: CollisionPair[] = []
    const checked = new Set<string>()

    // Build joint exclusion set
    const jointExcluded = new Set<string>()
    for (const jid of world.query('Joint')) {
      const j = world.getComponent<JointComponent>(jid, 'Joint')!
      if (!j.enabled || j.broken) continue
      if (!j.contactsEnabled) {
        jointExcluded.add(pairKey(j.entityA, j.entityB))
      }
    }

    // Gather all collidable entities
    const boxEntities = world.query('Transform', 'BoxCollider')
    const circleEntities = world.query('Transform', 'CircleCollider')
    const capsuleEntities = world.query('Transform', 'CapsuleCollider')

    // Collect AABBs for all entities
    type Entry = { id: EntityId; aabb: AABB; kind: 'box' | 'circle' | 'capsule' }
    const entries: Entry[] = []

    for (const id of boxEntities) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!
      if (!col.enabled) continue
      entries.push({ id, aabb: getAABB(t, col), kind: 'box' })
    }
    for (const id of circleEntities) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<CircleColliderComponent>(id, 'CircleCollider')!
      if (!col.enabled) continue
      entries.push({ id, aabb: getCircleAABB(t, col), kind: 'circle' })
    }
    for (const id of capsuleEntities) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<CapsuleColliderComponent>(id, 'CapsuleCollider')!
      if (!col.enabled) continue
      entries.push({ id, aabb: getCapsuleAABB(t, col), kind: 'capsule' })
    }

    // Brute force broad phase (n²/2 — fine for collision-only mode)
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]
        const b = entries[j]
        const key = pairKey(a.id, b.id)

        if (!aabbOverlaps(a.aabb, b.aabb)) continue

        broadPhasePairs.push({ entityA: a.id, entityB: b.id })

        // Joint exclusion
        if (jointExcluded.has(key)) continue
        if (checked.has(key)) continue
        checked.add(key)

        // Layer/mask filtering
        const colA = this.getCollider(world, a.id, a.kind)
        const colB = this.getCollider(world, b.id, b.kind)
        if (!colA || !colB) continue

        if (!canInteract(colA.layer, colA.mask, colB.layer, colB.mask, colA.group, colB.group)) continue

        // Check if either is a trigger → intersection pair
        if (colA.isTrigger || colB.isTrigger) {
          intersectionPairs.push({ entityA: a.id, entityB: b.id })
          continue
        }

        // Narrow phase
        const manifold = this.narrowPhase(world, a, b)
        if (manifold) {
          manifold.entityA = a.id
          manifold.entityB = b.id
          manifolds.push(manifold)
        }
      }
    }

    return { manifolds, broadPhasePairs, intersectionPairs }
  }

  /**
   * Run broad phase only — returns potential collision pairs without narrow phase.
   */
  broadPhaseOnly(world: ECSWorld): CollisionPair[] {
    const pairs: CollisionPair[] = []
    const entries = this.gatherEntries(world)

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (aabbOverlaps(entries[i].aabb, entries[j].aabb)) {
          pairs.push({ entityA: entries[i].id, entityB: entries[j].id })
        }
      }
    }

    return pairs
  }

  private gatherEntries(world: ECSWorld) {
    type Entry = { id: EntityId; aabb: AABB; kind: 'box' | 'circle' | 'capsule' }
    const entries: Entry[] = []
    for (const id of world.query('Transform', 'BoxCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!
      if (!col.enabled) continue
      entries.push({ id, aabb: getAABB(t, col), kind: 'box' })
    }
    for (const id of world.query('Transform', 'CircleCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<CircleColliderComponent>(id, 'CircleCollider')!
      if (!col.enabled) continue
      entries.push({ id, aabb: getCircleAABB(t, col), kind: 'circle' })
    }
    for (const id of world.query('Transform', 'CapsuleCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<CapsuleColliderComponent>(id, 'CapsuleCollider')!
      if (!col.enabled) continue
      entries.push({ id, aabb: getCapsuleAABB(t, col), kind: 'capsule' })
    }
    return entries
  }

  private getCollider(
    world: ECSWorld,
    id: EntityId,
    kind: 'box' | 'circle' | 'capsule',
  ): { layer: string; mask: string | string[]; group: string; isTrigger: boolean } | null {
    if (kind === 'box') {
      const c = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')
      return c ? { layer: c.layer, mask: c.mask, group: c.group, isTrigger: c.isTrigger } : null
    }
    if (kind === 'circle') {
      const c = world.getComponent<CircleColliderComponent>(id, 'CircleCollider')
      return c ? { layer: c.layer, mask: c.mask, group: c.group, isTrigger: c.isTrigger } : null
    }
    const c = world.getComponent<CapsuleColliderComponent>(id, 'CapsuleCollider')
    return c ? { layer: c.layer, mask: c.mask, group: c.group, isTrigger: c.isTrigger } : null
  }

  private narrowPhase(
    world: ECSWorld,
    a: { id: EntityId; aabb: AABB; kind: 'box' | 'circle' | 'capsule' },
    b: { id: EntityId; aabb: AABB; kind: 'box' | 'circle' | 'capsule' },
  ): ContactManifold | null {
    const kinds = `${a.kind}-${b.kind}`
    let raw: { normalX: number; normalY: number; points: any[] } | null = null

    if (kinds === 'box-box') {
      raw = generateBoxBoxManifold(
        a.aabb.cx,
        a.aabb.cy,
        a.aabb.hw,
        a.aabb.hh,
        b.aabb.cx,
        b.aabb.cy,
        b.aabb.hw,
        b.aabb.hh,
      )
    } else if (kinds === 'circle-circle') {
      const ca = world.getComponent<CircleColliderComponent>(a.id, 'CircleCollider')!
      const cb = world.getComponent<CircleColliderComponent>(b.id, 'CircleCollider')!
      raw = generateCircleCircleManifold(a.aabb.cx, a.aabb.cy, ca.radius, b.aabb.cx, b.aabb.cy, cb.radius)
    } else if (kinds === 'circle-box') {
      const ca = world.getComponent<CircleColliderComponent>(a.id, 'CircleCollider')!
      raw = generateCircleBoxManifold(a.aabb.cx, a.aabb.cy, ca.radius, b.aabb.cx, b.aabb.cy, b.aabb.hw, b.aabb.hh)
    } else if (kinds === 'box-circle') {
      const cb = world.getComponent<CircleColliderComponent>(b.id, 'CircleCollider')!
      raw = generateCircleBoxManifold(b.aabb.cx, b.aabb.cy, cb.radius, a.aabb.cx, a.aabb.cy, a.aabb.hw, a.aabb.hh)
      if (raw) {
        raw.normalX = -raw.normalX
        raw.normalY = -raw.normalY
      }
    } else if (kinds === 'capsule-box') {
      raw = generateCapsuleBoxManifold(
        a.aabb.cx,
        a.aabb.cy,
        a.aabb.hw,
        a.aabb.hh,
        b.aabb.cx,
        b.aabb.cy,
        b.aabb.hw,
        b.aabb.hh,
      )
    } else if (kinds === 'box-capsule') {
      raw = generateCapsuleBoxManifold(
        b.aabb.cx,
        b.aabb.cy,
        b.aabb.hw,
        b.aabb.hh,
        a.aabb.cx,
        a.aabb.cy,
        a.aabb.hw,
        a.aabb.hh,
      )
      if (raw) {
        raw.normalX = -raw.normalX
        raw.normalY = -raw.normalY
      }
    } else if (kinds === 'capsule-circle') {
      const cb = world.getComponent<CircleColliderComponent>(b.id, 'CircleCollider')!
      raw = generateCapsuleCircleManifold(a.aabb.cx, a.aabb.cy, a.aabb.hw, a.aabb.hh, b.aabb.cx, b.aabb.cy, cb.radius)
    } else if (kinds === 'circle-capsule') {
      const ca = world.getComponent<CircleColliderComponent>(a.id, 'CircleCollider')!
      raw = generateCapsuleCircleManifold(b.aabb.cx, b.aabb.cy, b.aabb.hw, b.aabb.hh, a.aabb.cx, a.aabb.cy, ca.radius)
      if (raw) {
        raw.normalX = -raw.normalX
        raw.normalY = -raw.normalY
      }
    } else if (kinds === 'capsule-capsule') {
      raw = generateCapsuleCapsuleManifold(
        a.aabb.cx,
        a.aabb.cy,
        a.aabb.hw,
        a.aabb.hh,
        b.aabb.cx,
        b.aabb.cy,
        b.aabb.hw,
        b.aabb.hh,
      )
    }

    if (!raw) return null

    return {
      ...raw,
      entityA: a.id,
      entityB: b.id,
      friction: 0.5,
      restitution: 0,
    }
  }
}
