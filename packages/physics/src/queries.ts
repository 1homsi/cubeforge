import type { ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from './components/rigidbody'
import type { BoxColliderComponent } from './components/boxCollider'
import type { CircleColliderComponent } from './components/circleCollider'
import type { CapsuleColliderComponent } from './components/capsuleCollider'

interface TagComponent {
  type: 'Tag'
  tags: string[]
}

export interface QueryOpts {
  /** Only include entities with this tag. */
  tag?: string
  /** Only include entities whose collider is on this layer. */
  layer?: string
  /** Exclude these entity IDs (e.g. the querying entity itself). */
  exclude?: EntityId[]
  /** Exclude a single entity by ID. */
  excludeEntity?: EntityId
  /** Custom filter predicate — return false to skip an entity. */
  filter?: (entityId: EntityId) => boolean
  /** Exclude static bodies. */
  excludeStatic?: boolean
  /** Exclude kinematic bodies. */
  excludeKinematic?: boolean
  /** Exclude sleeping bodies. */
  excludeSleeping?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function passesTagAndExclude(world: ECSWorld, id: EntityId, layer: string, opts: QueryOpts): boolean {
  if (opts.exclude?.includes(id)) return false
  if (opts.excludeEntity !== undefined && id === opts.excludeEntity) return false
  if (opts.layer && layer !== opts.layer) return false
  if (opts.tag) {
    const t = world.getComponent<TagComponent>(id, 'Tag')
    if (!t?.tags.includes(opts.tag)) return false
  }
  if (opts.filter && !opts.filter(id)) return false
  if (opts.excludeStatic || opts.excludeKinematic || opts.excludeSleeping) {
    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
    if (rb) {
      if (opts.excludeStatic && rb.isStatic) return false
      if (opts.excludeKinematic && rb.isKinematic) return false
      if (opts.excludeSleeping && rb.sleeping) return false
    }
  }
  return true
}

// ── Shape AABB helpers ────────────────────────────────────────────────────────

interface ShapeAABB {
  cx: number
  cy: number
  hw: number
  hh: number
  layer: string
  isTrigger: boolean
}

function boxAABB(t: TransformComponent, c: BoxColliderComponent): ShapeAABB {
  return {
    cx: t.x + c.offsetX,
    cy: t.y + c.offsetY,
    hw: c.width / 2,
    hh: c.height / 2,
    layer: c.layer,
    isTrigger: c.isTrigger,
  }
}

function circleAABB(t: TransformComponent, c: CircleColliderComponent): ShapeAABB {
  return {
    cx: t.x + c.offsetX,
    cy: t.y + c.offsetY,
    hw: c.radius,
    hh: c.radius,
    layer: c.layer,
    isTrigger: c.isTrigger,
  }
}

function capsuleAABB(t: TransformComponent, c: CapsuleColliderComponent): ShapeAABB {
  return {
    cx: t.x + c.offsetX,
    cy: t.y + c.offsetY,
    hw: c.width / 2,
    hh: c.height / 2,
    layer: c.layer,
    isTrigger: c.isTrigger,
  }
}

/** Collect all collidable entities as AABBs (box, circle, capsule) */
function* allColliderAABBs(
  world: ECSWorld,
): Generator<{ id: EntityId; aabb: ShapeAABB; isCircle: boolean; circleR: number }> {
  for (const id of world.query('Transform', 'BoxCollider')) {
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    const c = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!
    if (!c.enabled) continue
    yield { id, aabb: boxAABB(t, c), isCircle: false, circleR: 0 }
  }
  for (const id of world.query('Transform', 'CircleCollider')) {
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    const c = world.getComponent<CircleColliderComponent>(id, 'CircleCollider')!
    if (!c.enabled) continue
    yield { id, aabb: circleAABB(t, c), isCircle: true, circleR: c.radius }
  }
  for (const id of world.query('Transform', 'CapsuleCollider')) {
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    const c = world.getComponent<CapsuleColliderComponent>(id, 'CapsuleCollider')!
    if (!c.enabled) continue
    yield { id, aabb: capsuleAABB(t, c), isCircle: false, circleR: 0 }
  }
}

// ── overlapBox ────────────────────────────────────────────────────────────────

/**
 * Returns all entities whose collider overlaps the given AABB.
 * Supports BoxCollider, CircleCollider, and CapsuleCollider.
 *
 * @param world - The ECS world.
 * @param cx    - World-space center X of the test box.
 * @param cy    - World-space center Y of the test box.
 * @param hw    - Half-width of the test box.
 * @param hh    - Half-height of the test box.
 * @param opts  - Optional tag/layer filter and entity exclusion list.
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
  for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue

    if (isCircle) {
      // Circle vs AABB overlap
      const nearX = Math.max(cx - hw, Math.min(aabb.cx, cx + hw))
      const nearY = Math.max(cy - hh, Math.min(aabb.cy, cy + hh))
      const dx = aabb.cx - nearX
      const dy = aabb.cy - nearY
      if (dx * dx + dy * dy <= circleR * circleR) {
        results.push(id)
      }
    } else {
      // AABB vs AABB overlap
      if (Math.abs(aabb.cx - cx) < hw + aabb.hw && Math.abs(aabb.cy - cy) < hh + aabb.hh) {
        results.push(id)
      }
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
  /** Surface normal at the hit point. */
  normal: { x: number; y: number }
}

interface RaycastOpts extends QueryOpts {
  /** If true, also hit trigger colliders (default false). */
  includeTriggers?: boolean
}

/** Ray-AABB slab test. Returns {tmin, nx, ny} or null. */
function rayAABB(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
  maxDist: number,
): { tmin: number; nx: number; ny: number } | null {
  let tmin = -Infinity
  let tmax = Infinity
  let nx = 0,
    ny = 0

  if (dx !== 0) {
    const t1 = (left - ox) / dx
    const t2 = (right - ox) / dx
    const tLo = Math.min(t1, t2)
    const tHi = Math.max(t1, t2)
    if (tLo > tmin) {
      tmin = tLo
      nx = dx > 0 ? -1 : 1
      ny = 0
    }
    tmax = Math.min(tmax, tHi)
  } else if (ox < left || ox > right) {
    return null
  }

  if (dy !== 0) {
    const t1 = (top - oy) / dy
    const t2 = (bottom - oy) / dy
    const tLo = Math.min(t1, t2)
    const tHi = Math.max(t1, t2)
    if (tLo > tmin) {
      tmin = tLo
      nx = 0
      ny = dy > 0 ? -1 : 1
    }
    tmax = Math.min(tmax, tHi)
  } else if (oy < top || oy > bottom) {
    return null
  }

  if (tmax < 0 || tmin > tmax || tmin > maxDist) return null
  return { tmin: Math.max(0, tmin), nx, ny }
}

/** Ray-Circle test. Returns {dist, nx, ny} or null. */
function rayCircle(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  ccx: number,
  ccy: number,
  r: number,
  maxDist: number,
): { tmin: number; nx: number; ny: number } | null {
  const fx = ox - ccx
  const fy = oy - ccy
  const a = dx * dx + dy * dy // should be 1 for normalized dir
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - r * r
  let discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null

  discriminant = Math.sqrt(discriminant)
  let t = (-b - discriminant) / (2 * a)
  if (t < 0) t = (-b + discriminant) / (2 * a) // inside circle — use exit
  if (t < 0 || t > maxDist) return null

  const hitX = ox + dx * t
  const hitY = oy + dy * t
  const ndx = hitX - ccx
  const ndy = hitY - ccy
  const nlen = Math.sqrt(ndx * ndx + ndy * ndy)
  return {
    tmin: t,
    nx: nlen > 0 ? ndx / nlen : 0,
    ny: nlen > 0 ? ndy / nlen : 0,
  }
}

/**
 * Casts a ray and returns the closest hit, or `null`.
 * Tests against BoxCollider, CircleCollider, and CapsuleCollider.
 */
export function raycast(
  world: ECSWorld,
  origin: { x: number; y: number },
  direction: { x: number; y: number },
  maxDistance: number,
  opts: RaycastOpts = {},
): RaycastHit | null {
  const len = Math.hypot(direction.x, direction.y)
  if (len === 0) return null
  const dx = direction.x / len
  const dy = direction.y / len

  let closest: RaycastHit | null = null

  for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
    if (!opts.includeTriggers && aabb.isTrigger) continue
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue

    let hit: { tmin: number; nx: number; ny: number } | null = null

    if (isCircle) {
      hit = rayCircle(origin.x, origin.y, dx, dy, aabb.cx, aabb.cy, circleR, maxDistance)
    } else {
      hit = rayAABB(
        origin.x,
        origin.y,
        dx,
        dy,
        aabb.cx - aabb.hw,
        aabb.cx + aabb.hw,
        aabb.cy - aabb.hh,
        aabb.cy + aabb.hh,
        maxDistance,
      )
    }

    if (!hit) continue
    if (closest && hit.tmin >= closest.distance) continue

    closest = {
      entityId: id,
      distance: hit.tmin,
      point: { x: origin.x + dx * hit.tmin, y: origin.y + dy * hit.tmin },
      normal: { x: hit.nx, y: hit.ny },
    }
  }

  return closest
}

