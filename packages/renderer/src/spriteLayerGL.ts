import { MAX_LAYER_ATLASES, SPRITE_FLIP_X, SPRITE_FLIP_Y, SPRITE_HIDDEN, SPRITE_UNTEXTURED } from './spriteLayerFlags'
import type { SpriteLayer } from './spriteLayer'

const FLOATS = 20
const MAX_BATCH = 16384

const VERT = `#version 300 es
layout(location = 0) in vec2 a_quadPos;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec2  i_pos;
layout(location = 3) in vec2  i_size;
layout(location = 4) in float i_rot;
layout(location = 5) in vec2  i_anchor;
layout(location = 6) in vec2  i_flip;
layout(location = 7) in vec4  i_color;
layout(location = 8) in vec4  i_uvRect;
layout(location = 9) in float i_atlas;
uniform vec2 u_camPos;
uniform float u_zoom;
uniform vec2 u_canvasSize;
uniform vec2 u_shake;
out vec2 v_uv;
out vec4 v_color;
flat out int v_atlas;
void main() {
  vec2 local = (a_quadPos - (i_anchor - 0.5)) * i_size;
  if (i_flip.x > 0.5) local.x = -local.x;
  if (i_flip.y > 0.5) local.y = -local.y;
  float c = cos(i_rot);
  float s = sin(i_rot);
  vec2 world = i_pos + vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  gl_Position = vec4(
    2.0 * u_zoom / u_canvasSize.x * (world.x - u_camPos.x) + 2.0 * u_shake.x / u_canvasSize.x,
    -2.0 * u_zoom / u_canvasSize.y * (world.y - u_camPos.y) - 2.0 * u_shake.y / u_canvasSize.y,
    0.0, 1.0);
  v_uv = i_uvRect.xy + a_uv * i_uvRect.zw;
  v_color = i_color;
  v_atlas = i_atlas < -0.5 ? -1 : int(i_atlas + 0.5);
}
`

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_color;
flat in int v_atlas;
uniform sampler2D u_tex[${MAX_LAYER_ATLASES}];
out vec4 fragColor;
void main() {
  vec4 t = vec4(1.0);
  switch (v_atlas) {
${Array.from({ length: MAX_LAYER_ATLASES }, (_, i) => `    case ${i}: t = texture(u_tex[${i}], v_uv); break;`).join('\n')}
    default: break;
  }
  fragColor = t * v_color;
}
`

/** A resolved atlas texture, or null while it is still loading. */
export interface ResolvedAtlas {
  tex: WebGLTexture
  width: number
  height: number
}

export interface LayerCamera {
  x: number
  y: number
  zoom: number
  width: number
  height: number
  shakeX: number
  shakeY: number
  viewL: number
  viewR: number
  viewT: number
  viewB: number
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`[SpriteLayer] ${gl.getShaderInfoLog(sh)}`)
  return sh
}

/** Draws SpriteLayers with up to 8 atlases per draw call. */
export class SpriteLayerRenderer {
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buffer: WebGLBuffer | null = null
  private uCam: WebGLUniformLocation | null = null
  private uZoom: WebGLUniformLocation | null = null
  private uSize: WebGLUniformLocation | null = null
  private uShake: WebGLUniformLocation | null = null
  private readonly data = new Float32Array(MAX_BATCH * FLOATS)
  private readonly uw = new Float32Array(MAX_LAYER_ATLASES)
  private readonly vh = new Float32Array(MAX_LAYER_ATLASES)
  private readonly cols = new Int32Array(MAX_LAYER_ATLASES)
  private readonly ready = new Uint8Array(MAX_LAYER_ATLASES)
  drawCalls = 0
  instances = 0

  constructor(private readonly gl: WebGL2RenderingContext) {}

  private init(): void {
    const { gl } = this
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`[SpriteLayer] ${gl.getProgramInfoLog(p)}`)
    this.program = p
    this.uCam = gl.getUniformLocation(p, 'u_camPos')
    this.uZoom = gl.getUniformLocation(p, 'u_zoom')
    this.uSize = gl.getUniformLocation(p, 'u_canvasSize')
    this.uShake = gl.getUniformLocation(p, 'u_shake')
    gl.useProgram(p)
    for (let i = 0; i < MAX_LAYER_ATLASES; i++) gl.uniform1i(gl.getUniformLocation(p, `u_tex[${i}]`), i)

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    const quad = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -0.5, -0.5, 0, 0, 0.5, -0.5, 1, 0, -0.5, 0.5, 0, 1, 0.5, -0.5, 1, 0, 0.5, 0.5, 1, 1, -0.5, 0.5, 0, 1,
      ]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
    this.buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW)
    let off = 0
    const attr = (loc: number, size: number) => {
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, FLOATS * 4, off)
      gl.vertexAttribDivisor(loc, 1)
      off += size * 4
    }
    attr(2, 2)
    attr(3, 2)
    attr(4, 1)
    attr(5, 2)
    attr(6, 2)
    attr(7, 4)
    attr(8, 4)
    attr(9, 1)
    gl.bindVertexArray(null)
  }

  /** GL objects died with the context; rebuild on next draw. */
  contextRestored(): void {
    this.program = null
  }

  dispose(): void {
    const { gl } = this
    if (this.program) gl.deleteProgram(this.program)
    if (this.vao) gl.deleteVertexArray(this.vao)
    if (this.buffer) gl.deleteBuffer(this.buffer)
    this.program = null
  }

  /**
   * `resolve(i)` returns atlas i's texture or null while loading; `white` is
   * bound to unused units. Sprites whose atlas isn't ready are skipped.
   */
  draw(
    layer: SpriteLayer,
    cam: LayerCamera,
    resolve: (i: number) => ResolvedAtlas | null,
    white: WebGLTexture,
    applySampling: (tex: WebGLTexture) => void,
  ): void {
    const count = layer.count
    if (!layer.visible || count === 0) return
    const { gl } = this
    if (!this.program) this.init()
    gl.useProgram(this.program)
    gl.uniform2f(this.uCam, cam.x, cam.y)
    gl.uniform1f(this.uZoom, cam.zoom)
    gl.uniform2f(this.uSize, cam.width, cam.height)
    gl.uniform2f(this.uShake, cam.shakeX, cam.shakeY)

    const atlases = layer.atlases
    const na = Math.min(atlases.length, MAX_LAYER_ATLASES)
    for (let a = 0; a < MAX_LAYER_ATLASES; a++) {
      // Select the unit first: resolve() may create or re-upload a texture, which binds it.
      gl.activeTexture(gl.TEXTURE0 + a)
      const r = a < na ? resolve(a) : null
      gl.bindTexture(gl.TEXTURE_2D, r ? r.tex : white)
      if (r) applySampling(r.tex)
      const at = a < na ? atlases[a] : undefined
      // 2 = atlas without a source: its sprites draw as solid rects.
      this.ready[a] =
        at && at.src === undefined && at.image === undefined && at.dynamicSrc === undefined ? 2 : r ? 1 : 0
      if (r && at) {
        const fw = at.frameWidth ?? 0
        const fh = at.frameHeight ?? 0
        if (fw > 0 && fh > 0) {
          this.cols[a] = at.frameColumns ?? Math.max(1, Math.floor(r.width / fw))
          this.uw[a] = fw / r.width
          this.vh[a] = fh / r.height
        } else {
          this.cols[a] = 1
          this.uw[a] = 1
          this.vh[a] = 1
        }
      }
    }
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)

    const order = layer.sortByKey ? layer.drawOrder() : null
    const { viewL, viewR, viewT, viewB } = cam
    const ax = layer.anchorX
    const ay = layer.anchorY
    const X = layer.x,
      Y = layer.y,
      Wd = layer.w,
      Ht = layer.h,
      R = layer.rotation,
      F = layer.frame,
      A = layer.atlas,
      C = layer.color,
      FL = layer.flags
    const d = this.data
    let batch = 0
    for (let k = 0; k < count; k++) {
      const i = order ? order[k] : k
      const flags = FL[i]
      if (flags & SPRITE_HIDDEN) continue
      const x = X[i],
        y = Y[i],
        w = Wd[i],
        h = Ht[i]
      const rad = (w < 0 ? -w : w) + (h < 0 ? -h : h)
      if (x + rad < viewL || x - rad > viewR || y + rad < viewT || y - rad > viewB) continue
      let a = A[i]
      const untextured = (flags & SPRITE_UNTEXTURED) !== 0 || a >= na || this.ready[a] === 2
      if (!untextured && this.ready[a] === 0) continue
      const c = C[i]
      const b = batch * FLOATS
      d[b] = x
      d[b + 1] = y
      d[b + 2] = w
      d[b + 3] = h
      d[b + 4] = R[i]
      d[b + 5] = ax
      d[b + 6] = ay
      d[b + 7] = flags & SPRITE_FLIP_X
      d[b + 8] = (flags & SPRITE_FLIP_Y) >> 1
      d[b + 9] = (c >>> 24) / 255
      d[b + 10] = ((c >>> 16) & 255) / 255
      d[b + 11] = ((c >>> 8) & 255) / 255
      d[b + 12] = (c & 255) / 255
      if (untextured) {
        a = -1
        d[b + 13] = 0
        d[b + 14] = 0
        d[b + 15] = 1
        d[b + 16] = 1
      } else {
        const f = F[i]
        const cols = this.cols[a]
        d[b + 13] = (f % cols) * this.uw[a]
        d[b + 14] = Math.floor(f / cols) * this.vh[a]
        d[b + 15] = this.uw[a]
        d[b + 16] = this.vh[a]
      }
      d[b + 17] = a
      d[b + 18] = 0
      d[b + 19] = 0
      if (++batch === MAX_BATCH) {
        this.flush(batch)
        batch = 0
      }
    }
    this.flush(batch)
    gl.bindVertexArray(null)
    gl.activeTexture(gl.TEXTURE0)
  }

  private flush(n: number): void {
    if (n === 0) return
    const { gl } = this
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, n * FLOATS)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n)
    this.drawCalls++
    this.instances += n
  }
}
