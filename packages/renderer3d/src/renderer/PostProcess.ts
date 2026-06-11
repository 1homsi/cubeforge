/**
 * PostProcess — bloom extraction + two-pass Gaussian blur + HDR composite.
 *
 * Pipeline:
 *   1. Extract bright pixels above threshold → bloomExtractFBO
 *   2. Horizontal blur  → pingFBO
 *   3. Vertical   blur  → pongFBO
 *   (repeat steps 2-3 for `passes` iterations)
 *   4. composite() — combine sceneTexture + blurred bloom, apply tone mapping,
 *      exposure, vignette, and output to the screen (or a target FBO).
 */

import { Texture, Framebuffer, ShaderProgram } from '../core'
import { BLOOM_VERT, BLOOM_FRAG, COMPOSITE_VERT, COMPOSITE_FRAG } from '../shaders'

// ---------------------------------------------------------------------------
// Composite parameters
// ---------------------------------------------------------------------------

export interface CompositeParams {
  exposure: number
  bloomStrength: number
  /** 0 = Reinhard, 1 = ACES, 2 = linear clamp */
  tonemapMode: number
  vignette: number
  vignetteRadius?: number
  saturation?: number
  contrast?: number
  brightness?: number
}

// ---------------------------------------------------------------------------
// PostProcess
// ---------------------------------------------------------------------------

export class PostProcess {
  private readonly gl: WebGL2RenderingContext

  private _width: number
  private _height: number

  // Float texture support (requires EXT_color_buffer_float or half_float variant)
  private readonly _canFloat: boolean

  // Framebuffers
  private _bloomExtractFBO: Framebuffer
  private _pingFBO: Framebuffer
  private _pongFBO: Framebuffer

  // Shader programs
  private _extractProgram: ShaderProgram
  private _blurProgram: ShaderProgram
  private _compositeProgram: ShaderProgram

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl
    this._width = width
    this._height = height
    this._canFloat = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')

    // Build shader programs
    this._extractProgram = this._buildExtractProgram()
    this._blurProgram = this._buildBlurProgram()
    this._compositeProgram = new ShaderProgram(gl, COMPOSITE_VERT, COMPOSITE_FRAG)

    // Create framebuffers at half resolution for bloom (common practice)
    const bw = Math.max(1, width >> 1)
    const bh = Math.max(1, height >> 1)

    this._bloomExtractFBO = this._makeFBO(bw, bh)
    this._pingFBO = this._makeFBO(bw, bh)
    this._pongFBO = this._makeFBO(bw, bh)
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  resize(w: number, h: number): void {
    if (this._width === w && this._height === h) return
    this._width = w
    this._height = h

    const bw = Math.max(1, w >> 1)
    const bh = Math.max(1, h >> 1)

    this._bloomExtractFBO.resize(bw, bh)
    this._pingFBO.resize(bw, bh)
    this._pongFBO.resize(bw, bh)
  }

  /**
   * Run bloom: extract bright pixels from `sceneTexture`, apply iterative
   * two-pass Gaussian blur, and return the final blurred bloom Texture.
   */
  renderBloom(sceneTexture: Texture, _strength: number, threshold: number, radius: number, passes = 5): Texture {
    const { gl } = this

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)

    // ── Step 1: Extract bright pixels ──
    const bw = this._bloomExtractFBO.width
    const bh = this._bloomExtractFBO.height

