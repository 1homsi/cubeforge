import type { ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { BoxColliderComponent } from './components/boxCollider'

interface TagComponent {
  type: 'Tag'
  tags: string[]
}

interface QueryOpts {
  /** Only include entities with this tag. */
  tag?: string
  /** Only include entities whose BoxCollider is on this layer. */
  layer?: string
  /** Exclude these entity IDs (e.g. the querying entity itself). */
  exclude?: EntityId[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function passesFilter(
  world: ECSWorld,
  id: EntityId,
  col: BoxColliderComponent,
  opts: QueryOpts,
): boolean {
  if (opts.exclude?.includes(id)) return false
  if (opts.layer && col.layer !== opts.layer) return false
  if (opts.tag) {
    const t = world.getComponent<TagComponent>(id, 'Tag')
    if (!t?.tags.includes(opts.tag)) return false
  }
  return true
}

// ── overlapBox ────────────────────────────────────────────────────────────────

/**
 * Returns all entities whose BoxCollider overlaps the given AABB.
 *
 * @param world - The ECS world.
 * @param cx    - World-space center X of the test box.
 * @param cy    - World-space center Y of the test box.
 * @param hw    - Half-width of the test box.
 * @param hh    - Half-height of the test box.
 * @param opts  - Optional tag/layer filter and entity exclusion list.
 *
 * @example
 * ```ts
 * const hits = overlapBox(world, transform.x, transform.y, 32, 32, { tag: 'enemy' })
 * ```
 */
export function overlapBox(
  world: ECSWorld,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  opts: QueryOpts = {},
): EntityId[] {
  const results: EntityId[] = []
  for (const id of world.query('Transform', 'BoxCollider')) {
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    const c = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!
    if (!passesFilter(world, id, c, opts)) continue

    const ecx = t.x + c.offsetX
    const ecy = t.y + c.offsetY
    const ehw = c.width / 2
    const ehh = c.height / 2

    if (Math.abs(ecx - cx) < hw + ehw && Math.abs(ecy - cy) < hh + ehh) {
      results.push(id)
    }
  }
  return results
}

// ── raycast ───────────────────────────────────────────────────────────────────

export interface RaycastHit {
  /** The entity that was hit. */
  entityId: EntityId
  /** Distance from ray origin to the hit point. */
  distance: number
  /** World-space point where the ray entered the collider. */
  point: { x: number; y: number }
  /** Surface normal at the hit point (axis-aligned, one of ±{1,0} or {0,±1}). */
  normal: { x: number; y: number }
}

interface RaycastOpts extends QueryOpts {
  /** If true, also hit trigger colliders (default false). */
  includeTriggers?: boolean
}

/**
 * Casts a ray from `origin` in `direction` up to `maxDistance` pixels and
 * returns the closest hit, or `null` if nothing was struck.
 *
 * Uses the AABB slab intersection method — accurate for all angles.
 *
 * @example
 * ```ts
 * const hit = raycast(world, { x: transform.x, y: transform.y }, { x: 1, y: 0 }, 200, { tag: 'wall' })
 * if (hit) console.log('Hit entity', hit.entityId, 'at distance', hit.distance)
 * ```
 */
export function raycast(
  world: ECSWorld,
  origin: { x: number; y: number },
  direction: { x: number; y: number },
  maxDistance: number,
  opts: RaycastOpts = {},
): RaycastHit | null {
  // Normalize direction
  const len = Math.hypot(direction.x, direction.y)
  if (len === 0) return null
  const dx = direction.x / len
  const dy = direction.y / len

  let closest: RaycastHit | null = null

  for (const id of world.query('Transform', 'BoxCollider')) {
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    const c = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!
    if (!opts.includeTriggers && c.isTrigger) continue
    if (!passesFilter(world, id, c, opts)) continue

    const cx = t.x + c.offsetX
    const cy = t.y + c.offsetY
    const hw = c.width / 2
    const hh = c.height / 2

    // Slab test
    const left   = cx - hw
    const right  = cx + hw
    const top    = cy - hh
    const bottom = cy + hh

    let tmin = -Infinity
    let tmax =  Infinity

    // X slab
    if (dx !== 0) {
      const t1 = (left  - origin.x) / dx
      const t2 = (right - origin.x) / dx
      tmin = Math.max(tmin, Math.min(t1, t2))
      tmax = Math.min(tmax, Math.max(t1, t2))
    } else if (origin.x < left || origin.x > right) {
      continue // ray parallel and outside slab
    }

    // Y slab
    if (dy !== 0) {
      const t1 = (top    - origin.y) / dy
      const t2 = (bottom - origin.y) / dy
      tmin = Math.max(tmin, Math.min(t1, t2))
      tmax = Math.min(tmax, Math.max(t1, t2))
    } else if (origin.y < top || origin.y > bottom) {
      continue // ray parallel and outside slab
    }

    if (tmax < 0 || tmin > tmax || tmin > maxDistance) continue

    const dist = Math.max(0, tmin) // 0 if origin is inside the box
    if (closest && dist >= closest.distance) continue

    // Determine hit normal from which slab face was entered
    const hitX = origin.x + dx * tmin
    const hitY = origin.y + dy * tmin

    let nx = 0
    let ny = 0
    const edgeEps = 0.001
    if (Math.abs(hitX - left)   < edgeEps) nx = -1
    else if (Math.abs(hitX - right)  < edgeEps) nx =  1
    else if (Math.abs(hitY - top)    < edgeEps) ny = -1
    else if (Math.abs(hitY - bottom) < edgeEps) ny =  1

    closest = {
      entityId: id,
      distance: dist,
      point: { x: hitX, y: hitY },
      normal: { x: nx, y: ny },
    }
  }

  return closest
}
