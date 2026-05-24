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

import { createContext, ShaderProgram, Texture, Framebuffer } from '../core'
import { Mat4 } from '../math'
import { Scene, Camera } from '../scene'
import {
  Material,
  MeshStandardMaterial,
  MeshBasicMaterial,
  ShaderMaterial,
} from '../material'
import {
  Light,
  AmbientLight,
  DirectionalLight,
  PointLight,
} from '../lights'
import { Mesh, InstancedMesh, SkinnedMesh } from '../objects'

import { RenderInfo, RenderState } from './RenderState'
import { RenderQueue, RenderItem } from './RenderQueue'
import { ShadowMapRenderer } from './ShadowMap'
import { PostProcess } from './PostProcess'

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
  out[0] = e[0]; out[1] = e[1]; out[2] = e[2]
  out[3] = e[4]; out[4] = e[5]; out[5] = e[6]
  out[6] = e[8]; out[7] = e[9]; out[8] = e[10]
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
  }
  pixelRatio: number
  autoClear      = true
  autoClearColor = true
  autoClearDepth = true

  /** Read-only frame statistics (updated every render() call). */
  get info(): RenderInfo {
    return this._state.info
  }

  // ── Private state ─────────────────────────────────────────────────────────
  private _width  = 0
  private _height = 0

  private readonly _state:      RenderState
  private readonly _queue:      RenderQueue
  private readonly _shadowMap:  ShadowMapRenderer
  private _postProcess: PostProcess | null = null

  /** HDR framebuffer used when post-processing is enabled. */
  private _hdrFBO:  Framebuffer | null = null
  private _hdrTex:  Texture     | null = null

  // ── Cached identity light-space matrix (used when no shadow light present) ──
  private readonly _identityMat = new Mat4()

  // ── Start time for u_time uniform ──
  private readonly _startTime = performance.now()

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(options: RendererOptions) {
    const { canvas } = options

    this.canvas = canvas
    this.gl = createContext(canvas, {
      antialias: options.antialias ?? true,
      alpha:     options.alpha    ?? false,
      depth:     true,
      stencil:   false,
      powerPreference: 'high-performance',
    })

    this.pixelRatio = options.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1)

    this.shadowMap = {
      enabled: options.shadowMap ?? true,
      type:    'pcf',
    }

    this.postProcessing = {
      enabled:     options.postProcess ?? false,
      bloom:       { enabled: true, strength: 0.04, threshold: 1.0, radius: 1.0 },
      toneMapping: 'aces',
      exposure:    1.0,
      vignette:    0.3,
    }

    // Internal subsystems
    this._state   = new RenderState(this.gl)
    this._queue   = new RenderQueue()
    this._shadowMap = new ShadowMapRenderer(this.gl, this._state)

    if (options.postProcess) {
      this._postProcess = new PostProcess(this.gl, canvas.width, canvas.height)
    }

    // Initial size
    const w = canvas.width  || canvas.clientWidth  || 1
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
    this._width  = width
    this._height = height

    const pw = Math.floor(width  * this.pixelRatio)
    const ph = Math.floor(height * this.pixelRatio)

    this.canvas.width  = pw
    this.canvas.height = ph

    this.gl.viewport(0, 0, pw, ph)

    this._rebuildHDRFBO(pw, ph)
    this._postProcess?.resize(pw, ph)
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
    if (color)   mask |= gl.COLOR_BUFFER_BIT
    if (depth)   mask |= gl.DEPTH_BUFFER_BIT
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
    this._state.currentScene  = scene

    // Reset per-frame info
    this._state.resetInfo()

    // ── 3. Build render queue ──
    this._queue.extractFromScene(scene, camera)
    this._queue.sort()

    const { lights } = this._queue

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
      this._renderObject(item, camera, lights)
    }

    // ── Render transparent ──
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    this._state.glState.depthWrite(false)

    for (const item of this._queue.transparent) {
      this._renderObject(item, camera, lights)
    }

    // Restore depth write
    this._state.glState.depthWrite(true)

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

      let bloomTex: Texture = this._hdrTex // default: no bloom = use scene itself

      if (ppc.bloom.enabled) {
        bloomTex = pp.renderBloom(
          this._hdrTex,
          ppc.bloom.strength,
          ppc.bloom.threshold,
          ppc.bloom.radius,
        )
      }

      const tonemapMode =
        ppc.toneMapping === 'aces'     ? 1 :
        ppc.toneMapping === 'reinhard' ? 0 : 2

      pp.composite(this._hdrTex, bloomTex, {
        exposure:     ppc.exposure,
        bloomStrength: ppc.bloom.enabled ? ppc.bloom.strength : 0,
        tonemapMode,
        vignette:     ppc.vignette,
      })
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

    const isSkinned  = !!(object as SkinnedMesh).isSkinnedMesh
    const isInstanced = !!(object as InstancedMesh).isInstancedMesh

    // ── Get / compile shader ──
    const program = this._state.getShader(material, lights, isSkinned)

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
          this._state.uploadInstanceColor(
            entry,
            im.instanceColor.data as Float32Array,
            10,
          )
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

    // ── Custom ShaderMaterial uniforms ──
    if (material instanceof ShaderMaterial) {
      this._setShaderMaterialUniforms(program, material)
    }

    // ── Draw ──
    vao.bind()

    const hasIndex   = geometry.index !== null
    const start      = item.groupStart
    const count      = item.groupCount

    if (isInstanced) {
      const im = object as InstancedMesh
      if (hasIndex) {
        const indexType = geometry.index!.data instanceof Uint32Array
          ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
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
      if (material.wireframe) {
        if (hasIndex) {
          const indexType = geometry.index!.data instanceof Uint32Array
            ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
          const byteOffset = start * (indexType === gl.UNSIGNED_INT ? 4 : 2)
          gl.drawElements(gl.LINES, count, indexType, byteOffset)
        } else {
          gl.drawArrays(gl.LINES, start, count)
        }
      } else {
        if (hasIndex) {
          const indexType = geometry.index!.data instanceof Uint32Array
            ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
          const byteOffset = start * (indexType === gl.UNSIGNED_INT ? 4 : 2)
          gl.drawElements(gl.TRIANGLES, count, indexType, byteOffset)
        } else {
          gl.drawArrays(gl.TRIANGLES, start, count)
        }
      }

      this._state.info.calls++
      this._state.info.triangles += Math.floor(count / 3)
    }
  }

  // ---------------------------------------------------------------------------
  // Uniform helpers
  // ---------------------------------------------------------------------------

  private _setMatrixUniforms(
    program: ShaderProgram,
    object: Mesh,
    camera: Camera,
  ): void {
    const modelMat = object.matrixWorld
    const viewMat  = camera.matrixWorldInverse
    const projMat  = camera.projectionMatrix

    program.setUniformMat4fv('u_modelMatrix',      modelMat.elements)
    program.setUniformMat4fv('u_viewMatrix',        viewMat.elements)
    program.setUniformMat4fv('u_projectionMatrix',  projMat.elements)

    // Normal matrix: transpose(inverse(modelMatrix)) — upper-left 3×3
    computeNormalMatrix(modelMat, _normalMatrix)
    program.setUniformMat3fv('u_normalMatrix', _normalMatrix)
  }

  private _setMaterialUniforms(program: ShaderProgram, material: Material): void {
    let textureUnit = 0

    if (material instanceof MeshStandardMaterial) {
      program.setUniform3f('u_color',          material.color.x, material.color.y, material.color.z)
      program.setUniform1f('u_metalness',      material.metalness)
      program.setUniform1f('u_roughness',      material.roughness)
      program.setUniform1f('u_aoMapIntensity', material.aoMapIntensity)
      program.setUniform3f('u_emissive',       material.emissive.x, material.emissive.y, material.emissive.z)
      program.setUniform1f('u_emissiveIntensity', material.emissiveIntensity)
      program.setUniform2f('u_normalScale',    material.normalScale.x, material.normalScale.y)
      program.setUniform1f('u_opacity',        material.opacity)

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

      return
    }

    if (material instanceof MeshBasicMaterial) {
      program.setUniform3f('u_color',   material.color.x, material.color.y, material.color.z)
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
    let ar = ambient.x, ag = ambient.y, ab = ambient.z

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
    }

    // ── Directional light (first one found) ──
    let dirSet = false
    for (const light of lights) {
      if (light instanceof DirectionalLight) {
        // Direction from light toward scene (i.e. negative of light's forward)
        const le = light.matrixWorld.elements
        // Column 2 of the world matrix is the -Z (forward) direction
        const dx = -le[8], dy = -le[9], dz = -le[10]
        // Normalize
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
        program.setUniform3f('u_dirLightDir',       dx / len, dy / len, dz / len)
        program.setUniform3f('u_dirLightColor',     light.color.x, light.color.y, light.color.z)
        program.setUniform1f('u_dirLightIntensity', light.intensity)
        dirSet = true
        break
      }
    }
    if (!dirSet) {
      program.setUniform3f('u_dirLightDir',       0, -1, 0)
      program.setUniform3f('u_dirLightColor',     0, 0, 0)
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
      posArr[i * 3]     = pe[12]
      posArr[i * 3 + 1] = pe[13]
      posArr[i * 3 + 2] = pe[14]
      colArr[i * 3]     = pl.color.x
      colArr[i * 3 + 1] = pl.color.y
      colArr[i * 3 + 2] = pl.color.z
      intArr[i]          = pl.intensity
      rngArr[i]          = pl.distance
    }

    program.setUniform3fv('u_pointLightPos',       posArr)
    program.setUniform3fv('u_pointLightColor',     colArr)
    program.setUniform1fv('u_pointLightIntensity', intArr)
    program.setUniform1fv('u_pointLightRange',     rngArr)
  }

  private _setSceneUniforms(program: ShaderProgram): void {
    const scene = this._state.currentScene
    const t = (performance.now() - this._startTime) * 0.001
    program.setUniform1f('u_time', t)

    if (scene?.fog) {
      program.setUniform3f('u_fogColor', scene.fog.color.x, scene.fog.color.y, scene.fog.color.z)
      program.setUniform1f('u_fogNear',  scene.fog.near)
      program.setUniform1f('u_fogFar',   scene.fog.far)
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
      const lightSpaceMat = _mat4B.multiplyMatrices(
        shadow.camera.projectionMatrix,
        shadow.camera.matrixWorldInverse,
      )
      program.setUniformMat4fv('u_lightSpaceMatrix', lightSpaceMat.elements)
      program.setUniform1f('u_shadowBias', shadow.bias)

      // Bind shadow depth texture
      const shadowMap = shadow.map
      const depthTex  = shadowMap.depthTexture
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
      program.setUniform1i('u_boneCount',   mesh.skeleton.bones.length)
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
          case 2: program.setUniform2f(name, value[0], value[1]); break
          case 3: program.setUniform3f(name, value[0], value[1], value[2]); break
          case 4: program.setUniform4f(name, value[0], value[1], value[2], value[3]); break
          default: program.setUniform1fv(name, new Float32Array(value as number[])); break
        }
        continue
      }
      // WebGLTexture or object with .handle (Texture class)
      const handle = (value as { handle?: WebGLTexture }).handle
        ?? (value instanceof WebGLTexture ? value : null)
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
    const canHalfFloat = !!gl.getExtension('EXT_color_buffer_float') ||
                         !!gl.getExtension('EXT_color_buffer_half_float')

    const internalFormat = canHalfFloat ? gl.RGBA16F : gl.RGBA8
    const type           = canHalfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE

    const fbo = new Framebuffer(gl, w, h)

    const colorTex = Texture.createEmpty(gl, w, h, {
      internalFormat,
      format:    gl.RGBA,
      type,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS:     gl.CLAMP_TO_EDGE,
      wrapT:     gl.CLAMP_TO_EDGE,
    })

    fbo.attachColor(colorTex, 0)
    fbo.attachDepthRenderbuffer()
    fbo.check()

    this._hdrFBO = fbo
    this._hdrTex = colorTex
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

    if (this._hdrFBO) {
      this._hdrFBO.dispose()
      this._hdrFBO = null
      this._hdrTex = null
    }
  }
}
