/**
 * FXAAPass — Fast Approximate Anti-Aliasing (Lottes FXAA 3.11).
 *
 * This pass reads a tone-mapped LDR texture and outputs an anti-aliased
 * result directly to the currently bound framebuffer (typically the screen).
 *
 * Usage:
 *   const fxaa = new FXAAPass(gl, width, height)
 *   fxaa.render(ldrTexture) // renders to screen
 */

import { ShaderProgram, Texture } from '../core'
import { FXAA_VERT, FXAA_FRAG } from '../shaders'

export class FXAAPass {
  enabled = true

  private readonly gl: WebGL2RenderingContext
  private _width: number
  private _height: number
  private readonly _program: ShaderProgram

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl
    this._width = width
    this._height = height
    this._program = new ShaderProgram(gl, FXAA_VERT, FXAA_FRAG)
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Apply FXAA to `inputTexture` and render directly to the currently bound
   * framebuffer (call with the default FBO bound to write to the screen).
   */
  render(inputTexture: Texture): void {
    const { gl } = this

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)

    gl.useProgram(this._program.handle)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, inputTexture.handle)
    this._program.setUniform1i('u_inputTexture', 0)
    this._program.setUniform2f('u_texelSize', 1.0 / this._width, 1.0 / this._height)

    gl.bindVertexArray(null)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  resize(w: number, h: number): void {
    this._width = w
    this._height = h
  }

  dispose(): void {
    this._program.dispose()
  }
}
