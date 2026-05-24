/**
 * EquirectangularLoader
 *
 * Loads an equirectangular (lat-long) HDR or LDR image from a URL and
 * converts it to a WebGL cubemap texture.  Also provides helpers for baking
 * the three IBL textures required by PBR shading:
 *
 *   • irradiance map  — diffuse IBL (32 × 32 cubemap)
 *   • prefiltered env map — specular IBL with mip levels for roughness
 *   • BRDF LUT        — split-sum look-up table (512 × 512 RG texture)
 */

import {
  EQUIRECT_TO_CUBEMAP_VERT,
  EQUIRECT_TO_CUBEMAP_FRAG,
  IRRADIANCE_FRAG,
  PREFILTER_FRAG,
  BRDF_FRAG,
  BLOOM_VERT, // fullscreen-triangle vert reused for BRDF LUT pass
} from '../shaders'
import { ShaderProgram } from '../core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 6 view matrices — one per cubemap face — looking from the origin. */
function buildFaceViewMatrices(): Float32Array[] {
  // Column-major 4×4 matrices.
  // Each row: [right, up, -forward, origin=0]
  const faces: [number[], number[], number[]][] = [
    // +X
    [
      [0, 0, -1],
      [0, -1, 0],
      [1, 0, 0],
    ],
    // -X
    [
      [0, 0, 1],
      [0, -1, 0],
      [-1, 0, 0],
    ],
    // +Y
    [
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    // -Y
    [
      [1, 0, 0],
      [0, 0, -1],
      [0, -1, 0],
    ],
    // +Z
    [
      [1, 0, 0],
      [0, -1, 0],
      [0, 0, 1],
    ],
    // -Z
    [
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, -1],
    ],
  ]

  return faces.map(([r, u, f]) => {
    // View matrix = transpose of rotation part (orthonormal), translation = 0
    // Standard view matrix: row 0 = right, row 1 = up, row 2 = -forward
    // Column-major storage:
    const m = new Float32Array(16)
    // Column 0: right
    m[0] = r[0]
    m[1] = u[0]
    m[2] = f[0]
    m[3] = 0
    // Column 1: up
    m[4] = r[1]
    m[5] = u[1]
    m[6] = f[1]
    m[7] = 0
    // Column 2: -forward (target direction)
    m[8] = r[2]
    m[9] = u[2]
    m[10] = f[2]
    m[11] = 0
    // Column 3: translation = 0
    m[12] = 0
    m[13] = 0
    m[14] = 0
    m[15] = 1
    return m
  })
}

/** A 90° perspective projection matrix (column-major). */
function makeCubeProjMatrix(): Float32Array {
  const near = 0.1
  const far = 10.0
  const f = 1.0 // tan(45°) = 1
  const m = new Float32Array(16)
  m[0] = 1 / f
  m[1] = 0
  m[2] = 0
  m[3] = 0
  m[4] = 0
  m[5] = 1 / f
  m[6] = 0
  m[7] = 0
  m[8] = 0
  m[9] = 0
  m[10] = -(far + near) / (far - near)
  m[11] = -1
  m[12] = 0
  m[13] = 0
  m[14] = -(2 * far * near) / (far - near)
  m[15] = 0
  return m
}

/**
 * Cube geometry — 36 vertices (12 triangles, 6 faces), interleaved position.
 * Each face of a unit cube (-1 .. +1).
 */
function buildCubeVertices(): Float32Array {
  // prettier-ignore
  return new Float32Array([
    // +X
     1,-1,-1,  1,-1, 1,  1, 1, 1,   1,-1,-1,  1, 1, 1,  1, 1,-1,
    // -X
    -1,-1, 1, -1,-1,-1, -1, 1,-1,  -1,-1, 1, -1, 1,-1, -1, 1, 1,
    // +Y
    -1, 1,-1,  1, 1,-1,  1, 1, 1,  -1, 1,-1,  1, 1, 1, -1, 1, 1,
    // -Y
    -1,-1, 1,  1,-1, 1,  1,-1,-1,  -1,-1, 1,  1,-1,-1, -1,-1,-1,
    // +Z
    -1,-1, 1, -1, 1, 1,  1, 1, 1,  -1,-1, 1,  1, 1, 1,  1,-1, 1,
    // -Z
     1,-1,-1,  1, 1,-1, -1, 1,-1,   1,-1,-1, -1, 1,-1, -1,-1,-1,
  ])
}

