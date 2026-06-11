import { GLError } from './GLContext'

export function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new GLError('Failed to create WebGLShader object')

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown error'
    gl.deleteShader(shader)

    const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
    const lines = source.split('\n')
    const annotated = lines.map((line, i) => `${String(i + 1).padStart(4)}: ${line}`).join('\n')
    throw new GLError(`${typeName} shader compile error:\n${log}\nSource:\n${annotated}`)
  }

  return shader
}

export class ShaderProgram {
  static warnMissingUniforms = false

  readonly handle: WebGLProgram
  private readonly _uniformLocations = new Map<string, WebGLUniformLocation | null>()
  private readonly _warnedUniforms = new Set<string>()

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vertSrc: string,
    fragSrc: string,
  ) {
    const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)

    const program = gl.createProgram()
    if (!program) {
      gl.deleteShader(vert)
      gl.deleteShader(frag)
      throw new GLError('Failed to create WebGLProgram object')
    }

    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)

    gl.deleteShader(vert)
    gl.deleteShader(frag)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? 'Unknown error'
      gl.deleteProgram(program)
      throw new GLError(`Shader program link error:\n${log}`)
    }

    this.handle = program
  }

  static fromSources(gl: WebGL2RenderingContext, vert: string, frag: string): ShaderProgram {
    return new ShaderProgram(gl, vert, frag)
  }

  use(): void {
    this.gl.useProgram(this.handle)
  }

  dispose(): void {
    this.gl.deleteProgram(this.handle)
  }

  getAttribLocation(name: string): number {
    return this.gl.getAttribLocation(this.handle, name)
  }

  private _loc(name: string): WebGLUniformLocation | null {
    if (this._uniformLocations.has(name)) {
      return this._uniformLocations.get(name)!
    }
    const loc = this.gl.getUniformLocation(this.handle, name)
    this._uniformLocations.set(name, loc)
    if (loc === null && ShaderProgram.warnMissingUniforms && !this._warnedUniforms.has(name)) {
      this._warnedUniforms.add(name)
      console.warn(`[ShaderProgram] Uniform "${name}" not found (may be unused/optimized out)`)
    }
    return loc
  }

  setUniform1i(name: string, value: number): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform1i(loc, value)
  }

  setUniform1f(name: string, value: number): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform1f(loc, value)
  }

  setUniform2f(name: string, x: number, y: number): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform2f(loc, x, y)
  }

  setUniform3f(name: string, x: number, y: number, z: number): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform3f(loc, x, y, z)
  }

  setUniform4f(name: string, x: number, y: number, z: number, w: number): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform4f(loc, x, y, z, w)
  }

  setUniform1fv(name: string, value: Float32List): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform1fv(loc, value)
  }

  setUniform2fv(name: string, value: Float32List): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform2fv(loc, value)
  }

  setUniform3fv(name: string, value: Float32List): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform3fv(loc, value)
  }

  setUniform4fv(name: string, value: Float32List): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniform4fv(loc, value)
  }

  setUniformMat3fv(name: string, value: Float32List, transpose = false): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniformMatrix3fv(loc, transpose, value)
  }

  setUniformMat4fv(name: string, value: Float32List, transpose = false): void {
    const loc = this._loc(name)
    if (loc !== null) this.gl.uniformMatrix4fv(loc, transpose, value)
  }
}
