/**
 * MotionBlurPass — screen-space motion blur driven by per-pixel velocity.
 *
 * Each frame the pass:
 *   1. Reconstructs world-space position from the depth buffer + inverse current VP.
 *   2. Re-projects that world position with the previous frame's VP matrix to get
 *      the previous screen coordinate.
 *   3. Samples `options.samples` times along the velocity vector, averages.
 *   4. Velocity magnitude is clamped to `maxBlurPixels` and scaled by
 *      `shutterAngle / 360`.
 *
 * The caller is responsible for storing the previous VP matrix and passing both
 * matrices to render().
 */

import { Texture, Framebuffer, ShaderProgram } from '../core'
import { Mat4 } from '../math'
import { BLOOM_VERT, MOTION_BLUR_FRAG } from '../shaders'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MotionBlurOptions {
  /** Samples along the velocity vector (default 8). */
  samples?: number
  /** Shutter angle in degrees 0-360, controls blur strength (default 180). */
  shutterAngle?: number
  /** Maximum velocity in pixels before clamping (default 20). */
  maxBlurPixels?: number
}

// ---------------------------------------------------------------------------
// MotionBlurPass
// ---------------------------------------------------------------------------

export class MotionBlurPass {
  enabled = true
  options: Required<MotionBlurOptions>

  private readonly gl: WebGL2RenderingContext
  private _width: number
  private _height: number
  private readonly _program: ShaderProgram
  private _outputFBO: Framebuffer

  // Scratch inverse-VP matrix (reused per frame to avoid allocation)
  private readonly _invVP = new Mat4()

  constructor(gl: WebGL2RenderingContext, width: number, height: number, opts?: MotionBlurOptions) {
    this.gl = gl
    this._width = width
    this._height = height

    this.options = {
      samples: opts?.samples ?? 8,
      shutterAngle: opts?.shutterAngle ?? 180,
      maxBlurPixels: opts?.maxBlurPixels ?? 20,
    }

    this._program = new ShaderProgram(gl, BLOOM_VERT, MOTION_BLUR_FRAG)
    this._outputFBO = this._makeFBO(width, height)
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Render motion blur.
   *
   * Reads from `colorTexture` + `depthTexture`, writes to an internal FBO, and
   * returns the blurred color texture so the caller can continue the post chain.
   *
   * @param colorTexture   HDR or LDR scene color.
   * @param depthTexture   Scene depth (GL_DEPTH_COMPONENT, r channel = [0,1]).
   * @param prevVP         View-projection matrix from the **previous** frame.
   * @param currentVP      View-projection matrix from the **current** frame.
   * @returns              The blurred output texture.
   */
  render(colorTexture: Texture, depthTexture: Texture, prevVP: Mat4, currentVP: Mat4): Texture {
    const { gl } = this

    // Compute inverse of current VP for world-position reconstruction
    this._invVP.copy(currentVP).invert()

    this._outputFBO.bind()
    gl.viewport(0, 0, this._width, this._height)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this._program.handle)

    // Bind textures
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, colorTexture.handle)
    this._program.setUniform1i('u_colorTexture', 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, depthTexture.handle)
    this._program.setUniform1i('u_depthTexture', 1)

    // Matrices
    this._program.setUniformMat4fv('u_invCurrentVP', this._invVP.elements)
    this._program.setUniformMat4fv('u_prevVP', prevVP.elements)

    // Options
    this._program.setUniform1i('u_samples', this.options.samples)
    this._program.setUniform1f('u_shutterAngle', this.options.shutterAngle)
    this._program.setUniform1f('u_maxBlurPixels', this.options.maxBlurPixels)
    this._program.setUniform2f('u_texelSize', 1.0 / this._width, 1.0 / this._height)

    // Draw fullscreen triangle (gl_VertexID trick — no VAO needed)
    gl.bindVertexArray(null)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    this._outputFBO.unbind()

    return this._outputFBO.colorTexture
  }

  resize(w: number, h: number): void {
    if (this._width === w && this._height === h) return
    this._width = w
    this._height = h
    this._outputFBO.dispose()
    this._outputFBO = this._makeFBO(w, h)
  }

  dispose(): void {
    this._program.dispose()
    this._outputFBO.dispose()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _makeFBO(width: number, height: number): Framebuffer {
    const { gl } = this
    const fbo = new Framebuffer(gl, width, height)
    const tex = Texture.createEmpty(gl, width, height, {
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
}
