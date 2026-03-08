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

    // Camera bounds visualization (drawn in same world-space context)
    if (camId !== undefined) {
      const camFull = world.getComponent<{
        type: 'Camera2D'; x: number; y: number; zoom: number
        bounds?: { x: number; y: number; width: number; height: number }
      }>(camId, 'Camera2D')!
      if (camFull.bounds) {
        const b = camFull.bounds
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'
        ctx.lineWidth = 1 / zoom
        ctx.setLineDash([8 / zoom, 4 / zoom])
        ctx.strokeRect(b.x, b.y, b.width, b.height)
        ctx.setLineDash([])
      }
    }

    ctx.restore()

    // Physics grid visualization (128px spatial broadphase grid)
    const GRID_SIZE = 128
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    ctx.lineWidth = 1
    ctx.setLineDash([])

    // Compute visible world-space range
    const offsetX = camX - canvas.width / (2 * zoom)
    const offsetY = camY - canvas.height / (2 * zoom)
    const visibleW = canvas.width / zoom
    const visibleH = canvas.height / zoom

    const startCol = Math.floor(offsetX / GRID_SIZE)
    const endCol = Math.ceil((offsetX + visibleW) / GRID_SIZE)
    const startRow = Math.floor(offsetY / GRID_SIZE)
    const endRow = Math.ceil((offsetY + visibleH) / GRID_SIZE)

    ctx.translate(canvas.width / 2 - camX * zoom, canvas.height / 2 - camY * zoom)
    ctx.scale(zoom, zoom)

    for (let col = startCol; col <= endCol; col++) {
      const wx = col * GRID_SIZE
      ctx.beginPath()
      ctx.moveTo(wx, startRow * GRID_SIZE)
      ctx.lineTo(wx, endRow * GRID_SIZE)
      ctx.stroke()
    }
    for (let row = startRow; row <= endRow; row++) {
      const wy = row * GRID_SIZE
      ctx.beginPath()
      ctx.moveTo(startCol * GRID_SIZE, wy)
      ctx.lineTo(endCol * GRID_SIZE, wy)
      ctx.stroke()
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
