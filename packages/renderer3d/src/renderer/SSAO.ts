/**
 * SSAOPass — Screen-Space Ambient Occlusion.
 *
 * Pipeline:
 *   1. Generate hemisphere kernel samples once at construction.
 *   2. Generate 4×4 random-rotation noise texture once.
 *   3. render(depthTex, normalTex, camera)
 *      a. SSAO pass → aoFBO (R channel holds occlusion factor)
 *      b. Horizontal Gaussian blur → pingFBO
 *      c. Vertical   Gaussian blur → pongFBO   (= final result)
 *   4. Return the blurred AO Framebuffer.  The caller composites AO on top of
 *      ambient light as:  ambient *= ao_factor.
 */

import { ShaderProgram, Texture, Framebuffer } from '../core'
import { BLOOM_VERT, SSAO_FRAG } from '../shaders'
import type { Camera } from '../scene'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SSAOOptions {
  /** Number of hemisphere samples (default 32, max 64). */
  kernelSize?: number
  /** World-space AO radius (default 0.5). */
  radius?: number
  /** Depth-comparison bias to prevent self-occlusion (default 0.025). */
  bias?: number
  /** Exponent applied to AO result for contrast (default 2.0). */
  power?: number
  /** Number of two-pass Gaussian blur iterations (default 2). */
  blurRadius?: number
}

// ---------------------------------------------------------------------------
// Blur shader (simple box/Gaussian, two-pass)
// ---------------------------------------------------------------------------

const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_inputTexture;
uniform vec2      u_texelSize;
uniform int       u_horizontal;

out vec4 fragColor;

// 9-tap Gaussian weights (σ≈1.5)
const float WEIGHT[5] = float[](0.227027, 0.194595, 0.121622, 0.054054, 0.016216);

