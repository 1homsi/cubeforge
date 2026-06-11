/**
 * CascadeShadowMap (CSM) — improves shadow quality over large scenes by
 * splitting the view frustum into N sub-frusta (cascades) and rendering a
 * separate shadow map for each.
 *
 * Usage:
 *   const csm = new CascadeShadowMap(gl, { cascades: 4, shadowMapSize: 1024 })
 *   // every frame:
 *   csm.update(camera, lightDir)
 *   csm.render(gl, scene, renderState)
 *   // then bind csm.shadowMaps[i].depthTexture + csm.lightSpaceMatrices[i]
 *   // and csm.splitDepths[i] in your main shader
 */

import { Texture, Framebuffer, ShaderProgram } from '../core'
import { Mat4, Vec3 } from '../math'
import { Scene, Camera, PerspectiveCamera } from '../scene'
import { Mesh, SkinnedMesh } from '../objects'
import { SHADOW_VERT, SHADOW_FRAG, SKINNED_VERT } from '../shaders'
import { RenderState } from './RenderState'

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface CSMOptions {
  /** Number of cascade splits (default 4) */
  cascades?: number
  /** Depth-map resolution per cascade (default 1024) */
  shadowMapSize?: number
  /** Blend between uniform (0) and logarithmic (1) splits (default 0.5) */
  lambda?: number
  /** Constant depth bias (default −0.0005) */
  bias?: number
  /** Normal-offset bias in world units (default 0) */
  normalBias?: number
  /** Maximum shadow draw distance from camera (default 500) */
  maxDistance?: number
}

// ---------------------------------------------------------------------------
// Scratch maths (avoids per-frame allocations)
// ---------------------------------------------------------------------------

const _up = new Vec3(0, 1, 0)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute 8 world-space corners of a perspective frustum slice [near, far]. */
function frustumSliceCorners(camera: PerspectiveCamera, sliceNear: number, sliceFar: number): Vec3[] {
  const fovRad = (camera.fov * Math.PI) / 180
  const aspect = camera.aspect
  const tanHalfFov = Math.tan(fovRad * 0.5)

  const nearH = sliceNear * tanHalfFov
  const nearW = nearH * aspect
  const farH = sliceFar * tanHalfFov
  const farW = farH * aspect

  // Camera space corners → world space via matrixWorld
  const mw = camera.matrixWorld.elements
  const ex = mw[8],
    ey = mw[9],
    ez = mw[10] // -Z (forward)
  const rx = mw[0],
    ry = mw[1],
    rz = mw[2] // +X right
  const ux = mw[4],
    uy = mw[5],
    uz = mw[6] // +Y up
  const ox = mw[12],
    oy = mw[13],
    oz = mw[14] // origin

  // NOTE: in OpenGL camera looks toward -Z, so forward = -e
  const fwx = -ex,
    fwy = -ey,
    fwz = -ez

  const nc = [ox + fwx * sliceNear, oy + fwy * sliceNear, oz + fwz * sliceNear] // near center
  const fc = [ox + fwx * sliceFar, oy + fwy * sliceFar, oz + fwz * sliceFar] // far center

  const corners: Vec3[] = [
    new Vec3(nc[0] + rx * nearW + ux * nearH, nc[1] + ry * nearW + uy * nearH, nc[2] + rz * nearW + uz * nearH),
    new Vec3(nc[0] - rx * nearW + ux * nearH, nc[1] - ry * nearW + uy * nearH, nc[2] - rz * nearW + uz * nearH),
    new Vec3(nc[0] + rx * nearW - ux * nearH, nc[1] + ry * nearW - uy * nearH, nc[2] + rz * nearW - uz * nearH),
    new Vec3(nc[0] - rx * nearW - ux * nearH, nc[1] - ry * nearW - uy * nearH, nc[2] - rz * nearW - uz * nearH),
    new Vec3(fc[0] + rx * farW + ux * farH, fc[1] + ry * farW + uy * farH, fc[2] + rz * farW + uz * farH),
    new Vec3(fc[0] - rx * farW + ux * farH, fc[1] - ry * farW + uy * farH, fc[2] - rz * farW + uz * farH),
    new Vec3(fc[0] + rx * farW - ux * farH, fc[1] + ry * farW - uy * farH, fc[2] + rz * farW - uz * farH),
    new Vec3(fc[0] - rx * farW - ux * farH, fc[1] - ry * farW - uy * farH, fc[2] - rz * farW - uz * farH),
  ]
  return corners
}

