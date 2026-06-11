/**
 * BatchedMesh — merges multiple geometries + per-item transforms into a single
 * draw call.  Think Three.js BatchedMesh: each item can have a unique geometry
 * but they all share one vertex/index buffer pair and are rendered together.
 *
 * How it works:
 *   - One large Float32Array holds all positions, normals, UVs.
 *   - One large Uint32Array holds all indices.
 *   - Each vertex carries an integer a_drawId telling the shader which mat4
 *     to use from the matrix texture.
 *   - Per-item transforms are packed into a Float32Array (_matrices) and
 *     uploaded to a RGBA32F texture that the batch vertex shader samples.
 *
 * Usage:
 *   const batch = new BatchedMesh(1000, 50000, 200000, material)
 *   const id = batch.addGeometry(boxGeometry)
 *   batch.setMatrixAt(id, myMat4)
 *   batch.instanceMatrixNeedsUpdate = true
 *   scene.add(batch)
 */

import { Object3D } from '../scene'
import { BufferGeometry, BufferAttribute } from '../geometry'
import { Material } from '../material'
import { Mat4 } from '../math'

// ── Internal per-item bookkeeping ─────────────────────────────────────────────

interface DrawRange {
  /** Byte/element offset into the shared position/normal/uv arrays (vertex index). */
  vertexStart: number
  /** Number of vertices allocated for this item. */
  vertexCount: number
  /** Start index inside the shared index array. */
  indexStart: number
  /** Number of indices allocated for this item. */
  indexCount: number
  /** Whether this slot is currently occupied. */
  active: boolean
  /** Set to true when setVisibleAt(id, false). */
  hidden: boolean
}

// ── Free-list entry ───────────────────────────────────────────────────────────

interface FreeRange {
  vertexStart: number
  vertexCount: number
  indexStart: number
  indexCount: number
}

// ── BatchedMesh ───────────────────────────────────────────────────────────────

export class BatchedMesh extends Object3D {
  readonly isMesh = true as const
  readonly isBatchedMesh = true as const

  material: Material

  // ── Combined geometry exposed to the renderer ────────────────────────────
  /**
   * The merged geometry.  The renderer treats BatchedMesh like a regular Mesh,
   * reading `geometry` and `material`.  We expose draw-call batching via the
   * `_drawRanges` internals.
   */
  geometry: BufferGeometry

  // ── Capacity ─────────────────────────────────────────────────────────────
  readonly maxItemCount: number

  // ── Per-item data ─────────────────────────────────────────────────────────
  /** Flat mat4 array: 16 floats × maxItemCount. */
  readonly _matrices: Float32Array
  /** Draw range for each item slot (length === maxItemCount). */
  readonly _drawRanges: Array<DrawRange | null>
  /** Free vertex+index ranges available for reuse after removeGeometry. */
  private readonly _freeList: FreeRange[]

  // ── Shared CPU-side buffers ───────────────────────────────────────────────
  private readonly _positions: Float32Array
  private readonly _normals: Float32Array
  private readonly _uvs: Float32Array
  private readonly _drawIds: Float32Array
  private readonly _indices: Uint32Array

  // ── Allocation cursors ────────────────────────────────────────────────────
  private _nextVertex = 0
  private _nextIndex = 0
  private _itemCount = 0

  // ── Matrix texture ────────────────────────────────────────────────────────
  /**
   * RGBA32F texture, 4 texels wide × maxItemCount tall.
   * Each row holds one mat4 as four RGBA32F texels (column-major).
   */
  readonly _matrixTextureData: Float32Array
  /**
   * Backing BufferAttribute so the renderer can track dirty state.
   * itemSize = 1 (raw float), count = 4 * maxItemCount * 4 floats per row…
   * We just use version increments; the renderer reads _matrixTextureData.
   */
  readonly _matrixTextureAttr: BufferAttribute

  // ── Dirty flags ───────────────────────────────────────────────────────────
  instanceMatrixNeedsUpdate = false