// ── raycastAll ────────────────────────────────────────────────────────────────

/**
 * Like `raycast`, but returns **all** hits sorted by distance (nearest first).
 */
export function raycastAll(
  world: ECSWorld,
  origin: { x: number; y: number },
  direction: { x: number; y: number },
  maxDistance: number,
  opts: RaycastOpts = {},
): RaycastHit[] {
  const len = Math.hypot(direction.x, direction.y)
  if (len === 0) return []
  const dx = direction.x / len
  const dy = direction.y / len

  const hits: RaycastHit[] = []

  for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
    if (!opts.includeTriggers && aabb.isTrigger) continue
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue

    let hit: { tmin: number; nx: number; ny: number } | null = null

    if (isCircle) {
      hit = rayCircle(origin.x, origin.y, dx, dy, aabb.cx, aabb.cy, circleR, maxDistance)
    } else {
      hit = rayAABB(
        origin.x,
        origin.y,
        dx,
        dy,
        aabb.cx - aabb.hw,
        aabb.cx + aabb.hw,
        aabb.cy - aabb.hh,
        aabb.cy + aabb.hh,
        maxDistance,
      )
    }

    if (!hit) continue
    hits.push({
      entityId: id,
      distance: hit.tmin,
      point: { x: origin.x + dx * hit.tmin, y: origin.y + dy * hit.tmin },
      normal: { x: hit.nx, y: hit.ny },
    })
  }

  hits.sort((a, b) => a.distance - b.distance)
  return hits
}

