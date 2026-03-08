import type { System, ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { EventBus } from '@cubeforge/core'
import type { RigidBodyComponent } from './components/rigidbody'
import type { BoxColliderComponent } from './components/boxCollider'
import type { CircleColliderComponent } from './components/circleCollider'
import type { CompoundColliderComponent, ColliderShape } from './components/compoundCollider'

interface AABB {
  cx: number
  cy: number
  hw: number
  hh: number
}

function getAABB(
  transform: TransformComponent,
  collider: BoxColliderComponent,
): AABB {
  return {
    cx: transform.x + collider.offsetX,
    cy: transform.y + collider.offsetY,
    hw: collider.width / 2,
    hh: collider.height / 2,
  }
}

interface Overlap {
  x: number
  y: number
}

function getOverlap(a: AABB, b: AABB): Overlap | null {
  const dx = a.cx - b.cx
  const dy = a.cy - b.cy
  const ox = (a.hw + b.hw) - Math.abs(dx)
  const oy = (a.hh + b.hh) - Math.abs(dy)
  if (ox <= 0 || oy <= 0) return null
  return {
    x: dx >= 0 ? ox : -ox,
    y: dy >= 0 ? oy : -oy,
  }
}

/**
 * For a sloped collider, computes the surface Y at the given world X.
 * Returns null if worldX is outside the collider's horizontal extent.
 * slope is in degrees; positive = surface rises left→right.
 */
function getSlopeSurfaceY(
  st: TransformComponent,
  sc: BoxColliderComponent,
  worldX: number,
): number | null {
  const hw = sc.width / 2
  const hh = sc.height / 2
  const cx = st.x + sc.offsetX
  const cy = st.y + sc.offsetY
  const left = cx - hw
  const right = cx + hw
  if (worldX < left || worldX > right) return null
  const dx = worldX - left
  const angleRad = sc.slope * (Math.PI / 180)
  return (cy - hh) + dx * Math.tan(angleRad)
}

// ── Layer / mask filtering ────────────────────────────────────────────────────

function maskAllows(mask: string | string[], layer: string): boolean {
  if (mask === '*') return true
  if (Array.isArray(mask)) return mask.includes(layer)
  return mask === layer
}

/**
 * Returns true if collider A and B are allowed to interact.
 * Both sides must permit the other's layer (AND semantics).
 * The default mask '*' always permits, so entities without an explicit mask
 * never filter anything — backward compatible.
 */
function canInteract(a: BoxColliderComponent, b: BoxColliderComponent): boolean {
  return maskAllows(a.mask, b.layer) && maskAllows(b.mask, a.layer)
}

// ── Compound collider helpers ──────────────────────────────────────────────────

/** Compute the AABB for a single shape relative to the entity's transform. */
function shapeToAABB(tx: number, ty: number, shape: ColliderShape): AABB {
  if (shape.type === 'box') {
    return {
      cx: tx + shape.offsetX,
      cy: ty + shape.offsetY,
      hw: (shape.width ?? 0) / 2,
      hh: (shape.height ?? 0) / 2,
    }
  }
  // circle → bounding AABB
  const r = shape.radius ?? 0
  return {
    cx: tx + shape.offsetX,
    cy: ty + shape.offsetY,
    hw: r,
    hh: r,
  }
}

/**
 * Check if a compound collider shape overlaps with an AABB.
 * For box shapes this is AABB-AABB; for circle shapes it's circle-AABB.
 */
function shapeOverlapsAABB(
  tx: number,
  ty: number,
  shape: ColliderShape,
  other: AABB,
): Overlap | null {
  if (shape.type === 'box') {
    return getOverlap(shapeToAABB(tx, ty, shape), other)
  }
  // Circle vs AABB
  const r = shape.radius ?? 0
  const cx = tx + shape.offsetX
  const cy = ty + shape.offsetY
  const nearX = Math.max(other.cx - other.hw, Math.min(cx, other.cx + other.hw))
  const nearY = Math.max(other.cy - other.hh, Math.min(cy, other.cy + other.hh))
  const dx = cx - nearX
  const dy = cy - nearY
  if (dx * dx + dy * dy >= r * r) return null
  // Approximate an overlap vector using the AABB of the circle
  return getOverlap(shapeToAABB(tx, ty, shape), other)
}

/**
 * Check if a compound shape overlaps with a circle collider.
 */
function shapeOverlapsCircle(
  tx: number,
  ty: number,
  shape: ColliderShape,
  cx: number,
  cy: number,
  cr: number,
): boolean {
  if (shape.type === 'circle') {
    const r = shape.radius ?? 0
    const dx = (tx + shape.offsetX) - cx
    const dy = (ty + shape.offsetY) - cy
    return dx * dx + dy * dy < (r + cr) * (r + cr)
  }
  // Box shape vs circle
  const aabb = shapeToAABB(tx, ty, shape)
  const nearX = Math.max(aabb.cx - aabb.hw, Math.min(cx, aabb.cx + aabb.hw))
  const nearY = Math.max(aabb.cy - aabb.hh, Math.min(cy, aabb.cy + aabb.hh))
  const dx = cx - nearX
  const dy = cy - nearY
  return dx * dx + dy * dy < cr * cr
}

/** Compute the overall bounding AABB of a compound collider. */
function getCompoundBounds(
  tx: number,
  ty: number,
  shapes: ColliderShape[],
): AABB {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of shapes) {
    const a = shapeToAABB(tx, ty, s)
    const l = a.cx - a.hw
    const r = a.cx + a.hw
    const t = a.cy - a.hh
    const b = a.cy + a.hh
    if (l < minX) minX = l
    if (r > maxX) maxX = r
    if (t < minY) minY = t
    if (b > maxY) maxY = b
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    hw: (maxX - minX) / 2,
    hh: (maxY - minY) / 2,
  }
}

