/**
 * DebugRenderer3D — overlays wireframe bounding boxes, axes, normals, light
 * positions, a grid, camera frustum, and skeleton bones on top of the main
 * render pass.
 *
 * All draw calls use a single colour shader (position + u_color + u_mvp) and
 * gl.LINES primitives — depth testing disabled so overlays are always visible.
 */

import { ShaderProgram, GLBuffer, VAO } from '../core'
import { Mat4, Vec3 } from '../math'
import { Scene, Camera } from '../scene'
import { Mesh, SkinnedMesh } from '../objects'
import { Light, DirectionalLight } from '../lights'
import { BufferGeometry } from '../geometry'

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface DebugOptions {
  /** Draw AABB wireframe for all meshes (default false) */
  boundingBoxes?: boolean
  /** Draw wireframe overlay on all meshes (default false) */
  wireframe?: boolean
  /** Draw normal vectors as line segments (default false) */
  normals?: boolean
  /** World units for normal line length (default 0.1) */
  normalLength?: number
  /** Draw a sphere/arrow for each light (default false) */
  lights?: boolean
  /** Draw an infinite grid on the XZ plane (default false) */
  grid?: boolean
  /** Half-extent of the grid in world units (default 100) */
  gridSize?: number
  /** Lines per side (default 20) */
  gridDivisions?: number
  /** Draw XYZ axis lines at the origin (default false) */
  axes?: boolean
  /** Length of axis lines (default 1) */
  axesSize?: number
  /** Draw the camera frustum wireframe (default false) */
  frustum?: boolean
  /** Draw skeleton bone lines (default false) */
  skeletons?: boolean
}

// ---------------------------------------------------------------------------
// Simple colour shader (reused for every debug draw)
// ---------------------------------------------------------------------------

