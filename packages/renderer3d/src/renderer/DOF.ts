/**
 * DOFPass — Depth of Field post-processing.
 *
 * Pipeline:
 *   1. COC pass   — compute circle-of-confusion per pixel from the depth buffer.
 *   2. Blur pass  — three separable hex-bokeh blur directions (0°, 60°, 120°).
 *   3. Combine    — blend blurred result with the sharp scene based on CoC.
 *
 * The reused BLOOM_VERT fullscreen-triangle vertex shader drives all passes.
 */

import { Texture, Framebuffer, ShaderProgram } from '../core'
import { BLOOM_VERT, DOF_FRAG } from '../shaders'
import type { Camera, PerspectiveCamera } from '../scene'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DOFOptions {
  /** World units from camera to focus plane (default 10). */
  focusDistance?: number
  /** Depth range that is in focus (default 3). */
  focusRange?: number
  /** Max blur radius in pixels (default 4). */
  bokehRadius?: number
  /** Blur quality — samples per direction (default 3). */
  iterations?: number
}

// ---------------------------------------------------------------------------
// DOFPass
// ---------------------------------------------------------------------------

export class DOFPass {
  enabled = true
  options: Required<DOFOptions>

  private readonly gl: WebGL2RenderingContext
  private _width: number
  private _height: number

  // Three shader variants compiled with different #defines
  private readonly _cocProgram: ShaderProgram
  private readonly _blurProgram: ShaderProgram
  private readonly _combineProgram: ShaderProgram

  // Intermediate FBOs
  private _cocFBO: Framebuffer
  private _blurFBO: Framebuffer

  constructor(gl: WebGL2RenderingContext, width: number, height: number, opts?: DOFOptions) {
    this.gl = gl
    this._width = width
    this._height = height

    this.options = {
      focusDistance: opts?.focusDistance ?? 10,
      focusRange: opts?.focusRange ?? 3,
      bokehRadius: opts?.bokehRadius ?? 4,
      iterations: opts?.iterations ?? 3,
    }

    this._cocProgram = new ShaderProgram(gl, BLOOM_VERT, this._inject(DOF_FRAG, 'COC_PASS'))
    this._blurProgram = new ShaderProgram(gl, BLOOM_VERT, this._inject(DOF_FRAG, 'BLUR_PASS'))
    this._combineProgram = new ShaderProgram(gl, BLOOM_VERT, this._inject(DOF_FRAG, 'COMBINE_PASS'))

    this._cocFBO = this._makeFBO(width, height)
    this._blurFBO = this._makeFBO(width, height)
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Render DOF blur. The result is written to the currently bound framebuffer
   * (pass null / screen for final output).
   *
   * @param colorTexture  HDR scene color (RGBA16F recommended).
   * @param depthTexture  Scene depth (DEPTH_COMPONENT24 or DEPTH_COMPONENT32F).
   * @param camera        Active camera — near/far extracted from PerspectiveCamera.
   */
  render(colorTexture: Texture, depthTexture: Texture, camera: Camera): void {
    const { gl, options } = this
    const pcam = camera as PerspectiveCamera

    const near = (pcam as { near?: number }).near ?? 0.1
    const far = (pcam as { far?: number }).far ?? 2000

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)

    // ── Pass 1: CoC ──────────────────────────────────────────────────────────
    this._cocFBO.bind()
    gl.viewport(0, 0, this._width, this._height)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this._cocProgram.handle)
    this._bindTex(colorTexture, 0)
    this._bindTex(depthTexture, 1)
    this._cocProgram.setUniform1i('u_colorTexture', 0)
    this._cocProgram.setUniform1i('u_depthTexture', 1)
    this._cocProgram.setUniform1f('u_near', near)
    this._cocProgram.setUniform1f('u_far', far)
    this._cocProgram.setUniform1f('u_focusDistance', options.focusDistance)
    this._cocProgram.setUniform1f('u_focusRange', options.focusRange)
    this._cocProgram.setUniform1f('u_bokehRadius', options.bokehRadius)
    this._fullscreen()
    this._cocFBO.unbind()