function canInteractGeneric(
  aLayer: string,
  aMask: string | string[],
  bLayer: string,
  bMask: string | string[],
): boolean {
  return maskAllows(aMask, bLayer) && maskAllows(bMask, aLayer)
}

// ── Contact pair tracking ─────────────────────────────────────────────────────

/** Stable key for an unordered entity pair. */
function pairKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

export class PhysicsSystem implements System {
  private accumulator = 0
  private readonly FIXED_DT = 1 / 60
  /** Maximum accumulated time (seconds). Prevents hundreds of sub-steps when
   *  the tab is backgrounded and dt spikes on resume. 0.1s ≈ 6 steps at 60Hz. */
  private readonly MAX_ACCUMULATOR = 0.1

  // Active contact sets — updated each physics step.
  private activeTriggerPairs    = new Map<string, [EntityId, EntityId]>()
  private activeCollisionPairs  = new Map<string, [EntityId, EntityId]>()
  private activeCirclePairs     = new Map<string, [EntityId, EntityId]>()
  private activeCompoundPairs   = new Map<string, [EntityId, EntityId]>()

  // Previous-frame positions of static entities — used to compute platform carry delta.
  private staticPrevPos = new Map<EntityId, { x: number; y: number }>()

  constructor(
    private gravity: number,
    private readonly events?: EventBus,
  ) {}

  setGravity(g: number): void { this.gravity = g }

  update(world: ECSWorld, dt: number): void {
    this.accumulator += dt
    // Cap accumulator to prevent freeze after tab-background (large dt spike)
    if (this.accumulator > this.MAX_ACCUMULATOR) {
      this.accumulator = this.MAX_ACCUMULATOR
    }
    while (this.accumulator >= this.FIXED_DT) {
      this.step(world, this.FIXED_DT)
      this.accumulator -= this.FIXED_DT
    }
  }

  private getCells(cx: number, cy: number, hw: number, hh: number): string[] {
    const CELL = 128
    const x0 = Math.floor((cx - hw) / CELL)
    const x1 = Math.floor((cx + hw) / CELL)
    const y0 = Math.floor((cy - hh) / CELL)
    const y1 = Math.floor((cy + hh) / CELL)
    const cells: string[] = []
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        cells.push(`${x},${y}`)
    return cells
  }

