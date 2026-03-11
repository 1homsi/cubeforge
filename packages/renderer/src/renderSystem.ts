import type { System, ECSWorld, EntityId, NavGrid } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { SpriteComponent } from './components/sprite'
import type { Camera2DComponent } from './components/camera2d'
import type { AnimationStateComponent, AnimationClipDefinition } from './components/animationState'
import type { AnimatorComponent, AnimatorCondition } from './components/animator'
import type { SquashStretchComponent } from './components/squashStretch'
import type { ParticlePoolComponent } from './components/particle'
import type { ParallaxLayerComponent } from './components/parallaxLayer'
import type { TextComponent } from './components/text'
import type { TrailComponent } from './components/trail'
import type { NineSliceComponent } from './components/nineSlice'
import { Canvas2DRenderer } from './canvas2d'
import { createRenderLayerManager, type RenderLayerManager } from './renderLayers'
import { createPostProcessStack, type PostProcessStack } from './postProcess'

const imageCache = new Map<string, HTMLImageElement>()

/** Generate a consistent HSL colour for a collision layer name. */
function layerColor(layer: string, alpha: number): string {
  let hash = 0
  for (let i = 0; i < layer.length; i++) {
    hash = ((hash << 5) - hash + layer.charCodeAt(i)) | 0
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsla(${hue}, 80%, 60%, ${alpha})`
}

interface BoxColliderShape {
  type: 'BoxCollider'
  width: number
  height: number
  offsetX: number
  offsetY: number
  isTrigger: boolean
  layer?: string
  mask?: string | string[]
}

interface RigidBodyShape {
  type: 'RigidBody'
  vx: number
  vy: number
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  w: number,
  h: number,
  borderRadius: number,
  starPoints: number,
  starInnerRadius: number,
): void {
  const cx = x + w / 2
  const cy = y + h / 2
  switch (shape) {
    case 'circle': {
      const r = Math.min(w, h) / 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      break
    }
    case 'ellipse': {
      ctx.beginPath()
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
      break
    }
    case 'roundedRect': {
      const r = Math.min(borderRadius, w / 2, h / 2)
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, r)
      break
    }
    case 'triangle': {
      ctx.beginPath()
      ctx.moveTo(cx, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      break
    }
    case 'pentagon': {
      drawRegularPolygon(ctx, cx, cy, Math.min(w, h) / 2, 5)
      break
    }
    case 'hexagon': {
      drawRegularPolygon(ctx, cx, cy, Math.min(w, h) / 2, 6)
      break
    }
    case 'star': {
      drawStar(ctx, cx, cy, Math.min(w, h) / 2, starPoints, starInnerRadius)
      break
    }
    default: {
      // 'rect' fallback
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      break
    }
  }
}

function drawRegularPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  sides: number,
): void {
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
    const px = cx + r * Math.cos(angle)
    const py = cy + r * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  points: number,
  innerRatio: number,
): void {
  const inner = r * innerRatio
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2
    const radius = i % 2 === 0 ? r : inner
    const px = cx + radius * Math.cos(angle)
    const py = cy + radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export class RenderSystem implements System {
  /** Default background used when no Camera2D component exists */
  defaultBackground = '#1a1a2e'

  private debug = false
  private pendingShake: { intensity: number; duration: number } | null = null

  // FPS tracking
  private frameTimes: number[] = []
  private lastTimestamp = 0

  // Debug overlays
  private debugNavGrid: NavGrid | null = null
  private contactFlashPoints: { x: number; y: number; ttl: number }[] = []

  // Render layer manager
  readonly layers: RenderLayerManager = createRenderLayerManager()

  // Post-processing effect stack
  readonly postProcessStack: PostProcessStack = createPostProcessStack()

  constructor(
    private readonly renderer: Canvas2DRenderer,
    private readonly entityIds: Map<string, EntityId>,
  ) {}

  setDebug(v: boolean): void {
    this.debug = v
  }

  /** Overlay a nav grid: green = walkable, red = blocked. Pass null to clear. */
  setDebugNavGrid(grid: NavGrid | null): void {
    this.debugNavGrid = grid
  }

  /** Flash a point on the canvas for one frame (world-space coords). */
  flashContactPoint(x: number, y: number): void {
    this.contactFlashPoints.push({ x, y, ttl: 1 })
  }

  triggerShake(intensity: number, duration: number): void {
    this.pendingShake = { intensity, duration }
  }

  update(world: ECSWorld, dt: number): void {
    const { ctx, canvas } = this.renderer

    // --- FPS tracking ---
    const now = performance.now()
    if (this.lastTimestamp > 0) {
      this.frameTimes.push(now - this.lastTimestamp)
      if (this.frameTimes.length > 60) this.frameTimes.shift()
    }
    this.lastTimestamp = now

    // --- Camera ---
    let camX = 0
    let camY = 0
    let zoom = 1
    let background = this.defaultBackground
    let shakeX = 0
    let shakeY = 0

    const camEntityId = world.queryOne('Camera2D')
    if (camEntityId !== undefined) {
      const cam = world.getComponent<Camera2DComponent>(camEntityId, 'Camera2D')!
      background = cam.background

      // Apply pending shake
      if (this.pendingShake) {
        cam.shakeIntensity = this.pendingShake.intensity
        cam.shakeDuration = this.pendingShake.duration
        cam.shakeTimer = this.pendingShake.duration
        this.pendingShake = null
      }

      if (cam.followEntityId) {
        const targetId = this.entityIds.get(cam.followEntityId)
        if (targetId !== undefined) {
          const targetTransform = world.getComponent<TransformComponent>(targetId, 'Transform')
          if (targetTransform) {
            const tx = targetTransform.x + (cam.followOffsetX ?? 0)
            const ty = targetTransform.y + (cam.followOffsetY ?? 0)
            if (cam.deadZone) {
              // Only move camera if target is outside dead zone
              const halfW = cam.deadZone.w / 2
              const halfH = cam.deadZone.h / 2
              const dx = tx - cam.x
              const dy = ty - cam.y
              if (dx > halfW) cam.x = tx - halfW
              else if (dx < -halfW) cam.x = tx + halfW
              if (dy > halfH) cam.y = ty - halfH
              else if (dy < -halfH) cam.y = ty + halfH
            } else if (cam.smoothing > 0) {
              cam.x += (tx - cam.x) * (1 - cam.smoothing)
              cam.y += (ty - cam.y) * (1 - cam.smoothing)
            } else {
              cam.x = tx
              cam.y = ty
            }
          }
        }
      }

      // Camera bounds clamping
      if (cam.bounds) {
        const halfW = canvas.width / (2 * cam.zoom)
        const halfH = canvas.height / (2 * cam.zoom)
        cam.x = Math.max(cam.bounds.x + halfW, Math.min(cam.bounds.x + cam.bounds.width - halfW, cam.x))
        cam.y = Math.max(cam.bounds.y + halfH, Math.min(cam.bounds.y + cam.bounds.height - halfH, cam.y))
      }

      // Camera shake
      if (cam.shakeTimer > 0) {
        cam.shakeTimer -= dt
        if (cam.shakeTimer < 0) cam.shakeTimer = 0
        const t = cam.shakeDuration > 0 ? cam.shakeTimer / cam.shakeDuration : 0
        const progress = t * t // quadratic ease-out (stronger at start, gentle at end)
        shakeX = (world.rng() * 2 - 1) * cam.shakeIntensity * progress
        shakeY = (world.rng() * 2 - 1) * cam.shakeIntensity * progress
      }

      camX = cam.x
      camY = cam.y
      zoom = cam.zoom
    }

    // --- Animator evaluation pass (runs before animation so clips are resolved) ---
    for (const id of world.query('Animator', 'AnimationState')) {
      const animator = world.getComponent<AnimatorComponent>(id, 'Animator')!
      const anim = world.getComponent<AnimationStateComponent>(id, 'AnimationState')!
      if (!animator.playing) continue

      // Ensure valid state
      if (!animator.states[animator.currentState]) {
        animator.currentState = animator.initialState
        animator._entered = false
      }

      const stateDef = animator.states[animator.currentState]
      if (!stateDef) continue

      // Enter state: set clip and fire onEnter
      if (!animator._entered) {
        anim.currentClip = stateDef.clip
        animator._entered = true
        stateDef.onEnter?.()
      }

      // Evaluate transitions
      if (stateDef.transitions && stateDef.transitions.length > 0) {
        // Sort by priority descending (stable: declaration order for same priority)
        const sorted = [...stateDef.transitions].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        for (const trans of sorted) {
          // exitTime check
          if (trans.exitTime != null && anim.frames.length > 0) {
            const progress = anim.currentIndex / anim.frames.length
            if (progress < trans.exitTime) continue
          }
          // Evaluate all conditions (AND)
          if (evaluateConditions(trans.when, animator.params)) {
            stateDef.onExit?.()
            animator.currentState = trans.to
            animator._entered = false
            break
          }
        }
      }
    }

    // --- Animation clip resolution + playback pass ---
    for (const id of world.query('AnimationState', 'Sprite')) {
      const anim = world.getComponent<AnimationStateComponent>(id, 'AnimationState')!
      const sprite = world.getComponent<SpriteComponent>(id, 'Sprite')!

      // Resolve named clip if changed
      if (anim.clips && anim.currentClip && anim._resolvedClip !== anim.currentClip) {
        const clip = anim.clips[anim.currentClip]
        if (clip) {
          resolveClip(anim, clip)
          anim._resolvedClip = anim.currentClip
        }
      }

      if (!anim.playing || anim.frames.length === 0) continue
      anim.timer += dt
      const frameDuration = 1 / anim.fps
      while (anim.timer >= frameDuration) {
        anim.timer -= frameDuration
        anim.currentIndex++
        if (anim.currentIndex >= anim.frames.length) {
          if (anim.loop) {
            anim.currentIndex = 0
          } else {
            anim.currentIndex = anim.frames.length - 1
            anim.playing = false
            if (anim.onComplete && !anim._completed) {
              anim._completed = true
              anim.onComplete()
            }
            // Auto-transition to next clip
            if (anim.clips && anim.currentClip) {
              const currentClipDef = anim.clips[anim.currentClip]
              if (currentClipDef?.next && anim.clips[currentClipDef.next]) {
                anim.currentClip = currentClipDef.next
                // Will be resolved next frame (or this frame via _resolvedClip check above)
              }
            }
          }
        }
        // Fire frame event for the new frame index (0-based position in frames array)
        anim.frameEvents?.[anim.currentIndex]?.()
      }
      sprite.frameIndex = anim.frames[anim.currentIndex]
    }

    // --- SquashStretch update pass ---
    for (const id of world.query('SquashStretch', 'RigidBody')) {
      const ss = world.getComponent<SquashStretchComponent>(id, 'SquashStretch')!
      const rb = world.getComponent<RigidBodyShape>(id, 'RigidBody')!
      const speed = Math.sqrt(rb.vx * rb.vx + rb.vy * rb.vy)
      const targetScaleX = rb.vy < -100 ? 1 + ss.intensity * 0.4 : speed > 50 ? 1 - ss.intensity * 0.3 : 1
      const targetScaleY = rb.vy < -100 ? 1 - ss.intensity * 0.4 : speed > 50 ? 1 + ss.intensity * 0.3 : 1
      ss.currentScaleX += (targetScaleX - ss.currentScaleX) * ss.recovery * dt
      ss.currentScaleY += (targetScaleY - ss.currentScaleY) * ss.recovery * dt
    }

    // Clear
    this.renderer.clear(background)

    // --- Parallax layer pre-pass (drawn in screen space before world sprites) ---
    const parallaxEntities = world.query('ParallaxLayer')
    parallaxEntities.sort((a, b) => {
      const za = world.getComponent<ParallaxLayerComponent>(a, 'ParallaxLayer')!.zIndex
      const zb = world.getComponent<ParallaxLayerComponent>(b, 'ParallaxLayer')!.zIndex
      return za - zb
    })
    for (const id of parallaxEntities) {
      const layer = world.getComponent<ParallaxLayerComponent>(id, 'ParallaxLayer')!

      // Load / retrieve image from cache
      let img = imageCache.get(layer.src)
      if (!img) {
        img = new Image()
        img.src = layer.src
        img.onload = () => {
          layer.imageWidth = img!.naturalWidth
          layer.imageHeight = img!.naturalHeight
        }
        imageCache.set(layer.src, img)
      }
      if (!img.complete || img.naturalWidth === 0) continue

      // Keep imageWidth/imageHeight in sync
      if (layer.imageWidth === 0) layer.imageWidth = img.naturalWidth
      if (layer.imageHeight === 0) layer.imageHeight = img.naturalHeight

      const imgW = layer.imageWidth
      const imgH = layer.imageHeight

      // Parallax draw position
      const drawX = layer.offsetX - camX * layer.speedX
      const drawY = layer.offsetY - camY * layer.speedY

      ctx.save()
      if (layer.repeatX || layer.repeatY) {
        // Tile using pattern
        const pattern = ctx.createPattern(
          img,
          layer.repeatX && layer.repeatY ? 'repeat' : layer.repeatX ? 'repeat-x' : 'repeat-y',
        )
        if (pattern) {
          // Offset the pattern to match parallax position
          const offsetX = ((drawX % imgW) + imgW) % imgW
          const offsetY = ((drawY % imgH) + imgH) % imgH
          const matrix = new DOMMatrix()
          matrix.translateSelf(offsetX, offsetY)
          pattern.setTransform(matrix)
          ctx.fillStyle = pattern
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      } else {
        ctx.drawImage(img, drawX, drawY, imgW, imgH)
      }
      ctx.restore()
    }

    // Apply camera transform: translate so camX,camY is at screen center, plus shake offset
    ctx.save()
    ctx.translate(canvas.width / 2 - camX * zoom + shakeX, canvas.height / 2 - camY * zoom + shakeY)
    ctx.scale(zoom, zoom)

    // Collect renderable entities.
    // Sort by: (1) zIndex ascending, (2) texture source key within the same zIndex.
    // Grouping same-texture sprites together minimises Canvas2D image-source state
    // changes (draw-call batching) while preserving the correct draw order.
    const renderables = world.query('Transform', 'Sprite')

    // Helper: derive a stable texture key for a sprite so we can batch by source.
    const textureKey = (id: EntityId): string => {
      const sprite = world.getComponent<SpriteComponent>(id, 'Sprite')!
      if (sprite.image && sprite.image.src) return sprite.image.src
      if (sprite.src) return sprite.src
      return `__color__:${sprite.color}`
    }

    renderables.sort((a, b) => {
      const sa = world.getComponent<SpriteComponent>(a, 'Sprite')!
      const sb = world.getComponent<SpriteComponent>(b, 'Sprite')!
      // Sort by render layer order first
      const layerDiff = this.layers.getOrder(sa.layer) - this.layers.getOrder(sb.layer)
      if (layerDiff !== 0) return layerDiff
      const zDiff = sa.zIndex - sb.zIndex
      if (zDiff !== 0) return zDiff
      // Same zIndex — group by texture to batch draw calls
      const ka = textureKey(a)
      const kb = textureKey(b)
      if (ka < kb) return -1
      if (ka > kb) return 1
      return 0
    })

    for (const id of renderables) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const sprite = world.getComponent<SpriteComponent>(id, 'Sprite')!

      if (!sprite.visible) continue

      const ss = world.getComponent<SquashStretchComponent>(id, 'SquashStretch')
      const scaleXMod = ss ? ss.currentScaleX : 1
      const scaleYMod = ss ? ss.currentScaleY : 1

      ctx.save()
      ctx.translate(transform.x, transform.y)
      ctx.rotate(transform.rotation)
      ctx.scale(
        transform.scaleX * (sprite.flipX ? -1 : 1) * scaleXMod,
        transform.scaleY * (sprite.flipY ? -1 : 1) * scaleYMod,
      )

      // Overall opacity
      if (sprite.opacity != null && sprite.opacity < 1) {
        ctx.globalAlpha = sprite.opacity
      }

      // Blend mode
      const blendMode = sprite.blendMode ?? 'normal'
      if (blendMode !== 'normal') {
        const blendMap: Record<string, GlobalCompositeOperation> = {
          additive: 'lighter',
          multiply: 'multiply',
          screen: 'screen',
        }
        ctx.globalCompositeOperation = blendMap[blendMode] ?? 'source-over'
      }

      const drawX = -sprite.anchorX * sprite.width + sprite.offsetX
      const drawY = -sprite.anchorY * sprite.height + sprite.offsetY

      if (sprite.image && sprite.image.complete && sprite.image.naturalWidth > 0) {
        if (sprite.frameWidth && sprite.frameHeight) {
          const cols = sprite.frameColumns ?? Math.floor(sprite.image.naturalWidth / sprite.frameWidth)
          const col = sprite.frameIndex % cols
          const row = Math.floor(sprite.frameIndex / cols)
          const sx = col * sprite.frameWidth
          const sy = row * sprite.frameHeight
          ctx.drawImage(
            sprite.image,
            sx,
            sy,
            sprite.frameWidth,
            sprite.frameHeight,
            drawX,
            drawY,
            sprite.width,
            sprite.height,
          )
        } else if (sprite.frame) {
          const { sx, sy, sw, sh } = sprite.frame
          ctx.drawImage(sprite.image, sx, sy, sw, sh, drawX, drawY, sprite.width, sprite.height)
        } else if (sprite.tileX || sprite.tileY) {
          const repeat = sprite.tileX && sprite.tileY ? 'repeat' : sprite.tileX ? 'repeat-x' : 'repeat-y'
          const pat = ctx.createPattern(sprite.image, repeat)
          if (pat) {
            const natW = sprite.image.naturalWidth || sprite.image.width
            const natH = sprite.image.naturalHeight || sprite.image.height
            const scaleX = (sprite.tileSizeX ?? natW) / natW
            const scaleY = (sprite.tileSizeY ?? natH) / natH
            pat.setTransform(new DOMMatrix().translate(drawX, drawY).scale(scaleX, scaleY))
            ctx.fillStyle = pat
            ctx.fillRect(drawX, drawY, sprite.width, sprite.height)
          }
        } else {
          ctx.drawImage(sprite.image, drawX, drawY, sprite.width, sprite.height)
        }
      } else if (sprite.customDraw) {
        ctx.save()
        ctx.translate(drawX, drawY)
        sprite.customDraw(ctx, sprite.width, sprite.height)
        ctx.restore()
      } else {
        ctx.fillStyle = sprite.color
        drawShape(ctx, sprite.shape, drawX, drawY, sprite.width, sprite.height, sprite.borderRadius, sprite.starPoints, sprite.starInnerRadius)
        ctx.fill()
        if (sprite.strokeColor && sprite.strokeWidth > 0) {
          ctx.strokeStyle = sprite.strokeColor
          ctx.lineWidth = sprite.strokeWidth
          ctx.stroke()
        }
      }

      // Tint overlay
      if (sprite.tint) {
        ctx.globalCompositeOperation = 'source-atop'
        const baseAlpha = sprite.opacity ?? 1
        ctx.globalAlpha = (sprite.tintOpacity ?? 0.3) * baseAlpha
        ctx.fillStyle = sprite.tint
        ctx.fillRect(drawX, drawY, sprite.width, sprite.height)
        ctx.globalAlpha = baseAlpha
        ctx.globalCompositeOperation = 'source-over'
      }

      ctx.restore()
    }

    // --- NineSlice rendering pass (world space) ---
    const nineSliceEntities = world.query('Transform', 'NineSlice')
    nineSliceEntities.sort((a, b) => {
      const na = world.getComponent<NineSliceComponent>(a, 'NineSlice')!
      const nb = world.getComponent<NineSliceComponent>(b, 'NineSlice')!
      return na.zIndex - nb.zIndex
    })
    for (const id of nineSliceEntities) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const ns = world.getComponent<NineSliceComponent>(id, 'NineSlice')!

      let img = imageCache.get(ns.src)
      if (!img) {
        img = new Image()
        img.src = ns.src
        imageCache.set(ns.src, img)
      }
      if (!img.complete || img.naturalWidth === 0) continue

      const srcW = img.naturalWidth
      const srcH = img.naturalHeight
      const { borderTop: bT, borderRight: bR, borderBottom: bB, borderLeft: bL, width: w, height: h } = ns

      // Destination position (top-left, centered on transform)
      const dx = transform.x - w / 2
      const dy = transform.y - h / 2

      // Inner dimensions
      const innerSrcW = srcW - bL - bR
      const innerSrcH = srcH - bT - bB
      const innerDestW = w - bL - bR
      const innerDestH = h - bT - bB

      ctx.save()

      // Top-left corner
      if (bL > 0 && bT > 0) ctx.drawImage(img, 0, 0, bL, bT, dx, dy, bL, bT)
      // Top center
      if (innerSrcW > 0 && bT > 0) ctx.drawImage(img, bL, 0, innerSrcW, bT, dx + bL, dy, innerDestW, bT)
      // Top-right corner
      if (bR > 0 && bT > 0) ctx.drawImage(img, srcW - bR, 0, bR, bT, dx + w - bR, dy, bR, bT)
      // Middle-left
      if (bL > 0 && innerSrcH > 0) ctx.drawImage(img, 0, bT, bL, innerSrcH, dx, dy + bT, bL, innerDestH)
      // Center
      if (innerSrcW > 0 && innerSrcH > 0)
        ctx.drawImage(img, bL, bT, innerSrcW, innerSrcH, dx + bL, dy + bT, innerDestW, innerDestH)
      // Middle-right
      if (bR > 0 && innerSrcH > 0)
        ctx.drawImage(img, srcW - bR, bT, bR, innerSrcH, dx + w - bR, dy + bT, bR, innerDestH)
      // Bottom-left corner
      if (bL > 0 && bB > 0) ctx.drawImage(img, 0, srcH - bB, bL, bB, dx, dy + h - bB, bL, bB)
      // Bottom center
      if (innerSrcW > 0 && bB > 0)
        ctx.drawImage(img, bL, srcH - bB, innerSrcW, bB, dx + bL, dy + h - bB, innerDestW, bB)
      // Bottom-right corner
      if (bR > 0 && bB > 0) ctx.drawImage(img, srcW - bR, srcH - bB, bR, bB, dx + w - bR, dy + h - bB, bR, bB)

      ctx.restore()
    }

    // --- Shape rendering pass (world space) ---
    for (const id of world.query('Transform', 'CircleShape')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const c = world.getComponent<{
        type: string
        radius: number
        color: string
        strokeColor?: string
        strokeWidth?: number
        zIndex: number
        visible: boolean
        opacity: number
      }>(id, 'CircleShape')!
      if (!c.visible) continue
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.rotate(t.rotation)
      ctx.globalAlpha = c.opacity
      ctx.beginPath()
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2)
      ctx.fillStyle = c.color
      ctx.fill()
      if (c.strokeColor && c.strokeWidth) {
        ctx.strokeStyle = c.strokeColor
        ctx.lineWidth = c.strokeWidth
        ctx.stroke()
      }
      ctx.restore()
    }

    for (const id of world.query('Transform', 'LineShape')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const l = world.getComponent<{
        type: string
        endX: number
        endY: number
        color: string
        lineWidth: number
        visible: boolean
        opacity: number
        lineCap: CanvasLineCap
      }>(id, 'LineShape')!
      if (!l.visible) continue
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.rotate(t.rotation)
      ctx.globalAlpha = l.opacity
      ctx.strokeStyle = l.color
      ctx.lineWidth = l.lineWidth
      ctx.lineCap = l.lineCap
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(l.endX, l.endY)
      ctx.stroke()
      ctx.restore()
    }

    for (const id of world.query('Transform', 'PolygonShape')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const p = world.getComponent<{
        type: string
        points: { x: number; y: number }[]
        color: string
        strokeColor?: string
        strokeWidth?: number
        visible: boolean
        opacity: number
        closed: boolean
      }>(id, 'PolygonShape')!
      if (!p.visible || p.points.length < 2) continue
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.rotate(t.rotation)
      ctx.globalAlpha = p.opacity
      ctx.beginPath()
      ctx.moveTo(p.points[0].x, p.points[0].y)
      for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y)
      if (p.closed) ctx.closePath()
      ctx.fillStyle = p.color
      ctx.fill()
      if (p.strokeColor && p.strokeWidth) {
        ctx.strokeStyle = p.strokeColor
        ctx.lineWidth = p.strokeWidth
        ctx.stroke()
      }
      ctx.restore()
    }

    // --- Gradient rendering pass (world space) ---
    for (const id of world.query('Transform', 'Gradient')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const g = world.getComponent<{
        type: string
        gradientType: string
        stops: { offset: number; color: string }[]
        angle: number
        innerRadius: number
        visible: boolean
        zIndex: number
        width: number
        height: number
        anchorX: number
        anchorY: number
      }>(id, 'Gradient')!
      if (!g.visible || g.stops.length === 0) continue
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.rotate(t.rotation)
      const dx = -g.anchorX * g.width
      const dy = -g.anchorY * g.height
      let gradient: CanvasGradient
      if (g.gradientType === 'radial') {
        gradient = ctx.createRadialGradient(
          dx + g.width / 2,
          dy + g.height / 2,
          (g.innerRadius * Math.min(g.width, g.height)) / 2,
          dx + g.width / 2,
          dy + g.height / 2,
          Math.min(g.width, g.height) / 2,
        )
      } else {
        const cos = Math.cos(g.angle)
        const sin = Math.sin(g.angle)
        const hw = g.width / 2
        const hh = g.height / 2
        gradient = ctx.createLinearGradient(
          dx + hw - cos * hw,
          dy + hh - sin * hh,
          dx + hw + cos * hw,
          dy + hh + sin * hh,
        )
      }
      for (const s of g.stops) gradient.addColorStop(s.offset, s.color)
      ctx.fillStyle = gradient
      ctx.fillRect(dx, dy, g.width, g.height)
      ctx.restore()
    }

    // --- Text rendering pass (world space) ---
    const textEntities = world.query('Transform', 'Text')
    textEntities.sort((a, b) => {
      const ta = world.getComponent<TextComponent>(a, 'Text')!
      const tb = world.getComponent<TextComponent>(b, 'Text')!
      return ta.zIndex - tb.zIndex
    })
    for (const id of textEntities) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const text = world.getComponent<TextComponent>(id, 'Text')!
      if (!text.visible) continue
      ctx.save()
      ctx.translate(transform.x + text.offsetX, transform.y + text.offsetY)
      ctx.rotate(transform.rotation)
      if (text.opacity != null) ctx.globalAlpha = text.opacity
      ctx.font = `${text.fontSize}px ${text.fontFamily}`
      ctx.textAlign = text.align
      ctx.textBaseline = text.baseline

      // Shadow
      if (text.shadowColor) {
        ctx.shadowColor = text.shadowColor
        ctx.shadowOffsetX = text.shadowOffsetX ?? 2
        ctx.shadowOffsetY = text.shadowOffsetY ?? 2
        ctx.shadowBlur = text.shadowBlur ?? 0
      }

      // Word wrap support
      const lines: string[] = []
      if (text.wordWrap && text.maxWidth) {
        const words = text.text.split(' ')
        let currentLine = ''
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          const metrics = ctx.measureText(testLine)
          if (metrics.width > text.maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
          } else {
            currentLine = testLine
          }
        }
        if (currentLine) lines.push(currentLine)
      } else {
        lines.push(text.text)
      }

      const lh = text.fontSize * (text.lineHeight ?? 1.2)
      for (let i = 0; i < lines.length; i++) {
        const ly = i * lh
        // Stroke (outline)
        if (text.strokeColor && text.strokeWidth) {
          ctx.strokeStyle = text.strokeColor
          ctx.lineWidth = text.strokeWidth
          ctx.strokeText(lines[i], 0, ly, text.maxWidth as number)
        }
        // Fill
        ctx.fillStyle = text.color
        ctx.fillText(lines[i], 0, ly, text.maxWidth as number)
      }
      ctx.restore()
    }

    // Mask components are registered for future clipping support
    // Currently masks are data-only — visual masking can be applied via
    // globalCompositeOperation in custom render passes or plugins

    // --- Particle update + render pass ---
    for (const id of world.query('Transform', 'ParticlePool')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const pool = world.getComponent<ParticlePoolComponent>(id, 'ParticlePool')!

      // Load texture if specified
      if (pool.textureSrc && !pool._textureImage) {
        let img = imageCache.get(pool.textureSrc)
        if (!img) {
          img = new Image()
          img.src = pool.textureSrc
          imageCache.set(pool.textureSrc, img)
        }
        if (img.complete && img.naturalWidth > 0) pool._textureImage = img
      }

      // Update existing particles (in-place swap-remove to avoid array reallocation)
      let alive = pool.particles.length
      for (let i = alive - 1; i >= 0; i--) {
        const p = pool.particles[i]
        p.life -= dt
        if (p.life <= 0) {
          // Swap with last alive element and shrink
          alive--
          pool.particles[i] = pool.particles[alive]
        } else {
          // Attractors
          if (pool.attractors) {
            for (const attr of pool.attractors) {
              const adx = attr.x - p.x
              const ady = attr.y - p.y
              const dist = Math.sqrt(adx * adx + ady * ady)
              if (dist < attr.radius && dist > 0) {
                const force = attr.strength * (1 - dist / attr.radius)
                p.vx += (adx / dist) * force * dt
                p.vy += (ady / dist) * force * dt
              }
            }
          }
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.vy += p.gravity * dt
          // Rotation
          if (p.rotation != null && p.rotationSpeed) p.rotation += p.rotationSpeed * dt
          // Size over life
          if (p.startSize != null && p.endSize != null) {
            const lifeT = 1 - p.life / p.maxLife
            p.currentSize = p.startSize + (p.endSize - p.startSize) * lifeT
          }
        }
      }
      pool.particles.length = alive

      // Emit new particles
      if (pool.active && pool.particles.length < pool.maxParticles) {
        let spawnCount: number
        if (pool.burstCount != null && pool.burstCount > 0) {
          spawnCount = pool.burstCount
          pool.active = false
        } else {
          pool.timer += dt
          spawnCount = Math.floor(pool.timer * pool.rate)
          pool.timer -= spawnCount / pool.rate
        }
        for (let i = 0; i < spawnCount && pool.particles.length < pool.maxParticles; i++) {
          const angle = pool.angle + (world.rng() - 0.5) * pool.spread
          const speed = pool.speed * (0.5 + world.rng() * 0.5)
          let ox = 0
          let oy = 0
          const shape = pool.emitShape ?? 'point'
          if (shape === 'circle') {
            const r = (pool.emitRadius ?? 0) * Math.sqrt(world.rng())
            const a = world.rng() * Math.PI * 2
            ox = Math.cos(a) * r
            oy = Math.sin(a) * r
          } else if (shape === 'box') {
            ox = (world.rng() - 0.5) * (pool.emitWidth ?? 0)
            oy = (world.rng() - 0.5) * (pool.emitHeight ?? 0)
          }
          const sol = pool.sizeOverLife
          const startSz = sol ? sol.start : pool.particleSize
          const endSz = sol ? sol.end : pool.particleSize
          const rsr = pool.rotationSpeedRange
          const rotSpeed = pool.enableRotation && rsr ? rsr[0] + world.rng() * (rsr[1] - rsr[0]) : 0
          pool.particles.push({
            x: t.x + ox,
            y: t.y + oy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: pool.particleLife,
            maxLife: pool.particleLife,
            size: startSz,
            color: pool.color,
            gravity: pool.gravity,
            rotation: pool.enableRotation ? world.rng() * Math.PI * 2 : 0,
            rotationSpeed: rotSpeed,
            currentSize: startSz,
            startSize: startSz,
            endSize: endSz,
          })
        }
      }

      // Render particles
      const texImg = pool._textureImage
      for (const p of pool.particles) {
        const alpha = p.life / p.maxLife
        const sz = p.currentSize ?? p.size
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        if (p.rotation) ctx.rotate(p.rotation)
        if (texImg) {
          ctx.drawImage(texImg, -sz / 2, -sz / 2, sz, sz)
        } else {
          ctx.fillStyle = p.color
          ctx.fillRect(-sz / 2, -sz / 2, sz, sz)
        }
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }

    // --- Trail update + render pass ---
    for (const id of world.query('Transform', 'Trail')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const trail = world.getComponent<TrailComponent>(id, 'Trail')!
      // Prepend current position
      trail.points.unshift({ x: t.x, y: t.y })
      // Trim to max length
      if (trail.points.length > trail.length) trail.points.length = trail.length
      // Draw fading polyline
      if (trail.points.length < 2) continue
      for (let i = 1; i < trail.points.length; i++) {
        const alpha = 1 - i / trail.points.length
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.strokeStyle = trail.color
        ctx.lineWidth = trail.width
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(trail.points[i - 1].x, trail.points[i - 1].y)
        ctx.lineTo(trail.points[i].x, trail.points[i].y)
        ctx.stroke()
        ctx.restore()
      }
    }

    // --- Debug: draw collider wireframes ---
    if (this.debug) {
      ctx.lineWidth = 1
      for (const id of world.query('Transform', 'BoxCollider')) {
        const t = world.getComponent<TransformComponent>(id, 'Transform')!
        const c = world.getComponent<BoxColliderShape>(id, 'BoxCollider')!

        // Color-code by layer when a layer is set, otherwise use default green/yellow
        if (c.layer) {
          ctx.strokeStyle = layerColor(c.layer, c.isTrigger ? 0.6 : 0.85)
        } else {
          ctx.strokeStyle = c.isTrigger ? 'rgba(255,200,0,0.6)' : 'rgba(0,255,0,0.6)'
        }

        const bx = t.x + c.offsetX - c.width / 2
        const by = t.y + c.offsetY - c.height / 2
        ctx.strokeRect(bx, by, c.width, c.height)

        // Show collision layer name above the collider
        if (c.layer || c.mask) {
          ctx.save()
          ctx.font = `${8 / zoom}px monospace`
          ctx.fillStyle = 'rgba(255,255,255,0.7)'
          const label = c.layer ?? 'default'
          ctx.fillText(label, bx, by - 4 / zoom)

          // Show mask indicator below the layer label
          if (c.mask) {
            const maskArr = Array.isArray(c.mask) ? c.mask : [c.mask]
            ctx.fillStyle = 'rgba(255,255,255,0.4)'
            ctx.font = `${6 / zoom}px monospace`
            ctx.fillText('-> ' + maskArr.join(', '), bx, by - 4 / zoom + 10 / zoom)
          }
          ctx.restore()
        }
      }

      // CircleCollider debug wireframes
      for (const id of world.query('Transform', 'CircleCollider')) {
        const t = world.getComponent<TransformComponent>(id, 'Transform')!
        const c = world.getComponent<{
          type: string
          radius: number
          offsetX?: number
          offsetY?: number
          isTrigger?: boolean
          layer?: string
        }>(id, 'CircleCollider')!
        if (c.layer) {
          ctx.strokeStyle = layerColor(c.layer, c.isTrigger ? 0.6 : 0.85)
        } else {
          ctx.strokeStyle = c.isTrigger ? 'rgba(255,200,0,0.6)' : 'rgba(0,255,0,0.6)'
        }
        ctx.beginPath()
        ctx.arc(t.x + (c.offsetX || 0), t.y + (c.offsetY || 0), c.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // --- Debug: nav grid overlay ---
    if (this.debugNavGrid) {
      const g = this.debugNavGrid
      ctx.lineWidth = 0.5
      for (let row = 0; row < g.rows; row++) {
        for (let col = 0; col < g.cols; col++) {
          const walkable = g.walkable[row * g.cols + col]
          ctx.fillStyle = walkable ? 'rgba(0,255,0,0.08)' : 'rgba(255,0,0,0.25)'
          ctx.fillRect(col * g.cellSize, row * g.cellSize, g.cellSize, g.cellSize)
          ctx.strokeStyle = walkable ? 'rgba(0,255,0,0.15)' : 'rgba(255,0,0,0.35)'
          ctx.strokeRect(col * g.cellSize, row * g.cellSize, g.cellSize, g.cellSize)
        }
      }
    }

    // --- Debug: contact flash points ---
    if (this.contactFlashPoints.length > 0) {
      ctx.save()
      for (const pt of this.contactFlashPoints) {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,80,80,0.9)'
        ctx.fill()
        pt.ttl--
      }
      ctx.restore()
      // In-place removal to avoid array reallocation
      let aliveFlash = this.contactFlashPoints.length
      for (let i = aliveFlash - 1; i >= 0; i--) {
        if (this.contactFlashPoints[i].ttl <= 0) {
          aliveFlash--
          this.contactFlashPoints[i] = this.contactFlashPoints[aliveFlash]
        }
      }
      this.contactFlashPoints.length = aliveFlash
    }

    ctx.restore()

    // --- Post-processing effects (screen space) ---
    this.postProcessStack.apply(ctx, canvas.width, canvas.height, dt)

    // --- Debug: FPS display (screen space, after ctx.restore) ---
    if (this.debug && this.frameTimes.length > 0) {
      const avgMs = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      const fps = Math.round(1000 / avgMs)
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(4, 4, 64, 20)
      ctx.fillStyle = '#00ff00'
      ctx.font = '12px monospace'
      ctx.fillText(`FPS: ${fps}`, 8, 19)
      ctx.restore()
    }
  }
}

// ── Animation helpers ──────────────────────────────────────────────────────

export function resolveClip(anim: AnimationStateComponent, clip: AnimationClipDefinition): void {
  anim.frames = clip.frames
  anim.fps = clip.fps ?? 12
  anim.loop = clip.loop ?? true
  anim.onComplete = clip.onComplete
  anim.frameEvents = clip.frameEvents
  anim.currentIndex = 0
  anim.timer = 0
  anim._completed = false
  anim.playing = true
}

export function evaluateConditions(conditions: AnimatorCondition[], params: Record<string, unknown>): boolean {
  for (const cond of conditions) {
    const val = params[cond.param]
    if (val === undefined) return false
    switch (cond.op) {
      case '==':
        if (val !== cond.value) return false
        break
      case '!=':
        if (val === cond.value) return false
        break
      case '>':
        if ((val as number) <= (cond.value as number)) return false
        break
      case '>=':
        if ((val as number) < (cond.value as number)) return false
        break
      case '<':
        if ((val as number) >= (cond.value as number)) return false
        break
      case '<=':
        if ((val as number) > (cond.value as number)) return false
        break
    }
  }
  return true
}