// ---------------------------------------------------------------------------
// EquirectangularLoader
// ---------------------------------------------------------------------------

export class EquirectangularLoader {
  private readonly gl: WebGL2RenderingContext

  // Lazily compiled shader programs
  private _equirectProgram: ShaderProgram | null = null
  private _irradianceProgram: ShaderProgram | null = null
  private _prefilterProgram: ShaderProgram | null = null
  private _brdfProgram: ShaderProgram | null = null

  // Reusable cube geometry
  private _cubeVAO: WebGLVertexArrayObject | null = null
  private _cubeVBO: WebGLBuffer | null = null

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Fetch an equirectangular image from `url` and bake it into a WebGL
   * cubemap.  Returns the raw WebGLTexture so it can be stored on a
   * MeshStandardMaterial.envMap or a CubeCamera.
   */
  async load(url: string, size = 512): Promise<WebGLTexture> {
    const img = await this._loadImage(url)
    const equirectTex = this._uploadEquirectTexture(img)
    const cubemap = this._convertEquirectToCubemap(equirectTex, size)
    this.gl.deleteTexture(equirectTex)
    return cubemap
  }

  /**
   * Convolve a cubemap into a diffuse irradiance cubemap.
   * Renders at low resolution (default 32 × 32) — it's intentionally blurry.
   */
  generateIrradianceMap(envMap: WebGLTexture, size = 32): WebGLTexture {
    const { gl } = this
    if (!this._irradianceProgram) {
      // Reuse the equirect vert (same cube geometry / uniforms)
      this._irradianceProgram = new ShaderProgram(gl, EQUIRECT_TO_CUBEMAP_VERT, IRRADIANCE_FRAG)
    }
    return this._renderToCubemap(this._irradianceProgram, envMap, 'samplerCube', size, false)
  }

  /**
   * Generate a pre-filtered specular environment map by importance-sampling
   * the source cubemap for each roughness mip level.
   */
  generatePrefilteredEnvMap(envMap: WebGLTexture, size = 128, mipLevels = 5): WebGLTexture {
    const { gl } = this
    if (!this._prefilterProgram) {
      this._prefilterProgram = new ShaderProgram(gl, EQUIRECT_TO_CUBEMAP_VERT, PREFILTER_FRAG)
    }
    return this._renderPrefilteredCubemap(this._prefilterProgram, envMap, size, mipLevels)
  }

