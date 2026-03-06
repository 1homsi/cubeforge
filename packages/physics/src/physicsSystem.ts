import type { System, ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { EventBus } from '@cubeforge/core'
import type { RigidBodyComponent } from './components/rigidbody'
import type { BoxColliderComponent } from './components/boxCollider'

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

export class PhysicsSystem implements System {
  private accumulator = 0
  private readonly FIXED_DT = 1 / 60

  constructor(
    private gravity: number,
    private readonly events?: EventBus,
  ) {}

  setGravity(g: number): void { this.gravity = g }

  update(world: ECSWorld, dt: number): void {
    this.accumulator += dt
    // Cap accumulator to prevent spiral of death
    if (this.accumulator > 5 * this.FIXED_DT) {
      this.accumulator = 5 * this.FIXED_DT
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

    // Phase 1: gravity + reset ground flags
    for (const id of dynamics) {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      rb.onGround = false
      rb.isNearGround = false
      rb.vy += this.gravity * rb.gravityScale * dt
    }

    // Phase 2 & 3: move X then resolve X (broadphase via grid)
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
            // Skip slope colliders in X-pass — handled in Y-pass
            if (sc.slope !== 0) continue

            const ov = getOverlap(getAABB(transform, col), getAABB(st, sc))
            if (!ov) continue

            // Only correct on X axis if X overlap is smaller
            if (Math.abs(ov.x) < Math.abs(ov.y)) {
              transform.x += ov.x
              rb.vx = rb.bounce > 0 ? -rb.vx * rb.bounce : 0
            }
          }
        }
      }
    }

    // Phase 4 & 5: move Y then resolve Y (broadphase via grid)
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

            if (sc.slope !== 0) {
              // Slope collision: check AABB overlap first, then resolve along slope surface
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

            // Only correct on Y axis if Y overlap is smaller-or-equal
            if (Math.abs(ov.y) <= Math.abs(ov.x)) {
              transform.y += ov.y
              if (ov.y < 0) {
                // Pushed upward = landed on top of platform
                rb.onGround = true
                if (rb.friction < 1) rb.vx *= rb.friction
              }
              rb.vy = rb.bounce > 0 ? -rb.vy * rb.bounce : 0
            }
          }
        }
      }
    }

    // Phase 6: dynamic vs dynamic (separation + velocity transfer for stacking)
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

        if (ca.isTrigger || cb.isTrigger) {
          this.events?.emit('trigger', { a: ia, b: ib })
          continue
        }

        const rba = world.getComponent<RigidBodyComponent>(ia, 'RigidBody')!
        const rbb = world.getComponent<RigidBodyComponent>(ib, 'RigidBody')!

        if (Math.abs(ov.y) <= Math.abs(ov.x)) {
          // Vertical collision — body stacking: transfer weight from upper to lower body
          if (ov.y > 0) {
            // A is below B: B landed on A
            if (rbb.vy > 0) {
              rba.vy += rbb.vy * 0.3
              rbb.vy = 0
            }
            rbb.onGround = true
          } else {
            // A is above B: A landed on B
            if (rba.vy > 0) {
              rbb.vy += rba.vy * 0.3
              rba.vy = 0
            }
            rba.onGround = true
          }
        }

        // Push apart equally
        ta.x += ov.x / 2
        ta.y += ov.y / 2
        tb.x -= ov.x / 2
        tb.y -= ov.y / 2

        this.events?.emit('collision', { a: ia, b: ib })
      }
    }

    // Phase 7: near-ground detection (2px downward probe)
    for (const id of dynamics) {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      if (rb.onGround) {
        rb.isNearGround = true
        continue
      }
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!
      // Probe AABB shifted 2px downward
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
          const ov = getOverlap(probeAABB, getAABB(st, sc))
          if (ov && Math.abs(ov.y) <= Math.abs(ov.x) && ov.y < 0) {
            rb.isNearGround = true
            break outer
          }
        }
      }
    }
  }
}