// ── overlapCircle ─────────────────────────────────────────────────────────────

/**
 * Returns all entities whose collider overlaps the given circle.
 * Supports BoxCollider, CircleCollider, and CapsuleCollider.
 */
export function overlapCircle(
  world: ECSWorld,
  cx: number,
  cy: number,
  radius: number,
  opts: QueryOpts = {},
): EntityId[] {
  const results: EntityId[] = []
  for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue

    if (isCircle) {
      // Circle vs circle
      const dx = aabb.cx - cx
      const dy = aabb.cy - cy
      const totalR = radius + circleR
      if (dx * dx + dy * dy <= totalR * totalR) {
        results.push(id)
      }
    } else {
      // Circle vs AABB
      const nearX = Math.max(aabb.cx - aabb.hw, Math.min(cx, aabb.cx + aabb.hw))
      const nearY = Math.max(aabb.cy - aabb.hh, Math.min(cy, aabb.cy + aabb.hh))
      const dx = cx - nearX
      const dy = cy - nearY
      if (dx * dx + dy * dy <= radius * radius) {
        results.push(id)
      }
    }
  }
  return results
}

// ── sweepBox ──────────────────────────────────────────────────────────────────

/**
 * Sweeps a box of `(w × h)` from its center `(cx, cy)` by `(dx, dy)` and
 * returns the first hit, or `null`.
 * Tests against BoxCollider, CircleCollider, and CapsuleCollider.
 */
export function sweepBox(
  world: ECSWorld,
  cx: number,
  cy: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
  opts: RaycastOpts = {},
): RaycastHit | null {
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return null

  const hw = w / 2
  const hh = h / 2
  const dirX = dx / dist
  const dirY = dy / dist

  let closest: RaycastHit | null = null

  for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
    if (!opts.includeTriggers && aabb.isTrigger) continue
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue

    let hit: { tmin: number; nx: number; ny: number } | null = null

    if (isCircle) {
      // Sweep box vs circle: expand circle radius by box half-extents (approximate)
      const effectiveR = circleR + Math.max(hw, hh)
      hit = rayCircle(cx, cy, dirX, dirY, aabb.cx, aabb.cy, effectiveR, dist)
    } else {
      // Minkowski sum: expand target AABB by sweep box half-extents
      hit = rayAABB(
        cx,
        cy,
        dirX,
        dirY,
        aabb.cx - aabb.hw - hw,
        aabb.cx + aabb.hw + hw,
        aabb.cy - aabb.hh - hh,
        aabb.cy + aabb.hh + hh,
        dist,
      )
    }

    if (!hit) continue
    if (closest && hit.tmin >= closest.distance) continue

    closest = {
      entityId: id,
      distance: hit.tmin,
      point: { x: cx + dirX * hit.tmin, y: cy + dirY * hit.tmin },
      normal: { x: hit.nx, y: hit.ny },
    }
  }

  return closest
}

