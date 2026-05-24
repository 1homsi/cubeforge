/**
 * WebGLRenderer3D — the main WebGL2 renderer.
 *
 * Render pipeline per frame:
 *   1. camera.updateMatrixWorld()
 *   2. scene.updateMatrixWorld()
 *   3. Build RenderQueue (frustum cull, sort, collect lights)
 *   4. Shadow pass — render depth maps for shadow-casting lights
 *   5. Main pass — if postProcess enabled, render into HDR FBO; else screen
 *      a. Opaque objects (front-to-back)
 *      b. Transparent objects (back-to-front)
 *   6. Post-process — bloom + composite to screen
 */

import { createContext, ShaderProgram, Texture, Framebuffer, GLBuffer, VAO } from '../core'
import { Mat4 } from '../math'
import { Scene, Camera } from '../scene'
import { Material, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, LineMaterial } from '../material'
import { Light, AmbientLight, DirectionalLight, PointLight } from '../lights'
import { Mesh, InstancedMesh, SkinnedMesh, Sprite3D, Line3D, LineSegments, LineLoop } from '../objects'
import { SPRITE_VERT, SPRITE_FRAG } from '../shaders'

import { RenderInfo, RenderState } from './RenderState'
import { RenderQueue, RenderItem } from './RenderQueue'
import { ShadowMapRenderer } from './ShadowMap'
import { PostProcess } from './PostProcess'
import { SSAOPass, SSAOOptions } from './SSAO'
import { FXAAPass } from './FXAA'
import { DOFPass, DOFOptions } from './DOF'
import { MotionBlurPass, MotionBlurOptions } from './MotionBlur'
import { OcclusionCulling } from './OcclusionCulling'
import { GBUFFER_NORMAL_VERT, GBUFFER_NORMAL_FRAG } from '../shaders'

// ---------------------------------------------------------------------------
// Public configuration types
// ---------------------------------------------------------------------------

export interface RendererOptions {
  canvas: HTMLCanvasElement
  antialias?: boolean
  alpha?: boolean
  shadowMap?: boolean
  shadowMapSize?: number
  postProcess?: boolean
  pixelRatio?: number
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Maximum number of point lights sent to the shader. */
const MAX_POINT_LIGHTS = 4

// ---------------------------------------------------------------------------
// Scratch objects (avoid per-frame GC pressure)
// ---------------------------------------------------------------------------

const _mat4A = new Mat4()
const _mat4B = new Mat4()
const _normalMatrix = new Float32Array(9)

// Extract the upper-left 3×3 normal matrix (transpose inverse of model-view).
function computeNormalMatrix(modelMat: Mat4, out: Float32Array): Float32Array {
  // normal matrix = transpose(inverse(M))
  // We only need the 3×3 rotation/scale part.
  _mat4A.copy(modelMat).invert().transpose()
  const e = _mat4A.elements
  out[0] = e[0]
  out[1] = e[1]
  out[2] = e[2]
  out[3] = e[4]
  out[4] = e[5]
  out[5] = e[6]
  out[6] = e[8]
  out[7] = e[9]
  out[8] = e[10]
  return out
}

// ---------------------------------------------------------------------------
// WebGLRenderer3D
// ---------------------------------------------------------------------------

export class WebGLRenderer3D {
  readonly gl: WebGL2RenderingContext
  readonly canvas: HTMLCanvasElement

  // ── Public configuration ──────────────────────────────────────────────────
  shadowMap: { enabled: boolean; type: 'basic' | 'pcf' }
  postProcessing: {
    enabled: boolean
    bloom: { enabled: boolean; strength: number; threshold: number; radius: number }
    toneMapping: 'none' | 'reinhard' | 'aces'
    exposure: number
    vignette: number
    ssao: { enabled: boolean; options: SSAOOptions }
    fxaa: { enabled: boolean }
    dof: { enabled: boolean; options: DOFOptions }
    motionBlur: { enabled: boolean; options: MotionBlurOptions }
  }
  /** GPU occlusion culling settings. */
  occlusionCulling: { enabled: boolean }
  pixelRatio: number
  autoClear = true
  autoClearColor = true
  autoClearDepth = true

  /** Read-only frame statistics (updated every render() call). */
  get info(): RenderInfo {
    return this._state.info
  }

  // ── Private state ─────────────────────────────────────────────────────────
  private _width = 0
  private _height = 0

  private readonly _state: RenderState
  private readonly _queue: RenderQueue
  private readonly _shadowMap: ShadowMapRenderer
  private _postProcess: PostProcess | null = null
  private _ssaoPass: SSAOPass | null = null
  private _fxaaPass: FXAAPass | null = null
  private _dofPass: DOFPass | null = null
  private _motionBlurPass: MotionBlurPass | null = null
  /** VP matrix stored at the end of each frame for the next frame's motion blur. */
  private _prevVP = new Mat4()
  /** True after the first rendered frame — avoids blurring the initial still frame. */
  private _prevVPValid = false

  /** HDR framebuffer used when post-processing is enabled. */
  private _hdrFBO: Framebuffer | null = null
  private _hdrTex: Texture | null = null

  /**
   * G-buffer FBO holding view-space normals (RGBA8, packed [0,1]).
   * Only allocated when SSAO is enabled.
   */
  private _gbufferFBO: Framebuffer | null = null
  private _gbufferNormalTex: Texture | null = null
  private _gbufferDepthTex: Texture | null = null
  private _gbufferProgram: ShaderProgram | null = null

  /** Intermediate LDR FBO used when FXAA is enabled (composite target). */
  private _ldrFBO: Framebuffer | null = null

  // ── Occlusion culling ─────────────────────────────────────────────────────
  readonly _occlusionCulling: OcclusionCulling

  // ── Cached identity light-space matrix (used when no shadow light present) ──
  private readonly _identityMat = new Mat4()

  // ── Start time for u_time uniform ──
  private readonly _startTime = performance.now()

  // ── Line render pass resources ────────────────────────────────────────────
  private _lineProgram: ShaderProgram | null = null
  private _lineVAO: VAO | null = null
  private _lineBuffer: GLBuffer | null = null

