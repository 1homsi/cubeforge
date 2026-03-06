import type { System, ECSWorld } from '@cubeforge/core'
import type { TransformComponent } from '@cubeforge/core'
import type { Canvas2DRenderer } from '@cubeforge/renderer'

export class DebugSystem implements System {
  private frameCount = 0
  private lastFpsTime = 0
  private fps = 0

  constructor(private readonly renderer: Canvas2DRenderer) {}

  update(world: ECSWorld, dt: number): void {
    const { ctx, canvas } = this.renderer

    // FPS tracking
    this.frameCount++
    this.lastFpsTime += dt
    if (this.lastFpsTime >= 0.5) {
      this.fps = Math.round(this.frameCount / this.lastFpsTime)
      this.frameCount = 0
      this.lastFpsTime = 0
    }

    // Get camera for world-space drawing
    const camId = world.queryOne('Camera2D')
    let camX = 0, camY = 0, zoom = 1
    if (camId !== undefined) {
      const cam = world.getComponent<{ type: 'Camera2D'; x: number; y: number; zoom: number }>(camId, 'Camera2D')!
      camX = cam.x; camY = cam.y; zoom = cam.zoom
    }

    // Draw collider wireframes in world space
    ctx.save()
    ctx.translate(canvas.width / 2 - camX * zoom, canvas.height / 2 - camY * zoom)
    ctx.scale(zoom, zoom)

    const lw = 1 / zoom
    for (const id of world.query('Transform', 'BoxCollider')) {
      const t = world.getComponent<TransformComponent>(id, 'Transform')!
      const c = world.getComponent<{
        type: 'BoxCollider'; width: number; height: number
        offsetX: number; offsetY: number; isTrigger: boolean
      }>(id, 'BoxCollider')!

      ctx.strokeStyle = c.isTrigger ? 'rgba(255,200,0,0.85)' : 'rgba(0,255,120,0.85)'
      ctx.lineWidth = lw
      ctx.strokeRect(
        t.x + c.offsetX - c.width / 2,
        t.y + c.offsetY - c.height / 2,
        c.width,
        c.height,
      )

      // Entity ID label
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `${10 / zoom}px monospace`
      ctx.fillText(String(id), t.x + c.offsetX - c.width / 2 + lw, t.y + c.offsetY - c.height / 2 - lw * 2)
    }

    ctx.restore()

    // Screen-space HUD
    const entityCount = world.entityCount
    const physicsCount = world.query('RigidBody', 'BoxCollider').length
    const renderCount  = world.query('Transform', 'Sprite').length

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(8, 8, 184, 84)
    ctx.fillStyle = '#00ff88'
    ctx.font = '11px monospace'
    ctx.fillText(`FPS         ${this.fps}`,        16, 26)
    ctx.fillText(`Entities    ${entityCount}`,     16, 42)
    ctx.fillText(`Physics     ${physicsCount}`,    16, 58)
    ctx.fillText(`Renderables ${renderCount}`,     16, 74)
    ctx.restore()
  }
}
