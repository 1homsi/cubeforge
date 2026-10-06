import {
  ATLASES_PER_DRAW,
  MAX_LAYER_ATLASES,
  SPRITE_FLIP_X,
  SPRITE_FLIP_Y,
  SPRITE_HIDDEN,
  SPRITE_UNTEXTURED,
} from './spriteLayerFlags'
import type { SpriteLayer, AtlasFrame } from './spriteLayer'

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
uniform sampler2D u_tex[${ATLASES_PER_DRAW}];
out vec4 fragColor;
void main() {
  vec4 t = vec4(1.0);
  switch (v_atlas) {
${Array.from({ length: ATLASES_PER_DRAW }, (_, i) => `    case ${i}: t = texture(u_tex[${i}], v_uv); break;`).join('\n')}
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

/** Draws SpriteLayers; atlases are bound in groups of 8 (one draw call per run of sprites in a group). */
export class SpriteLayerRenderer {
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buffer: WebGLBuffer | null = null
  private uCam: WebGLUniformLocation | null = null
  private uZoom: WebGLUniformLocation | null = null
  private uSize: WebGLUniformLocation | null = null
  private uShake: WebGLUniformLocation | null = null
  private readonly data = new Float32Array(MAX_BATCH * FLOATS)
  // Per-atlas state for the layer being drawn (rebuilt every draw).
  private readonly texs: (WebGLTexture | null)[] = new Array(MAX_LAYER_ATLASES).fill(null)
  private readonly invW = new Float32Array(MAX_LAYER_ATLASES)
  private readonly invH = new Float32Array(MAX_LAYER_ATLASES)
  private readonly uw = new Float32Array(MAX_LAYER_ATLASES)
  private readonly vh = new Float32Array(MAX_LAYER_ATLASES)
  private readonly stepU = new Float32Array(MAX_LAYER_ATLASES)
  private readonly stepV = new Float32Array(MAX_LAYER_ATLASES)
  private readonly originU = new Float32Array(MAX_LAYER_ATLASES)
  private readonly originV = new Float32Array(MAX_LAYER_ATLASES)
  private readonly insetU = new Float32Array(MAX_LAYER_ATLASES)
  private readonly insetV = new Float32Array(MAX_LAYER_ATLASES)
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
    for (let i = 0; i < ATLASES_PER_DRAW; i++) gl.uniform1i(gl.getUniformLocation(p, `u_tex[${i}]`), i)

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
   * bound to unused units; `applySampling(i)` sets the filter of the texture
   * currently bound for atlas i. Sprites whose atlas isn't ready are skipped.
   */
  draw(
    layer: SpriteLayer,
    cam: LayerCamera,
    resolve: (i: number) => ResolvedAtlas | null,
    white: WebGLTexture,
    applySampling: (atlasIndex: number, tex: WebGLTexture) => void,
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
    const frameTables: (AtlasFrame[] | undefined)[] = this.frameTables
    for (let a = 0; a < na; a++) {
      const r = resolve(a)
      const at = atlases[a]
      this.texs[a] = r ? r.tex : null
      // 2 = atlas without a source: its sprites draw as solid rects.
      this.ready[a] = at.src === undefined && at.image === undefined && at.dynamicSrc === undefined ? 2 : r ? 1 : 0
      frameTables[a] = at.frames
      if (!r) continue
      const W = r.width
      const H = r.height
      this.invW[a] = 1 / W
      this.invH[a] = 1 / H
      const inset = at.inset ?? 0
      this.insetU[a] = inset / W
      this.insetV[a] = inset / H
      const fw = at.frameWidth ?? 0
      const fh = at.frameHeight ?? 0
      if (fw > 0 && fh > 0) {
        const sp = at.frameSpacing ?? 0
        const mg = at.frameMargin ?? 0
        this.cols[a] = at.frameColumns ?? Math.max(1, Math.floor((W - 2 * mg + sp) / (fw + sp)))
        this.uw[a] = fw / W
        this.vh[a] = fh / H
        this.stepU[a] = (fw + sp) / W
        this.stepV[a] = (fh + sp) / H
        this.originU[a] = mg / W
        this.originV[a] = mg / H
      } else {
        this.cols[a] = 1
        this.uw[a] = 1
        this.vh[a] = 1
        this.stepU[a] = 0
        this.stepV[a] = 0
        this.originU[a] = 0
        this.originV[a] = 0
      }
    }
    // Every unit holds a valid texture before the first draw (solid sprites bind none).
    for (let u = 0; u < ATLASES_PER_DRAW; u++) {
      gl.activeTexture(gl.TEXTURE0 + u)
      gl.bindTexture(gl.TEXTURE_2D, white)
    }
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)

    const order = layer.sortByKey ? layer.drawOrder() : null
    const total = order ? layer.orderCount : count
    const { viewL, viewR, viewT, viewB } = cam
    const usePivots = layer.hasPivots()
    const perSprite = usePivots || layer.anchor !== null
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
    let group = -1
    for (let k = 0; k < total; k++) {
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
      let u0 = 0,
        v0 = 0,
        uw = 1,
        vh = 1
      if (!untextured) {
        if (this.ready[a] === 0) continue
        const f = F[i]
        const table = frameTables[a]
        if (table !== undefined) {
          const fr = table[f]
          if (fr === undefined) continue
          const iu = this.insetU[a]
          const iv = this.insetV[a]
          u0 = fr.x * this.invW[a] + iu
          v0 = fr.y * this.invH[a] + iv
          uw = fr.w * this.invW[a] - 2 * iu
          vh = fr.h * this.invH[a] - 2 * iv
        } else {
          const cols = this.cols[a]
          const iu = this.insetU[a]
          const iv = this.insetV[a]
          u0 = this.originU[a] + (f % cols) * this.stepU[a] + iu
          v0 = this.originV[a] + Math.floor(f / cols) * this.stepV[a] + iv
          uw = this.uw[a] - 2 * iu
          vh = this.vh[a] - 2 * iv
        }
        const g = a >> 3
        if (g !== group) {
          if (batch > 0) {
            this.flush(batch)
            batch = 0
          }
          this.bindGroup(g, na, white, applySampling)
          group = g
        }
      }
      const c = C[i]
      const b = batch * FLOATS
      d[b] = x
      d[b + 1] = y
      d[b + 2] = w
      d[b + 3] = h
      d[b + 4] = R[i]
      if (perSprite) {
        layer.resolveAnchor(i, usePivots)
        d[b + 5] = layer._ax
        d[b + 6] = layer._ay
      } else {
        d[b + 5] = ax
        d[b + 6] = ay
      }
      d[b + 7] = flags & SPRITE_FLIP_X
      d[b + 8] = (flags & SPRITE_FLIP_Y) >> 1
      d[b + 9] = (c >>> 24) / 255
      d[b + 10] = ((c >>> 16) & 255) / 255
      d[b + 11] = ((c >>> 8) & 255) / 255
      d[b + 12] = (c & 255) / 255
      d[b + 13] = u0
      d[b + 14] = v0
      d[b + 15] = uw
      d[b + 16] = vh
      if (untextured) a = -1
      d[b + 17] = a < 0 ? -1 : a & 7
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

  private readonly frameTables: (AtlasFrame[] | undefined)[] = new Array(MAX_LAYER_ATLASES)

  /** Bind atlases [8g, 8g + 8) to the texture units and set their filters. */
  private bindGroup(
    g: number,
    na: number,
    white: WebGLTexture,
    applySampling: (atlasIndex: number, tex: WebGLTexture) => void,
  ): void {
    const { gl } = this
    for (let u = 0; u < ATLASES_PER_DRAW; u++) {
      const idx = g * ATLASES_PER_DRAW + u
      const real = idx < na && this.ready[idx] === 1
      gl.activeTexture(gl.TEXTURE0 + u)
      gl.bindTexture(gl.TEXTURE_2D, real ? this.texs[idx]! : white)
      if (real) applySampling(idx, this.texs[idx]!)
    }
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
