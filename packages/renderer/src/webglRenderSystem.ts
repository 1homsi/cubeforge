import type { System, ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import { VERT_SRC, FRAG_SRC, PARALLAX_VERT_SRC, PARALLAX_FRAG_SRC } from './shaders'
import { parseCSSColor } from './colorParser'

// ── Component shapes (duck-typed — no hard dependency on renderer/physics) ───

interface SpriteComponent {
  type: 'Sprite'
  width: number
  height: number
  color: string
  src?: string
  image?: HTMLImageElement
  offsetX: number
  offsetY: number
  zIndex: number
  visible: boolean
  flipX: boolean
  anchorX: number
  anchorY: number
  frameIndex: number
  frameWidth?: number
  frameHeight?: number
  frameColumns?: number
  frame?: { sx: number; sy: number; sw: number; sh: number }
  tileX?: boolean
  tileY?: boolean
}

interface Camera2DComponent {
  type: 'Camera2D'
  x: number
  y: number
  zoom: number
  followEntityId?: string
  smoothing: number
  background: string
  bounds?: { x: number; y: number; width: number; height: number }
  deadZone?: { w: number; h: number }
  shakeIntensity: number
  shakeDuration: number
  shakeTimer: number
}

interface AnimationStateComponent {
  type: 'AnimationState'
  playing: boolean
  frames: number[]
  fps: number
  timer: number
  currentIndex: number
  loop: boolean
}

interface SquashStretchComponent {
  type: 'SquashStretch'
  intensity: number
  recovery: number
  currentScaleX: number
  currentScaleY: number
}

interface RigidBodyShape {
  type: 'RigidBody'
  vx: number
  vy: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
}

interface ParticlePoolComponent {
  type: 'ParticlePool'
  particles: Particle[]
  active: boolean
  maxParticles: number
  timer: number
  rate: number
  angle: number
  spread: number
  speed: number
  particleLife: number
  particleSize: number
  color: string
  gravity: number
}

interface ParallaxLayerComponent {
  type: 'ParallaxLayer'
  src: string
  speedX: number
  speedY: number
  repeatX: boolean
  repeatY: boolean
  zIndex: number
  offsetX: number
  offsetY: number
  imageWidth: number
  imageHeight: number
}

interface TextComponent {
  type: 'Text'
  text: string
  fontSize: number
  fontFamily: string
  color: string
  align: CanvasTextAlign
  baseline: CanvasTextBaseline
  zIndex: number
  visible: boolean
  maxWidth?: number
  offsetX: number
  offsetY: number
}

interface TrailComponent {
  type: 'Trail'
  length: number
  color: string
  width: number
  points: { x: number; y: number }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Number of floats per instance in the GPU buffer. */
const FLOATS_PER_INSTANCE = 18
/** Maximum sprites batched in a single draw call. */
const MAX_INSTANCES = 8192
/** Maximum text texture cache entries before evicting oldest. */
const MAX_TEXT_CACHE = 200

// ── GL helpers ────────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`[WebGLRenderer] Shader compile error:\n${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  const prog = gl.createProgram()!
  gl.attachShader(prog, vert)
  gl.attachShader(prog, frag)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`[WebGLRenderer] Program link error:\n${gl.getProgramInfoLog(prog)}`)
  }
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  return prog
}

function createWhiteTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  return tex
}

// ── Sprite helpers ────────────────────────────────────────────────────────────

function getTextureKey(sprite: SpriteComponent): string {
  const src = sprite.image?.src || sprite.src
  if (src) return (sprite.tileX || sprite.tileY) ? `${src}:repeat` : src
  return `__color__:${sprite.color}`
}

function getUVRect(sprite: SpriteComponent): [number, number, number, number] {
  if (!sprite.image || sprite.image.naturalWidth === 0) return [0, 0, 1, 1]
  const iw = sprite.image.naturalWidth
  const ih = sprite.image.naturalHeight
  if (sprite.frameWidth && sprite.frameHeight) {
    const cols = sprite.frameColumns ?? Math.floor(iw / sprite.frameWidth)
    const col = sprite.frameIndex % cols
    const row = Math.floor(sprite.frameIndex / cols)
    return [
      (col * sprite.frameWidth) / iw,
      (row * sprite.frameHeight) / ih,
      sprite.frameWidth / iw,
      sprite.frameHeight / ih,
    ]
  }
  if (sprite.frame) {
    const { sx, sy, sw, sh } = sprite.frame
    return [sx / iw, sy / ih, sw / iw, sh / ih]
  }
  // Tiling: UV width/height > 1 causes the texture to repeat (needs REPEAT wrap mode)
  const uw = sprite.tileX ? sprite.width / iw : 1
  const vh = sprite.tileY ? sprite.height / ih : 1
  return [0, 0, uw, vh]
}

