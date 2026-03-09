import { useEffect, useContext } from 'react'
import { createText, type TextComponent } from '@cubeforge/renderer'
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
  strokeColor?: string
  strokeWidth?: number
  shadowColor?: string
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowBlur?: number
  wordWrap?: boolean
  lineHeight?: number
  opacity?: number
}

export function Text({
  text,
  fontSize = 16,
  fontFamily = 'monospace',
  color = '#ffffff',
  align = 'center',
  baseline = 'middle',
  zIndex = 10,
  visible = true,
  maxWidth,
  offsetX = 0,
  offsetY = 0,
  strokeColor,
  strokeWidth,
  shadowColor,
  shadowOffsetX,
  shadowOffsetY,
  shadowBlur,
  wordWrap = false,
  lineHeight = 1.2,
  opacity,
}: TextProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp = createText({
      text,
      fontSize,
      fontFamily,
      color,
      align,
      baseline,
      zIndex,
      visible,
      maxWidth,
      offsetX,
      offsetY,
      strokeColor,
      strokeWidth,
      shadowColor,
      shadowOffsetX,
      shadowOffsetY,
      shadowBlur,
      wordWrap,
      lineHeight,
      opacity,
    })
    engine.ecs.addComponent(entityId, comp)
    return () => engine.ecs.removeComponent(entityId, 'Text')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props each render
  useEffect(() => {
    const comp = engine.ecs.getComponent<TextComponent>(entityId, 'Text')
    if (!comp) return
    comp.text = text
    comp.color = color
    comp.visible = visible
    comp.zIndex = zIndex
    comp.strokeColor = strokeColor
    comp.strokeWidth = strokeWidth
    comp.shadowColor = shadowColor
    comp.shadowOffsetX = shadowOffsetX
    comp.shadowOffsetY = shadowOffsetY
    comp.shadowBlur = shadowBlur
    comp.wordWrap = wordWrap
    comp.lineHeight = lineHeight
    comp.opacity = opacity
  }, [
    text,
    color,
    visible,
    zIndex,
    strokeColor,
    strokeWidth,
    shadowColor,
    shadowOffsetX,
    shadowOffsetY,
    shadowBlur,
    wordWrap,
    lineHeight,
    opacity,
    engine,
    entityId,
  ])

  return null
}
