import { describe, it, expect } from 'vitest'
import { createText } from '../components/text'

describe('TextComponent', () => {
  it('has correct default values for new fields', () => {
    const comp = createText({ text: 'hello' })
    expect(comp.type).toBe('Text')
    expect(comp.text).toBe('hello')
    expect(comp.fontSize).toBe(16)
    expect(comp.fontFamily).toBe('monospace')
    expect(comp.color).toBe('#ffffff')
    expect(comp.align).toBe('center')
    expect(comp.baseline).toBe('middle')
    expect(comp.zIndex).toBe(10)
    expect(comp.visible).toBe(true)
    expect(comp.offsetX).toBe(0)
    expect(comp.offsetY).toBe(0)
    expect(comp.wordWrap).toBe(false)
    expect(comp.lineHeight).toBe(1.2)
  })

  it('strokeColor and strokeWidth are optional and undefined by default', () => {
    const comp = createText({ text: 'test' })
    expect(comp.strokeColor).toBeUndefined()
    expect(comp.strokeWidth).toBeUndefined()
  })

  it('wordWrap defaults to false', () => {
    const comp = createText({ text: 'wrap test' })
    expect(comp.wordWrap).toBe(false)
  })

  it('shadow fields are undefined by default', () => {
    const comp = createText({ text: 'shadow test' })
    expect(comp.shadowColor).toBeUndefined()
    expect(comp.shadowOffsetX).toBeUndefined()
    expect(comp.shadowOffsetY).toBeUndefined()
    expect(comp.shadowBlur).toBeUndefined()
  })

  it('opacity is undefined by default', () => {
    const comp = createText({ text: 'opacity test' })
    expect(comp.opacity).toBeUndefined()
  })

  it('accepts all new fields via opts', () => {
    const comp = createText({
      text: 'styled',
      strokeColor: '#000000',
      strokeWidth: 2,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowOffsetX: 2,
      shadowOffsetY: 3,
      shadowBlur: 4,
      wordWrap: true,
      lineHeight: 1.5,
      opacity: 0.8,
    })
    expect(comp.strokeColor).toBe('#000000')
    expect(comp.strokeWidth).toBe(2)
    expect(comp.shadowColor).toBe('rgba(0,0,0,0.5)')
    expect(comp.shadowOffsetX).toBe(2)
    expect(comp.shadowOffsetY).toBe(3)
    expect(comp.shadowBlur).toBe(4)
    expect(comp.wordWrap).toBe(true)
    expect(comp.lineHeight).toBe(1.5)
    expect(comp.opacity).toBe(0.8)
  })
})