// ── RenderSystem (WebGL2) ─────────────────────────────────────────────────────

/**
 * WebGL2-based instanced render system.
 *
 * Uses instanced rendering: sprites sharing the same texture source are
 * drawn in a single `drawArraysInstanced` call.
 */
export class RenderSystem implements System {
  private readonly gl: WebGL2RenderingContext
  private readonly program: WebGLProgram
  private readonly quadVAO: WebGLVertexArrayObject
  private readonly instanceBuffer: WebGLBuffer
  private readonly instanceData: Float32Array
  private readonly whiteTexture: WebGLTexture
  private readonly textures = new Map<string, WebGLTexture>()
  private readonly imageCache = new Map<string, HTMLImageElement>()

  // Cached uniform locations — sprite program
  private readonly uCamPos: WebGLUniformLocation
  private readonly uZoom: WebGLUniformLocation
  private readonly uCanvasSize: WebGLUniformLocation
  private readonly uShake: WebGLUniformLocation
  private readonly uTexture: WebGLUniformLocation
  private readonly uUseTexture: WebGLUniformLocation

  // ── Parallax program ──────────────────────────────────────────────────────
  private readonly parallaxProgram: WebGLProgram
  private readonly parallaxVAO: WebGLVertexArrayObject
  private readonly parallaxTextures = new Map<string, WebGLTexture>()
  private readonly parallaxImageCache = new Map<string, HTMLImageElement>()

  // Cached uniform locations — parallax program
  private readonly pUTexture: WebGLUniformLocation
  private readonly pUUvOffset: WebGLUniformLocation
  private readonly pUTexSize: WebGLUniformLocation
  private readonly pUCanvasSize: WebGLUniformLocation