const DEBUG_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
uniform mat4 u_mvp;
void main() {
  gl_Position = u_mvp * vec4(a_position, 1.0);
}
`

const DEBUG_FRAG = /* glsl */ `#version 300 es
precision mediump float;
uniform vec3 u_color;
out vec4 fragColor;
void main() {
  fragColor = vec4(u_color, 1.0);
}
`

// ---------------------------------------------------------------------------
// Scratch maths (reused across frames to avoid GC)
// ---------------------------------------------------------------------------

const _vpMat = new Mat4()
const _mvp = new Mat4()
const _invVP = new Mat4()

// ---------------------------------------------------------------------------
// Geometry-building helpers
// ---------------------------------------------------------------------------

/** 24 vertices (12 edges) for an AABB given min/max in world space. */
function boxEdges(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): Float32Array {
  const c: number[] = [
    minX,
    minY,
    minZ,
    maxX,
    minY,
    minZ,
    maxX,
    maxY,
    minZ,
    minX,
    maxY,
    minZ,
    minX,
    minY,
    maxZ,
    maxX,
    minY,
    maxZ,
    maxX,
    maxY,
    maxZ,
    minX,
    maxY,
    maxZ,
  ]
  const ei = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
  const out = new Float32Array(ei.length * 3)
  for (let i = 0; i < ei.length; i++) {
    const base = ei[i] * 3
    out[i * 3 + 0] = c[base + 0]
    out[i * 3 + 1] = c[base + 1]
    out[i * 3 + 2] = c[base + 2]
  }
  return out
}

/** World-space AABB for a mesh. Returns null if no position attribute. */
function computeWorldAABB(mesh: Mesh): { min: Vec3; max: Vec3 } | null {
  const posAttr = mesh.geometry.getAttribute('position')
  if (!posAttr || posAttr.count === 0) return null

  const min = new Vec3(Infinity, Infinity, Infinity)
  const max = new Vec3(-Infinity, -Infinity, -Infinity)
  const mw = mesh.matrixWorld.elements

  for (let i = 0; i < posAttr.count; i++) {
    const lx = posAttr.getX(i),
      ly = posAttr.getY(i),
      lz = posAttr.getZ(i)
    const wx = mw[0] * lx + mw[4] * ly + mw[8] * lz + mw[12]
    const wy = mw[1] * lx + mw[5] * ly + mw[9] * lz + mw[13]
    const wz = mw[2] * lx + mw[6] * ly + mw[10] * lz + mw[14]
    if (wx < min.x) min.x = wx
    if (wx > max.x) max.x = wx
    if (wy < min.y) min.y = wy
    if (wy > max.y) max.y = wy
    if (wz < min.z) min.z = wz
    if (wz > max.z) max.z = wz
  }
  return { min, max }
}

/** Static grid on Y=0. */
function buildGrid(halfSize: number, divisions: number): Float32Array {
  const step = (halfSize * 2) / divisions
  const verts: number[] = []
  for (let i = 0; i <= divisions; i++) {
    const t = -halfSize + i * step
    verts.push(t, 0, -halfSize, t, 0, halfSize) // Z-aligned
    verts.push(-halfSize, 0, t, halfSize, 0, t) // X-aligned
  }
  return new Float32Array(verts)
}

/** Two-vertex line along one axis from origin. */
function axisLine(size: number, axis: 0 | 1 | 2): Float32Array {
  const out = new Float32Array(6)
  out[axis + 3] = size
  return out
}

/** Coarse sphere at (cx,cy,cz) with radius r as line pairs. */
function buildSphere(cx: number, cy: number, cz: number, r: number): Float32Array {
  const stacks = 5,
    slices = 8
  const verts: number[] = []
  for (let s = 0; s < stacks; s++) {
    const p0 = (Math.PI * s) / stacks
    const p1 = (Math.PI * (s + 1)) / stacks
    for (let l = 0; l < slices; l++) {
      const t0 = (2 * Math.PI * l) / slices
      const t1 = (2 * Math.PI * (l + 1)) / slices
      verts.push(
        cx + r * Math.sin(p0) * Math.cos(t0),
        cy + r * Math.cos(p0),
        cz + r * Math.sin(p0) * Math.sin(t0),
        cx + r * Math.sin(p0) * Math.cos(t1),
        cy + r * Math.cos(p0),
        cz + r * Math.sin(p0) * Math.sin(t1),
        cx + r * Math.sin(p0) * Math.cos(t0),
        cy + r * Math.cos(p0),
        cz + r * Math.sin(p0) * Math.sin(t0),
        cx + r * Math.sin(p1) * Math.cos(t0),
        cy + r * Math.cos(p1),
        cz + r * Math.sin(p1) * Math.sin(t0),
      )
    }
  }
  return new Float32Array(verts)
}

/** Edge list from triangles — deduplicates so each physical edge is drawn once. */
function buildWireframe(geo: BufferGeometry): Float32Array {
  const posAttr = geo.getAttribute('position')
  if (!posAttr) return new Float32Array(0)
  const idx = geo.index
  const edgeSet = new Set<string>()
  const verts: number[] = []

  const pushEdge = (a: number, b: number): void => {
    const lo = Math.min(a, b),
      hi = Math.max(a, b)
    const key = `${lo}_${hi}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    verts.push(posAttr.getX(lo), posAttr.getY(lo), posAttr.getZ(lo))
    verts.push(posAttr.getX(hi), posAttr.getY(hi), posAttr.getZ(hi))
  }

  if (idx) {
    for (let i = 0; i < idx.count; i += 3)
      (pushEdge(idx.getX(i), idx.getX(i + 1)),
        pushEdge(idx.getX(i + 1), idx.getX(i + 2)),
        pushEdge(idx.getX(i + 2), idx.getX(i)))
  } else {
    for (let i = 0; i < posAttr.count; i += 3) (pushEdge(i, i + 1), pushEdge(i + 1, i + 2), pushEdge(i + 2, i))
  }
  return new Float32Array(verts)
}