/** Pick up vector that isn't parallel to lightDir. */
function safeUp(lightDir: Vec3): Vec3 {
  const dot = Math.abs(lightDir.x * 0 + lightDir.y * 1 + lightDir.z * 0)
  if (dot > 0.99) {
    return new Vec3(0, 0, 1)
  }
  return _up
}

/** Build a tight orthographic view matrix for the given frustum corners from lightDir. */
function buildLightSpaceMatrix(corners: Vec3[], lightDir: Vec3, shadowMapSize: number): Mat4 {
  // Light-view matrix: look from infinity along -lightDir toward scene center
  const center = new Vec3()
  for (const c of corners) {
    center.x += c.x
    center.y += c.y
    center.z += c.z
  }
  center.x /= corners.length
  center.y /= corners.length
  center.z /= corners.length

  const eye = new Vec3(center.x - lightDir.x, center.y - lightDir.y, center.z - lightDir.z)

  const viewMat = new Mat4().lookAt(eye, center, safeUp(lightDir))
  // lookAt gives world→local, we need the inverse for the view transform
  const viewInv = new Mat4().copy(viewMat).invert()

  // Transform all corners into light space and find AABB
  let minX = Infinity,
    maxX = -Infinity
  let minY = Infinity,
    maxY = -Infinity
  let minZ = Infinity,
    maxZ = -Infinity

  const ve = viewInv.elements
  for (const c of corners) {
    // view-space = viewInv^-1 * world = viewMat^T ... easier: just use inverse
    // We stored viewInv so we need its inverse = viewMat for the transform.
    // Recompute: point in light-view = viewMat * worldPoint
    const mw = viewMat.elements
    const lx = mw[0] * c.x + mw[4] * c.y + mw[8] * c.z + mw[12]
    const ly = mw[1] * c.x + mw[5] * c.y + mw[9] * c.z + mw[13]
    const lz = mw[2] * c.x + mw[6] * c.y + mw[10] * c.z + mw[14]
    if (lx < minX) minX = lx
    if (lx > maxX) maxX = lx
    if (ly < minY) minY = ly
    if (ly > maxY) maxY = ly
    if (lz < minZ) minZ = lz
    if (lz > maxZ) maxZ = lz
  }
  void ve // suppress unused warning

  // Add a small margin to avoid edge-swimming artefacts
  const margin = 2
  minX -= margin
  maxX += margin
  minY -= margin
  maxY += margin

  // Snap orthographic origin to texel-size increments (eliminate shimmering).
  const worldUnitsPerTexel = Math.max(maxX - minX, maxY - minY) / shadowMapSize
  const snapX = (v: number): number => Math.floor(v / worldUnitsPerTexel) * worldUnitsPerTexel
  minX = snapX(minX)
  maxX = snapX(maxX)
  minY = snapX(minY)
  maxY = snapX(maxY)

  // Extend the Z range a bit so objects behind the camera cast shadows
  const zMargin = 50
  const projMat = new Mat4().makeOrthographic(minX, maxX, maxY, minY, minZ - zMargin, maxZ + zMargin)

  return new Mat4().multiplyMatrices(projMat, viewMat)
}

/** Practical split scheme: blend uniform and logarithmic distributions. */
function computeSplitDepths(n: number, near: number, far: number, lambda: number): Float32Array {
  const out = new Float32Array(n + 1)
  out[0] = near
  for (let i = 1; i < n; i++) {
    const ratio = i / n
    const log = near * Math.pow(far / near, ratio)
    const uni = near + (far - near) * ratio
    out[i] = lambda * log + (1 - lambda) * uni
  }
  out[n] = far
  return out
}

// ---------------------------------------------------------------------------
// CascadeShadowMap
// ---------------------------------------------------------------------------

export class CascadeShadowMap {
  readonly cascades: number

  /** One depth FBO per cascade. */
  shadowMaps: Framebuffer[]

