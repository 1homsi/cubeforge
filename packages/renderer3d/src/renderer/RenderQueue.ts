/**
 * RenderQueue — scene traversal, frustum culling, and draw-call sorting.
 *
 * Opaque items:      front-to-back  (minimize overdraw, depth-reject early)
 * Transparent items: back-to-front  (correct alpha blending)
 * Both lists respect `renderOrder` as primary sort key.
 */

import { Mat4 } from '../math'
import { Scene, Camera } from '../scene'
import { BufferGeometry } from '../geometry'
import { Material } from '../material'
import { Light } from '../lights'
import { Mesh, Sprite3D, Line3D } from '../objects'
import { LOD } from '../objects/LOD'

// ---------------------------------------------------------------------------
// RenderItem
// ---------------------------------------------------------------------------

export interface RenderItem {
  object: Mesh
  geometry: BufferGeometry
  material: Material
  /** Index into geometry.groups, or -1 if no groups (whole geometry) */
  groupIndex: number
  groupStart: number
  groupCount: number
  /** View-space depth of the object's world position (positive = in front of camera) */
  z: number
  renderOrder: number
}

// ---------------------------------------------------------------------------
// Frustum plane helper
// ---------------------------------------------------------------------------

// Columns of the view-projection matrix (M) define the six clip planes.
// A sphere (center, radius) is culled if it lies entirely outside any plane.

function extractFrustumPlanes(vp: Mat4, planes: Float32Array): Float32Array {
  const e = vp.elements
  // Each plane: [nx, ny, nz, d] — written into the caller-provided buffer to
  // avoid allocating six planes' worth of floats on every single frame.

  // Left:   col3 + col0
  planes[0] = e[3] + e[0]
  planes[1] = e[7] + e[4]
  planes[2] = e[11] + e[8]
  planes[3] = e[15] + e[12]
  // Right:  col3 - col0
  planes[4] = e[3] - e[0]
  planes[5] = e[7] - e[4]
  planes[6] = e[11] - e[8]
  planes[7] = e[15] - e[12]
  // Bottom: col3 + col1
  planes[8] = e[3] + e[1]
  planes[9] = e[7] + e[5]
  planes[10] = e[11] + e[9]
  planes[11] = e[15] + e[13]
  // Top:    col3 - col1
  planes[12] = e[3] - e[1]
  planes[13] = e[7] - e[5]
  planes[14] = e[11] - e[9]
  planes[15] = e[15] - e[13]
  // Near:   col3 + col2
  planes[16] = e[3] + e[2]
  planes[17] = e[7] + e[6]
  planes[18] = e[11] + e[10]
  planes[19] = e[15] + e[14]
  // Far:    col3 - col2
  planes[20] = e[3] - e[2]
  planes[21] = e[7] - e[6]
  planes[22] = e[11] - e[10]
  planes[23] = e[15] - e[14]

  // Normalize each plane
  for (let i = 0; i < 6; i++) {
    const o = i * 4
    const len = Math.sqrt(planes[o] ** 2 + planes[o + 1] ** 2 + planes[o + 2] ** 2)
    if (len > 0) {
      planes[o] /= len
      planes[o + 1] /= len
      planes[o + 2] /= len
      planes[o + 3] /= len
    }
  }

  return planes
}