  private step(world: ECSWorld, dt: number): void {
    const all = world.query('Transform', 'RigidBody', 'BoxCollider')
    const dynamics: EntityId[] = []
    const statics: EntityId[] = []

    for (const id of all) {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      if (rb.isStatic) statics.push(id)
      else dynamics.push(id)
    }

    // ── Prune dead-entity pairs and emit exit events ─────────────────────────
    for (const [key, [a, b]] of this.activeTriggerPairs) {
      if (!world.hasEntity(a) || !world.hasEntity(b)) {
        this.events?.emit('triggerExit', { a, b })
        this.activeTriggerPairs.delete(key)
      }
    }
    for (const [key, [a, b]] of this.activeCollisionPairs) {
      if (!world.hasEntity(a) || !world.hasEntity(b)) {
        this.events?.emit('collisionExit', { a, b })
        this.activeCollisionPairs.delete(key)
      }
    }
    // Circle pairs must be pruned here unconditionally — the circle phase below
    // is skipped entirely when allCircles.length === 0, which would leave stale
    // pairs stuck forever with no exit event.
    for (const [key, [a, b]] of this.activeCirclePairs) {
      if (!world.hasEntity(a) || !world.hasEntity(b)) {
        this.events?.emit('circleExit', { a, b })
        this.activeCirclePairs.delete(key)
      }
    }
    for (const [key, [a, b]] of this.activeCompoundPairs) {
      if (!world.hasEntity(a) || !world.hasEntity(b)) {
        this.events?.emit('compoundExit', { a, b })
        this.activeCompoundPairs.delete(key)
      }
    }

    // Compute platform carry deltas (how much each static moved since last step)
    const staticDelta = new Map<EntityId, { dx: number; dy: number }>()
    for (const sid of statics) {
      const st = world.getComponent<TransformComponent>(sid, 'Transform')!
      const prev = this.staticPrevPos.get(sid)
      if (prev) staticDelta.set(sid, { dx: st.x - prev.x, dy: st.y - prev.y })
      this.staticPrevPos.set(sid, { x: st.x, y: st.y })
    }
    // Clean up entries for entities that no longer exist
    for (const sid of this.staticPrevPos.keys()) {
      if (!world.hasEntity(sid)) this.staticPrevPos.delete(sid)
    }

    // Build spatial grid for static entities
    const staticGrid = new Map<string, EntityId[]>()
    for (const sid of statics) {
      const st = world.getComponent<TransformComponent>(sid, 'Transform')!
      const sc = world.getComponent<BoxColliderComponent>(sid, 'BoxCollider')!
      const aabb = getAABB(st, sc)
      for (const cell of this.getCells(aabb.cx, aabb.cy, aabb.hw, aabb.hh)) {
        let bucket = staticGrid.get(cell)
        if (!bucket) { bucket = []; staticGrid.set(cell, bucket) }
        bucket.push(sid)
      }
    }

    // Phase 1: gravity + reset ground flags + axis locks
    for (const id of dynamics) {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      rb.onGround = false
      rb.isNearGround = false
      // Kinematic bodies skip gravity and velocity integration
      if (rb.isKinematic) continue
      if (!rb.lockY) rb.vy += this.gravity * rb.gravityScale * dt
      if (rb.lockX) rb.vx = 0
      if (rb.lockY) rb.vy = 0
      // Decrement drop-through counter
      if (rb.dropThrough > 0) rb.dropThrough--
    }

    // Phase 2 & 3: move X then resolve X
    for (const id of dynamics) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!

      transform.x += rb.vx * dt

      if (!col.isTrigger) {
        const dynAABB = getAABB(transform, col)
        const candidateCells = this.getCells(dynAABB.cx, dynAABB.cy, dynAABB.hw, dynAABB.hh)
        const checked = new Set<EntityId>()
        for (const cell of candidateCells) {
          const bucket = staticGrid.get(cell)
          if (!bucket) continue
          for (const sid of bucket) {
            if (checked.has(sid)) continue
            checked.add(sid)
            const st = world.getComponent<TransformComponent>(sid, 'Transform')!
            const sc = world.getComponent<BoxColliderComponent>(sid, 'BoxCollider')!
            if (sc.isTrigger) continue
            if (sc.slope !== 0) continue
            if (!canInteract(col, sc)) continue

            const ov = getOverlap(getAABB(transform, col), getAABB(st, sc))
            if (!ov) continue

            if (Math.abs(ov.x) < Math.abs(ov.y)) {
              transform.x += ov.x
              rb.vx = rb.bounce > 0 ? -rb.vx * rb.bounce : 0
            }
          }
        }
      }
    }

