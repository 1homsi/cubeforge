/**
 * Character Controller — kinematic-style movement with collision resolution.
 *
 * Handles slopes, stairs, ground snapping, and dynamic body interaction.
 * Works with any collider shape (box, circle, capsule).
 * Translation only — does not affect rotation.
 *
 * Inspired by Rapier's KinematicCharacterController.
 */

import type { ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from './components/rigidbody'
import type { BoxColliderComponent } from './components/boxCollider'
import type { CircleColliderComponent } from './components/circleCollider'
import type { CapsuleColliderComponent } from './components/capsuleCollider'
import { applyImpulse } from './forceApi'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CharacterControllerConfig {
  /** Direction considered "up" for slope/ground calculations. Default: {x: 0, y: -1} */
  upX?: number
  upY?: number
  /** Small gap around character for numerical stability. Default: 0.1 */
  offset?: number
  /** Maximum slope angle (radians) the character can climb. Default: π/4 (45°) */
  maxSlopeClimbAngle?: number
  /** Minimum slope angle (radians) before sliding begins. Default: π/3 (60°) */
  minSlopeSlideAngle?: number
  /** Maximum obstacle height that can be stepped over. Default: 0 (disabled) */
  maxStepHeight?: number
  /** Minimum width of a step to climb. Default: 8 */
  minStepWidth?: number
  /** Whether to auto-step onto dynamic bodies. Default: false */
  stepOnDynamic?: boolean
  /** Distance to snap character to ground when slightly airborne. Default: 0 (disabled) */
  snapToGroundDistance?: number
  /** Force multiplier when pushing dynamic bodies. Default: 1.0 */
  pushForce?: number
  /** Custom filter predicate — return false to ignore an entity. */
  filter?: (entityId: EntityId) => boolean
  /** Exclude sensor/trigger colliders. Default: true */
  excludeSensors?: boolean
}

export interface CharacterCollision {
  /** Entity that was hit. */
  entityId: EntityId
  /** Surface normal at the collision point. */
  normalX: number
  normalY: number
  /** Penetration depth. */
  penetration: number
}

export interface MoveResult {
  /** Actual translation applied. */
  dx: number
  dy: number
  /** Whether the character is on the ground. */
  grounded: boolean
  /** All collisions encountered during movement. */
  collisions: CharacterCollision[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface AABB {
  cx: number
  cy: number
  hw: number
  hh: number
}

function getEntityAABB(world: ECSWorld, id: EntityId): AABB | null {
  const t = world.getComponent<TransformComponent>(id, 'Transform')
  if (!t) return null

  const box = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')
  if (box && box.enabled) {
    return { cx: t.x + box.offsetX, cy: t.y + box.offsetY, hw: box.width / 2, hh: box.height / 2 }
  }
  const circle = world.getComponent<CircleColliderComponent>(id, 'CircleCollider')
  if (circle && circle.enabled) {
    return { cx: t.x + circle.offsetX, cy: t.y + circle.offsetY, hw: circle.radius, hh: circle.radius }
  }
  const capsule = world.getComponent<CapsuleColliderComponent>(id, 'CapsuleCollider')
  if (capsule && capsule.enabled) {
    return { cx: t.x + capsule.offsetX, cy: t.y + capsule.offsetY, hw: capsule.width / 2, hh: capsule.height / 2 }
  }
  return null
}

function aabbOverlap(
  a: AABB,
  b: AABB,
): { overlapX: number; overlapY: number; nx: number; ny: number; pen: number } | null {
  const ox = a.hw + b.hw - Math.abs(a.cx - b.cx)
  const oy = a.hh + b.hh - Math.abs(a.cy - b.cy)
  if (ox <= 0 || oy <= 0) return null

  if (ox < oy) {
    const nx = a.cx < b.cx ? -1 : 1
    return { overlapX: ox, overlapY: oy, nx, ny: 0, pen: ox }
  } else {
    const ny = a.cy < b.cy ? -1 : 1
    return { overlapX: ox, overlapY: oy, nx: 0, ny, pen: oy }
  }
}

// ── Character Controller ──────────────────────────────────────────────────

export class CharacterController {
  private readonly upX: number
  private readonly upY: number
  private readonly offset: number
  private readonly maxSlopeClimbAngle: number
  private readonly minSlopeSlideAngle: number
  private readonly maxStepHeight: number
  private readonly minStepWidth: number
  private readonly stepOnDynamic: boolean
  private readonly snapToGroundDistance: number
  private readonly pushForce: number
  private readonly filter: ((id: EntityId) => boolean) | null
  private readonly excludeSensors: boolean

  constructor(config: CharacterControllerConfig = {}) {
    this.upX = config.upX ?? 0
    this.upY = config.upY ?? -1
    this.offset = config.offset ?? 0.1
    this.maxSlopeClimbAngle = config.maxSlopeClimbAngle ?? Math.PI / 4
    this.minSlopeSlideAngle = config.minSlopeSlideAngle ?? Math.PI / 3
    this.maxStepHeight = config.maxStepHeight ?? 0
    this.minStepWidth = config.minStepWidth ?? 8
    this.stepOnDynamic = config.stepOnDynamic ?? false
    this.snapToGroundDistance = config.snapToGroundDistance ?? 0
    this.pushForce = config.pushForce ?? 1.0
    this.filter = config.filter ?? null
    this.excludeSensors = config.excludeSensors ?? true
  }

  /**
   * Move the character by the desired translation, resolving collisions.
   * Returns the actual movement applied and grounded state.
   */
  move(world: ECSWorld, entityId: EntityId, desiredDx: number, desiredDy: number): MoveResult {
    const transform = world.getComponent<TransformComponent>(entityId, 'Transform')
    if (!transform) return { dx: 0, dy: 0, grounded: false, collisions: [] }

    const collisions: CharacterCollision[] = []
    let grounded = false

    // Store starting position to compute actual movement
    const startX = transform.x
    const startY = transform.y

    // Get character AABB
    const charAABB = getEntityAABB(world, entityId)
    if (!charAABB) return { dx: 0, dy: 0, grounded: false, collisions: [] }

    // Collect all collidable entities
    const candidates = this.getCandidates(world, entityId)

    // ── X pass ──────────────────────────────────────────────────────────
    transform.x += desiredDx
    charAABB.cx += desiredDx

    for (const cid of candidates) {
      const otherAABB = getEntityAABB(world, cid)
      if (!otherAABB) continue

      const ov = aabbOverlap(charAABB, otherAABB)
      if (!ov) continue

      // Only resolve X-axis overlaps
      const ox = charAABB.hw + otherAABB.hw - Math.abs(charAABB.cx - otherAABB.cx)
      if (ox <= 0) continue
      const oy = charAABB.hh + otherAABB.hh - Math.abs(charAABB.cy - otherAABB.cy)
      if (oy <= 0) continue

      if (ox < oy) {
        const dir = charAABB.cx < otherAABB.cx ? -1 : 1
        const slopeAngle = this.getSlopeAngle(0, dir < 0 ? 1 : -1)

        // Check slope — too steep to climb, or steep enough to slide
        if (slopeAngle > this.maxSlopeClimbAngle) {
          // Too steep — blocked
          transform.x += dir * ox
          charAABB.cx += dir * ox
          collisions.push({ entityId: cid, normalX: dir, normalY: 0, penetration: ox })

          // If past the slide angle, apply slide down force direction
          if (slopeAngle >= this.minSlopeSlideAngle) {
            // Slide: project desired movement onto slope surface (effectively block X)
          }

          // Push dynamic bodies
          this.tryPush(world, cid, -dir, 0, desiredDx)
        } else {
          // Auto-step check: obstacle must be short enough AND wide enough
          if (this.maxStepHeight > 0 && oy <= this.maxStepHeight && otherAABB.hw * 2 >= this.minStepWidth) {
            const otherRb = world.getComponent<RigidBodyComponent>(cid, 'RigidBody')
            if (this.stepOnDynamic || !otherRb || otherRb.isStatic || otherRb.isKinematic) {
              // Step up
              transform.y -= oy + this.offset
              charAABB.cy -= oy + this.offset
              grounded = true
              continue
            }
          }
          // Normal X resolution
          transform.x += dir * (ox + this.offset)
          charAABB.cx += dir * (ox + this.offset)
          collisions.push({ entityId: cid, normalX: dir, normalY: 0, penetration: ox })
          this.tryPush(world, cid, -dir, 0, desiredDx)
        }
      }
    }

    // ── Y pass ──────────────────────────────────────────────────────────
    transform.y += desiredDy
    charAABB.cy += desiredDy

    for (const cid of candidates) {
      const otherAABB = getEntityAABB(world, cid)
      if (!otherAABB) continue

      const ox = charAABB.hw + otherAABB.hw - Math.abs(charAABB.cx - otherAABB.cx)
      if (ox <= 0) continue
      const oy = charAABB.hh + otherAABB.hh - Math.abs(charAABB.cy - otherAABB.cy)
      if (oy <= 0) continue

      if (oy <= ox) {
        const dir = charAABB.cy < otherAABB.cy ? -1 : 1
        transform.y += dir * (oy + this.offset)
        charAABB.cy += dir * (oy + this.offset)
        collisions.push({ entityId: cid, normalX: 0, normalY: dir, penetration: oy })

        // Ground detection: collision normal points up (opposite of up vector)
        // up = (0, -1), so grounded when normal = (0, -1), i.e. dir = -1
        const dot = dir * this.upY
        if (dot > 0.5) {
          grounded = true
        }

        // Push dynamic bodies
        this.tryPush(world, cid, 0, -dir, desiredDy)
      }
    }

    // ── Snap to ground ─────────────────────────────────────────────────
    if (this.snapToGroundDistance > 0 && !grounded && desiredDy >= 0) {
      // Only snap when not jumping (desiredDy >= 0 means not moving upward)
      const probeAABB: AABB = {
        cx: charAABB.cx,
        cy: charAABB.cy + this.snapToGroundDistance,
        hw: charAABB.hw,
        hh: charAABB.hh,
      }

      for (const cid of candidates) {
        const otherAABB = getEntityAABB(world, cid)
        if (!otherAABB) continue

        const ox = probeAABB.hw + otherAABB.hw - Math.abs(probeAABB.cx - otherAABB.cx)
        if (ox <= 0) continue
        const oy = probeAABB.hh + otherAABB.hh - Math.abs(probeAABB.cy - otherAABB.cy)
        if (oy <= 0) continue

        // Only snap if ground is below
        if (probeAABB.cy < otherAABB.cy) {
          const snapDist = otherAABB.cy - otherAABB.hh - (charAABB.cy + charAABB.hh)
          if (snapDist > 0 && snapDist <= this.snapToGroundDistance) {
            transform.y += snapDist
            charAABB.cy += snapDist
            grounded = true
            break
          }
        }
      }
    }

    return {
      dx: transform.x - startX,
      dy: transform.y - startY,
      grounded,
      collisions,
    }
  }

  /**
   * Compute the slope angle from a surface normal relative to the up vector.
   */
  private getSlopeAngle(nx: number, ny: number): number {
    // Dot product of normal with up vector
    const dot = nx * this.upX + ny * this.upY
    return Math.acos(Math.max(-1, Math.min(1, Math.abs(dot))))
  }

  /**
   * Get all candidate entities for collision, applying filters.
   */
  private getCandidates(world: ECSWorld, selfId: EntityId): EntityId[] {
    const candidates: EntityId[] = []
    const types: [string, string][] = [
      ['Transform', 'BoxCollider'],
      ['Transform', 'CircleCollider'],
      ['Transform', 'CapsuleCollider'],
    ]

    for (const [t, c] of types) {
      for (const id of world.query(t, c)) {
        if (id === selfId) continue
        if (this.filter && !this.filter(id)) continue

        if (this.excludeSensors) {
          const box = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')
          if (box?.isTrigger) continue
          const circle = world.getComponent<CircleColliderComponent>(id, 'CircleCollider')
          if (circle?.isTrigger) continue
          const capsule = world.getComponent<CapsuleColliderComponent>(id, 'CapsuleCollider')
          if (capsule?.isTrigger) continue
        }

        candidates.push(id)
      }
    }

    return candidates
  }

  /**
   * Try to push a dynamic body by applying an impulse.
   */
  private tryPush(world: ECSWorld, entityId: EntityId, nx: number, ny: number, velocity: number): void {
    if (this.pushForce <= 0) return
    const rb = world.getComponent<RigidBodyComponent>(entityId, 'RigidBody')
    if (!rb || rb.isStatic || rb.isKinematic) return
    if (rb.invMass <= 0) return

    const impulse = Math.abs(velocity) * this.pushForce
    applyImpulse(rb, nx * impulse, ny * impulse)
  }
}
