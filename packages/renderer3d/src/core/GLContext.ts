export class GLError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GLError'
  }
}

export function createContext(canvas: HTMLCanvasElement, options?: WebGLContextAttributes): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', options)
  if (!gl) {
    throw new GLError(
      'WebGL2 is not available. Your browser or device may not support it. ' +
        'Try updating your browser or enabling hardware acceleration.',
    )
  }
  return gl
}

export class GLState {
  private _program: WebGLProgram | null = null
  private _vao: WebGLVertexArrayObject | null = null
  private _activeTextureUnit = -1
  private _textureBindings = new Map<number, Map<GLenum, WebGLTexture | null>>()
  private _enabled = new Map<GLenum, boolean>()
  private _blendSrc: GLenum | null = null
  private _blendDst: GLenum | null = null
  private _depthWrite: boolean | null = null
  private _cullFaceMode: GLenum | null = null
  private _viewport: [number, number, number, number] | null = null
  private _scissor: [number, number, number, number] | null = null

  constructor(private readonly gl: WebGL2RenderingContext) {}

  useProgram(program: WebGLProgram | null): void {
    if (this._program === program) return
    this._program = program
    this.gl.useProgram(program)
  }

  bindVAO(vao: WebGLVertexArrayObject | null): void {
    if (this._vao === vao) return
    this._vao = vao
    this.gl.bindVertexArray(vao)
  }

  activeTexture(unit: number): void {
    if (this._activeTextureUnit === unit) return
    this._activeTextureUnit = unit
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
  }

  bindTexture(unit: number, target: GLenum, texture: WebGLTexture | null): void {
    let unitMap = this._textureBindings.get(unit)
    if (!unitMap) {
      unitMap = new Map<GLenum, WebGLTexture | null>()
      this._textureBindings.set(unit, unitMap)
    }
    if (unitMap.has(target) && unitMap.get(target) === texture) return
    unitMap.set(target, texture)
    this.activeTexture(unit)
    this.gl.bindTexture(target, texture)
  }

  enable(cap: GLenum): void {
    if (this._enabled.get(cap) === true) return
    this._enabled.set(cap, true)
    this.gl.enable(cap)
  }

  disable(cap: GLenum): void {
    if (this._enabled.get(cap) === false) return
    this._enabled.set(cap, false)
    this.gl.disable(cap)
  }

  blendFunc(src: GLenum, dst: GLenum): void {
    if (this._blendSrc === src && this._blendDst === dst) return
    this._blendSrc = src
    this._blendDst = dst
    this.gl.blendFunc(src, dst)
  }

  depthWrite(enabled: boolean): void {
    if (this._depthWrite === enabled) return
    this._depthWrite = enabled
    this.gl.depthMask(enabled)
  }

  cullFace(mode: GLenum): void {
    if (this._cullFaceMode === mode) return
    this._cullFaceMode = mode
    this.gl.cullFace(mode)
  }

  viewport(x: number, y: number, width: number, height: number): void {
    const v = this._viewport
    if (v && v[0] === x && v[1] === y && v[2] === width && v[3] === height) return
    this._viewport = [x, y, width, height]
    this.gl.viewport(x, y, width, height)
  }

  scissor(x: number, y: number, width: number, height: number): void {
    const s = this._scissor
    if (s && s[0] === x && s[1] === y && s[2] === width && s[3] === height) return
    this._scissor = [x, y, width, height]
    this.gl.scissor(x, y, width, height)
  }

  reset(): void {
    this._program = null
    this._vao = null
    this._activeTextureUnit = -1
    this._textureBindings.clear()
    this._enabled.clear()
    this._blendSrc = null
    this._blendDst = null
    this._depthWrite = null
    this._cullFaceMode = null
    this._viewport = null
    this._scissor = null
  }
}
