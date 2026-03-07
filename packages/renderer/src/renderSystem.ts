import type { System, ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { SpriteComponent } from './components/sprite'
import type { Camera2DComponent } from './components/camera2d'
import type { AnimationStateComponent } from './components/animationState'
import type { SquashStretchComponent } from './components/squashStretch'
import type { ParticlePoolComponent } from './components/particle'
import type { ParallaxLayerComponent } from './components/parallaxLayer'
import type { TextComponent } from './components/text'
import { Canvas2DRenderer } from './canvas2d'

const imageCache = new Map<string, HTMLImageElement>()

interface BoxColliderShape {
  type: 'BoxCollider'
  width: number
  height: number
  offsetX: number
  offsetY: number
  isTrigger: boolean
}

interface RigidBodyShape {
  type: 'RigidBody'
  vx: number
  vy: number
}

export class RenderSystem implements System {
  private debug = false
  private pendingShake: { intensity: number; duration: number } | null = null

  // FPS tracking
  private frameTimes: number[] = []
  private lastTimestamp = 0

  constructor(
    private readonly renderer: Canvas2DRenderer,
    private readonly entityIds: Map<string, EntityId>,
  ) {}

  setDebug(v: boolean): void {
    this.debug = v
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
    let background = '#000000'
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
        const progress = cam.shakeDuration > 0 ? cam.shakeTimer / cam.shakeDuration : 0
        shakeX = (world.rng() * 2 - 1) * cam.shakeIntensity * progress
        shakeY = (world.rng() * 2 - 1) * cam.shakeIntensity * progress
      }

      camX = cam.x
      camY = cam.y
      zoom = cam.zoom
    }

    // --- Animation update pass ---
    for (const id of world.query('AnimationState', 'Sprite')) {
      const anim = world.getComponent<AnimationStateComponent>(id, 'AnimationState')!
      const sprite = world.getComponent<SpriteComponent>(id, 'Sprite')!
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
          }
        }
      }
      sprite.frameIndex = anim.frames[anim.currentIndex]
    }

    // --- SquashStretch update pass ---
    for (const id of world.query('SquashStretch', 'RigidBody')) {
      const ss = world.getComponent<SquashStretchComponent>(id, 'SquashStretch')!
      const rb = world.getComponent<RigidBodyShape>(id, 'RigidBody')!
      const speed = Math.sqrt(rb.vx * rb.vx + rb.vy * rb.vy)
      const targetScaleX = rb.vy < -100 ? 1 + ss.intensity * 0.4 : (speed > 50 ? 1 - ss.intensity * 0.3 : 1)
      const targetScaleY = rb.vy < -100 ? 1 - ss.intensity * 0.4 : (speed > 50 ? 1 + ss.intensity * 0.3 : 1)
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
        const pattern = ctx.createPattern(img, layer.repeatX && layer.repeatY ? 'repeat' : layer.repeatX ? 'repeat-x' : 'repeat-y')
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
    ctx.translate(
      canvas.width / 2 - camX * zoom + shakeX,
      canvas.height / 2 - camY * zoom + shakeY,
    )
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
        transform.scaleY * scaleYMod,
      )

      const drawX = -sprite.anchorX * sprite.width + sprite.offsetX
      const drawY = -sprite.anchorY * sprite.height + sprite.offsetY

      if (sprite.image && sprite.image.complete && sprite.image.naturalWidth > 0) {
        if (sprite.frameWidth && sprite.frameHeight) {
          const cols = sprite.frameColumns ?? Math.floor(sprite.image.naturalWidth / sprite.frameWidth)
          const col = sprite.frameIndex % cols
          const row = Math.floor(sprite.frameIndex / cols)
          const sx = col * sprite.frameWidth
          const sy = row * sprite.frameHeight
          ctx.drawImage(sprite.image, sx, sy, sprite.frameWidth, sprite.frameHeight, drawX, drawY, sprite.width, sprite.height)
        } else if (sprite.frame) {
          const { sx, sy, sw, sh } = sprite.frame
          ctx.drawImage(sprite.image, sx, sy, sw, sh, drawX, drawY, sprite.width, sprite.height)
        } else if (sprite.tileX || sprite.tileY) {
          const repeat = sprite.tileX && sprite.tileY ? 'repeat' : sprite.tileX ? 'repeat-x' : 'repeat-y'
          const pat = ctx.createPattern(sprite.image, repeat)
          if (pat) {
            pat.setTransform(new DOMMatrix().translate(drawX, drawY))
            ctx.fillStyle = pat
            ctx.fillRect(drawX, drawY, sprite.width, sprite.height)
          }
        } else {
          ctx.drawImage(sprite.image, drawX, drawY, sprite.width, sprite.height)
        }
      } else {
        ctx.fillStyle = sprite.color
        ctx.fillRect(drawX, drawY, sprite.width, sprite.height)
      }

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
      ctx.font = `${text.fontSize}px ${text.fontFamily}`
      ctx.fillStyle = text.color
      ctx.textAlign = text.align
      ctx.textBaseline = text.baseline
      ctx.fillText(text.text, 0, 0, text.maxWidth as number)
      ctx.restore()
    }

    // --- Particle update + render pass ---
    for (const id of world.query('Transform', 'ParticlePool')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const pool = world.getComponent<ParticlePoolComponent>(id, 'ParticlePool')!

      // Update existing particles
      pool.particles = pool.particles.filter(p => {
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
            x: t.x,
            y: t.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: pool.particleLife,
            maxLife: pool.particleLife,
            size: pool.particleSize,
            color: pool.color,
            gravity: pool.gravity,
          })
        }
      }

      // Render particles
      for (const p of pool.particles) {
        const alpha = p.life / p.maxLife
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
      ctx.globalAlpha = 1
    }

    // --- Debug: draw collider wireframes ---
    if (this.debug) {
      ctx.lineWidth = 1
      for (const id of world.query('Transform', 'BoxCollider')) {
        const t = world.getComponent<TransformComponent>(id, 'Transform')!
        const c = world.getComponent<BoxColliderShape>(id, 'BoxCollider')!
        ctx.strokeStyle = c.isTrigger ? 'rgba(255,200,0,0.6)' : 'rgba(0,255,0,0.6)'
        ctx.strokeRect(
          t.x + c.offsetX - c.width / 2,
          t.y + c.offsetY - c.height / 2,
          c.width,
          c.height,
        )
      }
    }

    ctx.restore()

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