function sphereInFrustum(planes: Float32Array, cx: number, cy: number, cz: number, radius: number): boolean {
  for (let i = 0; i < 6; i++) {
    const o = i * 4
    const dist = planes[o] * cx + planes[o + 1] * cy + planes[o + 2] * cz + planes[o + 3]
    if (dist < -radius) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// RenderQueue
// ---------------------------------------------------------------------------

export class RenderQueue {
  opaque: RenderItem[] = []
  transparent: RenderItem[] = []
  lights: Light[] = []
  sprites: Sprite3D[] = []
  lines: Line3D[] = []

  /** Combined view-projection matrix for frustum extraction (set during extractFromScene) */
  private _vpMatrix = new Mat4()

  /** Reused frustum-plane buffer (6 planes × 4 components). */
  private _frustumPlanes = new Float32Array(24)

  /** Pool of RenderItem objects, reused frame-to-frame to avoid GC churn. */
  private _itemPool: RenderItem[] = []
  private _poolCursor = 0

  /** Number of objects tested against the frustum during the last extract. */
  culledTested = 0
  /** Number of objects rejected by frustum culling during the last extract. */
  culledRejected = 0

  clear(): void {
    this.opaque.length = 0
    this.transparent.length = 0
    this.lights.length = 0
    this.sprites.length = 0
    this.lines.length = 0
    this._poolCursor = 0
  }

  /** Acquire a RenderItem from the pool, allocating a new one only when needed. */
  private _acquire(): RenderItem {
    let item = this._itemPool[this._poolCursor]
    if (item === undefined) {
      item = {
        object: null as unknown as Mesh,
        geometry: null as unknown as BufferGeometry,
        material: null as unknown as Material,
        groupIndex: -1,
        groupStart: 0,
        groupCount: 0,
        z: 0,
        renderOrder: 0,
      }
      this._itemPool[this._poolCursor] = item
    }
    this._poolCursor++
    return item
  }

  push(item: RenderItem): void {
    if (item.material.transparent) {
      this.transparent.push(item)
    } else {
      this.opaque.push(item)
    }
  }

  /** Sort both lists.  Opaque: front-to-back.  Transparent: back-to-front. */
  sort(): void {
    this.opaque.sort(compareOpaque)
    this.transparent.sort(compareTransparent)
  }

  /**
   * Traverse `scene`, frustum-cull against `camera`, collect RenderItems
   * for every visible Mesh, and collect all Lights.
   */
  extractFromScene(scene: Scene, camera: Camera): void {
    this.clear()

    this.culledTested = 0
    this.culledRejected = 0

    // Build VP matrix for frustum culling
    this._vpMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const frustumPlanes = extractFrustumPlanes(this._vpMatrix, this._frustumPlanes)

    // Camera world position for depth calculation
    const camWorldE = camera.matrixWorld.elements
    const camPx = camWorldE[12]
    const camPy = camWorldE[13]
    const camPz = camWorldE[14]

    // Camera forward direction (negative Z column of world matrix = view direction)
    const fwdX = -camWorldE[8]
    const fwdY = -camWorldE[9]
    const fwdZ = -camWorldE[10]

    scene.traverseVisible((obj) => {
      // LOD node — update visibility of its children, then continue traversal
      // so only the active level's meshes get added to the queue.
      if ((obj as unknown as { isLOD?: boolean }).isLOD) {
        const lod = obj as unknown as LOD
        lod.update(camera)
        // Do not return — traversal continues into the LOD's now-updated children
        return
      }

      // Collect lights
      if ((obj as unknown as { isLight?: boolean }).isLight || ('intensity' in obj && 'color' in obj)) {
        this.lights.push(obj as unknown as Light)
        return
      }

      // Collect Sprite3D objects
      if ((obj as unknown as { isSprite?: boolean }).isSprite) {
        this.sprites.push(obj as unknown as Sprite3D)
        return
      }

      // Collect Line3D / LineSegments / LineLoop objects
      if ((obj as unknown as { isLine?: boolean }).isLine) {
        this.lines.push(obj as unknown as Line3D)
        return
      }

      // Only process Mesh objects
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      if (!mesh.visible) return

      const geometry = mesh.geometry
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

      // ── Frustum culling ──
      const instanced = (mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh
        ? (mesh as unknown as import('../objects/InstancedMesh').InstancedMesh)
        : null
      if (mesh.frustumCulled) {
        this.culledTested++
        const mw = mesh.matrixWorld.elements

        if (instanced) {
          // Cull the whole instance fleet by its aggregate bounding sphere,
          // which already accounts for every instance's world translation.
          if (!instanced.boundingSphere) instanced.computeBoundingSphere()
          const ibs = instanced.boundingSphere!
          // The instance matrices are world-space, so only the mesh's own
          // world transform is applied on top of the aggregate centre.
          const wcx = mw[0] * ibs.center.x + mw[4] * ibs.center.y + mw[8] * ibs.center.z + mw[12]
          const wcy = mw[1] * ibs.center.x + mw[5] * ibs.center.y + mw[9] * ibs.center.z + mw[13]
          const wcz = mw[2] * ibs.center.x + mw[6] * ibs.center.y + mw[10] * ibs.center.z + mw[14]
          if (!sphereInFrustum(frustumPlanes, wcx, wcy, wcz, ibs.radius)) {
            this.culledRejected++
            return
          }
        } else {
          // Ensure bounding sphere is available
          if (!geometry.boundingSphere) {
            geometry.computeBoundingSphere()
          }
          const bs = geometry.boundingSphere!

          // Transform sphere center to world space
          const wcx = mw[0] * bs.center.x + mw[4] * bs.center.y + mw[8] * bs.center.z + mw[12]
          const wcy = mw[1] * bs.center.x + mw[5] * bs.center.y + mw[9] * bs.center.z + mw[13]
          const wcz = mw[2] * bs.center.x + mw[6] * bs.center.y + mw[10] * bs.center.z + mw[14]

          // Scale radius by max scale component
          const sx = Math.sqrt(mw[0] ** 2 + mw[1] ** 2 + mw[2] ** 2)
          const sy = Math.sqrt(mw[4] ** 2 + mw[5] ** 2 + mw[6] ** 2)
          const sz = Math.sqrt(mw[8] ** 2 + mw[9] ** 2 + mw[10] ** 2)
          const worldRadius = bs.radius * Math.max(sx, sy, sz)

          if (!sphereInFrustum(frustumPlanes, wcx, wcy, wcz, worldRadius)) {
            this.culledRejected++
            return
          }
        }
      }

      // ── Compute view-space depth (dot product of (pos - cam) with forward) ──
      const mw2 = mesh.matrixWorld.elements
      const wx = mw2[12],
        wy = mw2[13],
        wz = mw2[14]
      const dx = wx - camPx,
        dy = wy - camPy,
        dz = wz - camPz
      const z = dx * fwdX + dy * fwdY + dz * fwdZ

      // ── Push render items ──
      if (geometry.groups.length > 0) {
        for (let gi = 0; gi < geometry.groups.length; gi++) {
          const group = geometry.groups[gi]
          const mat = materials[group.materialIndex] ?? materials[0]
          if (!mat) continue

          const item = this._acquire()
          item.object = mesh
          item.geometry = geometry
          item.material = mat
          item.groupIndex = gi
          item.groupStart = group.start
          item.groupCount = group.count
          item.z = z
          item.renderOrder = mesh.renderOrder
          this.push(item)
        }
      } else {
        const mat = materials[0]
        if (!mat) return

        const posAttr = geometry.getAttribute('position')
        const totalVerts = posAttr?.count ?? 0
        const drawCount =
          geometry.drawRange.count === Infinity
            ? geometry.index
              ? geometry.index.count
              : totalVerts
            : geometry.drawRange.count

        const item = this._acquire()
        item.object = mesh
        item.geometry = geometry
        item.material = mat
        item.groupIndex = -1
        item.groupStart = geometry.drawRange.start
        item.groupCount = drawCount
        item.z = z
        item.renderOrder = mesh.renderOrder
        this.push(item)
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Comparators
// ---------------------------------------------------------------------------

function compareOpaque(a: RenderItem, b: RenderItem): number {
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder
  // Front-to-back: smaller z first
  return a.z - b.z
}

function compareTransparent(a: RenderItem, b: RenderItem): number {
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder
  // Back-to-front: larger z first
  return b.z - a.z
}