/** Normal line pairs, returned in world space. */
function buildNormals(geo: BufferGeometry, mw: Float32Array, normalLength: number): Float32Array {
  const posAttr = geo.getAttribute('position')
  const nrmAttr = geo.getAttribute('normal')
  if (!posAttr || !nrmAttr) return new Float32Array(0)

  const count = posAttr.count
  const out = new Float32Array(count * 6)
  for (let i = 0; i < count; i++) {
    const lx = posAttr.getX(i),
      ly = posAttr.getY(i),
      lz = posAttr.getZ(i)
    const nx = nrmAttr.getX(i),
      ny = nrmAttr.getY(i),
      nz = nrmAttr.getZ(i)
    const wx = mw[0] * lx + mw[4] * ly + mw[8] * lz + mw[12]
    const wy = mw[1] * lx + mw[5] * ly + mw[9] * lz + mw[13]
    const wz = mw[2] * lx + mw[6] * ly + mw[10] * lz + mw[14]
    let wnx = mw[0] * nx + mw[4] * ny + mw[8] * nz
    let wny = mw[1] * nx + mw[5] * ny + mw[9] * nz
    let wnz = mw[2] * nx + mw[6] * ny + mw[10] * nz
    const len = Math.sqrt(wnx * wnx + wny * wny + wnz * wnz) || 1
    wnx /= len
    wny /= len
    wnz /= len
    const b = i * 6
    out[b + 0] = wx
    out[b + 1] = wy
    out[b + 2] = wz
    out[b + 3] = wx + wnx * normalLength
    out[b + 4] = wy + wny * normalLength
    out[b + 5] = wz + wnz * normalLength
  }
  return out
}

/** Unproject 8 NDC corners → world, emit 12 frustum edges. */
function frustumCornersLines(invVP: Mat4): Float32Array {
  const ndcPts: [number, number, number][] = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ]
  const e = invVP.elements
  const ws: [number, number, number][] = ndcPts.map(([nx, ny, nz]) => {
    let x = e[0] * nx + e[4] * ny + e[8] * nz + e[12]
    let y = e[1] * nx + e[5] * ny + e[9] * nz + e[13]
    let z = e[2] * nx + e[6] * ny + e[10] * nz + e[14]
    const w = e[3] * nx + e[7] * ny + e[11] * nz + e[15]
    if (w !== 0) {
      x /= w
      y /= w
      z /= w
    }
    return [x, y, z]
  })
  const ei = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
  const out = new Float32Array(ei.length * 3)
  for (let i = 0; i < ei.length; i++) {
    const c = ws[ei[i]]
    out[i * 3 + 0] = c[0]
    out[i * 3 + 1] = c[1]
    out[i * 3 + 2] = c[2]
  }
  return out
}

// ---------------------------------------------------------------------------
// DebugRenderer3D
// ---------------------------------------------------------------------------

export class DebugRenderer3D {
  options: DebugOptions
  enabled: boolean

  private readonly gl: WebGL2RenderingContext
  private readonly _program: ShaderProgram
  private readonly _vao: VAO
  private readonly _buf: GLBuffer

  /** Cached static grid geometry */
  private _gridVerts: Float32Array | null = null
  private _gridSizeCache = -1
  private _gridDivisionsCache = -1

  constructor(gl: WebGL2RenderingContext, opts: DebugOptions = {}) {
    this.gl = gl
    this.options = { ...opts }
    this.enabled = true

    this._program = new ShaderProgram(gl, DEBUG_VERT, DEBUG_FRAG)
    this._buf = GLBuffer.createVBO(gl, undefined, gl.DYNAMIC_DRAW)

    this._vao = new VAO(gl)
    this._vao.setAttribute(0, this._buf, 3, gl.FLOAT)
  }

  // ---------------------------------------------------------------------------
  // Main entry point — call after the main render pass
  // ---------------------------------------------------------------------------

  render(scene: Scene, camera: Camera): void {
    if (!this.enabled) return

    const { gl, _program: prog, _vao: vao, _buf: buf } = this
    const opts = this.options

    // Build VP matrix
    _vpMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)

    gl.useProgram(prog.handle)
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const identity = new Mat4()