  // ── Sprite render pass resources ─────────────────────────────────────────
  /** Compiled sprite shader variants keyed by "USE_MAP" flag */
  private _spritePrograms = new Map<string, ShaderProgram>()
  /** Reusable unit-quad VAO for sprite rendering */
  private _spriteQuadVAO: VAO | null = null
  private _spriteQuadBuffer: GLBuffer | null = null

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(options: RendererOptions) {
    const { canvas } = options

    this.canvas = canvas
    this.gl = createContext(canvas, {
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
    })

    this.pixelRatio = options.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1)

    this.shadowMap = {
      enabled: options.shadowMap ?? true,
      type: 'pcf',
    }

    this.postProcessing = {
      enabled: options.postProcess ?? false,
      bloom: { enabled: true, strength: 0.04, threshold: 1.0, radius: 1.0 },
      toneMapping: 'aces',
      exposure: 1.0,
      vignette: 0.3,
      ssao: { enabled: false, options: {} },
      fxaa: { enabled: false },
      dof: { enabled: false, options: {} },
      motionBlur: { enabled: false, options: {} },
    }

    this.occlusionCulling = { enabled: false }

    // Internal subsystems
    this._state = new RenderState(this.gl)
    this._queue = new RenderQueue()
    this._shadowMap = new ShadowMapRenderer(this.gl, this._state)
    this._occlusionCulling = new OcclusionCulling(this.gl)

    if (options.postProcess) {
      this._postProcess = new PostProcess(this.gl, canvas.width, canvas.height)
    }

    // Initial size
    const w = canvas.width || canvas.clientWidth || 1
    const h = canvas.height || canvas.clientHeight || 1
    this.setSize(w, h)

    // Context loss handling
    canvas.addEventListener('webglcontextlost', this._onContextLost)
    canvas.addEventListener('webglcontextrestored', this._onContextRestored)
  }

  // ---------------------------------------------------------------------------
  // Size / pixel ratio
  // ---------------------------------------------------------------------------

  setSize(width: number, height: number): void {
    this._width = width
    this._height = height

    const pw = Math.floor(width * this.pixelRatio)
    const ph = Math.floor(height * this.pixelRatio)

    this.canvas.width = pw
    this.canvas.height = ph

    this.gl.viewport(0, 0, pw, ph)

    this._rebuildHDRFBO(pw, ph)
    this._postProcess?.resize(pw, ph)
    this._ssaoPass?.resize(pw, ph)
    this._fxaaPass?.resize(pw, ph)
    this._dofPass?.resize(pw, ph)
    this._motionBlurPass?.resize(pw, ph)
    this._rebuildGBufferFBO(pw, ph)
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = ratio
    this.setSize(this._width, this._height)
  }

  getSize(): { width: number; height: number } {
    return { width: this._width, height: this._height }
  }

  // ---------------------------------------------------------------------------
  // Clear helpers
  // ---------------------------------------------------------------------------

  clear(color = true, depth = true, stencil = false): void {
    const { gl } = this
    let mask = 0
    if (color) mask |= gl.COLOR_BUFFER_BIT
    if (depth) mask |= gl.DEPTH_BUFFER_BIT
    if (stencil) mask |= gl.STENCIL_BUFFER_BIT
    if (mask) gl.clear(mask)
  }

  clearColor(): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  clearDepth(): void {
    this.gl.clear(this.gl.DEPTH_BUFFER_BIT)
  }

  // ---------------------------------------------------------------------------
  // Main render loop
  // ---------------------------------------------------------------------------

