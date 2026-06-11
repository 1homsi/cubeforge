/**
 * RenderState — GL state cache, compiled shader cache, and geometry VAO cache.
 * Wraps GLState to provide renderer-level resource lifecycle management.
 */

import { GLState, ShaderProgram, GLBuffer, VAO } from '../core'
import { Material, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial } from '../material'
import { BufferGeometry, BufferAttribute } from '../geometry'
import { Light, DirectionalLight } from '../lights'
import { Camera, Scene } from '../scene'
import { STANDARD_VERT, STANDARD_FRAG, SKINNED_VERT } from '../shaders'

/** First attribute location reserved for morph target position data. */
const MORPH_ATTRIB_BASE = 11
/** Maximum morph targets supported per mesh. */
const MAX_MORPH_TARGETS = 8

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface RenderInfo {
  calls: number
  triangles: number
  points: number
  frame: number
}

/** Per-geometry GPU resources. */
interface GeometryGPUEntry {
  vao: VAO
  indexBuffer: GLBuffer | null
  attributeBuffers: Map<string, GLBuffer>
  /** Track attribute versions to detect needsUpdate */
  attributeVersions: Map<string, number>
  indexVersion: number
}

// ---------------------------------------------------------------------------
// RenderState
// ---------------------------------------------------------------------------

export class RenderState {
  readonly gl: WebGL2RenderingContext
  readonly glState: GLState

  info: RenderInfo = { calls: 0, triangles: 0, points: 0, frame: 0 }

  currentCamera: Camera | null = null
  currentScene: Scene | null = null

  /** Shader cache: key → ShaderProgram */
  private _shaderCache = new Map<string, ShaderProgram>()

