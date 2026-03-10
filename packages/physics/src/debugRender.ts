/**
 * Debug Render Pipeline — backend-agnostic line-based debug renderer.
 *
 * Generates a list of debug draw commands (lines, circles, points) that can
 * be rendered by any backend (Canvas2D, WebGL, SVG, etc.).
 *
 * Inspired by Rapier's DebugRenderPipeline.
 */

import type { ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from './components/rigidbody'
import type { BoxColliderComponent } from './components/boxCollider'
import type { CircleColliderComponent } from './components/circleCollider'
import type { CapsuleColliderComponent } from './components/capsuleCollider'
import type { ConvexPolygonColliderComponent } from './components/convexPolygonCollider'
import type { TriangleColliderComponent } from './components/triangleCollider'
import type { SegmentColliderComponent } from './components/segmentCollider'
import type { HeightFieldColliderComponent } from './components/heightFieldCollider'
import type { HalfSpaceColliderComponent } from './components/halfSpaceCollider'
import type { TriMeshColliderComponent } from './components/triMeshCollider'
import type { JointComponent } from './components/joint'
import type { ContactManifold } from './contactManifold'

// ── Types ──────────────────────────────────────────────────────────────────

export interface DebugLine {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

export interface DebugCircle {
  cx: number
  cy: number
  radius: number
  color: string
}

export interface DebugPoint {
  x: number
  y: number
  color: string
}

export interface DebugRenderOutput {
  lines: DebugLine[]
  circles: DebugCircle[]
  points: DebugPoint[]
}

/** Flags controlling which elements to render. */
export interface DebugRenderFlags {
  bodies?: boolean
  colliders?: boolean
  contacts?: boolean
  joints?: boolean
  aabbs?: boolean
  centerOfMass?: boolean
  velocityVectors?: boolean
}

/** Per-element-type color configuration. */
export interface DebugRenderColors {
  dynamicBody?: string
  staticBody?: string
  kinematicBody?: string
  sleepingBody?: string
  trigger?: string
  contact?: string
  contactNormal?: string
  joint?: string
  aabb?: string
  centerOfMass?: string
  velocity?: string
}

const DEFAULT_FLAGS: Required<DebugRenderFlags> = {
  bodies: true,
  colliders: true,
  contacts: true,
  joints: true,
  aabbs: false,
  centerOfMass: false,
  velocityVectors: false,
}

const DEFAULT_COLORS: Required<DebugRenderColors> = {
  dynamicBody: '#4fc3f7',
  staticBody: '#66bb6a',
  kinematicBody: '#ffa726',
  sleepingBody: '#9e9e9e',
  trigger: '#ab47bc',
  contact: '#ef5350',
  contactNormal: '#ffee58',
  joint: '#26c6da',
  aabb: '#ffffff33',
  centerOfMass: '#ff7043',
  velocity: '#81c784',
}

// ── Debug Render Backend ──────────────────────────────────────────────────

/** Pluggable backend interface — implement to render debug output. */
export interface DebugRenderBackend {
  drawLine(x1: number, y1: number, x2: number, y2: number, color: string): void
  drawCircle(cx: number, cy: number, radius: number, color: string): void
  drawPoint(x: number, y: number, color: string): void
}

// ── Debug Render Pipeline ─────────────────────────────────────────────────

export class DebugRenderPipeline {
  private flags: Required<DebugRenderFlags>
  private colors: Required<DebugRenderColors>

  constructor(flags?: DebugRenderFlags, colors?: DebugRenderColors) {
    this.flags = { ...DEFAULT_FLAGS, ...flags }
    this.colors = { ...DEFAULT_COLORS, ...colors }
  }

  /** Update render flags. */
  setFlags(flags: Partial<DebugRenderFlags>): void {
    Object.assign(this.flags, flags)
  }

  /** Update colors. */
  setColors(colors: Partial<DebugRenderColors>): void {
    Object.assign(this.colors, colors)
  }

  /**
   * Generate debug render output for the current world state.
   * Optionally pass contact manifolds from the physics system for contact rendering.
   */
  render(world: ECSWorld, manifolds?: ContactManifold[]): DebugRenderOutput {
    const output: DebugRenderOutput = { lines: [], circles: [], points: [] }

    if (
      this.flags.colliders ||
      this.flags.bodies ||
      this.flags.aabbs ||
      this.flags.centerOfMass ||
      this.flags.velocityVectors
    ) {
      this.renderBoxes(world, output)
      this.renderCircles(world, output)
      this.renderCapsules(world, output)
      this.renderPolygons(world, output)
      this.renderTriangles(world, output)
      this.renderSegments(world, output)
      this.renderHeightFields(world, output)
      this.renderHalfSpaces(world, output)
      this.renderTriMeshes(world, output)
    }

    if (this.flags.contacts && manifolds) {
      this.renderContacts(manifolds, output)
    }

    if (this.flags.joints) {
      this.renderJoints(world, output)
    }

    return output
  }

  /**
   * Render directly to a backend.
   */
  renderTo(backend: DebugRenderBackend, world: ECSWorld, manifolds?: ContactManifold[]): void {
    const output = this.render(world, manifolds)
    for (const l of output.lines) backend.drawLine(l.x1, l.y1, l.x2, l.y2, l.color)
    for (const c of output.circles) backend.drawCircle(c.cx, c.cy, c.radius, c.color)
    for (const p of output.points) backend.drawPoint(p.x, p.y, p.color)
  }

  // ── Shape rendering ────────────────────────────────────────────────────

  private getBodyColor(world: ECSWorld, id: EntityId): string {
    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
    if (!rb) return this.colors.staticBody
    if (rb.sleeping) return this.colors.sleepingBody
    if (rb.isStatic) return this.colors.staticBody
    if (rb.isKinematic) return this.colors.kinematicBody
    return this.colors.dynamicBody
  }

  private renderBoxes(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'BoxCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<BoxColliderComponent>(id, 'BoxCollider')!
      if (!col.enabled) continue

      const cx = t.x + col.offsetX
      const cy = t.y + col.offsetY
      const hw = col.width / 2
      const hh = col.height / 2
      const color = col.isTrigger ? this.colors.trigger : this.getBodyColor(world, id)

      if (this.flags.colliders) {
        this.addRect(output, cx, cy, hw, hh, t.rotation, color)
      }
      if (this.flags.aabbs) {
        this.addRect(output, cx, cy, hw, hh, 0, this.colors.aabb)
      }
      this.renderBodyExtras(world, id, t, output)
    }
  }

  private renderCircles(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'CircleCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<CircleColliderComponent>(id, 'CircleCollider')!
      if (!col.enabled) continue

      const cx = t.x + col.offsetX
      const cy = t.y + col.offsetY
      const color = col.isTrigger ? this.colors.trigger : this.getBodyColor(world, id)

      if (this.flags.colliders) {
        output.circles.push({ cx, cy, radius: col.radius, color })
        // Rotation indicator line
        output.lines.push({
          x1: cx,
          y1: cy,
          x2: cx + Math.cos(t.rotation) * col.radius,
          y2: cy + Math.sin(t.rotation) * col.radius,
          color,
        })
      }
      if (this.flags.aabbs) {
        this.addRect(output, cx, cy, col.radius, col.radius, 0, this.colors.aabb)
      }
      this.renderBodyExtras(world, id, t, output)
    }
  }

  private renderCapsules(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'CapsuleCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<CapsuleColliderComponent>(id, 'CapsuleCollider')!
      if (!col.enabled) continue

      const cx = t.x + col.offsetX
      const cy = t.y + col.offsetY
      const hw = col.width / 2
      const hh = col.height / 2
      const r = hw // capsule radius = half width
      const color = col.isTrigger ? this.colors.trigger : this.getBodyColor(world, id)

      if (this.flags.colliders) {
        // Two vertical lines
        output.lines.push({ x1: cx - hw, y1: cy - hh + r, x2: cx - hw, y2: cy + hh - r, color })
        output.lines.push({ x1: cx + hw, y1: cy - hh + r, x2: cx + hw, y2: cy + hh - r, color })
        // Top and bottom semicircles (approximated as circles)
        output.circles.push({ cx, cy: cy - hh + r, radius: r, color })
        output.circles.push({ cx, cy: cy + hh - r, radius: r, color })
      }
      if (this.flags.aabbs) {
        this.addRect(output, cx, cy, hw, hh, 0, this.colors.aabb)
      }
      this.renderBodyExtras(world, id, t, output)
    }
  }

  private renderPolygons(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'ConvexPolygonCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<ConvexPolygonColliderComponent>(id, 'ConvexPolygonCollider')!
      if (!col.enabled) continue

      const color = col.isTrigger ? this.colors.trigger : this.getBodyColor(world, id)
      const ox = t.x + col.offsetX
      const oy = t.y + col.offsetY

      if (this.flags.colliders) {
        const verts = col.vertices
        for (let i = 0; i < verts.length; i++) {
          const a = verts[i]
          const b = verts[(i + 1) % verts.length]
          output.lines.push({
            x1: ox + a.x,
            y1: oy + a.y,
            x2: ox + b.x,
            y2: oy + b.y,
            color,
          })
        }
      }
      this.renderBodyExtras(world, id, t, output)
    }
  }

  private renderTriangles(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'TriangleCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<TriangleColliderComponent>(id, 'TriangleCollider')!
      if (!col.enabled) continue

      const color = col.isTrigger ? this.colors.trigger : this.getBodyColor(world, id)
      const ox = t.x + col.offsetX
      const oy = t.y + col.offsetY

      if (this.flags.colliders) {
        output.lines.push({ x1: ox + col.a.x, y1: oy + col.a.y, x2: ox + col.b.x, y2: oy + col.b.y, color })
        output.lines.push({ x1: ox + col.b.x, y1: oy + col.b.y, x2: ox + col.c.x, y2: oy + col.c.y, color })
        output.lines.push({ x1: ox + col.c.x, y1: oy + col.c.y, x2: ox + col.a.x, y2: oy + col.a.y, color })
      }
      this.renderBodyExtras(world, id, t, output)
    }
  }

  private renderSegments(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'SegmentCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<SegmentColliderComponent>(id, 'SegmentCollider')!
      if (!col.enabled) continue

      const color = this.getBodyColor(world, id)
      const ox = t.x + col.offsetX
      const oy = t.y + col.offsetY

      if (this.flags.colliders) {
        output.lines.push({
          x1: ox + col.start.x,
          y1: oy + col.start.y,
          x2: ox + col.end.x,
          y2: oy + col.end.y,
          color,
        })
      }
    }
  }

  private renderHeightFields(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'HeightFieldCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<HeightFieldColliderComponent>(id, 'HeightFieldCollider')!
      if (!col.enabled) continue

      const color = this.getBodyColor(world, id)

      if (this.flags.colliders) {
        for (let i = 0; i < col.heights.length - 1; i++) {
          output.lines.push({
            x1: t.x + i * col.scaleX,
            y1: t.y + col.heights[i] * col.scaleY,
            x2: t.x + (i + 1) * col.scaleX,
            y2: t.y + col.heights[i + 1] * col.scaleY,
            color,
          })
        }
      }
    }
  }

  private renderHalfSpaces(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'HalfSpaceCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<HalfSpaceColliderComponent>(id, 'HalfSpaceCollider')!
      if (!col.enabled) continue

      const color = this.getBodyColor(world, id)

      if (this.flags.colliders) {
        // Draw a long line perpendicular to normal through entity position
        const perpX = -col.normalY
        const perpY = col.normalX
        const len = 2000 // large extent
        output.lines.push({
          x1: t.x + perpX * len,
          y1: t.y + perpY * len,
          x2: t.x - perpX * len,
          y2: t.y - perpY * len,
          color,
        })
        // Normal indicator
        output.lines.push({
          x1: t.x,
          y1: t.y,
          x2: t.x + col.normalX * 20,
          y2: t.y + col.normalY * 20,
          color,
        })
      }
    }
  }

  private renderTriMeshes(world: ECSWorld, output: DebugRenderOutput): void {
    for (const id of world.query('Transform', 'TriMeshCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const col = world.getComponent<TriMeshColliderComponent>(id, 'TriMeshCollider')!
      if (!col.enabled) continue

      const color = this.getBodyColor(world, id)

      if (this.flags.colliders) {
        for (let i = 0; i < col.indices.length; i += 3) {
          const a = col.vertices[col.indices[i]]
          const b = col.vertices[col.indices[i + 1]]
          const c = col.vertices[col.indices[i + 2]]
          output.lines.push({ x1: t.x + a.x, y1: t.y + a.y, x2: t.x + b.x, y2: t.y + b.y, color })
          output.lines.push({ x1: t.x + b.x, y1: t.y + b.y, x2: t.x + c.x, y2: t.y + c.y, color })
          output.lines.push({ x1: t.x + c.x, y1: t.y + c.y, x2: t.x + a.x, y2: t.y + a.y, color })
        }
      }
    }
  }

  // ── Body extras (CoM, velocity vectors) ────────────────────────────────

  private renderBodyExtras(world: ECSWorld, id: EntityId, t: TransformComponent, output: DebugRenderOutput): void {
    if (this.flags.centerOfMass) {
      const size = 4
      output.lines.push({ x1: t.x - size, y1: t.y, x2: t.x + size, y2: t.y, color: this.colors.centerOfMass })
      output.lines.push({ x1: t.x, y1: t.y - size, x2: t.x, y2: t.y + size, color: this.colors.centerOfMass })
    }

    if (this.flags.velocityVectors) {
      const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')
      if (rb && !rb.isStatic) {
        const scale = 0.1 // scale velocity to visible length
        output.lines.push({
          x1: t.x,
          y1: t.y,
          x2: t.x + rb.vx * scale,
          y2: t.y + rb.vy * scale,
          color: this.colors.velocity,
        })
      }
    }
  }

  // ── Contact rendering ──────────────────────────────────────────────────

  private renderContacts(manifolds: ContactManifold[], output: DebugRenderOutput): void {
    for (const m of manifolds) {
      for (const p of m.points) {
        // Contact point
        output.points.push({ x: p.worldAx, y: p.worldAy, color: this.colors.contact })

        // Normal arrow
        const scale = 15
        output.lines.push({
          x1: p.worldAx,
          y1: p.worldAy,
          x2: p.worldAx + m.normalX * scale,
          y2: p.worldAy + m.normalY * scale,
          color: this.colors.contactNormal,
        })
      }
    }
  }

  // ── Joint rendering ────────────────────────────────────────────────────

  private renderJoints(world: ECSWorld, output: DebugRenderOutput): void {
    for (const jid of world.query('Joint')) {
      const j = world.getComponent<JointComponent>(jid, 'Joint')!
      if (!j.enabled || j.broken) continue

      const tA = world.getComponent<TransformComponent>(j.entityA, 'Transform')
      const tB = world.getComponent<TransformComponent>(j.entityB, 'Transform')
      if (!tA || !tB) continue

      const ax = tA.x + j.anchorA.x
      const ay = tA.y + j.anchorA.y
      const bx = tB.x + j.anchorB.x
      const by = tB.y + j.anchorB.y

      output.lines.push({ x1: ax, y1: ay, x2: bx, y2: by, color: this.colors.joint })
      output.points.push({ x: ax, y: ay, color: this.colors.joint })
      output.points.push({ x: bx, y: by, color: this.colors.joint })
    }
  }

  // ── Geometry helpers ───────────────────────────────────────────────────

  private addRect(
    output: DebugRenderOutput,
    cx: number,
    cy: number,
    hw: number,
    hh: number,
    rotation: number,
    color: string,
  ): void {
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const corners = [
      { x: cx + (-hw * cos - -hh * sin), y: cy + (-hw * sin + -hh * cos) },
      { x: cx + (hw * cos - -hh * sin), y: cy + (hw * sin + -hh * cos) },
      { x: cx + (hw * cos - hh * sin), y: cy + (hw * sin + hh * cos) },
      { x: cx + (-hw * cos - hh * sin), y: cy + (-hw * sin + hh * cos) },
    ]
    for (let i = 0; i < 4; i++) {
      const a = corners[i]
      const b = corners[(i + 1) % 4]
      output.lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color })
    }
  }
}