  // ── Text texture cache ────────────────────────────────────────────────────
  private readonly textureCache = new Map<string, { tex: WebGLTexture; w: number; h: number }>()
  /** Insertion-order key list for LRU-style eviction. */
  private readonly textureCacheKeys: string[] = []

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly entityIds: Map<string, EntityId>,
  ) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false })
    if (!gl) throw new Error('[WebGLRenderer] WebGL2 is not supported in this browser')
    this.gl = gl

    this.program = createProgram(gl, VERT_SRC, FRAG_SRC)

    // ── Unit quad geometry (6 vertices, 2 triangles) ──────────────────────────
    // Corners at (-0.5, -0.5) to (0.5, 0.5), UVs at (0,0) to (1,1)
    const quadVerts = new Float32Array([
      -0.5, -0.5,  0, 0,
       0.5, -0.5,  1, 0,
      -0.5,  0.5,  0, 1,
       0.5, -0.5,  1, 0,
       0.5,  0.5,  1, 1,
      -0.5,  0.5,  0, 1,
    ])

    this.quadVAO = gl.createVertexArray()!
    gl.bindVertexArray(this.quadVAO)

    // Per-vertex buffer
    const quadBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW)

    const qStride = 4 * 4
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, qStride, 0)       // a_quadPos
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, qStride, 2 * 4)   // a_uv

    // Per-instance buffer
    this.instanceData = new Float32Array(MAX_INSTANCES * FLOATS_PER_INSTANCE)
    this.instanceBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW)

    const iStride = FLOATS_PER_INSTANCE * 4
    let byteOffset = 0
    const addAttr = (loc: number, size: number) => {
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, iStride, byteOffset)
      gl.vertexAttribDivisor(loc, 1)
      byteOffset += size * 4
    }
    addAttr(2, 2)  // i_pos
    addAttr(3, 2)  // i_size
    addAttr(4, 1)  // i_rot
    addAttr(5, 2)  // i_anchor
    addAttr(6, 2)  // i_offset
    addAttr(7, 1)  // i_flipX
    addAttr(8, 4)  // i_color
    addAttr(9, 4)  // i_uvRect

    gl.bindVertexArray(null)

    // Cache uniform locations — sprite program
    gl.useProgram(this.program)
    this.uCamPos     = gl.getUniformLocation(this.program, 'u_camPos')!
    this.uZoom       = gl.getUniformLocation(this.program, 'u_zoom')!
    this.uCanvasSize = gl.getUniformLocation(this.program, 'u_canvasSize')!
    this.uShake      = gl.getUniformLocation(this.program, 'u_shake')!
    this.uTexture    = gl.getUniformLocation(this.program, 'u_texture')!
    this.uUseTexture = gl.getUniformLocation(this.program, 'u_useTexture')!

    this.whiteTexture = createWhiteTexture(gl)

    // ── Parallax fullscreen quad ──────────────────────────────────────────────
    this.parallaxProgram = createProgram(gl, PARALLAX_VERT_SRC, PARALLAX_FRAG_SRC)

    // Fullscreen NDC quad (-1 to 1)
    const fsVerts = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1, -1,
       1,  1,
      -1,  1,
    ])

    this.parallaxVAO = gl.createVertexArray()!
    gl.bindVertexArray(this.parallaxVAO)

    const fsBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf)
    gl.bufferData(gl.ARRAY_BUFFER, fsVerts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0)

    gl.bindVertexArray(null)

    // Cache uniform locations — parallax program
    gl.useProgram(this.parallaxProgram)
    this.pUTexture    = gl.getUniformLocation(this.parallaxProgram, 'u_texture')!
    this.pUUvOffset   = gl.getUniformLocation(this.parallaxProgram, 'u_uvOffset')!
    this.pUTexSize    = gl.getUniformLocation(this.parallaxProgram, 'u_texSize')!
    this.pUCanvasSize = gl.getUniformLocation(this.parallaxProgram, 'u_canvasSize')!

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  // ── Texture management (sprite textures — CLAMP_TO_EDGE) ──────────────────

  private loadTexture(src: string): WebGLTexture {
    const cached = this.textures.get(src)
    if (cached) return cached

    // Strip :repeat suffix used for tiled texture cache keys — not part of the actual URL
    const imgSrc = src.endsWith(':repeat') ? src.slice(0, -7) : src

    // Check if this src is already loaded in imageCache (e.g. from fallback path)
    const existing = this.imageCache.get(imgSrc)
    if (existing && existing.complete && existing.naturalWidth > 0) {
      const gl = this.gl
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, existing)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      this.textures.set(src, tex)
      return tex
    }

    // Return white while image loads; swap in real texture on load
    if (!existing) {
      const img = new Image()
      img.src = imgSrc
      const tiled = src.endsWith(':repeat')
      img.onload = () => {
        const gl = this.gl
        const tex = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        const wrap = tiled ? gl.REPEAT : gl.CLAMP_TO_EDGE
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
        this.textures.set(src, tex)
      }
      this.imageCache.set(imgSrc, img)
    }

    return this.whiteTexture
  }

  // ── Parallax texture management (REPEAT wrap mode) ────────────────────────

  private loadParallaxTexture(src: string): WebGLTexture | null {
    const cached = this.parallaxTextures.get(src)
    if (cached) return cached

    let img = this.parallaxImageCache.get(src)
    if (!img) {
      img = new Image()
      img.src = src
      img.onload = () => {
        const gl = this.gl
        const tex = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img!)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
        this.parallaxTextures.set(src, tex)
      }
      this.parallaxImageCache.set(src, img)
    }

    return null  // not ready yet
  }

  // ── Text texture management ───────────────────────────────────────────────

  private getTextTextureKey(text: TextComponent): string {
    return `${text.text}|${text.fontSize ?? 16}|${text.fontFamily ?? 'monospace'}|${text.color ?? '#ffffff'}`
  }

  private getOrCreateTextTexture(text: TextComponent): { tex: WebGLTexture; w: number; h: number } | null {
    const key = this.getTextTextureKey(text)
    const cached = this.textureCache.get(key)
    if (cached) return cached

    // Evict oldest if over cap
    if (this.textureCache.size >= MAX_TEXT_CACHE) {
      const oldest = this.textureCacheKeys.shift()
      if (oldest) {
        const old = this.textureCache.get(oldest)
        if (old) this.gl.deleteTexture(old.tex)
        this.textureCache.delete(oldest)
      }
    }

    // Render text to an offscreen canvas
    const offscreen = document.createElement('canvas')
    const ctx2d = offscreen.getContext('2d')!
    const font = `${text.fontSize ?? 16}px ${text.fontFamily ?? 'monospace'}`
    ctx2d.font = font
    const metrics = ctx2d.measureText(text.text)
    const textW = Math.ceil(metrics.width) + 4
    const textH = Math.ceil((text.fontSize ?? 16) * 1.5) + 4
    offscreen.width  = textW
    offscreen.height = textH

    // Re-apply font after resize (canvas resize resets state)
    ctx2d.font = font
    ctx2d.fillStyle = text.color ?? '#ffffff'
    ctx2d.textAlign = 'left'
    ctx2d.textBaseline = 'top'
    ctx2d.fillText(text.text, 2, 2, text.maxWidth)

    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const entry = { tex, w: textW, h: textH }
    this.textureCache.set(key, entry)
    this.textureCacheKeys.push(key)
    return entry
  }

  // ── Instanced draw call ────────────────────────────────────────────────────

  private flush(count: number, textureKey: string): void {
    if (count === 0) return
    const { gl } = this
    const isColor = textureKey.startsWith('__color__')
    const tex = isColor ? this.whiteTexture : this.loadTexture(textureKey)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(this.uUseTexture, isColor ? 0 : 1)
    gl.bindVertexArray(this.quadVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData, 0, count * FLOATS_PER_INSTANCE)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count)
  }

  private flushWithTex(count: number, tex: WebGLTexture, useTexture: boolean): void {
    if (count === 0) return
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(this.uUseTexture, useTexture ? 1 : 0)
    gl.bindVertexArray(this.quadVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData, 0, count * FLOATS_PER_INSTANCE)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count)
  }

  // ── Write one sprite instance into instanceData ───────────────────────────

  private writeInstance(
    base: number,
    x: number, y: number,
    w: number, h: number,
    rot: number,
    anchorX: number, anchorY: number,
    offsetX: number, offsetY: number,
    flipX: boolean,
    r: number, g: number, b: number, a: number,
    u: number, v: number, uw: number, vh: number,
  ): void {
    const d = this.instanceData
    d[base + 0]  = x
    d[base + 1]  = y
    d[base + 2]  = w
    d[base + 3]  = h
    d[base + 4]  = rot
    d[base + 5]  = anchorX
    d[base + 6]  = anchorY
    d[base + 7]  = offsetX
    d[base + 8]  = offsetY
    d[base + 9]  = flipX ? 1 : 0
    d[base + 10] = r
    d[base + 11] = g
    d[base + 12] = b
    d[base + 13] = a
    d[base + 14] = u
    d[base + 15] = v
    d[base + 16] = uw
    d[base + 17] = vh
  }

  // ── Main update loop ───────────────────────────────────────────────────────

  update(world: ECSWorld, dt: number): void {
    const { gl, canvas } = this
    const W = canvas.width
    const H = canvas.height

    // ── Camera ──────────────────────────────────────────────────────────────
    let camX = 0, camY = 0, zoom = 1
    let background = '#000000'
    let shakeX = 0, shakeY = 0

    const camId = world.queryOne('Camera2D')
    if (camId !== undefined) {
      const cam = world.getComponent<Camera2DComponent>(camId, 'Camera2D')!
      background = cam.background

      if (cam.followEntityId) {
        const targetId = this.entityIds.get(cam.followEntityId)
        if (targetId !== undefined) {
          const t = world.getComponent<TransformComponent>(targetId, 'Transform')
          if (t) {
            if (cam.deadZone) {
              const halfW = cam.deadZone.w / 2
              const halfH = cam.deadZone.h / 2
              const dx = t.x - cam.x, dy = t.y - cam.y
              if (dx > halfW)  cam.x = t.x - halfW
              else if (dx < -halfW) cam.x = t.x + halfW
              if (dy > halfH)  cam.y = t.y - halfH
              else if (dy < -halfH) cam.y = t.y + halfH
            } else if (cam.smoothing > 0) {
              const distSq = (t.x - cam.x) ** 2 + (t.y - cam.y) ** 2
              // Snap instantly when target teleports (>400px jump)
              if (distSq > 160000) {
                cam.x = t.x
                cam.y = t.y
              } else {
                cam.x += (t.x - cam.x) * (1 - cam.smoothing)
                cam.y += (t.y - cam.y) * (1 - cam.smoothing)
              }
            } else {
              cam.x = t.x
              cam.y = t.y
            }
          }
        }
      }

      if (cam.bounds) {
        const halfW = W / (2 * cam.zoom)
        const halfH = H / (2 * cam.zoom)
        cam.x = Math.max(cam.bounds.x + halfW, Math.min(cam.bounds.x + cam.bounds.width - halfW, cam.x))
        cam.y = Math.max(cam.bounds.y + halfH, Math.min(cam.bounds.y + cam.bounds.height - halfH, cam.y))
      }

      if (cam.shakeTimer > 0) {
        cam.shakeTimer -= dt
        if (cam.shakeTimer < 0) cam.shakeTimer = 0
        const progress = cam.shakeDuration > 0 ? cam.shakeTimer / cam.shakeDuration : 0
        shakeX = (world.rng() * 2 - 1) * cam.shakeIntensity * progress
        shakeY = (world.rng() * 2 - 1) * cam.shakeIntensity * progress
      }

      camX = cam.x
      camY = cam.y
      zoom = cam.zoom
    }

    // ── Animation update ─────────────────────────────────────────────────────
    for (const id of world.query('AnimationState', 'Sprite')) {
      const anim   = world.getComponent<AnimationStateComponent>(id, 'AnimationState')!
      const sprite = world.getComponent<SpriteComponent>(id, 'Sprite')!
      if (!anim.playing || anim.frames.length === 0) continue
      anim.timer += dt
      const frameDuration = 1 / anim.fps
      while (anim.timer >= frameDuration) {
        anim.timer -= frameDuration
        anim.currentIndex++
        if (anim.currentIndex >= anim.frames.length) {
          anim.currentIndex = anim.loop ? 0 : anim.frames.length - 1
        }
      }
      sprite.frameIndex = anim.frames[anim.currentIndex]
    }

    // ── SquashStretch update ─────────────────────────────────────────────────
    for (const id of world.query('SquashStretch', 'RigidBody')) {
      const ss   = world.getComponent<SquashStretchComponent>(id, 'SquashStretch')!
      const rb   = world.getComponent<RigidBodyShape>(id, 'RigidBody')!
      const spd  = Math.sqrt(rb.vx * rb.vx + rb.vy * rb.vy)
      const tScX = rb.vy < -100 ? 1 + ss.intensity * 0.4 : (spd > 50 ? 1 - ss.intensity * 0.3 : 1)
      const tScY = rb.vy < -100 ? 1 - ss.intensity * 0.4 : (spd > 50 ? 1 + ss.intensity * 0.3 : 1)
      ss.currentScaleX += (tScX - ss.currentScaleX) * ss.recovery * dt
      ss.currentScaleY += (tScY - ss.currentScaleY) * ss.recovery * dt
    }

    // ── Clear ────────────────────────────────────────────────────────────────
    const [br, bg, bb] = parseCSSColor(background)
    gl.viewport(0, 0, W, H)
    gl.clearColor(br, bg, bb, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // ── Parallax pre-pass ─────────────────────────────────────────────────────
    const parallaxEntities = world.query('ParallaxLayer')
    if (parallaxEntities.length > 0) {
      parallaxEntities.sort((a: EntityId, b: EntityId) => {
        const za = world.getComponent<ParallaxLayerComponent>(a, 'ParallaxLayer')!.zIndex
        const zb = world.getComponent<ParallaxLayerComponent>(b, 'ParallaxLayer')!.zIndex
        return za - zb
      })

      gl.useProgram(this.parallaxProgram)
      gl.uniform2f(this.pUCanvasSize, W, H)
      gl.uniform1i(this.pUTexture, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindVertexArray(this.parallaxVAO)

      for (const id of parallaxEntities) {
        const layer = world.getComponent<ParallaxLayerComponent>(id, 'ParallaxLayer')!

        // Keep imageWidth/imageHeight in sync with loaded image
        let img = this.parallaxImageCache.get(layer.src)
        if (!img) {
          this.loadParallaxTexture(layer.src)
          continue // not ready
        }
        if (!img.complete || img.naturalWidth === 0) continue
        if (layer.imageWidth === 0) layer.imageWidth = img.naturalWidth
        if (layer.imageHeight === 0) layer.imageHeight = img.naturalHeight

        const tex = this.parallaxTextures.get(layer.src)
        if (!tex) continue

        const imgW = layer.imageWidth
        const imgH = layer.imageHeight

        // Compute UV offset: how much to scroll the texture based on camera and layer settings
        const drawX = layer.offsetX - camX * layer.speedX
        const drawY = layer.offsetY - camY * layer.speedY
        const uvOffsetX = ((drawX / imgW) % 1 + 1) % 1
        const uvOffsetY = ((drawY / imgH) % 1 + 1) % 1

        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.uniform2f(this.pUUvOffset, uvOffsetX, uvOffsetY)
        gl.uniform2f(this.pUTexSize, imgW, imgH)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      }
    }

    // ── Upload camera uniforms for sprite program ──────────────────────────────
    gl.useProgram(this.program)
    gl.uniform2f(this.uCamPos, camX, camY)
    gl.uniform1f(this.uZoom, zoom)
    gl.uniform2f(this.uCanvasSize, W, H)
    gl.uniform2f(this.uShake, shakeX, shakeY)
    gl.uniform1i(this.uTexture, 0)
    gl.activeTexture(gl.TEXTURE0)

    // ── Sprites ───────────────────────────────────────────────────────────────
    const renderables = world.query('Transform', 'Sprite')
    renderables.sort((a: EntityId, b: EntityId) => {
      const sa = world.getComponent<SpriteComponent>(a, 'Sprite')!
      const sb = world.getComponent<SpriteComponent>(b, 'Sprite')!
      const zd = sa.zIndex - sb.zIndex
      if (zd !== 0) return zd
      const ka = getTextureKey(sa), kb = getTextureKey(sb)
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })

    let batchCount = 0
    let batchKey   = ''

    for (let i = 0; i <= renderables.length; i++) {
      // Sentinel: flush remaining batch at end of list
      if (i === renderables.length) {
        this.flush(batchCount, batchKey)
        break
      }

      const id        = renderables[i]
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!
      if (!sprite.visible) continue

      // Ensure we have a GL texture for this sprite's image.
      // Sprite.tsx already loads the image via AssetManager (with correct BASE_URL resolution)
      // and sets sprite.image. Use that directly to create the texture synchronously.
      if (sprite.image && sprite.image.complete && sprite.image.naturalWidth > 0) {
        const tiled = sprite.tileX || sprite.tileY
        const cacheKey = sprite.image.src ? (tiled ? `${sprite.image.src}:repeat` : sprite.image.src) : null
        if (cacheKey && !this.textures.has(cacheKey)) {
          const gl = this.gl
          const tex = gl.createTexture()!
          gl.bindTexture(gl.TEXTURE_2D, tex)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sprite.image)
          gl.generateMipmap(gl.TEXTURE_2D)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          const wrap = tiled ? gl.REPEAT : gl.CLAMP_TO_EDGE
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
          this.textures.set(cacheKey, tex)
        }
      } else if (sprite.src && !sprite.image) {
        // Fallback: image not yet loaded by AssetManager — start loading it
        let img = this.imageCache.get(sprite.src)
        if (!img) {
          img = new Image()
          img.src = sprite.src
          this.imageCache.set(sprite.src, img)
          img.onload = () => {
            const gl = this.gl
            const tex = gl.createTexture()!
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img!)
            gl.generateMipmap(gl.TEXTURE_2D)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            this.textures.set(img!.src, tex)
          }
        }
        sprite.image = img
      }

      const key = getTextureKey(sprite)

      // Flush if texture group changes or buffer is full
      if ((key !== batchKey && batchCount > 0) || batchCount >= MAX_INSTANCES) {
        this.flush(batchCount, batchKey)
        batchCount = 0
      }
      batchKey = key

      const ss        = world.getComponent<SquashStretchComponent>(id, 'SquashStretch')
      const scaleXMod = ss ? ss.currentScaleX : 1
      const scaleYMod = ss ? ss.currentScaleY : 1
      // Textured sprites use white tint so the texture shows true colors;
      // only solid-color sprites use the color property as fill.
      const hasTexture = sprite.image && sprite.image.complete && sprite.image.naturalWidth > 0
      const [r, g, b, a] = hasTexture ? [1, 1, 1, 1] : parseCSSColor(sprite.color)
      const uv = getUVRect(sprite)

      this.writeInstance(
        batchCount * FLOATS_PER_INSTANCE,
        transform.x, transform.y,
        sprite.width  * transform.scaleX * scaleXMod,
        sprite.height * transform.scaleY * scaleYMod,
        transform.rotation,
        sprite.anchorX, sprite.anchorY,
        sprite.offsetX, sprite.offsetY,
        sprite.flipX,
        r, g, b, a,
        uv[0], uv[1], uv[2], uv[3],
      )
      batchCount++
    }

    // ── Text rendering pass ───────────────────────────────────────────────────
    // Text entities are rendered as textured quads using offscreen Canvas2D textures.
    const textEntities = world.query('Transform', 'Text')
    textEntities.sort((a: EntityId, b: EntityId) => {
      const ta = world.getComponent<TextComponent>(a, 'Text')!
      const tb = world.getComponent<TextComponent>(b, 'Text')!
      return ta.zIndex - tb.zIndex
    })

    for (const id of textEntities) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const text      = world.getComponent<TextComponent>(id, 'Text')!
      if (!text.visible) continue

      const entry = this.getOrCreateTextTexture(text)
      if (!entry) continue

      // Flush any pending sprite batch first, then draw the text quad
      this.flush(batchCount, batchKey)
      batchCount = 0
      batchKey = ''

      // Write text as a single textured instance
      this.writeInstance(
        0,
        transform.x + text.offsetX, transform.y + text.offsetY,
        entry.w, entry.h,
        transform.rotation,
        0, 0,       // anchor top-left
        0, 0,
        false,
        1, 1, 1, 1, // white tint — color baked into texture
        0, 0, 1, 1,
      )
      this.flushWithTex(1, entry.tex, true)
    }

    // ── Particles ────────────────────────────────────────────────────────────
    for (const id of world.query('Transform', 'ParticlePool')) {
      const t    = world.getComponent<TransformComponent>(id, 'Transform')!
      const pool = world.getComponent<ParticlePoolComponent>(id, 'ParticlePool')!

      // Update existing particles
      pool.particles = pool.particles.filter((p: Particle) => {
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += p.gravity * dt
        return p.life > 0
      })

      // Emit new particles
      if (pool.active && pool.particles.length < pool.maxParticles) {
        pool.timer += dt
        const spawnCount = Math.floor(pool.timer * pool.rate)
        pool.timer -= spawnCount / pool.rate
        for (let i = 0; i < spawnCount && pool.particles.length < pool.maxParticles; i++) {
          const angle = pool.angle + (world.rng() - 0.5) * pool.spread
          const speed = pool.speed * (0.5 + world.rng() * 0.5)
          pool.particles.push({
            x: t.x, y: t.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: pool.particleLife, maxLife: pool.particleLife,
            size: pool.particleSize, color: pool.color, gravity: pool.gravity,
          })
        }
      }

      // Render particles as instanced color quads
      let pCount = 0
      const pKey = `__color__`
      for (const p of pool.particles) {
        if (pCount >= MAX_INSTANCES) {
          this.flush(pCount, pKey)
          pCount = 0
        }
        const alpha = p.life / p.maxLife
        const [r, g, b] = parseCSSColor(p.color)
        this.writeInstance(
          pCount * FLOATS_PER_INSTANCE,
          p.x, p.y,
          p.size, p.size,
          0,
          0.5, 0.5,
          0, 0,
          false,
          r, g, b, alpha,
          0, 0, 1, 1,
        )
        pCount++
      }
      if (pCount > 0) this.flush(pCount, pKey)
    }

    // ── Trail update + render pass ────────────────────────────────────────────
    for (const id of world.query('Transform', 'Trail')) {
      const t     = world.getComponent<TransformComponent>(id, 'Transform')!
      const trail = world.getComponent<TrailComponent>(id, 'Trail')!

      // Prepend current position
      trail.points.unshift({ x: t.x, y: t.y })
      // Trim to max length
      if (trail.points.length > trail.length) trail.points.length = trail.length

      if (trail.points.length < 1) continue

      const [tr, tg, tb] = parseCSSColor(trail.color)
      const trailW = trail.width > 0 ? trail.width : 1
      let tCount = 0

      for (let i = 0; i < trail.points.length; i++) {
        if (tCount >= MAX_INSTANCES) {
          this.flush(tCount, '__color__')
          tCount = 0
        }
        // Alpha fades from 1 (newest) to 0 (oldest)
        const alpha = 1 - i / trail.points.length
        this.writeInstance(
          tCount * FLOATS_PER_INSTANCE,
          trail.points[i].x, trail.points[i].y,
          trailW, trailW,
          0,
          0.5, 0.5,
          0, 0,
          false,
          tr, tg, tb, alpha,
          0, 0, 1, 1,
        )
        tCount++
      }
      if (tCount > 0) this.flush(tCount, '__color__')
    }
  }
}
