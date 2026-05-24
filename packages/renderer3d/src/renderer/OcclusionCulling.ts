/**
 * OcclusionCulling — GPU occlusion queries via WebGL2 ANY_SAMPLES_PASSED_CONSERVATIVE.
 *
 * Pipeline per frame:
 *   1. beginFrame()    — read results from queries issued two frames ago;
 *                        returns the set of Object3D ids that passed.
 *   2. (render Z-prepass / main pass)
 *   3. issueQueries()  — for each object render its AABB inside an occlusion
 *                        query against the depth buffer already written.
 *   4. endFrame()      — advance the frame ring buffer.
 *
 * Two-frame delay avoids stalling the GPU pipeline on readback.
 *
 * AABB rendering uses a tiny depth-only shader so no colour writes happen.
 */

import { ShaderProgram } from '../core'
import { Mat4 } from '../math'
import { Camera } from '../scene'
import { Mesh } from '../objects'
import { RenderState } from './RenderState'

// ---------------------------------------------------------------------------
// Depth-only AABB shaders
// ---------------------------------------------------------------------------

const AABB_VERT = /* glsl */ `#version 300 es
precision highp float;
// 8 corners of the unit cube [−1,+1]³  (provided as a_position)
layout(location = 0) in vec3 a_position;

uniform mat4 u_mvp;
uniform vec3 u_aabbMin;
uniform vec3 u_aabbMax;

void main() {
  // Remap from [-1,+1] to [aabbMin, aabbMax]
  vec3 pos = mix(u_aabbMin, u_aabbMax, a_position * 0.5 + 0.5);
  gl_Position = u_mvp * vec4(pos, 1.0);
}
`

const AABB_FRAG = /* glsl */ `#version 300 es
precision highp float;
// No colour output — depth only.
void main() {}
`

// ---------------------------------------------------------------------------
// Pending query record
// ---------------------------------------------------------------------------

interface PendingQuery {
  objectId: number
  query: WebGLQuery
}

// ---------------------------------------------------------------------------
// Ring buffer slot (two-frame delay)
// ---------------------------------------------------------------------------

interface FrameSlot {
  pending: PendingQuery[]
}

// ---------------------------------------------------------------------------
// OcclusionCulling
// ---------------------------------------------------------------------------

export class OcclusionCulling {
  enabled = true
  /**
   * Re-issue queries every `queryInterval` frames (default 2).
   * Objects default to visible between query cycles.
   */
  queryInterval = 2

  private readonly _gl: WebGL2RenderingContext
  private readonly _program: ShaderProgram

  /** AABB unit-cube vertex buffer (8 vertices × 3 floats). */
  private readonly _aabbVBO: WebGLBuffer
  /** AABB index buffer (12 triangles × 3 indices = 36 indices). */
  private readonly _aabbIBO: WebGLBuffer
  private readonly _aabbVAO: WebGLVertexArrayObject

  /** Pool of reusable WebGLQuery objects. */
  private readonly _queryPool: WebGLQuery[] = []

  /** Ring: [currentSlot, previousSlot] */
  private readonly _slots: [FrameSlot, FrameSlot] = [{ pending: [] }, { pending: [] }]
  private _slotIndex = 0
  private _frameCount = 0

  /** Ids visible from the last resolved query round. */
  private _visibleIds = new Set<number>()

  /** Scratch VP matrix. */
  private readonly _vpMat = new Mat4()