  render(scene: Scene, camera: Camera): void {
    const { gl } = this

    // ── 1 & 2. Update matrices ──
    camera.updateMatrixWorld(true)
    scene.updateMatrixWorld(true)

    // Store for shader use
    this._state.currentCamera = camera
    this._state.currentScene = scene

    // Reset per-frame info
    this._state.resetInfo()

    // ── 3. Build render queue ──
    this._queue.extractFromScene(scene, camera)
    this._queue.sort()

    const { lights } = this._queue

    // ── Occlusion culling — beginFrame (read last round's results) ──
    this._occlusionCulling.enabled = this.occlusionCulling.enabled
    const allMeshes = [...this._queue.opaque, ...this._queue.transparent].map((i) => i.object)
    const visibleIds = this._occlusionCulling.beginFrame(allMeshes)

    // ── 4. Shadow pass ──
    if (this.shadowMap.enabled) {
      this._shadowMap.render(scene, lights)
      // Restore viewport after shadow pass
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }

    // ── 5. Main render pass ──
    const usePostProcess = this.postProcessing.enabled && this._hdrFBO !== null

    if (usePostProcess && this._hdrFBO) {
      this._hdrFBO.bind()
    } else {
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    }

    // Set viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)

    // Clear
    if (this.autoClear) {
      const bg = scene.background
      if (bg) {
        gl.clearColor(bg.x, bg.y, bg.z, 1.0)
      } else {
        gl.clearColor(0, 0, 0, 1)
      }
      this.clear(this.autoClearColor, this.autoClearDepth, false)
    }

    // Common GL state for opaque pass
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.disable(gl.BLEND)
    this._state.glState.depthWrite(true)

    // ── Render opaque ──
    for (const item of this._queue.opaque) {
      if (this.occlusionCulling.enabled && !visibleIds.has(item.object.id)) continue
      this._renderObject(item, camera, lights)
    }

    // ── Issue occlusion queries after opaque pass (depth buffer populated) ──
    if (this.occlusionCulling.enabled) {
      this._occlusionCulling.issueQueries(allMeshes, camera, this._state)
    }

    // ── Render transparent ──
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    this._state.glState.depthWrite(false)

    for (const item of this._queue.transparent) {
      if (this.occlusionCulling.enabled && !visibleIds.has(item.object.id)) continue
      this._renderObject(item, camera, lights)
    }

    // Restore depth write
    this._state.glState.depthWrite(true)

    // ── Render lines ──
    if (this._queue.lines.length > 0) {
      this._renderLines(this._queue.lines, camera)
    }

    // ── Render sprites (back-to-front, sorted by distance to camera) ──
    if (this._queue.sprites.length > 0) {
      this._renderSprites(this._queue.sprites, camera)
    }

    // ── 6. Post-process ──
    if (usePostProcess && this._hdrFBO && this._hdrTex && this._postProcess) {
      this._hdrFBO.unbind()

      // Render to screen
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.BLEND)

      const pp = this._postProcess
      const ppc = this.postProcessing

      // ── 6a. SSAO (before bloom, modulates ambient) ──
      let aoTex: Texture | null = null
      if (ppc.ssao.enabled && this._gbufferFBO && this._gbufferNormalTex && this._gbufferDepthTex) {
        // Ensure SSAOPass is created.
        if (!this._ssaoPass) {
          this._ssaoPass = new SSAOPass(gl, this.canvas.width, this.canvas.height, ppc.ssao.options)
        }
        // Run G-buffer normal pass so SSAO has normals.
        this._runGBufferPass(scene, camera)

        const aoFBO = this._ssaoPass.render(this._gbufferDepthTex, this._gbufferNormalTex, camera)
        aoTex = aoFBO.colorTexture
      }
      void aoTex // aoTex is available for future composite integration

      // ── 6b. Bloom ──
      let bloomTex: Texture = this._hdrTex // default: no bloom = use scene itself

      if (ppc.bloom.enabled) {
        bloomTex = pp.renderBloom(this._hdrTex, ppc.bloom.strength, ppc.bloom.threshold, ppc.bloom.radius)
      }

      // ── 6b-2. DOF (after bloom, before composite) ──
      // When DOF is enabled we need a depth texture. Prefer the G-buffer depth
      // (available when SSAO is also active); otherwise capture one lazily.
      let hdrTexForComposite: Texture = this._hdrTex
      if (ppc.dof.enabled) {
        // Ensure DOFPass is created
        if (!this._dofPass) {
          this._dofPass = new DOFPass(gl, this.canvas.width, this.canvas.height, ppc.dof.options)
        } else {
          // Propagate options in case they changed
          Object.assign(this._dofPass.options, ppc.dof.options)
        }

        // Acquire depth texture: use G-buffer if available, otherwise run G-buffer pass now.
        if (!this._gbufferDepthTex) {
          this._runGBufferPass(scene, camera)
        }

        if (this._gbufferDepthTex) {
          // DOF renders into a new intermediate FBO. We allocate a temporary
          // LDR FBO (reusing the existing _ldrFBO if FXAA isn't using it, or
          // just render DOF to a dedicated buffer embedded in DOFPass itself).
          // DOFPass.render writes to the currently bound FBO — bind _ldrFBO.
          if (!this._ldrFBO) {
            this._ldrFBO = this._makeLDRFBO(this.canvas.width, this.canvas.height)
          }
          this._ldrFBO.bind()
          gl.viewport(0, 0, this.canvas.width, this.canvas.height)
          gl.clear(gl.COLOR_BUFFER_BIT)
          this._dofPass.render(this._hdrTex, this._gbufferDepthTex, camera)
          this._ldrFBO.unbind()
          // Use the DOF output as the color source for the composite step.
          // We temporarily swap _hdrTex reference only for the composite call.
          hdrTexForComposite = this._ldrFBO.colorTexture
        }
      }

      // ── 6b-3. Motion Blur (after DOF, before composite) ──
      if (ppc.motionBlur.enabled && this._prevVPValid) {
        // Need depth texture for world-position reconstruction
        if (!this._gbufferDepthTex) {
          this._runGBufferPass(scene, camera)
        }

        if (this._gbufferDepthTex) {
          if (!this._motionBlurPass) {
            this._motionBlurPass = new MotionBlurPass(gl, this.canvas.width, this.canvas.height, ppc.motionBlur.options)
          } else {
            Object.assign(this._motionBlurPass.options, ppc.motionBlur.options)
          }

          // Build current VP matrix
          const currentVP = _mat4A.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse)

          const mbResult = this._motionBlurPass.render(
            hdrTexForComposite,
            this._gbufferDepthTex,
            this._prevVP,
            currentVP,
          )
          hdrTexForComposite = mbResult
        }
      }

      const tonemapMode = ppc.toneMapping === 'aces' ? 1 : ppc.toneMapping === 'reinhard' ? 0 : 2

