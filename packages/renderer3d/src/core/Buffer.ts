import { GLError } from './GLContext'

export class GLBuffer {
  readonly handle: WebGLBuffer

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly target: GLenum,
    readonly usage: GLenum,
  ) {
    const buf = gl.createBuffer()
    if (!buf) throw new GLError('Failed to create WebGLBuffer')
    this.handle = buf
  }

  static createVBO(
    gl: WebGL2RenderingContext,
    data?: BufferSource,
    usage: GLenum = gl.STATIC_DRAW,
  ): GLBuffer {
    const buf = new GLBuffer(gl, gl.ARRAY_BUFFER, usage)
    if (data !== undefined) {
      buf.bind()
      buf.upload(data)
    }
    return buf
  }

  static createIBO(
    gl: WebGL2RenderingContext,
    data?: BufferSource,
    usage: GLenum = gl.STATIC_DRAW,
  ): GLBuffer {
    const buf = new GLBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, usage)
    if (data !== undefined) {
      buf.bind()
      buf.upload(data)
    }
    return buf
  }

  bind(): void {
    this.gl.bindBuffer(this.target, this.handle)
  }

  unbind(): void {
    this.gl.bindBuffer(this.target, null)
  }

  upload(data: BufferSource): void {
    this.gl.bindBuffer(this.target, this.handle)
    this.gl.bufferData(this.target, data, this.usage)
  }

  uploadSubData(data: BufferSource, offset: number): void {
    this.gl.bindBuffer(this.target, this.handle)
    this.gl.bufferSubData(this.target, offset, data)
  }

  dispose(): void {
    this.gl.deleteBuffer(this.handle)
  }
}

export class VAO {
  readonly handle: WebGLVertexArrayObject

  constructor(private readonly gl: WebGL2RenderingContext) {
    const vao = gl.createVertexArray()
    if (!vao) throw new GLError('Failed to create WebGLVertexArrayObject')
    this.handle = vao
  }

  bind(): void {
    this.gl.bindVertexArray(this.handle)
  }

  unbind(): void {
    this.gl.bindVertexArray(null)
  }

  dispose(): void {
    this.gl.deleteVertexArray(this.handle)
  }

  setAttribute(
    index: number,
    buffer: GLBuffer,
    size: number,
    type: GLenum,
    normalized = false,
    stride = 0,
    offset = 0,
    divisor?: number,
  ): void {
    const { gl } = this
    gl.bindVertexArray(this.handle)
    buffer.bind()
    gl.enableVertexAttribArray(index)
    if (type === gl.INT || type === gl.UNSIGNED_INT || type === gl.SHORT || type === gl.UNSIGNED_SHORT || type === gl.BYTE || type === gl.UNSIGNED_BYTE) {
      gl.vertexAttribIPointer(index, size, type, stride, offset)
    } else {
      gl.vertexAttribPointer(index, size, type, normalized, stride, offset)
    }
    if (divisor !== undefined) {
      gl.vertexAttribDivisor(index, divisor)
    }
  }
}