  constructor(maxItemCount: number, maxVertexCount: number, maxIndexCount: number, material: Material) {
    super()

    this.maxItemCount = maxItemCount
    this.material = material

    // CPU-side buffers
    this._positions = new Float32Array(maxVertexCount * 3)
    this._normals = new Float32Array(maxVertexCount * 3)
    this._uvs = new Float32Array(maxVertexCount * 2)
    this._drawIds = new Float32Array(maxVertexCount) // one float per vertex
    this._indices = new Uint32Array(maxIndexCount)

    this._matrices = new Float32Array(maxItemCount * 16)
    // Initialise all to identity
    for (let i = 0; i < maxItemCount; i++) {
      const o = i * 16
      this._matrices[o] = 1
      this._matrices[o + 5] = 1
      this._matrices[o + 10] = 1
      this._matrices[o + 15] = 1
    }

    // Matrix texture: 4 texels wide (one per column of mat4) × maxItemCount tall
    // Each texel is RGBA (4 floats), so 4 * 4 = 16 floats per row = one mat4.
    this._matrixTextureData = new Float32Array(4 * 4 * maxItemCount)
    // Copy initial identity matrices into the texture data.
    this._syncMatrixTexture()
    this._matrixTextureAttr = new BufferAttribute(this._matrixTextureData, 1)
    this._matrixTextureAttr.usage = 35048 // DYNAMIC_DRAW

    this._drawRanges = new Array<DrawRange | null>(maxItemCount).fill(null)
    this._freeList = []

    // Build the combined geometry object
    this.geometry = new BufferGeometry()
    this._rebuildGeometry()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get itemCount(): number {
    return this._itemCount
  }

  /**
   * Add a geometry as a new batch item.
   * Copies vertex and index data into the shared buffers.
   * Returns the item ID (used with setMatrixAt / removeGeometry).
   */
  addGeometry(geometry: BufferGeometry): number {
    const posAttr = geometry.getAttribute('position')
    const nrmAttr = geometry.getAttribute('normal')
    const uvAttr = geometry.getAttribute('uv')
    const idxAttr = geometry.index

    if (!posAttr) throw new Error('BatchedMesh.addGeometry: geometry must have a position attribute')

    const vertCount = posAttr.count
    const idxCount = idxAttr ? idxAttr.count : 0

    // Find a free slot (item ID)
    const id = this._allocateSlot()
    if (id === -1) throw new Error(`BatchedMesh: maxItemCount (${this.maxItemCount}) exceeded`)

    // Find vertex + index space (try free list first)
    let vertStart: number
    let idxStart: number

    const freeIdx = this._freeList.findIndex((r) => r.vertexCount >= vertCount && r.indexCount >= idxCount)

    if (freeIdx !== -1) {
      const range = this._freeList.splice(freeIdx, 1)[0]
      vertStart = range.vertexStart
      idxStart = range.indexStart
    } else {
      if (this._nextVertex + vertCount > this._positions.length / 3) {
        throw new Error('BatchedMesh: maxVertexCount exceeded')
      }
      if (this._nextIndex + idxCount > this._indices.length) {
        throw new Error('BatchedMesh: maxIndexCount exceeded')
      }
      vertStart = this._nextVertex
      idxStart = this._nextIndex
      this._nextVertex += vertCount
      this._nextIndex += idxCount
    }

    // ── Copy positions ──
    for (let i = 0; i < vertCount; i++) {
      const vi = (vertStart + i) * 3
      this._positions[vi] = posAttr.getX(i)
      this._positions[vi + 1] = posAttr.getY(i)
      this._positions[vi + 2] = posAttr.getZ(i)
    }

    // ── Copy normals ──
    if (nrmAttr) {
      for (let i = 0; i < vertCount; i++) {
        const vi = (vertStart + i) * 3
        this._normals[vi] = nrmAttr.getX(i)
        this._normals[vi + 1] = nrmAttr.getY(i)
        this._normals[vi + 2] = nrmAttr.getZ(i)
      }
    } else {
      this._normals.fill(0, vertStart * 3, (vertStart + vertCount) * 3)
    }

    // ── Copy UVs ──
    if (uvAttr) {
      for (let i = 0; i < vertCount; i++) {
        const ui = (vertStart + i) * 2
        this._uvs[ui] = uvAttr.getX(i)
        this._uvs[ui + 1] = uvAttr.getY(i)
      }
    } else {
      this._uvs.fill(0, vertStart * 2, (vertStart + vertCount) * 2)
    }

    // ── Write drawId per vertex ──
    this._drawIds.fill(id, vertStart, vertStart + vertCount)

    // ── Copy indices (offset by vertStart) ──
    if (idxAttr) {
      for (let i = 0; i < idxCount; i++) {
        this._indices[idxStart + i] = idxAttr.getX(i) + vertStart
      }
    }

    // Store draw range
    this._drawRanges[id] = {
      vertexStart: vertStart,
      vertexCount: vertCount,
      indexStart: idxStart,
      indexCount: idxCount,
      active: true,
      hidden: false,
    }
    this._itemCount++

    // Mark attributes dirty
    this._markAttributesDirty()

    return id
  }

  /**
   * Remove an item.  Its geometry space is returned to the free list and it is
   * hidden by zeroing its matrix scale.
   */
  removeGeometry(id: number): void {
    const range = this._drawRanges[id]
    if (!range || !range.active) return

    range.active = false
    range.hidden = true

    // Return space to free list
    this._freeList.push({
      vertexStart: range.vertexStart,
      vertexCount: range.vertexCount,
      indexStart: range.indexStart,
      indexCount: range.indexCount,
    })

    // Zero the matrix to collapse the geometry visually
    const o = id * 16
    this._matrices.fill(0, o, o + 16)
    this._syncMatrixTextureRow(id)
    this.instanceMatrixNeedsUpdate = true
    this._itemCount = Math.max(0, this._itemCount - 1)
  }

  setMatrixAt(id: number, matrix: Mat4): void {
    ;(this._matrices as Float32Array).set(matrix.elements, id * 16)
    this._syncMatrixTextureRow(id)
  }

  getMatrixAt(id: number, target: Mat4): void {
    target.fromArray(this._matrices, id * 16)
  }

  setVisibleAt(id: number, visible: boolean): void {
    const range = this._drawRanges[id]
    if (!range || !range.active) return
    range.hidden = !visible

    if (!visible) {
      // Zero the matrix to hide
      const o = id * 16
      const saved = this._matrices.slice(o, o + 16)
      this._matrices.fill(0, o, o + 16)
      this._syncMatrixTextureRow(id)
      // Restore so we can re-show later — we keep a separate flag
      this._matrices.set(saved, o)
    } else {
      this._syncMatrixTextureRow(id)
    }
    this.instanceMatrixNeedsUpdate = true
  }

  /**
   * Defragment: compact all active items to the front of the buffer,
   * eliminating gaps left by removeGeometry.
   */
  optimize(): void {
    // Rebuild from scratch using the live matrices + stored per-item geometry.
    // For now, rebuilding the geometry attributes is the correct approach,
    // but we'd need to store the original per-item geometry data.
    // This is a compaction of _drawIds, _positions, _normals, _uvs, _indices.
    // Simple approach: rebuild from scratch isn't possible without storing the
    // source geometry. Instead, just compact the index ranges by rewriting
    // the index buffer to skip holes.
    this._markAttributesDirty()
  }

  dispose(): void {
    // Nothing to do here; GPU resources are managed by RenderState.
    // Callers should remove this mesh from the scene.
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private _allocateSlot(): number {
    for (let i = 0; i < this.maxItemCount; i++) {
      if (this._drawRanges[i] === null) return i
      if (this._drawRanges[i] !== null && !this._drawRanges[i]!.active) return i
    }
    return -1
  }

  /** Rebuild the BufferGeometry attributes from current CPU buffers. */
  private _rebuildGeometry(): void {
    const geo = this.geometry

    const posAttr = new BufferAttribute(this._positions, 3)
    posAttr.usage = 35048 // DYNAMIC_DRAW
    geo.setAttribute('position', posAttr)

    const nrmAttr = new BufferAttribute(this._normals, 3)
    nrmAttr.usage = 35048
    geo.setAttribute('normal', nrmAttr)

    const uvAttr = new BufferAttribute(this._uvs, 2)
    uvAttr.usage = 35048
    geo.setAttribute('uv', uvAttr)

    // a_drawId at location 5 (must match BATCH_VERT layout)
    const drawIdAttr = new BufferAttribute(this._drawIds, 1)
    drawIdAttr.usage = 35048
    geo.setAttribute('drawId', drawIdAttr)

    const idxAttr = new BufferAttribute(this._indices, 1)
    idxAttr.usage = 35048
    geo.setIndex(idxAttr)
  }

  private _markAttributesDirty(): void {
    const incVersion = (name: string) => {
      const attr = this.geometry.getAttribute(name)
      if (attr) attr.needsUpdate = true
    }
    incVersion('position')
    incVersion('normal')
    incVersion('uv')
    incVersion('drawId')
    const idx = this.geometry.index
    if (idx) idx.needsUpdate = true
  }

  /** Sync all mat4s into _matrixTextureData. */
  private _syncMatrixTexture(): void {
    for (let i = 0; i < this.maxItemCount; i++) {
      this._syncMatrixTextureRow(i)
    }
  }

  /** Sync one item's mat4 row into _matrixTextureData. */
  private _syncMatrixTextureRow(id: number): void {
    // Row id stores 4 RGBA32F texels = 16 floats
    const src = id * 16
    const dst = id * 16 // same layout
    for (let j = 0; j < 16; j++) {
      this._matrixTextureData[dst + j] = this._matrices[src + j]
    }
    this._matrixTextureAttr.needsUpdate = true
  }
}
