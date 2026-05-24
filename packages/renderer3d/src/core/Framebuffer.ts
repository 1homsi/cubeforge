import { GLError } from './GLContext'
import { Texture } from './Texture'

export class Framebuffer {
  readonly handle: WebGLFramebuffer
  private _colorTextures: Texture[] = []
  private _depthTexture: Texture | null = null
  private _depthRenderbuffer: WebGLRenderbuffer | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private _width: number,
    private _height: number,
  ) {
    const fbo = gl.createFramebuffer()
    if (!fbo) throw new GLError('Failed to create WebGLFramebuffer')
    this.handle = fbo
  }

  get width(): number {
    return this._width
  }

  get height(): number {
    return this._height
  }

  get colorTexture(): Texture {
    if (this._colorTextures.length === 0) {
      throw new GLError('No color texture attached to this Framebuffer')
    }
    return this._colorTextures[0]
  }

  get depthTexture(): Texture | null {
    return this._depthTexture
  }

  attachColor(texture: Texture, attachment = 0): void {
    const { gl } = this
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.handle)
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + attachment, gl.TEXTURE_2D, texture.handle, 0)
    this._colorTextures[attachment] = texture
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
  }

  attachDepth(texture: Texture): void {
    const { gl } = this
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.handle)
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture.handle, 0)
    this._depthTexture = texture
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
  }

  attachDepthRenderbuffer(): void {
    const { gl } = this

    if (this._depthRenderbuffer) {
      gl.deleteRenderbuffer(this._depthRenderbuffer)
    }

    const rb = gl.createRenderbuffer()
    if (!rb) throw new GLError('Failed to create depth renderbuffer')

    gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this._width, this._height)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.handle)
    gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)

    this._depthRenderbuffer = rb
  }

  bind(): void {
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, this.handle)
  }

  unbind(): void {
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, null)
  }

  resize(w: number, h: number): void {
    if (this._width === w && this._height === h) return
    this._width = w
    this._height = h

    for (const tex of this._colorTextures) {
      if (tex) tex.resize(w, h)
    }

    if (this._depthTexture) {
      this._depthTexture.resize(w, h)
    }

    if (this._depthRenderbuffer) {
      const { gl } = this
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthRenderbuffer)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h)
      gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    }
  }

  check(): void {
    const { gl } = this
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.handle)
    const status = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)

    if (status === gl.FRAMEBUFFER_COMPLETE) return

    const labels: Record<number, string> = {
      [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'INCOMPLETE_ATTACHMENT',
      [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'INCOMPLETE_MISSING_ATTACHMENT',
      [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'INCOMPLETE_DIMENSIONS',
      [gl.FRAMEBUFFER_UNSUPPORTED]: 'UNSUPPORTED',
      [gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]: 'INCOMPLETE_MULTISAMPLE',
    }
    const label = labels[status] ?? `0x${status.toString(16)}`
    throw new GLError(`Framebuffer is not complete: ${label}`)
  }

  dispose(): void {
    const { gl } = this
    gl.deleteFramebuffer(this.handle)
    if (this._depthRenderbuffer) {
      gl.deleteRenderbuffer(this._depthRenderbuffer)
      this._depthRenderbuffer = null
    }
  }
}