void main() {
  vec2 step = u_horizontal == 1 ? vec2(u_texelSize.x, 0.0) : vec2(0.0, u_texelSize.y);
  vec3 result = texture(u_inputTexture, v_uv).rgb * WEIGHT[0];
  for (int i = 1; i < 5; i++) {
    vec2 off = float(i) * step;
    result += texture(u_inputTexture, v_uv + off).rgb * WEIGHT[i];
    result += texture(u_inputTexture, v_uv - off).rgb * WEIGHT[i];
  }
  fragColor = vec4(result, 1.0);
}
`

// ---------------------------------------------------------------------------
// SSAOPass
// ---------------------------------------------------------------------------

export class SSAOPass {
  enabled = true
  options: Required<SSAOOptions>

  private readonly gl: WebGL2RenderingContext
  private _width: number
  private _height: number

  // GPU resources
  private readonly _ssaoProgram: ShaderProgram
  private readonly _blurProgram: ShaderProgram
  private _aoFBO: Framebuffer
  private _pingFBO: Framebuffer
  private _pongFBO: Framebuffer

  // Static per-instance data
  private readonly _kernelData: Float32Array
  private readonly _noiseTex: Texture

  constructor(gl: WebGL2RenderingContext, width: number, height: number, opts?: SSAOOptions) {
    this.gl = gl
    this._width = width
    this._height = height

    this.options = {
      kernelSize: Math.min(opts?.kernelSize ?? 32, 64),
      radius: opts?.radius ?? 0.5,
      bias: opts?.bias ?? 0.025,
      power: opts?.power ?? 2.0,
      blurRadius: opts?.blurRadius ?? 2,
    }

    // Build programs
    this._ssaoProgram = new ShaderProgram(gl, BLOOM_VERT, SSAO_FRAG)
    this._blurProgram = new ShaderProgram(gl, BLOOM_VERT, BLUR_FRAG)

    // Build kernel
    this._kernelData = this._generateKernel(this.options.kernelSize)

    // Build noise texture
    this._noiseTex = this._generateNoiseTex()

    // Build FBOs
    this._aoFBO = this._makeAOFBO(width, height)
    this._pingFBO = this._makeAOFBO(width, height)
    this._pongFBO = this._makeAOFBO(width, height)
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run the SSAO pass.
   *
   * @param depthTexture   The depth texture from the main pass (DEPTH_COMPONENT).
   * @param normalTexture  The G-buffer view-space normals texture (RGBA8, packed [0,1]).
   * @param camera         The scene camera (for projection matrices).
   * @returns              The blurred AO Framebuffer. Sample .colorTexture.handle
   *                       and multiply it on top of the ambient term.
   */
  render(depthTexture: Texture, normalTexture: Texture, camera: Camera): Framebuffer {
    const { gl } = this

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)

    const w = this._width
    const h = this._height
    const opts = this.options

    // ── SSAO pass ──────────────────────────────────────────────────────────────
    this._aoFBO.bind()
    gl.viewport(0, 0, w, h)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this._ssaoProgram.handle)

    // Bind textures
    this._bindTex2D(depthTexture.handle, 0)
    this._bindTex2D(normalTexture.handle, 1)
    this._bindTex2D(this._noiseTex.handle, 2)
    this._ssaoProgram.setUniform1i('u_depthTexture', 0)
    this._ssaoProgram.setUniform1i('u_normalTexture', 1)
    this._ssaoProgram.setUniform1i('u_noiseTexture', 2)

    // Kernel
    this._ssaoProgram.setUniform1i('u_kernelSize', opts.kernelSize)
    // Upload as flat array (x,y,z packed) — the shader uses vec3[64]
    const loc = gl.getUniformLocation(this._ssaoProgram.handle, 'u_kernel[0]')
    if (loc !== null) {
      gl.uniform3fv(loc, this._kernelData)
    }

    // Camera matrices
    this._ssaoProgram.setUniformMat4fv('u_projection', camera.projectionMatrix.elements)
    this._ssaoProgram.setUniformMat4fv('u_projectionInverse', camera.projectionMatrixInverse.elements)

    // Parameters
    this._ssaoProgram.setUniform1f('u_radius', opts.radius)
    this._ssaoProgram.setUniform1f('u_bias', opts.bias)
    this._ssaoProgram.setUniform1f('u_power', opts.power)
    this._ssaoProgram.setUniform2f('u_resolution', w, h)
    this._ssaoProgram.setUniform2f('u_noiseScale', w / 4.0, h / 4.0)

    this._drawFST()
    this._aoFBO.unbind()

    // ── Gaussian blur (ping-pong, opts.blurRadius passes) ──────────────────────
    gl.useProgram(this._blurProgram.handle)
    this._blurProgram.setUniform2f('u_texelSize', 1.0 / w, 1.0 / h)

    let readFBO = this._aoFBO
    let writeFBO = this._pingFBO
    let altFBO = this._pongFBO

    for (let pass = 0; pass < opts.blurRadius; pass++) {
      // Horizontal
      writeFBO.bind()
      gl.viewport(0, 0, w, h)
      gl.clear(gl.COLOR_BUFFER_BIT)
      this._bindTex2D(readFBO.colorTexture.handle, 0)
      this._blurProgram.setUniform1i('u_inputTexture', 0)
      this._blurProgram.setUniform1i('u_horizontal', 1)
      this._drawFST()
      writeFBO.unbind()

      // Vertical
      altFBO.bind()
      gl.viewport(0, 0, w, h)
      gl.clear(gl.COLOR_BUFFER_BIT)
      this._bindTex2D(writeFBO.colorTexture.handle, 0)
      this._blurProgram.setUniform1i('u_inputTexture', 0)
      this._blurProgram.setUniform1i('u_horizontal', 0)
      this._drawFST()
      altFBO.unbind()

      readFBO = altFBO
      ;[writeFBO, altFBO] = [altFBO, writeFBO]
    }

    return readFBO
  }

  resize(w: number, h: number): void {
    if (this._width === w && this._height === h) return
    this._width = w
    this._height = h
    this._aoFBO.resize(w, h)
    this._pingFBO.resize(w, h)
    this._pongFBO.resize(w, h)
  }

  dispose(): void {
    this._ssaoProgram.dispose()
    this._blurProgram.dispose()
    this._aoFBO.dispose()
    this._pingFBO.dispose()
    this._pongFBO.dispose()
    this._noiseTex.dispose()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _generateKernel(size: number): Float32Array {
    const data = new Float32Array(size * 3)
    for (let i = 0; i < size; i++) {
      let x = Math.random() * 2 - 1
      let y = Math.random() * 2 - 1
      let z = Math.random()
      // Normalise
      const len = Math.sqrt(x * x + y * y + z * z) || 1
      x /= len
      y /= len
      z /= len
      // Random magnitude, biased toward the origin for denser coverage
      let scale = i / size
      scale = 0.1 + scale * scale * 0.9 // lerp(0.1, 1.0, scale²)
      x *= scale
      y *= scale
      z *= scale
      data[i * 3] = x
      data[i * 3 + 1] = y
      data[i * 3 + 2] = z
    }
    return data
  }

  private _generateNoiseTex(): Texture {
    const { gl } = this
    // 4×4 random rotation vectors (only x,y used — z is always 0 for rotations)
    const data = new Float32Array(16 * 3)
    for (let i = 0; i < 16; i++) {
      data[i * 3] = Math.random() * 2 - 1
      data[i * 3 + 1] = Math.random() * 2 - 1
      data[i * 3 + 2] = 0
    }
    const tex = new Texture(gl)
    gl.bindTexture(gl.TEXTURE_2D, tex.handle)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16F, 4, 4, 0, gl.RGB, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }

  private _makeAOFBO(w: number, h: number): Framebuffer {
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

  private _bindTex2D(handle: WebGLTexture, unit: number): void {
    const { gl } = this
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, handle)
  }

  private _drawFST(): void {
    this.gl.bindVertexArray(null)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
  }
}