    const upload = (positions: Float32Array, color: [number, number, number], mvp: Mat4): void => {
      if (positions.length === 0) return
      prog.setUniform3f('u_color', color[0], color[1], color[2])
      prog.setUniformMat4fv('u_mvp', mvp.elements)
      buf.bind()
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)
      buf.unbind()
      vao.bind()
      gl.drawArrays(gl.LINES, 0, positions.length / 3)
      vao.unbind()
    }

    // ── Grid ───────────────────────────────────────────────────────────────────
    if (opts.grid) {
      const halfSize = opts.gridSize ?? 100
      const divisions = opts.gridDivisions ?? 20
      if (this._gridVerts === null || this._gridSizeCache !== halfSize || this._gridDivisionsCache !== divisions) {
        this._gridVerts = buildGrid(halfSize, divisions)
        this._gridSizeCache = halfSize
        this._gridDivisionsCache = divisions
      }
      upload(this._gridVerts, [0.4, 0.4, 0.4], _vpMat)
    }

    // ── World axes ─────────────────────────────────────────────────────────────
    if (opts.axes) {
      const sz = opts.axesSize ?? 1
      upload(axisLine(sz, 0), [1, 0, 0], _vpMat)
      upload(axisLine(sz, 1), [0, 1, 0], _vpMat)
      upload(axisLine(sz, 2), [0, 0, 1], _vpMat)
    }

    // ── Camera frustum ─────────────────────────────────────────────────────────
    if (opts.frustum) {
      _invVP.copy(_vpMat).invert()
      upload(frustumCornersLines(_invVP), [1, 1, 0], identity)
    }

    // ── Per-mesh overlays ──────────────────────────────────────────────────────
    scene.traverseVisible((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return

      if (opts.boundingBoxes) {
        const aabb = computeWorldAABB(mesh)
        if (aabb) {
          upload(boxEdges(aabb.min.x, aabb.min.y, aabb.min.z, aabb.max.x, aabb.max.y, aabb.max.z), [0, 1, 0], _vpMat)
        }
      }

      if (opts.wireframe) {
        const wf = buildWireframe(mesh.geometry)
        _mvp.multiplyMatrices(_vpMat, mesh.matrixWorld)
        upload(wf, [1, 1, 1], _mvp)
      }

      if (opts.normals) {
        const nl = opts.normalLength ?? 0.1
        upload(buildNormals(mesh.geometry, mesh.matrixWorld.elements, nl), [0, 0.6, 1], _vpMat)
      }

      // Skeleton bones
      if (opts.skeletons && (mesh as SkinnedMesh).isSkinnedMesh) {
        const sm = mesh as SkinnedMesh
        if (sm.skeleton) {
          const boneVerts: number[] = []
          for (const bone of sm.skeleton.bones) {
            if (bone.parent && (bone.parent as { isBone?: boolean }).isBone) {
              const bp = new Vec3(),
                pp = new Vec3()
              bone.getWorldPosition(bp)
              bone.parent.getWorldPosition(pp)
              boneVerts.push(pp.x, pp.y, pp.z, bp.x, bp.y, bp.z)
            }
          }
          if (boneVerts.length > 0) {
            upload(new Float32Array(boneVerts), [1, 0.5, 0], _vpMat)
          }
        }
      }
    })

    // ── Light helpers ──────────────────────────────────────────────────────────
    if (opts.lights) {
      scene.traverseVisible((obj) => {
        // Detect lights by duck-typing since Light extends Object3D
        if (!(obj as { isLight?: boolean }).isLight) return
        const light = obj as unknown as Light
        const wp = new Vec3()
        obj.getWorldPosition(wp)
        const lc = light.color
        upload(buildSphere(wp.x, wp.y, wp.z, 0.1), [lc.x, lc.y, lc.z], _vpMat)
        // Directional light arrow
        if (light instanceof DirectionalLight) {
          const dl = light as DirectionalLight
          const target = new Vec3()
          dl.target.getWorldPosition(target)
          let dx = target.x - wp.x,
            dy = target.y - wp.y,
            dz = target.z - wp.z
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
          dx /= len
          dy /= len
          dz /= len
          upload(new Float32Array([wp.x, wp.y, wp.z, wp.x + dx, wp.y + dy, wp.z + dz]), [lc.x, lc.y, lc.z], _vpMat)
        }
      })
    }

    // Restore GL state
    gl.enable(gl.DEPTH_TEST)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
  }

  resize(_w: number, _h: number): void {
    // Nothing size-dependent
  }

  dispose(): void {
    this._program.dispose()
    this._buf.dispose()
    this._vao.dispose()
  }
}
