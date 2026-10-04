/**
 * Headless WebGL2 stand-in for tests and benchmarks. Implements the subset of
 * WebGL2 the RenderSystem uses as no-ops, while recording draw calls, bound
 * textures and (optionally) the per-instance data of every instanced draw.
 *
 *   const canvas = createRecordingCanvas(800, 600, { captureInstances: true })
 *   const rs = new RenderSystem(canvas, new Map())
 *   rs.update(world, 1 / 60)
 *   canvas.gl.draws  // draws of the last frame (reset on gl.clear)
 */

export const INSTANCE_FLOATS = 19

export interface RecordedTexture {
  id: number
  width: number
  height: number
  uploads: number
  deleted: boolean
}

export interface RecordedDraw {
  kind: 'instanced' | 'arrays'
  /** Instance count for instanced draws, vertex count otherwise. */
  count: number
  texture: RecordedTexture | null
  /** Copy of instance floats (count * 19) when `captureInstances` is on. */
  instances: Float32Array | null
}

export interface RecordedInstance {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  anchorX: number
  anchorY: number
  offsetX: number
  offsetY: number
  flipX: boolean
  flipY: boolean
  r: number
  g: number
  b: number
  a: number
  u: number
  v: number
  uw: number
  vh: number
}

export interface RecordingGLOptions {
  captureInstances?: boolean
}

let nextObjId = 1
const noop = (): void => {}

/** Decode the instance floats of a recorded draw into objects (test helper; allocates). */
export function decodeInstances(draw: RecordedDraw): RecordedInstance[] {
  const d = draw.instances
  if (!d) throw new Error('decodeInstances: draw has no instance data (enable captureInstances)')
  const out: RecordedInstance[] = []
  for (let o = 0; o < draw.count * INSTANCE_FLOATS; o += INSTANCE_FLOATS) {
    out.push({
      x: d[o],
      y: d[o + 1],
      width: d[o + 2],
      height: d[o + 3],
      rotation: d[o + 4],
      anchorX: d[o + 5],
      anchorY: d[o + 6],
      offsetX: d[o + 7],
      offsetY: d[o + 8],
      flipX: d[o + 9] === 1,
      flipY: d[o + 10] === 1,
      r: d[o + 11],
      g: d[o + 12],
      b: d[o + 13],
      a: d[o + 14],
      u: d[o + 15],
      v: d[o + 16],
      uw: d[o + 17],
      vh: d[o + 18],
    })
  }
  return out
}

function sourceSize(src: unknown): [number, number] {
  const s = src as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | null
  if (!s) return [0, 0]
  return [s.naturalWidth || s.width || 0, s.naturalHeight || s.height || 0]
}

/**
 * Recording WebGL2 context. Draw state for the current frame lives in `draws`
 * (cleared by each `clear()` call, which the renderer issues once per frame);
 * `totalDraws` and `totalInstances` accumulate across frames.
 */