// ── projectPoint ──────────────────────────────────────────────────────────────

export interface PointProjection {
  /** The entity whose collider is nearest. */
  entityId: EntityId
  /** Distance from the query point to the nearest surface. */
  distance: number
  /** Projected point on the collider surface. */
  point: { x: number; y: number }
  /** Surface normal at the projected point. */
  normal: { x: number; y: number }
  /** Feature ID: 0-3 for box edges (top/right/bottom/left), -1 for circle. */
  featureId: number
}

/**
 * Find the nearest collider surface to a point.
 * Returns the closest projected point, distance, and surface normal.
 */
export function projectPoint(world: ECSWorld, px: number, py: number, opts: QueryOpts = {}): PointProjection | null {
  let closest: PointProjection | null = null

  for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue

    let dist: number
    let projX: number
    let projY: number
    let nx: number
    let ny: number
    let featureId: number

    if (isCircle) {
      const dx = px - aabb.cx
      const dy = py - aabb.cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 0.0001) {
        projX = aabb.cx + circleR
        projY = aabb.cy
        nx = 1
        ny = 0
      } else {
        nx = dx / d
        ny = dy / d
        projX = aabb.cx + nx * circleR
        projY = aabb.cy + ny * circleR
      }
      dist = Math.abs(d - circleR)
      featureId = -1
    } else {
      const left = aabb.cx - aabb.hw
      const right = aabb.cx + aabb.hw
      const top = aabb.cy - aabb.hh
      const bottom = aabb.cy + aabb.hh
      const clampX = Math.max(left, Math.min(px, right))
      const clampY = Math.max(top, Math.min(py, bottom))
      const inside = px >= left && px <= right && py >= top && py <= bottom

      if (inside) {
        const dLeft = px - left
        const dRight = right - px
        const dTop = py - top
        const dBottom = bottom - py
        const minD = Math.min(dLeft, dRight, dTop, dBottom)
        if (minD === dTop) {
          projX = px
          projY = top
          nx = 0
          ny = -1
          featureId = 0
        } else if (minD === dRight) {
          projX = right
          projY = py
          nx = 1
          ny = 0
          featureId = 1
        } else if (minD === dBottom) {
          projX = px
          projY = bottom
          nx = 0
          ny = 1
          featureId = 2
        } else {
          projX = left
          projY = py
          nx = -1
          ny = 0
          featureId = 3
        }
        dist = minD
      } else {
        projX = clampX
        projY = clampY
        const ddx = px - clampX
        const ddy = py - clampY
        dist = Math.sqrt(ddx * ddx + ddy * ddy)
        if (dist > 0) {
          nx = ddx / dist
          ny = ddy / dist
        } else {
          nx = 0
          ny = -1
        }
        if (clampY === top) featureId = 0
        else if (clampX === right) featureId = 1
        else if (clampY === bottom) featureId = 2
        else featureId = 3
      }
    }

    if (!closest || dist < closest.distance) {
      closest = { entityId: id, distance: dist, point: { x: projX, y: projY }, normal: { x: nx, y: ny }, featureId }
    }
  }

  return closest
}

// ── containsPoint ─────────────────────────────────────────────────────────────

/**
 * Return all entities whose collider contains the given point.
 */
export function containsPoint(world: ECSWorld, px: number, py: number, opts: QueryOpts = {}): EntityId[] {
  const results: EntityId[] = []
  for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue
    if (isCircle) {
      const dx = px - aabb.cx
      const dy = py - aabb.cy
      if (dx * dx + dy * dy <= circleR * circleR) results.push(id)
    } else {
      if (px >= aabb.cx - aabb.hw && px <= aabb.cx + aabb.hw && py >= aabb.cy - aabb.hh && py <= aabb.cy + aabb.hh) {
        results.push(id)
      }
    }
  }
  return results
}

// ── shapeCast ─────────────────────────────────────────────────────────────────

export type QueryShape = { type: 'circle'; radius: number } | { type: 'box'; halfWidth: number; halfHeight: number }

/**
 * Sweep a shape along a direction and return the first hit.
 */