      // ── 6c. Composite (tone map + bloom + vignette) ──
      if (ppc.fxaa.enabled) {
        // Composite to an intermediate texture, then apply FXAA to the screen.
        // For simplicity, composite to the bloom ping-pong buffer instead of
        // allocating a dedicated LDR FBO.  We create a small helper FBO on demand.
        if (!this._fxaaPass) {
          this._fxaaPass = new FXAAPass(gl, this.canvas.width, this.canvas.height)
        }
        // When DOF already used _ldrFBO we need a separate buffer for composite.
        // Re-use the same _ldrFBO since DOF output is already in hdrTexForComposite.
        if (!this._ldrFBO) {
          this._ldrFBO = this._makeLDRFBO(this.canvas.width, this.canvas.height)
        }

        // Composite to LDR FBO.
        this._ldrFBO.bind()
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clear(gl.COLOR_BUFFER_BIT)
        pp.composite(hdrTexForComposite, bloomTex, {
          exposure: ppc.exposure,
          bloomStrength: ppc.bloom.enabled ? ppc.bloom.strength : 0,
          tonemapMode,
          vignette: ppc.vignette,
        })
        this._ldrFBO.unbind()

        // FXAA to screen.
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        this._fxaaPass.render(this._ldrFBO.colorTexture)
      } else {
        pp.composite(hdrTexForComposite, bloomTex, {
          exposure: ppc.exposure,
          bloomStrength: ppc.bloom.enabled ? ppc.bloom.strength : 0,
          tonemapMode,
          vignette: ppc.vignette,
        })
      }
    }

    // ── Occlusion culling — endFrame ──
    if (this.occlusionCulling.enabled) {
      this._occlusionCulling.endFrame()
    }

    // ── Store VP matrix for motion blur next frame ──
    if (this.postProcessing.motionBlur.enabled) {
      this._prevVP.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse)
      this._prevVPValid = true
    }

    // Unbind program + VAO
    gl.useProgram(null)
    gl.bindVertexArray(null)
  }

  // ---------------------------------------------------------------------------
  // Per-object rendering
  // ---------------------------------------------------------------------------

  private _renderObject(item: RenderItem, camera: Camera, lights: Light[]): void {
    const { object, geometry, material } = item
    const { gl } = this

    if (!material.visible) return

    const isSkinned = !!(object as SkinnedMesh).isSkinnedMesh
    const isInstanced = !!(object as InstancedMesh).isInstancedMesh

    // ── Morph target count (clamped to MAX_MORPH_TARGETS = 8) ──
    const morphPositions = geometry.morphAttributes.get('position')
    const morphCount = morphPositions ? Math.min(morphPositions.length, 8) : 0

    // ── Get / compile shader ──
    const program = this._state.getShader(material, lights, isSkinned, morphCount)

    // ── Apply GL state from material ──
    this._applyMaterialState(material)

    // ── Use program ──
    this._state.glState.useProgram(program.handle)

    // ── Upload geometry ──
    const vao = this._state.getGeometryVAO(geometry, program)

    // ── Upload instance matrix buffers if needed ──
    if (isInstanced) {
      const im = object as InstancedMesh
      const entry = this._state.getGeometryEntry(geometry.id)
      if (entry) {
        this._state.uploadInstanceMatrix(
          entry,
          im.instanceMatrix.data as Float32Array,
          im.count,
          6, // base attrib location for mat4 columns
        )
        if (im.instanceColor) {
          this._state.uploadInstanceColor(entry, im.instanceColor.data as Float32Array, 10)
        }
      }
    }

    // ── Set uniforms ──
    this._setMatrixUniforms(program, object, camera)
    this._setMaterialUniforms(program, material)
    this._setLightUniforms(program, lights)
    this._setSceneUniforms(program)
    this._setShadowUniforms(program, lights)

    // ── Skinning ──
    if (isSkinned) {
      this._setSkinnedUniforms(program, object as SkinnedMesh)
    }

    // ── Morph target influences ──
    if (morphCount > 0) {
      const mesh = object as Mesh
      const influences = mesh.morphTargetInfluences
      const influenceArr = new Float32Array(morphCount)
      for (let i = 0; i < morphCount; i++) {
        influenceArr[i] = influences[i] ?? 0
      }
      program.setUniform1fv('u_morphTargetInfluences', influenceArr)
    }

    // ── Custom ShaderMaterial uniforms ──
    if (material instanceof ShaderMaterial) {
      this._setShaderMaterialUniforms(program, material)
    }

    // ── Draw ──
    vao.bind()

    const hasIndex = geometry.index !== null
    const start = item.groupStart
    const count = item.groupCount

    if (isInstanced) {
      const im = object as InstancedMesh
      if (hasIndex) {
        const indexType = geometry.index!.data instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
        const byteOffset = start * (indexType === gl.UNSIGNED_INT ? 4 : 2)
        gl.drawElementsInstanced(gl.TRIANGLES, count, indexType, byteOffset, im.count)
      } else {
        gl.drawArraysInstanced(gl.TRIANGLES, start, count, im.count)
      }

      // Stats
      const triCount = (count / 3) * im.count
      this._state.info.calls++
      this._state.info.triangles += triCount
    } else {
      const isPoints = material instanceof ShaderMaterial && material.drawMode === 'points'

      if (isPoints) {
        // Point-cloud draw — uses gl_PointSize in vertex shader
        gl.drawArrays(gl.POINTS, start, count)
        this._state.info.calls++
      } else if (material.wireframe) {
        if (hasIndex) {
          const indexType = geometry.index!.data instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
          const byteOffset = start * (indexType === gl.UNSIGNED_INT ? 4 : 2)
          gl.drawElements(gl.LINES, count, indexType, byteOffset)
        } else {
          gl.drawArrays(gl.LINES, start, count)
        }
        this._state.info.calls++
        this._state.info.triangles += Math.floor(count / 3)
      } else {
        if (hasIndex) {
          const indexType = geometry.index!.data instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
          const byteOffset = start * (indexType === gl.UNSIGNED_INT ? 4 : 2)
          gl.drawElements(gl.TRIANGLES, count, indexType, byteOffset)
        } else {
          gl.drawArrays(gl.TRIANGLES, start, count)
        }
        this._state.info.calls++
        this._state.info.triangles += Math.floor(count / 3)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Uniform helpers
  // ---------------------------------------------------------------------------

  private _setMatrixUniforms(program: ShaderProgram, object: Mesh, camera: Camera): void {
    const modelMat = object.matrixWorld
    const viewMat = camera.matrixWorldInverse
    const projMat = camera.projectionMatrix

    program.setUniformMat4fv('u_modelMatrix', modelMat.elements)
    program.setUniformMat4fv('u_viewMatrix', viewMat.elements)
    program.setUniformMat4fv('u_projectionMatrix', projMat.elements)

    // Normal matrix: transpose(inverse(modelMatrix)) — upper-left 3×3
    computeNormalMatrix(modelMat, _normalMatrix)
    program.setUniformMat3fv('u_normalMatrix', _normalMatrix)
  }

  private _setMaterialUniforms(program: ShaderProgram, material: Material): void {
    let textureUnit = 0

    if (material instanceof MeshStandardMaterial) {
      program.setUniform3f('u_color', material.color.x, material.color.y, material.color.z)
      program.setUniform1f('u_metalness', material.metalness)
      program.setUniform1f('u_roughness', material.roughness)
      program.setUniform1f('u_aoMapIntensity', material.aoMapIntensity)
      program.setUniform3f('u_emissive', material.emissive.x, material.emissive.y, material.emissive.z)
      program.setUniform1f('u_emissiveIntensity', material.emissiveIntensity)
      program.setUniform2f('u_normalScale', material.normalScale.x, material.normalScale.y)
      program.setUniform1f('u_opacity', material.opacity)

      if (material.map) {
        textureUnit = this._bindMaterialTexture(program, 'u_albedoMap', material.map.handle, textureUnit)
      }
      if (material.normalMap) {
        textureUnit = this._bindMaterialTexture(program, 'u_normalMap', material.normalMap.handle, textureUnit)
      }
      const mrMap = material.metalnessMap ?? material.roughnessMap
      if (mrMap) {
        textureUnit = this._bindMaterialTexture(program, 'u_metallicRoughnessMap', mrMap.handle, textureUnit)
      }
      if (material.aoMap) {
        textureUnit = this._bindMaterialTexture(program, 'u_aoMap', material.aoMap.handle, textureUnit)
      }
      if (material.emissiveMap) {
        textureUnit = this._bindMaterialTexture(program, 'u_emissiveMap', material.emissiveMap.handle, textureUnit)
      }

      // ── IBL textures (fixed units 8, 9, 10 — above shadow at 7 and bones at 6) ──
      if (material.irradianceMap && material.prefilteredEnvMap && material.brdfLUT) {
        const { gl } = this
        gl.activeTexture(gl.TEXTURE8)
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, material.irradianceMap)
        program.setUniform1i('u_irradianceMap', 8)

        gl.activeTexture(gl.TEXTURE9)
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, material.prefilteredEnvMap)
        program.setUniform1i('u_prefilteredEnvMap', 9)

        gl.activeTexture(gl.TEXTURE10)
        gl.bindTexture(gl.TEXTURE_2D, material.brdfLUT)
        program.setUniform1i('u_brdfLUT', 10)

        program.setUniform1f('u_envMapIntensity', material.envMapIntensity)
      }

      return
    }

    if (material instanceof MeshBasicMaterial) {
      program.setUniform3f('u_color', material.color.x, material.color.y, material.color.z)
      program.setUniform1f('u_opacity', 1.0)
      // Zero out PBR scalars so the lighting math still runs but produces flat output
      program.setUniform1f('u_metalness', 0.0)
      program.setUniform1f('u_roughness', 1.0)
      program.setUniform3f('u_emissive', 0, 0, 0)
      program.setUniform1f('u_emissiveIntensity', 1.0)
      program.setUniform1f('u_aoMapIntensity', 0.0)
      program.setUniform2f('u_normalScale', 1, 1)

      if (material.map) {
        textureUnit = this._bindMaterialTexture(program, 'u_albedoMap', material.map.handle, textureUnit)
      }
      return
    }

    // ShaderMaterial — uniforms handled separately in _setShaderMaterialUniforms
  }

  private _bindMaterialTexture(
    program: ShaderProgram,
    uniformName: string,
    handle: WebGLTexture,
    unit: number,
  ): number {
    const { gl } = this
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, handle)
    program.setUniform1i(uniformName, unit)
    return unit + 1
  }

  private _setLightUniforms(program: ShaderProgram, lights: Light[]): void {
    const scene = this._state.currentScene

    // ── Ambient ──
    const ambient = scene?.ambientColor ?? { x: 0.1, y: 0.1, z: 0.1 }
    let ar = ambient.x,
      ag = ambient.y,
      ab = ambient.z

    // Accumulate additional AmbientLight contributions
    for (const light of lights) {
      if (light instanceof AmbientLight) {
        ar += light.color.x * light.intensity
        ag += light.color.y * light.intensity
        ab += light.color.z * light.intensity
      }
    }
    program.setUniform3f('u_ambientColor', ar, ag, ab)

    // ── Camera position ──
    const cam = this._state.currentCamera
    if (cam) {
      const ce = cam.matrixWorld.elements
      program.setUniform3f('u_cameraPos', ce[12], ce[13], ce[14])
      // Alias used by sky/star shaders (and custom ShaderMaterial authors)
      program.setUniform3f('u_cameraPosition', ce[12], ce[13], ce[14])
    }

    // ── Directional light (first one found) ──
    let dirSet = false
    for (const light of lights) {
      if (light instanceof DirectionalLight) {
        // Direction from light toward scene (i.e. negative of light's forward)
        const le = light.matrixWorld.elements
        // Column 2 of the world matrix is the -Z (forward) direction
        const dx = -le[8],
          dy = -le[9],
          dz = -le[10]
        // Normalize
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
        program.setUniform3f('u_dirLightDir', dx / len, dy / len, dz / len)
        program.setUniform3f('u_dirLightColor', light.color.x, light.color.y, light.color.z)
        program.setUniform1f('u_dirLightIntensity', light.intensity)
        dirSet = true
        break
      }
    }
    if (!dirSet) {
      program.setUniform3f('u_dirLightDir', 0, -1, 0)
      program.setUniform3f('u_dirLightColor', 0, 0, 0)
      program.setUniform1f('u_dirLightIntensity', 0)
    }

    // ── Point lights (up to MAX_POINT_LIGHTS) ──
    const pointLights: PointLight[] = []
    for (const light of lights) {
      if (light instanceof PointLight && pointLights.length < MAX_POINT_LIGHTS) {
        pointLights.push(light)
      }
    }
    program.setUniform1i('u_pointLightCount', pointLights.length)

    const posArr = new Float32Array(MAX_POINT_LIGHTS * 3)
    const colArr = new Float32Array(MAX_POINT_LIGHTS * 3)
    const intArr = new Float32Array(MAX_POINT_LIGHTS)
    const rngArr = new Float32Array(MAX_POINT_LIGHTS)

    for (let i = 0; i < pointLights.length; i++) {
      const pl = pointLights[i]
      const pe = pl.matrixWorld.elements
      posArr[i * 3] = pe[12]
      posArr[i * 3 + 1] = pe[13]
      posArr[i * 3 + 2] = pe[14]
      colArr[i * 3] = pl.color.x
      colArr[i * 3 + 1] = pl.color.y
      colArr[i * 3 + 2] = pl.color.z
      intArr[i] = pl.intensity
      rngArr[i] = pl.distance
    }

    program.setUniform3fv('u_pointLightPos', posArr)
    program.setUniform3fv('u_pointLightColor', colArr)
    program.setUniform1fv('u_pointLightIntensity', intArr)
    program.setUniform1fv('u_pointLightRange', rngArr)
  }

  private _setSceneUniforms(program: ShaderProgram): void {
    const scene = this._state.currentScene
    const t = (performance.now() - this._startTime) * 0.001
    program.setUniform1f('u_time', t)

    if (scene?.fog) {
      program.setUniform3f('u_fogColor', scene.fog.color.x, scene.fog.color.y, scene.fog.color.z)
      program.setUniform1f('u_fogNear', scene.fog.near)
      program.setUniform1f('u_fogFar', scene.fog.far)
    }
  }

  private _setShadowUniforms(program: ShaderProgram, lights: Light[]): void {
    const { gl } = this

    // Find the first shadow-casting directional light with a valid shadow map
    for (const light of lights) {
      if (!(light instanceof DirectionalLight) || !light.castShadow) continue
      const shadow = light.shadow
      if (!shadow || !shadow.map) continue

      // Light-space matrix
      const lightSpaceMat = _mat4B.multiplyMatrices(shadow.camera.projectionMatrix, shadow.camera.matrixWorldInverse)
      program.setUniformMat4fv('u_lightSpaceMatrix', lightSpaceMat.elements)
      program.setUniform1f('u_shadowBias', shadow.bias)

      // Bind shadow depth texture
      const shadowMap = shadow.map
      const depthTex = shadowMap.depthTexture
      if (depthTex) {
        const unit = 7 // reserve a fixed unit for the shadow map
        this._state.glState.bindTexture(unit, gl.TEXTURE_2D, depthTex.handle)
        program.setUniform1i('u_shadowMap', unit)
      }
      return
    }

    // No shadow light — set identity light-space matrix
    program.setUniformMat4fv('u_lightSpaceMatrix', this._identityMat.elements)
  }

  private _setSkinnedUniforms(program: ShaderProgram, mesh: SkinnedMesh): void {
    const { gl } = this
    if (!mesh.skeleton) return

    mesh.skeleton.update(gl)

    if (mesh.skeleton.boneTexture) {
      const unit = 6 // dedicated unit for bone texture
      this._state.glState.bindTexture(unit, gl.TEXTURE_2D, mesh.skeleton.boneTexture)
      program.setUniform1i('u_boneTexture', unit)
      program.setUniform1i('u_boneCount', mesh.skeleton.bones.length)
    }
  }

  private _setShaderMaterialUniforms(program: ShaderProgram, material: ShaderMaterial): void {
    const { gl } = this
    let textureUnit = 0

    for (const [name, uniform] of Object.entries(material.uniforms)) {
      const { value } = uniform

      if (value === null || value === undefined) continue

      if (typeof value === 'number') {
        program.setUniform1f(name, value)
        continue
      }
      if (typeof value === 'boolean') {
        program.setUniform1i(name, value ? 1 : 0)
        continue
      }
      if (value instanceof Float32Array) {
        if (value.length === 16) {
          program.setUniformMat4fv(name, value)
        } else if (value.length === 9) {
          program.setUniformMat3fv(name, value)
        } else {
          program.setUniform1fv(name, value)
        }
        continue
      }
      if (Array.isArray(value)) {
        switch (value.length) {
          case 2:
            program.setUniform2f(name, value[0], value[1])
            break
          case 3:
            program.setUniform3f(name, value[0], value[1], value[2])
            break
          case 4:
            program.setUniform4f(name, value[0], value[1], value[2], value[3])
            break
          default:
            program.setUniform1fv(name, new Float32Array(value as number[]))
            break
        }
        continue
      }
      // WebGLTexture or object with .handle (Texture class)
      const handle = (value as { handle?: WebGLTexture }).handle ?? (value instanceof WebGLTexture ? value : null)
      if (handle) {
        gl.activeTexture(gl.TEXTURE0 + textureUnit)
        gl.bindTexture(gl.TEXTURE_2D, handle as WebGLTexture)
        program.setUniform1i(name, textureUnit)
        textureUnit++
      }
    }
  }

  // ---------------------------------------------------------------------------
  // GL state management
  // ---------------------------------------------------------------------------

  private _applyMaterialState(material: Material): void {
    const { gl } = this
    const glState = this._state.glState

    // Depth test
    if (material.depthTest) {
      glState.enable(gl.DEPTH_TEST)
    } else {
      glState.disable(gl.DEPTH_TEST)
    }

    // Depth write
    glState.depthWrite(material.depthWrite)

    // Culling
    if (material.side === 'double') {
      glState.disable(gl.CULL_FACE)
    } else {
      glState.enable(gl.CULL_FACE)
      glState.cullFace(material.side === 'back' ? gl.FRONT : gl.BACK)
    }

    // Blending
    if (material.transparent) {
      glState.enable(gl.BLEND)
      switch (material.blending) {
        case 'additive':
          glState.blendFunc(gl.SRC_ALPHA, gl.ONE)
          break
        case 'multiply':
          glState.blendFunc(gl.DST_COLOR, gl.ZERO)
          break
        default:
          glState.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
          break
      }
    } else {
      glState.disable(gl.BLEND)
    }
  }

  // ---------------------------------------------------------------------------
  // HDR framebuffer
  // ---------------------------------------------------------------------------

  private _rebuildHDRFBO(w: number, h: number): void {
    if (this._hdrFBO) {
      this._hdrFBO.dispose()
      this._hdrFBO = null
      this._hdrTex = null
    }

    if (!this.postProcessing.enabled) return

    const { gl } = this

    // Check for float texture support
    const canHalfFloat = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')

    const internalFormat = canHalfFloat ? gl.RGBA16F : gl.RGBA8
    const type = canHalfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE

    const fbo = new Framebuffer(gl, w, h)

    const colorTex = Texture.createEmpty(gl, w, h, {
      internalFormat,
      format: gl.RGBA,
      type,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    })

    fbo.attachColor(colorTex, 0)
    fbo.attachDepthRenderbuffer()
    fbo.check()

    this._hdrFBO = fbo
    this._hdrTex = colorTex
  }

  // ---------------------------------------------------------------------------
  // G-buffer (normals + depth for SSAO)
  // ---------------------------------------------------------------------------

  private _rebuildGBufferFBO(w: number, h: number): void {
    if (this._gbufferFBO) {
      this._gbufferFBO.dispose()
      this._gbufferNormalTex?.dispose()
      this._gbufferDepthTex?.dispose()
      this._gbufferFBO = null
      this._gbufferNormalTex = null
      this._gbufferDepthTex = null
    }
    if (this._ldrFBO) {
      this._ldrFBO.dispose()
      this._ldrFBO = null
    }

    if (!this.postProcessing.enabled) return

    const { gl } = this

    // Normal texture (RGBA8 — packed view-space normals).
    const normalTex = Texture.createEmpty(gl, w, h, {
      internalFormat: gl.RGBA8,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    })

    // Depth texture (DEPTH_COMPONENT24 — used by SSAO for reconstruction).
    const depthTex = new Texture(gl)
    gl.bindTexture(gl.TEXTURE_2D, depthTex.handle)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)

    const fbo = new Framebuffer(gl, w, h)
    fbo.attachColor(normalTex, 0)
    fbo.attachDepth(depthTex)
    fbo.check()

    this._gbufferFBO = fbo
    this._gbufferNormalTex = normalTex
    this._gbufferDepthTex = depthTex
  }

  /**
   * Render the scene into the G-buffer (normals + depth) for SSAO consumption.
   * This is a lightweight depth+normal prepass — no lighting, no textures.
   */
  private _runGBufferPass(_scene: Scene, camera: Camera): void {
    if (!this._gbufferFBO || !this._gbufferNormalTex) return
    const { gl } = this

    if (!this._gbufferProgram) {
      this._gbufferProgram = new ShaderProgram(gl, GBUFFER_NORMAL_VERT, GBUFFER_NORMAL_FRAG)
    }

    this._gbufferFBO.bind()
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.disable(gl.BLEND)

    const prog = this._gbufferProgram
    this._state.glState.useProgram(prog.handle)

    // Iterate opaque render items and draw them with the gbuffer shader.
    for (const item of this._queue.opaque) {
      const { object, geometry } = item
      if (!object.visible) continue

      const posAttr = geometry.getAttribute('position')
      const normAttr = geometry.getAttribute('normal')
      if (!posAttr || !normAttr) continue

      const modelMat = object.matrixWorld
      const viewMat = camera.matrixWorldInverse
      const projMat = camera.projectionMatrix

      prog.setUniformMat4fv('u_modelMatrix', modelMat.elements)
      prog.setUniformMat4fv('u_viewMatrix', viewMat.elements)
      prog.setUniformMat4fv('u_projectionMatrix', projMat.elements)
      computeNormalMatrix(modelMat, _normalMatrix)
      prog.setUniformMat3fv('u_normalMatrix', _normalMatrix)

      const vao = this._state.getGeometryVAO(geometry, prog)
      vao.bind()

      const hasIndex = geometry.index !== null
      const start = item.groupStart
      const count = item.groupCount

      if (hasIndex) {
        const indexType = geometry.index!.data instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
        const byteOffset = start * (indexType === gl.UNSIGNED_INT ? 4 : 2)
        gl.drawElements(gl.TRIANGLES, count, indexType, byteOffset)
      } else {
        gl.drawArrays(gl.TRIANGLES, start, count)
      }
    }

    gl.bindVertexArray(null)
    this._gbufferFBO.unbind()
  }

  /** Create an LDR FBO for the FXAA composite target. */
  private _makeLDRFBO(w: number, h: number): Framebuffer {
    const { gl } = this
    const fbo = new Framebuffer(gl, w, h)
    const tex = Texture.createEmpty(gl, w, h, {
      internalFormat: gl.RGBA8,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    })
    fbo.attachColor(tex, 0)
    fbo.check()
    return fbo
  }

  // ---------------------------------------------------------------------------
  // Line render pass
  // ---------------------------------------------------------------------------

  private _getLineProgram(): ShaderProgram {
    if (this._lineProgram) return this._lineProgram

    const { gl } = this
    const vert = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
void main() {
  gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 1.0);
}
`
    const frag = `#version 300 es
