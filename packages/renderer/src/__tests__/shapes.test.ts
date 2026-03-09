import { describe, it, expect } from 'vitest'
import { createCircleShape, createLineShape, createPolygonShape } from '../components/shapes'

describe('createCircleShape', () => {
  it('creates with correct defaults', () => {
    const c = createCircleShape()
    expect(c.type).toBe('CircleShape')
    expect(c.radius).toBe(16)
    expect(c.color).toBe('#ffffff')
    expect(c.zIndex).toBe(0)
    expect(c.visible).toBe(true)
    expect(c.opacity).toBe(1)
    expect(c.strokeColor).toBeUndefined()
    expect(c.strokeWidth).toBeUndefined()
  })

  it('allows custom props to override defaults', () => {
    const c = createCircleShape({ radius: 32, color: '#ff0000', strokeColor: '#000', strokeWidth: 3, opacity: 0.5 })
    expect(c.type).toBe('CircleShape')
    expect(c.radius).toBe(32)
    expect(c.color).toBe('#ff0000')
    expect(c.strokeColor).toBe('#000')
    expect(c.strokeWidth).toBe(3)
    expect(c.opacity).toBe(0.5)
  })
})

describe('createLineShape', () => {
  it('creates with correct defaults', () => {
    const l = createLineShape()
    expect(l.type).toBe('LineShape')
    expect(l.endX).toBe(0)
    expect(l.endY).toBe(0)
    expect(l.color).toBe('#ffffff')
    expect(l.lineWidth).toBe(2)
    expect(l.zIndex).toBe(0)
    expect(l.visible).toBe(true)
    expect(l.opacity).toBe(1)
    expect(l.lineCap).toBe('round')
  })

  it('allows custom props to override defaults', () => {
    const l = createLineShape({ endX: 100, endY: 50, color: '#00ff00', lineWidth: 4, lineCap: 'square' })
    expect(l.type).toBe('LineShape')
    expect(l.endX).toBe(100)
    expect(l.endY).toBe(50)
    expect(l.color).toBe('#00ff00')
    expect(l.lineWidth).toBe(4)
    expect(l.lineCap).toBe('square')
  })
})

describe('createPolygonShape', () => {
  it('creates with correct defaults', () => {
    const p = createPolygonShape()
    expect(p.type).toBe('PolygonShape')
    expect(p.points).toEqual([])
    expect(p.color).toBe('#ffffff')
    expect(p.zIndex).toBe(0)
    expect(p.visible).toBe(true)
    expect(p.opacity).toBe(1)
    expect(p.closed).toBe(true)
    expect(p.strokeColor).toBeUndefined()
    expect(p.strokeWidth).toBeUndefined()
  })

  it('allows custom props to override defaults', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]
    const p = createPolygonShape({ points: pts, color: '#0000ff', closed: false, strokeColor: '#fff', strokeWidth: 2 })
    expect(p.type).toBe('PolygonShape')
    expect(p.points).toEqual(pts)
    expect(p.color).toBe('#0000ff')
    expect(p.closed).toBe(false)
    expect(p.strokeColor).toBe('#fff')
    expect(p.strokeWidth).toBe(2)
  })
})