    this._bloomExtractFBO.bind()
    gl.viewport(0, 0, bw, bh)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this._extractProgram.handle)
    this._bindTexture(sceneTexture, 0)
    this._extractProgram.setUniform1i('u_inputTexture', 0)
    this._extractProgram.setUniform1f('u_threshold', threshold)
    this._extractProgram.setUniform1f('u_knee', threshold * 0.1)
    this._drawFullscreenTriangle()

    this._bloomExtractFBO.unbind()

    // ── Steps 2-3: Iterative ping-pong Gaussian blur ──
    let readFBO = this._bloomExtractFBO
    let writeFBO = this._pingFBO
    let altFBO = this._pongFBO

    gl.useProgram(this._blurProgram.handle)
    this._blurProgram.setUniform1f('u_blurScale', radius)

    for (let pass = 0; pass < passes; pass++) {
      // Horizontal
      writeFBO.bind()
      gl.viewport(0, 0, bw, bh)
      gl.clear(gl.COLOR_BUFFER_BIT)

      this._bindTexture(readFBO.colorTexture, 0)
      this._blurProgram.setUniform1i('u_inputTexture', 0)
      this._blurProgram.setUniform1i('u_horizontal', 1)
      this._drawFullscreenTriangle()
      writeFBO.unbind()

      // Vertical
      altFBO.bind()
      gl.viewport(0, 0, bw, bh)
      gl.clear(gl.COLOR_BUFFER_BIT)

      this._bindTexture(writeFBO.colorTexture, 0)
      this._blurProgram.setUniform1i('u_inputTexture', 0)
      this._blurProgram.setUniform1i('u_horizontal', 0)
      this._drawFullscreenTriangle()
      altFBO.unbind()

      readFBO = altFBO
      ;[writeFBO, altFBO] = [altFBO, writeFBO]
    }

    // readFBO now holds the final blurred bloom
    return readFBO.colorTexture
  }

  /**
   * Composite the scene and bloom textures to the currently bound framebuffer
   * (pass null FBO to render to screen).
   */
  composite(sceneTexture: Texture, bloomTexture: Texture, params: CompositeParams): void {
    const { gl } = this

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)

    gl.useProgram(this._compositeProgram.handle)

    this._bindTexture(sceneTexture, 0)
    this._bindTexture(bloomTexture, 1)
    this._compositeProgram.setUniform1i('u_hdrBuffer', 0)
    this._compositeProgram.setUniform1i('u_bloomTexture', 1)

    this._compositeProgram.setUniform1f('u_exposure', params.exposure)
    this._compositeProgram.setUniform1f('u_bloomStrength', params.bloomStrength)
    this._compositeProgram.setUniform1i('u_tonemapMode', params.tonemapMode)
    this._compositeProgram.setUniform1f('u_vignetteStrength', params.vignette)
    this._compositeProgram.setUniform1f('u_vignetteRadius', params.vignetteRadius ?? 0.75)
    this._compositeProgram.setUniform1f('u_saturation', params.saturation ?? 1.0)
    this._compositeProgram.setUniform1f('u_contrast', params.contrast ?? 1.0)
    this._compositeProgram.setUniform1f('u_brightness', params.brightness ?? 0.0)

    this._drawFullscreenTriangle()
  }

  dispose(): void {
    this._extractProgram.dispose()
    this._blurProgram.dispose()
    this._compositeProgram.dispose()
    this._bloomExtractFBO.dispose()
    this._pingFBO.dispose()
    this._pongFBO.dispose()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _buildExtractProgram(): ShaderProgram {
    const { gl } = this
    // Inject BLOOM_EXTRACT define into the bloom frag shader
    const fragSrc = this._injectDefine(BLOOM_FRAG, 'BLOOM_EXTRACT')
    return new ShaderProgram(gl, BLOOM_VERT, fragSrc)
  }

  private _buildBlurProgram(): ShaderProgram {
    // No BLOOM_EXTRACT define → blur pass
    return new ShaderProgram(this.gl, BLOOM_VERT, BLOOM_FRAG)
  }

  private _injectDefine(src: string, define: string): string {
    const nl = src.indexOf('\n')
    if (nl === -1) return src + `\n#define ${define}\n`
    return src.slice(0, nl + 1) + `#define ${define}\n` + src.slice(nl + 1)
  }

  private _makeFBO(width: number, height: number): Framebuffer {
    const { gl } = this
    const fbo = new Framebuffer(gl, width, height)
    const tex = Texture.createEmpty(gl, width, height, {
      internalFormat: this._canFloat ? gl.RGBA16F : gl.RGBA8,
      format: gl.RGBA,
      type: this._canFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    })
    fbo.attachColor(tex, 0)
    fbo.check()
    return fbo
  }

  private _bindTexture(tex: Texture, unit: number): void {
    const { gl } = this
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex.handle)
  }

  /** Draw a fullscreen triangle without a VBO (vertex ID trick). */
  private _drawFullscreenTriangle(): void {
    // Temporarily unbind any VAO so the gl_VertexID-based vertex shader works.
    this.gl.bindVertexArray(null)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
  }
}
