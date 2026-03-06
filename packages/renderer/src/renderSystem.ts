import type { System, ECSWorld, EntityId } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { SpriteComponent } from './components/sprite'
import type { Camera2DComponent } from './components/camera2d'
import { Canvas2DRenderer } from './canvas2d'

export class RenderSystem implements System {
  constructor(
    private readonly renderer: Canvas2DRenderer,
    private readonly entityIds: Map<string, EntityId>,
  ) {}

  update(world: ECSWorld, _dt: number): void {
    const { ctx, canvas } = this.renderer

    // --- Camera ---
    let camX = 0
    let camY = 0
    let zoom = 1
    let background = '#000000'

    const camEntityId = world.queryOne('Camera2D')
    if (camEntityId !== undefined) {
      const cam = world.getComponent<Camera2DComponent>(camEntityId, 'Camera2D')!
      background = cam.background

      if (cam.followEntityId) {
        const targetId = this.entityIds.get(cam.followEntityId)
        if (targetId !== undefined) {
          const targetTransform = world.getComponent<TransformComponent>(targetId, 'Transform')
          if (targetTransform) {
            if (cam.smoothing > 0) {
              cam.x += (targetTransform.x - cam.x) * (1 - cam.smoothing)
              cam.y += (targetTransform.y - cam.y) * (1 - cam.smoothing)
            } else {
              cam.x = targetTransform.x
              cam.y = targetTransform.y
            }
          }
        }
      }

      camX = cam.x
      camY = cam.y
      zoom = cam.zoom
    }

    // Clear
    this.renderer.clear(background)

    // Apply camera transform: translate so camX,camY is at screen center
    ctx.save()
    ctx.translate(canvas.width / 2 - camX * zoom, canvas.height / 2 - camY * zoom)
    ctx.scale(zoom, zoom)

    // Collect renderable entities, sort by zIndex
    const renderables = world.query('Transform', 'Sprite')
    renderables.sort((a, b) => {
      const za = world.getComponent<SpriteComponent>(a, 'Sprite')!.zIndex
      const zb = world.getComponent<SpriteComponent>(b, 'Sprite')!.zIndex
      return za - zb
    })

    for (const id of renderables) {
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const sprite = world.getComponent<SpriteComponent>(id, 'Sprite')!

      if (!sprite.visible) continue

      ctx.save()
      ctx.translate(transform.x, transform.y)
      ctx.rotate(transform.rotation)
      ctx.scale(
        transform.scaleX * (sprite.flipX ? -1 : 1),
        transform.scaleY,
      )

      const drawX = -(sprite.width / 2) + sprite.offsetX
      const drawY = -(sprite.height / 2) + sprite.offsetY

      if (sprite.image && sprite.image.complete && sprite.image.naturalWidth > 0) {
        if (sprite.frame) {
          const { sx, sy, sw, sh } = sprite.frame
          ctx.drawImage(sprite.image, sx, sy, sw, sh, drawX, drawY, sprite.width, sprite.height)
        } else {
          ctx.drawImage(sprite.image, drawX, drawY, sprite.width, sprite.height)
        }
      } else {
        ctx.fillStyle = sprite.color
        ctx.fillRect(drawX, drawY, sprite.width, sprite.height)
      }

      ctx.restore()
    }

    ctx.restore()
  }
}