precision highp float;
uniform vec3 u_color;
uniform float u_opacity;
out vec4 fragColor;
void main() {
  fragColor = vec4(u_color, u_opacity);
}
`
    this._lineProgram = new ShaderProgram(gl, vert, frag)
    return this._lineProgram
  }

  private _renderLines(lines: Line3D[], camera: Camera): void {
    const { gl } = this
    const glState = this._state.glState

    const program = this._getLineProgram()
    glState.useProgram(program.handle)

    // Lines respect depth test but typically do not write depth
    gl.enable(gl.DEPTH_TEST)
    glState.depthWrite(false)
    gl.disable(gl.CULL_FACE)

    for (const line of lines) {
      if (!line.visible) continue

      const posAttr = line.geometry.getAttribute('position')
      if (!posAttr || posAttr.count === 0) continue

      // Upload / reuse position buffer
      if (!this._lineVAO) {
        this._lineVAO = new VAO(gl)
        this._lineBuffer = new GLBuffer(gl, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW)
      }

      this._lineVAO.bind()
      this._lineBuffer!.bind()
      this._lineBuffer!.upload(posAttr.data as unknown as ArrayBuffer)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)

      // Matrices
      const modelMat = line.matrixWorld
      const viewMat = camera.matrixWorldInverse
      const projMat = camera.projectionMatrix
      program.setUniformMat4fv('u_modelMatrix', modelMat.elements)
      program.setUniformMat4fv('u_viewMatrix', viewMat.elements)
      program.setUniformMat4fv('u_projectionMatrix', projMat.elements)

      // Color / opacity from LineMaterial (or fallback)
      const mat = line.material
      if (mat instanceof LineMaterial) {
        program.setUniform3f('u_color', mat.color.x, mat.color.y, mat.color.z)
        program.setUniform1f('u_opacity', 1.0)
      } else {
        program.setUniform3f('u_color', 1, 1, 1)
        program.setUniform1f('u_opacity', 1.0)
      }

      // Choose primitive type based on Line3D subclass
      let primitive: GLenum = gl.LINE_STRIP
      if (line instanceof LineSegments) {
        primitive = gl.LINES
      } else if (line instanceof LineLoop) {
        primitive = gl.LINE_LOOP
      }

      gl.drawArrays(primitive, 0, posAttr.count)
      this._state.info.calls++

      gl.bindVertexArray(null)
    }

    glState.depthWrite(true)
    gl.enable(gl.CULL_FACE)
  }

  // ---------------------------------------------------------------------------
  // Sprite render pass
  // ---------------------------------------------------------------------------

  private _getSpriteProgram(useMap: boolean): ShaderProgram {
    const key = useMap ? 'MAP' : ''
    let program = this._spritePrograms.get(key)
    if (program) return program

    const { gl } = this
    const defines = useMap ? '#define USE_MAP\n' : ''
    // Inject define after #version line
    const injectDefine = (src: string, def: string): string => {
      if (!def) return src
      const nl = src.indexOf('\n')
      return nl === -1 ? src + '\n' + def : src.slice(0, nl + 1) + def + src.slice(nl + 1)
    }
    program = new ShaderProgram(gl, injectDefine(SPRITE_VERT, defines), injectDefine(SPRITE_FRAG, defines))
    this._spritePrograms.set(key, program)
    return program
  }

  private _ensureSpriteQuad(): void {
    if (this._spriteQuadVAO) return

    const { gl } = this
    // Unit quad: 2 triangles covering [-0.5, 0.5] on X and Y
    // Vertex layout: vec2 a_position (location 0)
    const verts = new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5])

    this._spriteQuadVAO = new VAO(gl)
    this._spriteQuadBuffer = new GLBuffer(gl, gl.ARRAY_BUFFER, gl.STATIC_DRAW)

    this._spriteQuadVAO.bind()
    this._spriteQuadBuffer.bind()
    this._spriteQuadBuffer.upload(verts as unknown as ArrayBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
  }

  private _renderSprites(sprites: Sprite3D[], camera: Camera): void {
    const { gl } = this
    const glState = this._state.glState

    this._ensureSpriteQuad()

    // Sort back-to-front by distance to camera
    const camE = camera.matrixWorld.elements
    const camPx = camE[12],
      camPy = camE[13],
      camPz = camE[14]
    const fwdX = -camE[8],
      fwdY = -camE[9],
      fwdZ = -camE[10]

    const sorted = sprites.slice().sort((a, b) => {
      const ae = a.matrixWorld.elements
      const be = b.matrixWorld.elements
      const adist = (ae[12] - camPx) * fwdX + (ae[13] - camPy) * fwdY + (ae[14] - camPz) * fwdZ
      const bdist = (be[12] - camPx) * fwdX + (be[13] - camPy) * fwdY + (be[14] - camPz) * fwdZ
      return bdist - adist // back-to-front
    })

    gl.enable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)

    this._spriteQuadVAO!.bind()

    for (const sprite of sorted) {
      if (!sprite.visible) continue

      const mat = sprite.material
      const useMap = mat.map !== null

      const program = this._getSpriteProgram(useMap)
      glState.useProgram(program.handle)

      // Depth test / depth write
      if (mat.depthTest) {
        glState.enable(gl.DEPTH_TEST)
      } else {
        glState.disable(gl.DEPTH_TEST)
      }
      glState.depthWrite(mat.depthWrite)

      // Blending
      glState.enable(gl.BLEND)
      if (mat.blending === 'additive') {
        glState.blendFunc(gl.SRC_ALPHA, gl.ONE)
      } else {
        glState.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      }

      // World-space center
      const mwE = sprite.matrixWorld.elements
      const cx = mwE[12],
        cy = mwE[13],
        cz = mwE[14]

      // Scale: extract from matrixWorld columns
      const sx = Math.sqrt(mwE[0] ** 2 + mwE[1] ** 2 + mwE[2] ** 2)
      const sy = Math.sqrt(mwE[4] ** 2 + mwE[5] ** 2 + mwE[6] ** 2)

      // Size attenuation: 1.0 = perspective, 0.0 = fixed screen size
      const sizeAttenuation = mat.sizeAttenuation ? 1.0 : 0.0

      program.setUniformMat4fv('u_viewMatrix', camera.matrixWorldInverse.elements)
      program.setUniformMat4fv('u_projectionMatrix', camera.projectionMatrix.elements)
      program.setUniform3f('u_center', cx, cy, cz)
      program.setUniform2f('u_scale', sx, sy)
      program.setUniform2f('u_center_pivot', sprite.center.x, sprite.center.y)
      program.setUniform1f('u_rotation', mat.rotation)
      program.setUniform1f('u_sizeAttenuation', sizeAttenuation)
      program.setUniform3f('u_color', mat.color.x, mat.color.y, mat.color.z)
      program.setUniform1f('u_opacity', mat.opacity)

      if (useMap && mat.map) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, mat.map.handle)
        program.setUniform1i('u_map', 0)
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6)
      this._state.info.calls++
    }

    gl.bindVertexArray(null)
    glState.depthWrite(true)
    glState.enable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.enable(gl.CULL_FACE)
  }

  // ---------------------------------------------------------------------------
  // Context loss
  // ---------------------------------------------------------------------------

  private _onContextLost = (event: Event): void => {
    event.preventDefault()
    this._state.reset()
    this._shadowMap.dispose()
    console.warn('[WebGLRenderer3D] Context lost — GPU resources invalidated.')
  }

  private _onContextRestored = (): void => {
    console.info('[WebGLRenderer3D] Context restored — rebuilding resources.')
    this._rebuildHDRFBO(this.canvas.width, this.canvas.height)
  }

  // ---------------------------------------------------------------------------
  // Disposal
  // ---------------------------------------------------------------------------

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored)

    this._state.dispose()
    this._shadowMap.dispose()
    this._postProcess?.dispose()
    this._ssaoPass?.dispose()
    this._fxaaPass?.dispose()
    this._dofPass?.dispose()
    this._motionBlurPass?.dispose()
    this._gbufferProgram?.dispose()

    if (this._hdrFBO) {
      this._hdrFBO.dispose()
      this._hdrFBO = null
      this._hdrTex = null
    }
    if (this._gbufferFBO) {
      this._gbufferFBO.dispose()
      this._gbufferNormalTex?.dispose()
      this._gbufferDepthTex?.dispose()
      this._gbufferFBO = null
      this._gbufferNormalTex = null
      this._gbufferDepthTex = null
    }
    if (this._ldrFBO) {
      this._ldrFBO.dispose()
      this._ldrFBO = null
    }

    // Line pass resources
    this._lineProgram?.dispose()
    this._lineProgram = null
    this._lineVAO?.dispose()
    this._lineVAO = null
    this._lineBuffer?.dispose()
    this._lineBuffer = null

    // Sprite pass resources
    for (const prog of this._spritePrograms.values()) prog.dispose()
    this._spritePrograms.clear()
    this._spriteQuadVAO?.dispose()
    this._spriteQuadVAO = null
    this._spriteQuadBuffer?.dispose()
    this._spriteQuadBuffer = null
  }
}
