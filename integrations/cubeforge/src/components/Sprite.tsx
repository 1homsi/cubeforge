import { useEffect, useContext } from 'react'
import { createSprite, type SpriteComponent, type Sampling } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'
import type { SpriteAtlas } from './spriteAtlas'

interface SpriteProps {
  width: number
  height: number
  color?: string
  src?: string
  offsetX?: number
  offsetY?: number
  zIndex?: number
  visible?: boolean
  flipX?: boolean
  anchorX?: number
  anchorY?: number
  frameIndex?: number
  frameWidth?: number
  frameHeight?: number
  frameColumns?: number
  atlas?: SpriteAtlas
  frame?: string
  tileX?: boolean
  tileY?: boolean
  tileSizeX?: number
  tileSizeY?: number
  /** Texture sampling mode — controls filtering when the sprite is scaled */
  sampling?: Sampling
}

export function Sprite({
  width,
  height,
  color = '#ffffff',
  src,
  offsetX = 0,
  offsetY = 0,
  zIndex = 0,
  visible = true,
  flipX = false,
  anchorX = 0.5,
  anchorY = 0.5,
  frameIndex = 0,
  frameWidth,
  frameHeight,
  frameColumns,
  atlas,
  frame,
  tileX,
  tileY,
  tileSizeX,
  tileSizeY,
  sampling,
}: SpriteProps) {
  const resolvedFrameIndex = (atlas && frame != null) ? (atlas[frame] ?? 0) : frameIndex
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp = createSprite({
      width,
      height,
      color,
      src,
      offsetX,
      offsetY,
      zIndex,
      visible,
      flipX,
      anchorX,
      anchorY,
      frameIndex: resolvedFrameIndex,
      frameWidth,
      frameHeight,
      frameColumns,
      tileX,
      tileY,
      tileSizeX,
      tileSizeY,
      sampling,
    })
    engine.ecs.addComponent(entityId, comp)

    if (src) {
      // loadImage auto-resolves the base URL; store the resolved src on the
      // component so the WebGL renderer's texture cache key matches.
      engine.assets.loadImage(src).then((img: HTMLImageElement) => {
        const c = engine.ecs.getComponent<SpriteComponent>(entityId, 'Sprite')
        if (c) {
          c.image = img
          c.src = img.src // use the fully resolved URL for WebGL cache matching
        }
      }).catch(console.error)
    }

    return () => engine.ecs.removeComponent(entityId, 'Sprite')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props
  useEffect(() => {
    const comp = engine.ecs.getComponent<SpriteComponent>(entityId, 'Sprite')
    if (!comp) return
    comp.color = color
    comp.visible = visible
    comp.flipX = flipX
    comp.zIndex = zIndex
    comp.frameIndex = resolvedFrameIndex
  }, [color, visible, flipX, zIndex, resolvedFrameIndex, engine, entityId])

  return null
}