export class RecordingGL {
  // Constants (values match WebGL2 where it matters for debugging).
  readonly ARRAY_BUFFER = 0x8892
  readonly STATIC_DRAW = 0x88e4
  readonly DYNAMIC_DRAW = 0x88e8
  readonly FLOAT = 0x1406
  readonly UNSIGNED_BYTE = 0x1401
  readonly TRIANGLES = 0x0004
  readonly TEXTURE_2D = 0x0de1
  readonly TEXTURE0 = 0x84c0
  readonly TEXTURE1 = 0x84c1
  readonly RGBA = 0x1908
  readonly RGBA8 = 0x8058
  readonly TEXTURE_MIN_FILTER = 0x2801
  readonly TEXTURE_MAG_FILTER = 0x2800
  readonly TEXTURE_WRAP_S = 0x2802
  readonly TEXTURE_WRAP_T = 0x2803
  readonly NEAREST = 0x2600
  readonly LINEAR = 0x2601
  readonly NEAREST_MIPMAP_NEAREST = 0x2700
  readonly LINEAR_MIPMAP_NEAREST = 0x2701
  readonly NEAREST_MIPMAP_LINEAR = 0x2702
  readonly LINEAR_MIPMAP_LINEAR = 0x2703
  readonly CLAMP_TO_EDGE = 0x812f
  readonly REPEAT = 0x2901
  readonly BLEND = 0x0be2
  readonly SRC_ALPHA = 0x0302
  readonly ONE_MINUS_SRC_ALPHA = 0x0303
  readonly ONE_MINUS_SRC_COLOR = 0x0301
  readonly DST_COLOR = 0x0306
  readonly ONE = 1
  readonly COLOR_BUFFER_BIT = 0x4000
  readonly FRAMEBUFFER = 0x8d40
  readonly READ_FRAMEBUFFER = 0x8ca8
  readonly DRAW_FRAMEBUFFER = 0x8ca9
  readonly COLOR_ATTACHMENT0 = 0x8ce0
  readonly VERTEX_SHADER = 0x8b31
  readonly FRAGMENT_SHADER = 0x8b30
  readonly COMPILE_STATUS = 0x8b81
  readonly LINK_STATUS = 0x8b82

  readonly draws: RecordedDraw[] = []
  readonly textures = new Map<number, RecordedTexture>()
  totalDraws = 0
  totalInstances = 0
  frames = 0
  contextLost = false
  captureInstances: boolean

  private boundTexture: RecordedTexture | null = null
  private lastInstanceSrc: ArrayBufferView | null = null

  constructor(
    readonly canvas: unknown,
    opts: RecordingGLOptions = {},
  ) {
    this.captureInstances = opts.captureInstances ?? false
  }

  isContextLost(): boolean {
    return this.contextLost
  }

  clear(): void {
    this.draws.length = 0
    this.frames++
  }

  createTexture(): object {
    const t: RecordedTexture = { id: nextObjId++, width: 0, height: 0, uploads: 0, deleted: false }
    this.textures.set(t.id, t)
    return t
  }
  deleteTexture(t: RecordedTexture | null): void {
    if (t) t.deleted = true
  }
  bindTexture(_target: number, t: RecordedTexture | null): void {
    this.boundTexture = t
  }
  texImage2D(...args: unknown[]): void {
    const t = this.boundTexture
    if (!t) return
    // (target, level, internal, w, h, border, format, type, pixels) or (target, level, internal, format, type, source)
    if (args.length >= 8) {
      t.width = args[3] as number
      t.height = args[4] as number
    } else {
      ;[t.width, t.height] = sourceSize(args[5])
    }
    t.uploads++
  }
  texSubImage2D(): void {
    if (this.boundTexture) this.boundTexture.uploads++
  }

  bufferSubData(_target: number, _dst: number, src: ArrayBufferView): void {
    this.lastInstanceSrc = src
  }

  drawArraysInstanced(_mode: number, _first: number, _count: number, instanceCount: number): void {
    let instances: Float32Array | null = null
    if (this.captureInstances && this.lastInstanceSrc instanceof Float32Array) {
      instances = this.lastInstanceSrc.slice(0, instanceCount * INSTANCE_FLOATS)
    }
    this.draws.push({ kind: 'instanced', count: instanceCount, texture: this.boundTexture, instances })
    this.totalDraws++
    this.totalInstances += instanceCount
  }
  drawArrays(_mode: number, _first: number, count: number): void {
    this.draws.push({ kind: 'arrays', count, texture: this.boundTexture, instances: null })
    this.totalDraws++
  }

  /** All instances drawn this frame, decoded, in draw order. Requires `captureInstances`. */
  frameInstances(): RecordedInstance[] {
    const out: RecordedInstance[] = []
    for (const d of this.draws) if (d.kind === 'instanced') out.push(...decodeInstances(d))
    return out
  }

