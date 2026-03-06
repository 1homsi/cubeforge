import { useEffect, useContext } from 'react'
import { createSprite, type SpriteComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

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
}: SpriteProps) {
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
      frameIndex,
      frameWidth,
      frameHeight,
      frameColumns,
    })
    engine.ecs.addComponent(entityId, comp)

    if (src) {
      engine.assets.loadImage(src).then((img: HTMLImageElement) => {
        const c = engine.ecs.getComponent<SpriteComponent>(entityId, 'Sprite')
        if (c) c.image = img
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
    comp.frameIndex = frameIndex
  }, [color, visible, flipX, zIndex, frameIndex, engine, entityId])

  return null
}