    // ── Pass 2: Three-direction hex-bokeh blur ────────────────────────────────
    //   Direction 0: 0°   = (1, 0)
    //   Direction 1: 60°  = (0.5, 0.866)
    //   Direction 2: 120° = (-0.5, 0.866)
    const texelSize = 1.0 / Math.max(this._width, this._height)
    const dirs: [number, number][] = [
      [1.0, 0.0],
      [0.5, 0.866],
      [-0.5, 0.866],
    ]

    // Accumulate blurs into blurFBO using additive blending so all three
    // directions are composited together.
    this._blurFBO.bind()
    gl.viewport(0, 0, this._width, this._height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this._blurFBO.unbind()

    // We'll blend the three directions ourselves by averaging them in a
    // CPU-friendly way: render into blurFBO three times using gl.BLEND.
    this._blurFBO.bind()
    gl.viewport(0, 0, this._width, this._height)

    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFunc(gl.ONE, gl.ONE) // additive — we'll divide by 3 in combine

    gl.useProgram(this._blurProgram.handle)
    this._blurProgram.setUniform1f('u_texelSize', texelSize)
    this._blurProgram.setUniform1i('u_iterations', options.iterations)
    this._blurProgram.setUniform1f('u_near', near)
    this._blurProgram.setUniform1f('u_far', far)
    this._blurProgram.setUniform1f('u_focusDistance', options.focusDistance)
    this._blurProgram.setUniform1f('u_focusRange', options.focusRange)
    this._blurProgram.setUniform1f('u_bokehRadius', options.bokehRadius)
    this._blurProgram.setUniform1i('u_depthTexture', 1)
    this._bindTex(depthTexture, 1)

    let isFirst = true
    for (const dir of dirs) {
      if (isFirst) {
        gl.disable(gl.BLEND)
        isFirst = false
      } else {
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
      }
      this._bindTex(this._cocFBO.colorTexture, 0)
      this._blurProgram.setUniform1i('u_colorTexture', 0)
      this._blurProgram.setUniform2f('u_blurDir', dir[0], dir[1])
      this._fullscreen()
    }

    gl.disable(gl.BLEND)
    this._blurFBO.unbind()

    // ── Pass 3: Combine ───────────────────────────────────────────────────────
    // Blend blurred vs. sharp scene using CoC from blurFBO alpha.
    // u_colorTexture = blurred, u_depthTexture reused as sharp color texture.
    gl.useProgram(this._combineProgram.handle)
    this._bindTex(this._blurFBO.colorTexture, 0)
    this._bindTex(colorTexture, 1) // sharp color
    this._combineProgram.setUniform1i('u_colorTexture', 0)
    this._combineProgram.setUniform1i('u_depthTexture', 1)
    this._combineProgram.setUniform1f('u_near', near)
    this._combineProgram.setUniform1f('u_far', far)
    this._combineProgram.setUniform1f('u_focusDistance', options.focusDistance)
    this._combineProgram.setUniform1f('u_focusRange', options.focusRange)
    this._combineProgram.setUniform1f('u_bokehRadius', options.bokehRadius)
    this._fullscreen()
  }

  resize(w: number, h: number): void {
    if (this._width === w && this._height === h) return
    this._width = w
    this._height = h
    this._cocFBO.resize(w, h)
    this._blurFBO.resize(w, h)
  }

  dispose(): void {
    this._cocProgram.dispose()
    this._blurProgram.dispose()
    this._combineProgram.dispose()
    this._cocFBO.dispose()
    this._blurFBO.dispose()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _inject(src: string, define: string): string {
    // Insert after the #version line
    const nl = src.indexOf('\n')
    if (nl === -1) return `#define ${define}\n` + src
    return src.slice(0, nl + 1) + `#define ${define}\n` + src.slice(nl + 1)
  }

  private _makeFBO(w: number, h: number): Framebuffer {
    const { gl } = this
    const fbo = new Framebuffer(gl, w, h)
    const tex = Texture.createEmpty(gl, w, h, {
      internalFormat: gl.RGBA16F,
      format: gl.RGBA,
      type: gl.HALF_FLOAT,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    })
    fbo.attachColor(tex, 0)
    fbo.check()
    return fbo
  }

  private _bindTex(tex: Texture, unit: number): void {
    const { gl } = this
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex.handle)
  }

  private _fullscreen(): void {
    this.gl.bindVertexArray(null)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
  }
}