  createBuffer(): object {
    return { id: nextObjId++ }
  }
  createVertexArray(): object {
    return { id: nextObjId++ }
  }
  createFramebuffer(): object {
    return { id: nextObjId++ }
  }
  createProgram(): object {
    return { id: nextObjId++ }
  }
  createShader(): object {
    return { id: nextObjId++ }
  }
  getUniformLocation(): object {
    return { id: nextObjId++ }
  }
  getShaderParameter(): boolean {
    return true
  }
  getProgramParameter(): boolean {
    return true
  }
  getShaderInfoLog(): string {
    return ''
  }
  getProgramInfoLog(): string {
    return ''
  }
}

// Every other WebGL2 method the renderer calls is a no-op.
for (const name of [
  'activeTexture',
  'attachShader',
  'bindBuffer',
  'bindFramebuffer',
  'bindVertexArray',
  'blendFunc',
  'blitFramebuffer',
  'bufferData',
  'clearColor',
  'compileShader',
  'deleteFramebuffer',
  'deleteShader',
  'disable',
  'enable',
  'enableVertexAttribArray',
  'framebufferTexture2D',
  'generateMipmap',
  'linkProgram',
  'shaderSource',
  'texParameteri',
  'uniform1f',
  'uniform1i',
  'uniform2f',
  'useProgram',
  'vertexAttribDivisor',
  'vertexAttribPointer',
  'viewport',
]) {
  ;(RecordingGL.prototype as unknown as Record<string, unknown>)[name] = noop
}

/** No-op 2D context: enough for the renderer's offscreen text/shape/particle canvases. */
function createNoop2D(canvas: { width: number; height: number }): CanvasRenderingContext2D {
  const gradient = { addColorStop: noop }
  const target: Record<string, unknown> = {
    canvas,
    measureText: (s: string) => ({ width: s.length * 8 }),
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  }
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k as string] : noop),
    set: (t, k, v) => {
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

export interface RecordingCanvas extends HTMLCanvasElement {
  readonly gl: RecordingGL
}

/**
 * A canvas-like object whose `getContext('webgl2')` returns a {@link RecordingGL}
 * and `getContext('2d')` a no-op 2D context. Works without a DOM.
 */
export function createRecordingCanvas(width = 800, height = 600, opts: RecordingGLOptions = {}): RecordingCanvas {
  const canvas = {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {},
    addEventListener: noop,
    removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }),
  } as unknown as { gl: RecordingGL; getContext(kind: string): unknown; width: number; height: number }
  canvas.gl = new RecordingGL(canvas, opts)
  let ctx2d: CanvasRenderingContext2D | null = null
  canvas.getContext = (kind: string) => {
    if (kind === 'webgl2') return canvas.gl
    if (kind === '2d') return (ctx2d ??= createNoop2D(canvas))
    return null
  }
  return canvas as unknown as RecordingCanvas
}

/**
 * Makes the renderer's offscreen canvases (text, shapes, particles) work without
 * a real canvas implementation. In plain Node it installs a minimal `document`;
 * under happy-dom/jsdom it gives `HTMLCanvasElement` a no-op `getContext` when
 * the environment has none. Returns a function that undoes the change.
 */
export function installHeadlessCanvasDOM(): () => void {
  const g = globalThis as unknown as {
    document?: unknown
    HTMLCanvasElement?: { prototype: { getContext?: unknown } }
  }
  if (!g.document) {
    g.document = {
      createElement: (tag: string) => {
        if (tag !== 'canvas') throw new Error(`headless DOM: createElement('${tag}') not supported`)
        return createRecordingCanvas(1, 1)
      },
    }
    return () => {
      delete g.document
    }
  }
  const proto = g.HTMLCanvasElement?.prototype
  if (!proto || typeof proto.getContext === 'function') return noop
  const ctxs = new WeakMap<object, unknown>()
  proto.getContext = function (this: { width: number; height: number }, kind: string) {
    if (kind === '2d') {
      let c = ctxs.get(this)
      if (!c) ctxs.set(this, (c = createNoop2D(this)))
      return c
    }
    if (kind === 'webgl2') return new RecordingGL(this)
    return null
  }
  return () => {
    delete proto.getContext
  }
}
