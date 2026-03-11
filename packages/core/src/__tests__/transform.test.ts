import { describe, it, expect } from 'vitest'
import { createTransform } from '../components/transform'

describe('createTransform', () => {
  it('creates a Transform component with default values', () => {
    const t = createTransform()
    expect(t.type).toBe('Transform')
    expect(t.x).toBe(0)
    expect(t.y).toBe(0)
    expect(t.rotation).toBe(0)
    expect(t.scaleX).toBe(1)
    expect(t.scaleY).toBe(1)
  })

  it('accepts x and y', () => {
    const t = createTransform(100, 200)
    expect(t.x).toBe(100)
    expect(t.y).toBe(200)
    expect(t.rotation).toBe(0)
    expect(t.scaleX).toBe(1)
    expect(t.scaleY).toBe(1)
  })

  it('accepts x, y, and rotation', () => {
    const t = createTransform(10, 20, Math.PI)
    expect(t.rotation).toBeCloseTo(Math.PI)
  })

  it('accepts all parameters', () => {
    const t = createTransform(1, 2, 0.5, 2, 3)
    expect(t.x).toBe(1)
    expect(t.y).toBe(2)
    expect(t.rotation).toBe(0.5)
    expect(t.scaleX).toBe(2)
    expect(t.scaleY).toBe(3)
  })

  it('fields are mutable', () => {
    const t = createTransform()
    t.x = 50
    t.y = 60
    t.rotation = 1
    t.scaleX = 3
    t.scaleY = 4
    expect(t.x).toBe(50)
    expect(t.y).toBe(60)
    expect(t.rotation).toBe(1)
    expect(t.scaleX).toBe(3)
    expect(t.scaleY).toBe(4)
  })

  it('type is readonly', () => {
    const t = createTransform()
    expect(t.type).toBe('Transform')
  })

  it('accepts negative coordinates', () => {
    const t = createTransform(-100, -200)
    expect(t.x).toBe(-100)
    expect(t.y).toBe(-200)
  })

  it('accepts zero scale', () => {
    const t = createTransform(0, 0, 0, 0, 0)
    expect(t.scaleX).toBe(0)
    expect(t.scaleY).toBe(0)
  })
})