export function shapeCast(
  world: ECSWorld,
  shape: QueryShape,
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  maxDist: number,
  opts: RaycastOpts = {},
): RaycastHit | null {
  if (shape.type === 'circle') {
    const len = Math.hypot(dirX, dirY)
    if (len === 0) return null
    const ndx = dirX / len
    const ndy = dirY / len

    let best: RaycastHit | null = null
    for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
      if (!opts.includeTriggers && aabb.isTrigger) continue
      if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue

      let hit: { tmin: number; nx: number; ny: number } | null = null
      if (isCircle) {
        hit = rayCircle(originX, originY, ndx, ndy, aabb.cx, aabb.cy, circleR + shape.radius, maxDist)
      } else {
        hit = rayAABB(
          originX,
          originY,
          ndx,
          ndy,
          aabb.cx - aabb.hw - shape.radius,
          aabb.cx + aabb.hw + shape.radius,
          aabb.cy - aabb.hh - shape.radius,
          aabb.cy + aabb.hh + shape.radius,
          maxDist,
        )
      }
      if (!hit) continue
      if (best && hit.tmin >= best.distance) continue
      best = {
        entityId: id,
        distance: hit.tmin,
        point: { x: originX + ndx * hit.tmin, y: originY + ndy * hit.tmin },
        normal: { x: hit.nx, y: hit.ny },
      }
    }
    return best
  } else {
    // sweepBox expects total displacement (dx, dy), not direction + maxDist
    return sweepBox(
      world,
      originX,
      originY,
      shape.halfWidth * 2,
      shape.halfHeight * 2,
      dirX * maxDist,
      dirY * maxDist,
      opts,
    )
  }
}

// ── intersectShape ────────────────────────────────────────────────────────────

/**
 * Return all entities overlapping a given shape at a position.
 */
export function intersectShape(
  world: ECSWorld,
  shape: QueryShape,
  posX: number,
  posY: number,
  opts: QueryOpts = {},
): EntityId[] {
  if (shape.type === 'circle') {
    return overlapCircle(world, posX, posY, shape.radius, opts)
  } else {
    return overlapBox(world, posX, posY, shape.halfWidth, shape.halfHeight, opts)
  }
}

// ── intersectAABB ─────────────────────────────────────────────────────────────

/**
 * Return all entities whose collider AABBs overlap a given AABB.
 * Conservative broad-phase query.
 */
export function intersectAABB(
  world: ECSWorld,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  opts: QueryOpts = {},
): EntityId[] {
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const hw = (maxX - minX) / 2
  const hh = (maxY - minY) / 2

  const results: EntityId[] = []
  for (const { id, aabb } of allColliderAABBs(world)) {
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue
    if (Math.abs(aabb.cx - cx) < hw + aabb.hw && Math.abs(aabb.cy - cy) < hh + aabb.hh) {
      results.push(id)
    }
  }
  return results
}

// ── intersectRay ──────────────────────────────────────────────────────────────

/**
 * Enumerate all colliders hit by a ray via callback (unordered).
 */
export function intersectRay(
  world: ECSWorld,
  origin: { x: number; y: number },
  direction: { x: number; y: number },
  maxDistance: number,
  callback: (hit: RaycastHit) => void,
  opts: RaycastOpts = {},
): void {
  const len = Math.hypot(direction.x, direction.y)
  if (len === 0) return
  const dx = direction.x / len
  const dy = direction.y / len

  for (const { id, aabb, isCircle, circleR } of allColliderAABBs(world)) {
    if (!opts.includeTriggers && aabb.isTrigger) continue
    if (!passesTagAndExclude(world, id, aabb.layer, opts)) continue

    let hit: { tmin: number; nx: number; ny: number } | null = null
    if (isCircle) {
      hit = rayCircle(origin.x, origin.y, dx, dy, aabb.cx, aabb.cy, circleR, maxDistance)
    } else {
      hit = rayAABB(
        origin.x,
        origin.y,
        dx,
        dy,
        aabb.cx - aabb.hw,
        aabb.cx + aabb.hw,
        aabb.cy - aabb.hh,
        aabb.cy + aabb.hh,
        maxDistance,
      )
    }
    if (!hit) continue
    callback({
      entityId: id,
      distance: hit.tmin,
      point: { x: origin.x + dx * hit.tmin, y: origin.y + dy * hit.tmin },
      normal: { x: hit.nx, y: hit.ny },
    })
  }
}
