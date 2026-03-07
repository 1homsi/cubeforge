import { useEffect, useContext } from 'react'
import type { TextComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface TextProps {
  text: string
  fontSize?: number
  fontFamily?: string
  color?: string
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  zIndex?: number
  visible?: boolean
  maxWidth?: number
  offsetX?: number
  offsetY?: number
}

export function Text({
  text,
  fontSize    = 16,
  fontFamily  = 'monospace',
  color       = '#ffffff',
  align       = 'center',
  baseline    = 'middle',
  zIndex      = 10,
  visible     = true,
  maxWidth,
  offsetX     = 0,
  offsetY     = 0,
}: TextProps) {
  const engine   = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp: TextComponent = {
      type: 'Text', text, fontSize, fontFamily, color, align, baseline,
      zIndex, visible, maxWidth, offsetX, offsetY,
    }
    engine.ecs.addComponent(entityId, comp)
    return () => engine.ecs.removeComponent(entityId, 'Text')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props each render
  useEffect(() => {
    const comp = engine.ecs.getComponent<TextComponent>(entityId, 'Text')
    if (!comp) return
    comp.text    = text
    comp.color   = color
    comp.visible = visible
    comp.zIndex  = zIndex
  }, [text, color, visible, zIndex, engine, entityId])

  return null
}
