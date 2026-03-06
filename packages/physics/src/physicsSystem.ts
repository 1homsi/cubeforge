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

export class PhysicsSystem implements System {
  constructor(
    private gravity: number,
    private readonly events?: EventBus,
  ) {}

  setGravity(g: number): void { this.gravity = g }

  update(world: ECSWorld, dt: number): void {
    const all = world.query('Transform', 'RigidBody', 'BoxCollider')
    const dynamics: EntityId[] = []
    const statics: EntityId[] = []

    for (const id of all) {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      if (rb.isStatic) statics.push(id)
      else dynamics.push(id)
    }

    // Phase 1: gravity + reset onGround
    for (const id of dynamics) {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      rb.onGround = false
      rb.vy += this.gravity * rb.gravityScale * dt
    }

    // Phase 2 & 3: move X then resolve X
    for (const id of dynamics) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!

      transform.x += rb.vx * dt

      if (!col.isTrigger) {
        for (const sid of statics) {
          const st = world.getComponent<TransformComponent>(sid, 'Transform')!
          const sc = world.getComponent<BoxColliderComponent>(sid, 'BoxCollider')!
          if (sc.isTrigger) continue

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

    // Phase 4 & 5: move Y then resolve Y
    for (const id of dynamics) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!

      transform.y += rb.vy * dt

      if (!col.isTrigger) {
        for (const sid of statics) {
          const st = world.getComponent<TransformComponent>(sid, 'Transform')!
          const sc = world.getComponent<BoxColliderComponent>(sid, 'BoxCollider')!
          if (sc.isTrigger) continue

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

    // Phase 6: dynamic vs dynamic (simple separation, no velocity exchange)
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
          // Fire trigger event
          this.events?.emit('trigger', { a: ia, b: ib })
          continue
        }

        // Push apart equally
        ta.x += ov.x / 2
        ta.y += ov.y / 2
        tb.x -= ov.x / 2
        tb.y -= ov.y / 2

        this.events?.emit('collision', { a: ia, b: ib })
      }
    }
  }
}