  /** Geometry GPU resource cache: geometry.id → entry */
  private _geometryCache = new Map<number, GeometryGPUEntry>()

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.glState = new GLState(gl)
  }

  // -------------------------------------------------------------------------
  // Frame management
  // -------------------------------------------------------------------------

  resetInfo(): void {
    this.info.calls = 0
    this.info.triangles = 0
    this.info.points = 0
    this.info.frame++
  }

  // -------------------------------------------------------------------------
  // Shader cache
  // -------------------------------------------------------------------------

  /**
   * Build a cache key and return (compiling if necessary) a ShaderProgram for
   * the given material + light configuration.
   */
  getShader(material: Material, lights: Light[], isSkinned = false, morphCount = 0): ShaderProgram {
    const key = this._shaderKey(material, lights, isSkinned, morphCount)
    let program = this._shaderCache.get(key)
    if (program) return program

    program = this._compileForMaterial(material, lights, isSkinned, morphCount)
    this._shaderCache.set(key, program)
    return program
  }

  private _shaderKey(material: Material, lights: Light[], isSkinned: boolean, morphCount: number): string {
    const parts: string[] = [material.type, isSkinned ? 'S' : '', morphCount > 0 ? `M${morphCount}` : '']

    if (material instanceof MeshStandardMaterial) {
      if (material.map) parts.push('A')
      if (material.normalMap) parts.push('N')
      if (material.metalnessMap || material.roughnessMap) parts.push('MR')
      if (material.aoMap) parts.push('AO')
      if (material.emissiveMap) parts.push('E')
      if (material.flatShading) parts.push('FS')
      if (material.irradianceMap && material.prefilteredEnvMap && material.brdfLUT) parts.push('IBL')
    }

    // Encode light config: any fog, any shadow
    const scene = this.currentScene
    if (scene?.fog) parts.push('FOG')

    // Shadow define: check if any directional light casts shadows
    const hasShadow = lights.some((l) => l instanceof DirectionalLight && l.castShadow && l.shadow?.map)
    if (hasShadow) parts.push('SH')

    if (material instanceof ShaderMaterial) {
      // Use material.id so different ShaderMaterials (e.g. sky vs. stars) each
      // get their own compiled program even when defines are identical.
      parts.push(`sm${material.id}`)
      parts.push(JSON.stringify(material.defines))
    }

    return parts.join('|')
  }

  private _buildDefines(material: Material, lights: Light[], _isSkinned: boolean, morphCount: number): string {
    const lines: string[] = ['#version 300 es']
    const scene = this.currentScene

    if (material instanceof MeshStandardMaterial) {
      if (material.map) lines.push('#define USE_ALBEDO_MAP')
      if (material.normalMap) lines.push('#define USE_NORMAL_MAP')
      if (material.metalnessMap || material.roughnessMap) lines.push('#define USE_METALLIC_ROUGHNESS_MAP')
      if (material.aoMap) lines.push('#define USE_AO_MAP')
      if (material.emissiveMap) lines.push('#define USE_EMISSIVE_MAP')
      if (material.flatShading) lines.push('#define USE_FLAT_SHADING')
      if (material.irradianceMap && material.prefilteredEnvMap && material.brdfLUT) lines.push('#define USE_IBL')
    }

    if (scene?.fog) lines.push('#define USE_FOG')

    const hasShadow = lights.some((l) => l instanceof DirectionalLight && l.castShadow && l.shadow?.map)
    if (hasShadow) lines.push('#define USE_SHADOW_MAP')

    if (morphCount > 0) {
      lines.push('#define USE_MORPHTARGETS')
      lines.push(`#define MORPHTARGETS_COUNT ${morphCount}`)
    }

    return lines.slice(1).join('\n') // strip the leading #version we added
  }

  /**
   * Build the morph target attribute declarations (inserted after #version)
   * and the unrolled MORPHTARGETS_APPLY accumulation block.
   * Morph position attrs: locations MORPH_ATTRIB_BASE + i*2
   * Morph normal attrs:   locations MORPH_ATTRIB_BASE + i*2 + 1
   */
  private _buildMorphPreamble(morphCount: number): { attrDecls: string; applyBlock: string } {
    const decls: string[] = []
    const apply: string[] = []
    for (let i = 0; i < morphCount; i++) {
      const posLoc = MORPH_ATTRIB_BASE + i * 2
      const nrmLoc = MORPH_ATTRIB_BASE + i * 2 + 1
      decls.push(`layout(location = ${posLoc}) in vec3 a_morphPosition${i};`)
      decls.push(`layout(location = ${nrmLoc}) in vec3 a_morphNormal${i};`)
      apply.push(`  morphedPosition += u_morphTargetInfluences[${i}] * (a_morphPosition${i} - a_position);`)
      apply.push(`  morphedNormal   += u_morphTargetInfluences[${i}] * (a_morphNormal${i}   - a_normal);`)
    }
    return {
      attrDecls: decls.join('\n'),
      applyBlock: apply.join('\n'),
    }
  }

  private _injectDefines(src: string, defines: string): string {
    if (!defines) return src
    const newlineIdx = src.indexOf('\n')
    if (newlineIdx === -1) return src + '\n' + defines
    return src.slice(0, newlineIdx + 1) + defines + '\n' + src.slice(newlineIdx + 1)
  }

  private _compileForMaterial(
    material: Material,
    lights: Light[],
    isSkinned: boolean,
    morphCount: number,
  ): ShaderProgram {
    const { gl } = this

    if (material instanceof ShaderMaterial) {
      const vert = material.injectDefines(material.vertexShader)
      const frag = material.injectDefines(material.fragmentShader)
      return new ShaderProgram(gl, vert, frag)
    }

    const defines = this._buildDefines(material, lights, isSkinned, morphCount)

    if (material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial) {
      const vertSrc = isSkinned ? SKINNED_VERT : STANDARD_VERT
      const fragSrc = STANDARD_FRAG
      const vertWithDefines = this._injectDefines(vertSrc, defines)
      const fragWithDefines = this._injectDefines(fragSrc, defines)
      const finalVert = morphCount > 0 ? this._injectMorphPreamble(vertWithDefines, morphCount) : vertWithDefines
      return new ShaderProgram(gl, finalVert, fragWithDefines)
    }

    // Fallback: standard shader
    const vertWithDefines = this._injectDefines(STANDARD_VERT, defines)
    const finalVert = morphCount > 0 ? this._injectMorphPreamble(vertWithDefines, morphCount) : vertWithDefines
    return new ShaderProgram(gl, finalVert, this._injectDefines(STANDARD_FRAG, defines))
  }

  /**
   * Inject morph target attribute declarations after the #version line,
   * and replace the MORPHTARGETS_APPLY placeholder with the unrolled block.
   */
  private _injectMorphPreamble(src: string, morphCount: number): string {
    const { attrDecls, applyBlock } = this._buildMorphPreamble(morphCount)
    // Insert attribute declarations after the first newline (#version line)
    const newlineIdx = src.indexOf('\n')
    const withDecls =
      newlineIdx === -1
        ? src + '\n' + attrDecls
        : src.slice(0, newlineIdx + 1) + attrDecls + '\n' + src.slice(newlineIdx + 1)
    // Replace MORPHTARGETS_APPLY placeholder with the unrolled accumulation
    return withDecls.replace('MORPHTARGETS_APPLY', applyBlock)
  }

  // -------------------------------------------------------------------------
  // Geometry / VAO cache
  // -------------------------------------------------------------------------

  /**
   * Upload geometry to the GPU if not already cached, or sync any attributes
   * that have `needsUpdate` (version change). Returns the bound VAO.
   */
  getGeometryVAO(geometry: BufferGeometry, program: ShaderProgram): VAO {
    const { gl } = this
    let entry = this._geometryCache.get(geometry.id)

    if (!entry) {
      entry = {
        vao: new VAO(gl),
        indexBuffer: null,
        attributeBuffers: new Map(),
        attributeVersions: new Map(),
        indexVersion: -1,
      }
      this._geometryCache.set(geometry.id, entry)
    }

    const { vao, attributeBuffers, attributeVersions } = entry

    vao.bind()

    // ── Index buffer ──
    if (geometry.index !== null) {
      const idx = geometry.index
      if (entry.indexVersion !== idx.version) {
        if (!entry.indexBuffer) {
          entry.indexBuffer = new GLBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, idx.usage)
        }
        entry.indexBuffer.bind()
        entry.indexBuffer.upload(idx.data as unknown as ArrayBuffer)
        entry.indexVersion = idx.version
      } else if (entry.indexBuffer) {
        entry.indexBuffer.bind()
      }
    }

    // ── Attribute buffers ──
    const attrLocations: Record<string, number> = {
      position: 0,
      normal: 1,
      uv: 2,
      tangent: 3,
      skinIndex: 4, // a_joints in SKINNED_VERT uses location 4
      skinWeight: 5, // a_weights uses location 5
      instanceMatrix: 6,
    }

    for (const [name, attr] of geometry.attributes) {
      let loc = attrLocations[name]
      if (loc === undefined) {
        loc = program.getAttribLocation(name)
        if (loc < 0) continue
      }

      const cachedVersion = attributeVersions.get(name) ?? -1
      let buf = attributeBuffers.get(name)

      if (!buf || cachedVersion !== attr.version) {
        if (!buf) {
          buf = new GLBuffer(gl, gl.ARRAY_BUFFER, attr.usage)
          attributeBuffers.set(name, buf)
        }
        buf.bind()
        buf.upload(attr.data as unknown as ArrayBuffer)
        attributeVersions.set(name, attr.version)
      }

      const glType = this._glTypeForAttribute(attr)
      vao.setAttribute(loc, buf, attr.itemSize, glType, attr.normalized, 0, 0)
    }

    // ── Morph target attribute buffers ──
    // morphAttributes is a Map<'position'|'normal', BufferAttribute[]>
    const morphPositions = geometry.morphAttributes.get('position') ?? []
    const morphNormals = geometry.morphAttributes.get('normal') ?? []
    const morphCount = Math.min(morphPositions.length, MAX_MORPH_TARGETS)

    for (let i = 0; i < morphCount; i++) {
      const posAttr = morphPositions[i]
      if (posAttr) {
        const posKey = `__morphPosition${i}__`
        const posLoc = MORPH_ATTRIB_BASE + i * 2
        const posVersion = attributeVersions.get(posKey) ?? -1
        let posBuf = attributeBuffers.get(posKey)
        if (!posBuf || posVersion !== posAttr.version) {
          if (!posBuf) {
            posBuf = new GLBuffer(gl, gl.ARRAY_BUFFER, posAttr.usage)
            attributeBuffers.set(posKey, posBuf)
          }
          posBuf.bind()
          posBuf.upload(posAttr.data as unknown as ArrayBuffer)
          attributeVersions.set(posKey, posAttr.version)
        }
        vao.setAttribute(posLoc, posBuf, posAttr.itemSize, gl.FLOAT, false, 0, 0)
      }

      const nrmAttr = morphNormals[i]
      if (nrmAttr) {
        const nrmKey = `__morphNormal${i}__`
        const nrmLoc = MORPH_ATTRIB_BASE + i * 2 + 1
        const nrmVersion = attributeVersions.get(nrmKey) ?? -1
        let nrmBuf = attributeBuffers.get(nrmKey)
        if (!nrmBuf || nrmVersion !== nrmAttr.version) {
          if (!nrmBuf) {
            nrmBuf = new GLBuffer(gl, gl.ARRAY_BUFFER, nrmAttr.usage)
            attributeBuffers.set(nrmKey, nrmBuf)
          }
          nrmBuf.bind()
          nrmBuf.upload(nrmAttr.data as unknown as ArrayBuffer)
          attributeVersions.set(nrmKey, nrmAttr.version)
        }
        vao.setAttribute(nrmLoc, nrmBuf, nrmAttr.itemSize, gl.FLOAT, false, 0, 0)
      }
    }

    return vao
  }

  private _glTypeForAttribute(attr: BufferAttribute): GLenum {
    const { gl } = this
    if (attr.data instanceof Float32Array) return gl.FLOAT
    if (attr.data instanceof Uint16Array) return gl.UNSIGNED_SHORT
    if (attr.data instanceof Uint32Array) return gl.UNSIGNED_INT
    return gl.FLOAT
  }

  // -------------------------------------------------------------------------
  // Instanced mesh support
  // -------------------------------------------------------------------------

  /**
   * Upload per-instance matrix data as 4 consecutive vec4 attribute slots
   * starting at location `baseLocation` (default 6).
   */
  uploadInstanceMatrix(entry: GeometryGPUEntry, data: Float32Array, _instanceCount: number, baseLocation = 6): void {
    const { gl } = this
    const { vao } = entry

    let buf = entry.attributeBuffers.get('__instanceMatrix__')
    if (!buf) {
      buf = new GLBuffer(gl, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW)
      entry.attributeBuffers.set('__instanceMatrix__', buf)
    }
    buf.bind()
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)

    vao.bind()
    const stride = 16 * 4 // 16 floats × 4 bytes
    for (let col = 0; col < 4; col++) {
      const loc = baseLocation + col
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, stride, col * 16)
      gl.vertexAttribDivisor(loc, 1)
    }
  }

  uploadInstanceColor(entry: GeometryGPUEntry, data: Float32Array, colorLocation = 10): void {
    const { gl } = this
    const { vao } = entry

    let buf = entry.attributeBuffers.get('__instanceColor__')
    if (!buf) {
      buf = new GLBuffer(gl, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW)
      entry.attributeBuffers.set('__instanceColor__', buf)
    }
    buf.bind()
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)

    vao.bind()
    gl.enableVertexAttribArray(colorLocation)
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(colorLocation, 1)
  }

  getGeometryEntry(geometryId: number): GeometryGPUEntry | undefined {
    return this._geometryCache.get(geometryId)
  }

  // -------------------------------------------------------------------------
  // Context loss recovery / cleanup
  // -------------------------------------------------------------------------

  /** Clear all caches (call after context loss). */
  reset(): void {
    this._shaderCache.clear()
    this._geometryCache.clear()
    this.glState.reset()
  }

  /** Destroy all GPU resources. */
  dispose(): void {
    for (const program of this._shaderCache.values()) {
      program.dispose()
    }
    this._shaderCache.clear()

    for (const entry of this._geometryCache.values()) {
      entry.vao.dispose()
      entry.indexBuffer?.dispose()
      for (const buf of entry.attributeBuffers.values()) {
        buf.dispose()
      }
    }
    this._geometryCache.clear()
  }
}