    // Phase 4 & 5: move Y then resolve Y
    for (const id of dynamics) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!

      transform.y += rb.vy * dt

      if (!col.isTrigger) {
        const dynAABB = getAABB(transform, col)
        const candidateCells = this.getCells(dynAABB.cx, dynAABB.cy, dynAABB.hw, dynAABB.hh)
        const checked = new Set<EntityId>()
        for (const cell of candidateCells) {
          const bucket = staticGrid.get(cell)
          if (!bucket) continue
          for (const sid of bucket) {
            if (checked.has(sid)) continue
            checked.add(sid)
            const st = world.getComponent<TransformComponent>(sid, 'Transform')!
            const sc = world.getComponent<BoxColliderComponent>(sid, 'BoxCollider')!
            if (sc.isTrigger) continue
            if (!canInteract(col, sc)) continue

            if (sc.slope !== 0) {
              const ov = getOverlap(getAABB(transform, col), getAABB(st, sc))
              if (!ov) continue
              const entityBottom = transform.y + col.offsetY + col.height / 2
              const entityCenterX = transform.x + col.offsetX
              const surfaceY = getSlopeSurfaceY(st, sc, entityCenterX)
              if (surfaceY !== null && entityBottom > surfaceY) {
                transform.y -= (entityBottom - surfaceY)
                rb.onGround = true
                if (rb.friction < 1) rb.vx *= rb.friction
                rb.vy = rb.bounce > 0 ? -rb.vy * rb.bounce : 0
              }
              continue
            }

            const ov = getOverlap(getAABB(transform, col), getAABB(st, sc))
            if (!ov) continue

            if (Math.abs(ov.y) <= Math.abs(ov.x)) {
              // One-way platform: only block entities that were above the surface
              // (falling down onto it). Entities below pass through freely.
              if (sc.oneWay) {
                // Drop-through: entity requested to pass through for N frames
                if (rb.dropThrough > 0) continue
                if (ov.y >= 0) continue // resolution would push entity down — skip
                // Was entity's bottom above the platform's top BEFORE this Y step?
                const platformTop = st.y + sc.offsetY - sc.height / 2
                const prevEntityBottom = (transform.y - rb.vy * dt) + col.offsetY + col.height / 2
                if (prevEntityBottom > platformTop) continue // was below — skip
              }

              transform.y += ov.y
              if (ov.y < 0) {
                rb.onGround = true
                if (rb.friction < 1) rb.vx *= rb.friction
                // Platform carry: inherit the platform's horizontal (and vertical) movement
                const delta = staticDelta.get(sid)
                if (delta) {
                  transform.x += delta.dx
                  // Carry upward platform movement, but don't add downward (gravity handles that)
                  if (delta.dy < 0) transform.y += delta.dy
                }
              }
              rb.vy = rb.bounce > 0 ? -rb.vy * rb.bounce : 0
            }
          }
        }
      }
    }

    // Phase 6: dynamic vs dynamic — separation + collision events
    const currentCollisionPairs = new Map<string, [EntityId, EntityId]>()

    for (let i = 0; i < dynamics.length; i++) {
      for (let j = i + 1; j < dynamics.length; j++) {
        const ia = dynamics[i]
        const ib = dynamics[j]
        const ta = world.getComponent<TransformComponent>(ia, 'Transform')!
        const tb = world.getComponent<TransformComponent>(ib, 'Transform')!
        const ca = world.getComponent<BoxColliderComponent>(ia, 'BoxCollider')!
        const cb = world.getComponent<BoxColliderComponent>(ib, 'BoxCollider')!

        const ov = getOverlap(getAABB(ta, ca), getAABB(tb, cb))
        if (!ov) continue

        if (!canInteract(ca, cb)) continue

        if (ca.isTrigger || cb.isTrigger) continue // handled in trigger pass

        const rba = world.getComponent<RigidBodyComponent>(ia, 'RigidBody')!
        const rbb = world.getComponent<RigidBodyComponent>(ib, 'RigidBody')!

        if (Math.abs(ov.y) <= Math.abs(ov.x)) {
          if (ov.y > 0) {
            if (rbb.vy > 0) { rba.vy += rbb.vy * 0.3; rbb.vy = 0 }
            rbb.onGround = true
          } else {
            if (rba.vy > 0) { rbb.vy += rba.vy * 0.3; rba.vy = 0 }
            rba.onGround = true
          }
        }

        ta.x += ov.x / 2
        ta.y += ov.y / 2
        tb.x -= ov.x / 2
        tb.y -= ov.y / 2

        const key = pairKey(ia, ib)
        currentCollisionPairs.set(key, [ia, ib])
      }
    }

    // Emit collisionEnter / collision / collisionStay / collisionExit
    for (const [key, [a, b]] of currentCollisionPairs) {
      if (!this.activeCollisionPairs.has(key)) {
        this.events?.emit('collisionEnter', { a, b })
      } else {
        this.events?.emit('collisionStay', { a, b })
      }
      this.events?.emit('collision', { a, b })
    }
    for (const [key, [a, b]] of this.activeCollisionPairs) {
      if (!currentCollisionPairs.has(key)) {
        this.events?.emit('collisionExit', { a, b })
      }
    }
    this.activeCollisionPairs = currentCollisionPairs

    // Phase 7: near-ground detection (2px downward probe)
    for (const id of dynamics) {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      if (rb.onGround) { rb.isNearGround = true; continue }
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!
      const probeAABB: AABB = {
        cx: transform.x + col.offsetX,
        cy: transform.y + col.offsetY + 2,
        hw: col.width / 2,
        hh: col.height / 2,
      }
      const candidateCells = this.getCells(probeAABB.cx, probeAABB.cy, probeAABB.hw, probeAABB.hh)
      const checked = new Set<EntityId>()
      outer: for (const cell of candidateCells) {
        const bucket = staticGrid.get(cell)
        if (!bucket) continue
        for (const sid of bucket) {
          if (checked.has(sid)) continue
          checked.add(sid)
          const st = world.getComponent<TransformComponent>(sid, 'Transform')!
          const sc = world.getComponent<BoxColliderComponent>(sid, 'BoxCollider')!
          if (sc.isTrigger) continue
          if (!canInteract(col, sc)) continue
          const ov = getOverlap(probeAABB, getAABB(st, sc))
          if (ov && Math.abs(ov.y) <= Math.abs(ov.x) && ov.y < 0) {
            rb.isNearGround = true
            break outer
          }
        }
      }
    }

    // Phase 8: trigger detection — ALL entities with BoxCollider, at least one isTrigger.
    // This correctly handles static trigger zones (e.g. Checkpoint) that dynamics walk into.
    const allWithCollider = world.query('Transform', 'BoxCollider')
    const currentTriggerPairs = new Map<string, [EntityId, EntityId]>()

    for (let i = 0; i < allWithCollider.length; i++) {
      for (let j = i + 1; j < allWithCollider.length; j++) {
        const ia = allWithCollider[i]
        const ib = allWithCollider[j]
        const ca = world.getComponent<BoxColliderComponent>(ia, 'BoxCollider')!
        const cb = world.getComponent<BoxColliderComponent>(ib, 'BoxCollider')!

        // At least one must be a trigger
        if (!ca.isTrigger && !cb.isTrigger) continue
        if (!canInteract(ca, cb)) continue

        const ta = world.getComponent<TransformComponent>(ia, 'Transform')!
        const tb = world.getComponent<TransformComponent>(ib, 'Transform')!
        const ov = getOverlap(getAABB(ta, ca), getAABB(tb, cb))
        if (!ov) continue

        const key = pairKey(ia, ib)
        currentTriggerPairs.set(key, [ia, ib])
      }
    }

    // Emit triggerEnter / trigger / triggerStay / triggerExit
    for (const [key, [a, b]] of currentTriggerPairs) {
      if (!this.activeTriggerPairs.has(key)) {
        this.events?.emit('triggerEnter', { a, b })
      } else {
        this.events?.emit('triggerStay', { a, b })
      }
      this.events?.emit('trigger', { a, b })
    }
    for (const [key, [a, b]] of this.activeTriggerPairs) {
      if (!currentTriggerPairs.has(key)) {
        this.events?.emit('triggerExit', { a, b })
      }
    }
    this.activeTriggerPairs = currentTriggerPairs

    // Phase 9: CircleCollider contacts (circle-circle and circle-AABB overlap)
    // Physics resolution is manual (scripts handle response); this phase only emits events.
    const allCircles = world.query('Transform', 'CircleCollider')
    if (allCircles.length > 0) {
      const currentCirclePairs = new Map<string, [EntityId, EntityId]>()

      // Circle-circle
      for (let i = 0; i < allCircles.length; i++) {
        for (let j = i + 1; j < allCircles.length; j++) {
          const ia = allCircles[i]
          const ib = allCircles[j]
          const ca = world.getComponent<CircleColliderComponent>(ia, 'CircleCollider')!
          const cb = world.getComponent<CircleColliderComponent>(ib, 'CircleCollider')!
          if (!maskAllows(ca.mask, cb.layer) || !maskAllows(cb.mask, ca.layer)) continue
          const ta = world.getComponent<TransformComponent>(ia, 'Transform')!
          const tb = world.getComponent<TransformComponent>(ib, 'Transform')!
          const dx = (ta.x + ca.offsetX) - (tb.x + cb.offsetX)
          const dy = (ta.y + ca.offsetY) - (tb.y + cb.offsetY)
          if (dx * dx + dy * dy < (ca.radius + cb.radius) ** 2) {
            currentCirclePairs.set(pairKey(ia, ib), [ia, ib])
          }
        }
      }

      // Circle-AABB (circle triggers overlapping with BoxCollider entities, and vice versa)
      const allBoxes = world.query('Transform', 'BoxCollider')
      for (const cid of allCircles) {
        const cc = world.getComponent<CircleColliderComponent>(cid, 'CircleCollider')!
        const ct = world.getComponent<TransformComponent>(cid, 'Transform')!
        const cx = ct.x + cc.offsetX
        const cy = ct.y + cc.offsetY
        for (const bid of allBoxes) {
          if (bid === cid) continue
          const bc = world.getComponent<BoxColliderComponent>(bid, 'BoxCollider')!
          if (!maskAllows(cc.mask, bc.layer) || !maskAllows(bc.mask, cc.layer)) continue
          const bt = world.getComponent<TransformComponent>(bid, 'Transform')!
          const bx = bt.x + bc.offsetX
          const by = bt.y + bc.offsetY
          // Nearest point on box to circle center
          const nearX = Math.max(bx - bc.width / 2, Math.min(cx, bx + bc.width / 2))
          const nearY = Math.max(by - bc.height / 2, Math.min(cy, by + bc.height / 2))
          const dx = cx - nearX
          const dy = cy - nearY
          if (dx * dx + dy * dy < cc.radius * cc.radius) {
            currentCirclePairs.set(pairKey(cid, bid), [cid, bid])
          }
        }
      }

      // Emit circleEnter / circle / circleStay / circleExit
      for (const [key, [a, b]] of currentCirclePairs) {
        if (!this.activeCirclePairs.has(key)) {
          this.events?.emit('circleEnter', { a, b })
        } else {
          this.events?.emit('circleStay', { a, b })
        }
        this.events?.emit('circle', { a, b })
      }
      for (const [key, [a, b]] of this.activeCirclePairs) {
        if (!currentCirclePairs.has(key)) {
          this.events?.emit('circleExit', { a, b })
        }
      }
      this.activeCirclePairs = currentCirclePairs
    } else if (this.activeCirclePairs.size > 0) {
      // No circle entities remain — emit exits for all still-active pairs and clear.
      for (const [, [a, b]] of this.activeCirclePairs) {
        this.events?.emit('circleExit', { a, b })
      }
      this.activeCirclePairs = new Map()
    }

    // Phase 10: CompoundCollider contacts
    // Compound colliders emit contact events but do NOT physically resolve
    // (same approach as CircleCollider — scripts handle response).
    const allCompound = world.query('Transform', 'CompoundCollider')
    if (allCompound.length > 0) {
      const currentCompoundPairs = new Map<string, [EntityId, EntityId]>()

      // Compound vs BoxCollider
      const allBoxEntities = world.query('Transform', 'BoxCollider')
      for (const cid of allCompound) {
        const cc = world.getComponent<CompoundColliderComponent>(cid, 'CompoundCollider')!
        const ct = world.getComponent<TransformComponent>(cid, 'Transform')!
        for (const bid of allBoxEntities) {
          if (bid === cid) continue
          const bc = world.getComponent<BoxColliderComponent>(bid, 'BoxCollider')!
          if (!canInteractGeneric(cc.layer, cc.mask, bc.layer, bc.mask)) continue
          const bt = world.getComponent<TransformComponent>(bid, 'Transform')!
          const boxAABB = getAABB(bt, bc)
          let hit = false
          for (const shape of cc.shapes) {
            if (shapeOverlapsAABB(ct.x, ct.y, shape, boxAABB)) {
              hit = true
              break
            }
          }
          if (hit) currentCompoundPairs.set(pairKey(cid, bid), [cid, bid])
        }
      }

      // Compound vs CircleCollider
      for (const cid of allCompound) {
        const cc = world.getComponent<CompoundColliderComponent>(cid, 'CompoundCollider')!
        const ct = world.getComponent<TransformComponent>(cid, 'Transform')!
        for (const oid of allCircles) {
          if (oid === cid) continue
          const oc = world.getComponent<CircleColliderComponent>(oid, 'CircleCollider')!
          if (!canInteractGeneric(cc.layer, cc.mask, oc.layer, oc.mask)) continue
          const ot = world.getComponent<TransformComponent>(oid, 'Transform')!
          let hit = false
          for (const shape of cc.shapes) {
            if (shapeOverlapsCircle(ct.x, ct.y, shape, ot.x + oc.offsetX, ot.y + oc.offsetY, oc.radius)) {
              hit = true
              break
            }
          }
          if (hit) currentCompoundPairs.set(pairKey(cid, oid), [cid, oid])
        }
      }

      // Compound vs Compound
      for (let i = 0; i < allCompound.length; i++) {
        for (let j = i + 1; j < allCompound.length; j++) {
          const ia = allCompound[i]
          const ib = allCompound[j]
          const ca = world.getComponent<CompoundColliderComponent>(ia, 'CompoundCollider')!
          const cb = world.getComponent<CompoundColliderComponent>(ib, 'CompoundCollider')!
          if (!canInteractGeneric(ca.layer, ca.mask, cb.layer, cb.mask)) continue
          const ta = world.getComponent<TransformComponent>(ia, 'Transform')!
          const tb = world.getComponent<TransformComponent>(ib, 'Transform')!

          // Quick broad-phase: overall bounding AABBs
          const boundsA = getCompoundBounds(ta.x, ta.y, ca.shapes)
          const boundsB = getCompoundBounds(tb.x, tb.y, cb.shapes)
          if (!getOverlap(boundsA, boundsB)) continue

          // Narrow phase: any shape in A overlaps any shape in B
          let hit = false
          outer2: for (const sa of ca.shapes) {
            const aabb = shapeToAABB(ta.x, ta.y, sa)
            for (const sb of cb.shapes) {
              if (sb.type === 'circle') {
                const r = sb.radius ?? 0
                if (shapeOverlapsCircle(ta.x, ta.y, sa, tb.x + sb.offsetX, tb.y + sb.offsetY, r)) {
                  hit = true
                  break outer2
                }
              } else {
                const bAABB = shapeToAABB(tb.x, tb.y, sb)
                if (getOverlap(aabb, bAABB)) {
                  hit = true
                  break outer2
                }
              }
            }
          }
          if (hit) currentCompoundPairs.set(pairKey(ia, ib), [ia, ib])
        }
      }

      // Emit compoundEnter / compound / compoundStay / compoundExit
      for (const [key, [a, b]] of currentCompoundPairs) {
        if (!this.activeCompoundPairs.has(key)) {
          this.events?.emit('compoundEnter', { a, b })
        } else {
          this.events?.emit('compoundStay', { a, b })
        }
        this.events?.emit('compound', { a, b })
      }
      for (const [key, [a, b]] of this.activeCompoundPairs) {
        if (!currentCompoundPairs.has(key)) {
          this.events?.emit('compoundExit', { a, b })
        }
      }
      this.activeCompoundPairs = currentCompoundPairs
    } else if (this.activeCompoundPairs.size > 0) {
      for (const [, [a, b]] of this.activeCompoundPairs) {
        this.events?.emit('compoundExit', { a, b })
      }
      this.activeCompoundPairs = new Map()
    }
  }
}