  constructor(gl: WebGL2RenderingContext) {
    this._gl = gl
    this._program = new ShaderProgram(gl, AABB_VERT, AABB_FRAG)

    // ── Unit cube geometry ────────────────────────────────────────────────────
    // 8 corners in [-1,+1]³
    const corners = new Float32Array([
      -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    ])

    // 12 triangles (6 faces × 2 triangles)
    const cubeIndices = new Uint16Array([
      0,
      1,
      2,
      0,
      2,
      3, // -Z face
      4,
      6,
      5,
      4,
      7,
      6, // +Z face
      0,
      4,
      5,
      0,
      5,
      1, // -Y face
      2,
      6,
      7,
      2,
      7,
      3, // +Y face
      0,
      3,
      7,
      0,
      7,
      4, // -X face
      1,
      5,
      6,
      1,
      6,
      2, // +X face
    ])

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('OcclusionCulling: failed to create VAO')
    this._aabbVAO = vao

    const vbo = gl.createBuffer()
    if (!vbo) throw new Error('OcclusionCulling: failed to create VBO')
    this._aabbVBO = vbo

    const ibo = gl.createBuffer()
    if (!ibo) throw new Error('OcclusionCulling: failed to create IBO')
    this._aabbIBO = ibo

    gl.bindVertexArray(this._aabbVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this._aabbVBO)
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._aabbIBO)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW)

    gl.bindVertexArray(null)
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Called at the START of each frame before any rendering.
   * Reads the results of queries issued queryInterval frames ago and returns
   * the set of Object3D ids that passed the occlusion test.
   *
   * On the first frames before any results are available all objects are
   * considered visible.
   */
  beginFrame(objects: Mesh[]): Set<number> {
    if (!this.enabled) {
      // Return all ids as visible
      const all = new Set<number>()
      for (const obj of objects) all.add(obj.id)
      return all
    }

    this._frameCount++

    // Read the slot from two frames ago (previous slot in ring)
    const readSlot = this._slots[1 - this._slotIndex]

    if (readSlot.pending.length > 0) {
      // Try to read all pending queries without blocking.
      const gl = this._gl
      const resolved: PendingQuery[] = []
      const remaining: PendingQuery[] = []

      for (const pq of readSlot.pending) {
        const ready = gl.getQueryParameter(pq.query, gl.QUERY_RESULT_AVAILABLE)
        if (ready) {
          const passed = gl.getQueryParameter(pq.query, gl.QUERY_RESULT) as number
          if (passed) this._visibleIds.add(pq.objectId)
          this._returnQueryToPool(pq.query)
          resolved.push(pq)
        } else {
          remaining.push(pq)
        }
      }

      if (remaining.length === 0) {
        // All resolved — clear the set and rebuild from this round
        if (resolved.length > 0) {
          // The visible set was updated above; clear pending list.
          readSlot.pending.length = 0
        }
      } else {
        // Not all resolved yet; keep remaining for next frame.
        readSlot.pending = remaining
      }
    }

    // If we have no visibility data yet treat everything as visible.
    if (this._frameCount <= 2 || this._visibleIds.size === 0) {
      const all = new Set<number>()
      for (const obj of objects) all.add(obj.id)
      return all
    }

    return new Set(this._visibleIds)
  }

  /**
   * Called AFTER the Z-prepass / opaque pass when the depth buffer is already
   * populated.  Issues one occlusion query per object (AABB vs depth buffer).
   *
   * Only issues new queries every `queryInterval` frames to amortise cost.
   */
  issueQueries(objects: Mesh[], camera: Camera, _renderState: RenderState): void {
    if (!this.enabled) return
    if (this._frameCount % this.queryInterval !== 0) return

    const gl = this._gl
    const slot = this._slots[this._slotIndex]

    // Return leftover queries from this slot back to the pool.
    for (const pq of slot.pending) {
      this._returnQueryToPool(pq.query)
    }
    slot.pending.length = 0

    // Reset the visible set for this new round of queries.
    this._visibleIds.clear()

    // Build VP matrix.
    this._vpMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const mvp = new Mat4()

    // Configure GL state for AABB depth test (no colour write, depth test on).
    gl.useProgram(this._program.handle)
    gl.bindVertexArray(this._aabbVAO)
    gl.colorMask(false, false, false, false)
    gl.depthMask(false)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    const mvpLoc = gl.getUniformLocation(this._program.handle, 'u_mvp')
    const minLoc = gl.getUniformLocation(this._program.handle, 'u_aabbMin')
    const maxLoc = gl.getUniformLocation(this._program.handle, 'u_aabbMax')

    for (const obj of objects) {
      // Ensure bounding box is available.
      const geo = obj.geometry
      if (!geo.boundingBox) geo.computeBoundingBox()
      const bb = geo.boundingBox!

      // MVP = VP × model
      mvp.multiplyMatrices(this._vpMat, obj.matrixWorld)

      // Upload uniforms.
      if (mvpLoc) gl.uniformMatrix4fv(mvpLoc, false, mvp.elements)
      if (minLoc) gl.uniform3f(minLoc, bb.min.x, bb.min.y, bb.min.z)
      if (maxLoc) gl.uniform3f(maxLoc, bb.max.x, bb.max.y, bb.max.z)

      // Allocate and issue query.
      const query = this._acquireQuery()
      gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, query)
      gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0)
      gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE)

      slot.pending.push({ objectId: obj.id, query })
    }

    // Restore GL state.
    gl.colorMask(true, true, true, true)
    gl.depthMask(true)
    gl.bindVertexArray(null)
    gl.useProgram(null)
  }

  /**
   * Called at the END of each frame.  Advances the ring-buffer slot.
   */
  endFrame(): void {
    if (!this.enabled) return
    this._slotIndex = 1 - this._slotIndex
  }

  dispose(): void {
    const gl = this._gl
    this._program.dispose()
    gl.deleteBuffer(this._aabbVBO)
    gl.deleteBuffer(this._aabbIBO)
    gl.deleteVertexArray(this._aabbVAO)
    for (const q of this._queryPool) gl.deleteQuery(q)
    for (const slot of this._slots) {
      for (const pq of slot.pending) gl.deleteQuery(pq.query)
      slot.pending.length = 0
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private _acquireQuery(): WebGLQuery {
    const pooled = this._queryPool.pop()
    if (pooled) return pooled
    const q = this._gl.createQuery()
    if (!q) throw new Error('OcclusionCulling: failed to create WebGLQuery')
    return q
  }

  private _returnQueryToPool(q: WebGLQuery): void {
    this._queryPool.push(q)
  }
}
