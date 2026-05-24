import { GLError } from './GLContext'

export interface TextureOptions {
  width?: number
  height?: number
  format?: GLenum
  internalFormat?: GLenum
  type?: GLenum
  wrapS?: GLenum
  wrapT?: GLenum
  minFilter?: GLenum
  magFilter?: GLenum
  generateMipmaps?: boolean
  flipY?: boolean
  anisotropy?: number
}

export class Texture {
  readonly handle: WebGLTexture
  private _width = 0
  private _height = 0

  constructor(private readonly gl: WebGL2RenderingContext) {
    const tex = gl.createTexture()
    if (!tex) throw new GLError('Failed to create WebGLTexture')
    this.handle = tex
  }

  get width(): number {
    return this._width
  }

  get height(): number {
    return this._height
  }

  static fromImage(gl: WebGL2RenderingContext, img: HTMLImageElement | ImageBitmap, opts?: TextureOptions): Texture {
    const tex = new Texture(gl)
    tex.upload(img, opts)
    return tex
  }

  static createEmpty(gl: WebGL2RenderingContext, w: number, h: number, opts?: TextureOptions): Texture {
    const tex = new Texture(gl)
    tex.uploadData(null, w, h, opts)
    return tex
  }

  static createDepth(gl: WebGL2RenderingContext, w: number, h: number): Texture {
    const tex = new Texture(gl)
    tex.uploadData(null, w, h, {
      internalFormat: gl.DEPTH_COMPONENT24,
      format: gl.DEPTH_COMPONENT,
      type: gl.UNSIGNED_INT,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    })
    return tex
  }

  bind(unit = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.handle)
  }

  unbind(unit = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
  }

  upload(source: TexImageSource | null, opts?: TextureOptions): void {
    const { gl } = this
    const internalFormat = opts?.internalFormat ?? gl.RGBA8
    const format = opts?.format ?? gl.RGBA
    const type = opts?.type ?? gl.UNSIGNED_BYTE

    if (opts?.flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    gl.bindTexture(gl.TEXTURE_2D, this.handle)

    if (source !== null) {
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, format, type, source)
      if ('videoWidth' in source && typeof (source as { videoWidth: unknown }).videoWidth === 'number') {
        this._width = (source as { videoWidth: number }).videoWidth
        this._height = (source as { videoHeight: number }).videoHeight
      } else if ('width' in source && typeof (source as { width: unknown }).width === 'number') {
        this._width = (source as { width: number }).width
        this._height = (source as { height: number }).height
      }
    } else {
      const w = opts?.width ?? 0
      const h = opts?.height ?? 0
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)
      this._width = w
      this._height = h
    }

    this._applyParams(opts)

    if (opts?.flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    if (opts?.generateMipmaps) gl.generateMipmap(gl.TEXTURE_2D)
    if (opts?.anisotropy) this._applyAnisotropy(opts.anisotropy)
  }

  uploadData(data: ArrayBufferView | null, width: number, height: number, opts?: TextureOptions): void {
    const { gl } = this
    const internalFormat = opts?.internalFormat ?? gl.RGBA8
    const format = opts?.format ?? gl.RGBA
    const type = opts?.type ?? gl.UNSIGNED_BYTE

    gl.bindTexture(gl.TEXTURE_2D, this.handle)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data)
    this._width = width
    this._height = height

    this._applyParams(opts)

    if (opts?.generateMipmaps) gl.generateMipmap(gl.TEXTURE_2D)
    if (opts?.anisotropy) this._applyAnisotropy(opts.anisotropy)
  }

  resize(w: number, h: number): void {
    if (this._width === w && this._height === h) return
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, this.handle)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    this._width = w
    this._height = h
  }

  dispose(): void {
    this.gl.deleteTexture(this.handle)
  }

  private _applyParams(opts?: TextureOptions): void {
    const { gl } = this
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts?.minFilter ?? gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts?.magFilter ?? gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts?.wrapS ?? gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts?.wrapT ?? gl.CLAMP_TO_EDGE)
  }

  private _applyAnisotropy(amount: number): void {
    const { gl } = this
    const ext = gl.getExtension('EXT_texture_filter_anisotropic')
    if (!ext) return
    const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number
    gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(amount, max))
  }
}