  /**
   * Integrate the split-sum BRDF into a 512 × 512 RG16F LUT texture.
   * The LUT is independent of the scene — generate once and cache it.
   */
  generateBRDFLUT(): WebGLTexture {
    const { gl } = this

    const canHalf = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')

    const internalFormat = canHalf ? gl.RG16F : gl.RGBA8
    const format = canHalf ? gl.RG : gl.RGBA
    const type = canHalf ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE

    const lut = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, lut)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 512, 512, 0, format, type, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)

    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lut, 0)

    if (!this._brdfProgram) {
      // BLOOM_VERT is the same fullscreen-triangle vertex shader
      this._brdfProgram = new ShaderProgram(gl, BLOOM_VERT, BRDF_FRAG)
    }

    gl.viewport(0, 0, 512, 512)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this._brdfProgram.handle)
    gl.bindVertexArray(null)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fbo)

    return lut
  }

  dispose(): void {
    const { gl } = this
    this._equirectProgram?.dispose()
    this._irradianceProgram?.dispose()
    this._prefilterProgram?.dispose()
    this._brdfProgram?.dispose()
    if (this._cubeVAO) gl.deleteVertexArray(this._cubeVAO)
    if (this._cubeVBO) gl.deleteBuffer(this._cubeVBO)
    this._equirectProgram = null
    this._irradianceProgram = null
    this._prefilterProgram = null
    this._brdfProgram = null
    this._cubeVAO = null
    this._cubeVBO = null
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  private _uploadEquirectTexture(img: HTMLImageElement): WebGLTexture {
    const { gl } = this
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }

  /** Convert an equirectangular 2D texture to a cubemap via rendering. */
  private _convertEquirectToCubemap(equirectTex: WebGLTexture, size: number): WebGLTexture {
    const { gl } = this
    if (!this._equirectProgram) {
      this._equirectProgram = new ShaderProgram(gl, EQUIRECT_TO_CUBEMAP_VERT, EQUIRECT_TO_CUBEMAP_FRAG)
    }
    return this._renderToCubemap(this._equirectProgram, equirectTex, 'sampler2D', size, true)
  }

  /** Allocate an empty cubemap texture (optionally with mipmaps). */
  private _createCubemap(size: number, mips: boolean): WebGLTexture {
    const { gl } = this

    const canHalf = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')

    const internalFormat = canHalf ? gl.RGBA16F : gl.RGBA8
    const format = gl.RGBA
    const type = canHalf ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE

    const cubemap = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap)

    for (let face = 0; face < 6; face++) {
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, internalFormat, size, size, 0, format, type, null)
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)

    if (mips) {
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
    } else {
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
    return cubemap
  }

  /** Upload cube geometry to a shared VAO (lazy). */
  private _ensureCubeGeometry(): void {
    if (this._cubeVAO) return
    const { gl } = this
    const verts = buildCubeVertices()
    this._cubeVAO = gl.createVertexArray()!
    this._cubeVBO = gl.createBuffer()!
    gl.bindVertexArray(this._cubeVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this._cubeVBO)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0)
    gl.bindVertexArray(null)
  }

  /**
   * Render `srcTexture` into each face of a new cubemap using `program`.
   * `texTarget` is either 'sampler2D' (for equirect) or 'samplerCube' (for irradiance).
   */
  private _renderToCubemap(
    program: ShaderProgram,
    srcTexture: WebGLTexture,
    texTarget: 'sampler2D' | 'samplerCube',
    size: number,
    generateMips: boolean,
  ): WebGLTexture {
    const { gl } = this
    this._ensureCubeGeometry()

    const cubemap = this._createCubemap(size, false)
    const projMat = makeCubeProjMatrix()
    const viewMats = buildFaceViewMatrices()

    const fbo = gl.createFramebuffer()!
    const rbo = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, size, size)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo)

    gl.useProgram(program.handle)
    program.setUniformMat4fv('u_projection', projMat)

    // Bind source texture
    gl.activeTexture(gl.TEXTURE0)
    if (texTarget === 'sampler2D') {
      gl.bindTexture(gl.TEXTURE_2D, srcTexture)
      program.setUniform1i('u_equirectMap', 0)
    } else {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, srcTexture)
      program.setUniform1i('u_envMap', 0)
    }

    gl.viewport(0, 0, size, size)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)

    for (let face = 0; face < 6; face++) {
      program.setUniformMat4fv('u_view', viewMats[face])
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, cubemap, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.bindVertexArray(this._cubeVAO)
      gl.drawArrays(gl.TRIANGLES, 0, 36)
    }

    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fbo)
    gl.deleteRenderbuffer(rbo)

    if (generateMips) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap)
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
    }

    gl.enable(gl.CULL_FACE)

    return cubemap
  }

  /**
   * Render the prefiltered specular map: one mip level per roughness value.
   */
  private _renderPrefilteredCubemap(
    program: ShaderProgram,
    srcEnvMap: WebGLTexture,
    size: number,
    mipLevels: number,
  ): WebGLTexture {
    const { gl } = this
    this._ensureCubeGeometry()

    const cubemap = this._createCubemap(size, true)
    const projMat = makeCubeProjMatrix()
    const viewMats = buildFaceViewMatrices()

    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

    gl.useProgram(program.handle)
    program.setUniformMat4fv('u_projection', projMat)
    program.setUniform1f('u_envResolution', size)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, srcEnvMap)
    // Enable seamless cubemap filtering (WebGL2 always on, but set explicitly)
    program.setUniform1i('u_envMap', 0)

    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)

    for (let mip = 0; mip < mipLevels; mip++) {
      const mipSize = Math.max(1, size >> mip)
      const roughness = mip / (mipLevels - 1)

      const rbo = gl.createRenderbuffer()!
      gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, mipSize, mipSize)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo)

      gl.viewport(0, 0, mipSize, mipSize)
      program.setUniform1f('u_roughness', roughness)

      for (let face = 0; face < 6; face++) {
        program.setUniformMat4fv('u_view', viewMats[face])
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
          cubemap,
          mip,
        )
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.bindVertexArray(this._cubeVAO)
        gl.drawArrays(gl.TRIANGLES, 0, 36)
      }

      gl.deleteRenderbuffer(rbo)
    }

    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fbo)
    gl.enable(gl.CULL_FACE)

    return cubemap
  }
}