  /** One light-space VP matrix per cascade (ready to upload as mat4). */
  lightSpaceMatrices: Mat4[]

  /** (cascades+1) near/far values in view space for shader sampling. */
  splitDepths: Float32Array

  readonly bias: number
  readonly normalBias: number

  private readonly gl: WebGL2RenderingContext
  private readonly _shadowMapSize: number
  private readonly _lambda: number
  private readonly _maxDistance: number

  private _shadowProgram: ShaderProgram | null = null
  private _shadowSkinnedProgram: ShaderProgram | null = null

  constructor(gl: WebGL2RenderingContext, opts: CSMOptions = {}) {
    this.gl = gl
    this.cascades = opts.cascades ?? 4
    this._shadowMapSize = opts.shadowMapSize ?? 1024
    this._lambda = opts.lambda ?? 0.5
    this.bias = opts.bias ?? -0.0005
    this.normalBias = opts.normalBias ?? 0
    this._maxDistance = opts.maxDistance ?? 500

    this.shadowMaps = []
    this.lightSpaceMatrices = []
    this.splitDepths = new Float32Array(this.cascades + 1)

    for (let i = 0; i < this.cascades; i++) {
      this.shadowMaps.push(this._createShadowFBO(this._shadowMapSize))
      this.lightSpaceMatrices.push(new Mat4())
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Recompute cascade splits and per-cascade light-space matrices.
   * Call once per frame before render().
   */
  update(camera: Camera, lightDirection: Vec3): void {
    if (!(camera instanceof PerspectiveCamera)) return

    const near = camera.near
    const far = Math.min(camera.far, this._maxDistance)

    this.splitDepths = computeSplitDepths(this.cascades, near, far, this._lambda)

    // Normalise light direction (make a unit vector pointing FROM light)
    const ld = new Vec3(lightDirection.x, lightDirection.y, lightDirection.z)
    const llen = Math.sqrt(ld.x * ld.x + ld.y * ld.y + ld.z * ld.z) || 1
    ld.x /= llen
    ld.y /= llen
    ld.z /= llen

    for (let i = 0; i < this.cascades; i++) {
      const sliceNear = this.splitDepths[i]
      const sliceFar = this.splitDepths[i + 1]
      const corners = frustumSliceCorners(camera, sliceNear, sliceFar)
      this.lightSpaceMatrices[i] = buildLightSpaceMatrix(corners, ld, this._shadowMapSize)
    }
  }

  /**
   * Render a depth pass for each cascade.
   * Must be called after update().
   */
  render(gl: WebGL2RenderingContext, scene: Scene, renderState: RenderState): void {
    const staticProg = this._getShadowProgram(false)
    const skinnedProg = this._getShadowProgram(true)

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.FRONT)

    for (let ci = 0; ci < this.cascades; ci++) {
      const fbo = this.shadowMaps[ci]
      const lsm = this.lightSpaceMatrices[ci]

      fbo.bind()
      gl.viewport(0, 0, this._shadowMapSize, this._shadowMapSize)
      gl.clear(gl.DEPTH_BUFFER_BIT)

      scene.traverseVisible((obj) => {
        const mesh = obj as Mesh
        if (!mesh.isMesh || !mesh.castShadow) return

        const isSkinned = !!(mesh as SkinnedMesh).isSkinnedMesh
        const prog = isSkinned ? skinnedProg : staticProg

        renderState.glState.useProgram(prog.handle)
        prog.setUniformMat4fv('u_modelMatrix', mesh.matrixWorld.elements)
        prog.setUniformMat4fv('u_lightSpaceMatrix', lsm.elements)

        if (isSkinned) {
          const sm = mesh as SkinnedMesh
          if (sm.skeleton) {
            sm.skeleton.update(gl)
            if (sm.skeleton.boneTexture) {
              renderState.glState.bindTexture(0, gl.TEXTURE_2D, sm.skeleton.boneTexture)
              prog.setUniform1i('u_boneTexture', 0)
              prog.setUniform1i('u_boneCount', sm.skeleton.bones.length)
            }
          }
        }

        const vao = renderState.getGeometryVAO(mesh.geometry, prog)
        vao.bind()

        const geo = mesh.geometry
        const hasIdx = geo.index !== null
        const drawStart = geo.drawRange.start
        const drawCount =
          geo.drawRange.count === Infinity
            ? hasIdx
              ? geo.index!.count
              : (geo.getAttribute('position')?.count ?? 0)
            : geo.drawRange.count

        if (hasIdx) {
          const indexType = geo.index!.data instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
          gl.drawElements(gl.TRIANGLES, drawCount, indexType, drawStart * (indexType === gl.UNSIGNED_INT ? 4 : 2))
        } else {
          gl.drawArrays(gl.TRIANGLES, drawStart, drawCount)
        }
      })

      fbo.unbind()
    }

    gl.cullFace(gl.BACK)
  }

  resize(shadowMapSize: number): void {
    for (let i = 0; i < this.cascades; i++) {
      this.shadowMaps[i].resize(shadowMapSize, shadowMapSize)
    }
  }

  dispose(): void {
    for (const fbo of this.shadowMaps) fbo.dispose()
    this.shadowMaps = []
    this._shadowProgram?.dispose()
    this._shadowSkinnedProgram?.dispose()
    this._shadowProgram = null
    this._shadowSkinnedProgram = null
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _getShadowProgram(skinned: boolean): ShaderProgram {
    if (skinned) {
      if (!this._shadowSkinnedProgram) {
        this._shadowSkinnedProgram = new ShaderProgram(this.gl, SKINNED_VERT, SHADOW_FRAG)
      }
      return this._shadowSkinnedProgram
    }
    if (!this._shadowProgram) {
      this._shadowProgram = new ShaderProgram(this.gl, SHADOW_VERT, SHADOW_FRAG)
    }
    return this._shadowProgram
  }

  private _createShadowFBO(size: number): Framebuffer {
    const { gl } = this
    const fbo = new Framebuffer(gl, size, size)

    const depthTex = Texture.createDepth(gl, size, size)
    gl.bindTexture(gl.TEXTURE_2D, depthTex.handle)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL)
    gl.bindTexture(gl.TEXTURE_2D, null)
    fbo.attachDepth(depthTex)

    // Color attachment for FBO completeness (shadow pass doesn't write color)
    const colorTex = Texture.createEmpty(gl, size, size, {
      internalFormat: gl.RGBA8,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
    })
    fbo.attachColor(colorTex, 0)
    fbo.check()

    return fbo
  }
}

// ---------------------------------------------------------------------------
// GLSL snippet — paste into your main fragment shader to enable CSM sampling.
// Import this string and inject it when building the standard shader with
// the USE_CSM define enabled.
// ---------------------------------------------------------------------------

export const CSM_FRAG_GLSL = /* glsl */ `
// ── Cascade Shadow Maps ──────────────────────────────────────────────────────
#ifdef USE_CSM
#define CSM_CASCADES 4

uniform sampler2DShadow u_csmShadowMap[CSM_CASCADES];
uniform mat4            u_csmLightSpaceMatrix[CSM_CASCADES];
uniform float           u_csmSplitDepths[CSM_CASCADES + 1];
uniform float           u_csmBias;

float sampleCSMShadow(vec3 worldPos, float viewDepth) {
  int cascadeIndex = CSM_CASCADES - 1;
  for (int i = 0; i < CSM_CASCADES; i++) {
    if (viewDepth < u_csmSplitDepths[i + 1]) {
      cascadeIndex = i;
      break;
    }
  }

  vec4 lsPos = u_csmLightSpaceMatrix[cascadeIndex] * vec4(worldPos, 1.0);
  vec3 proj  = lsPos.xyz / lsPos.w;
  proj = proj * 0.5 + 0.5;

  if (proj.z > 1.0 || proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0)
    return 1.0;

  float shadow = 0.0;
  vec2 texelSize = vec2(1.0) / vec2(textureSize(u_csmShadowMap[cascadeIndex], 0));
  for (int x = -1; x <= 1; ++x) {
    for (int y = -1; y <= 1; ++y) {
      vec3 uvz = vec3(proj.xy + vec2(float(x), float(y)) * texelSize, proj.z - u_csmBias);
      shadow += texture(u_csmShadowMap[cascadeIndex], uvz);
    }
  }
  return shadow / 9.0;
}
#endif
`
