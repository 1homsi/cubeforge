import { describe, it, expect } from 'vitest'
import { createMask } from '../components/mask'

describe('createMask', () => {
  it('creates with correct defaults', () => {
    const m = createMask()
    expect(m.type).toBe('Mask')
    expect(m.shape).toBe('rect')
    expect(m.width).toBe(64)
    expect(m.height).toBe(64)
    expect(m.radius).toBe(32)
    expect(m.inverted).toBe(false)
    expect(m.anchorX).toBe(0.5)
    expect(m.anchorY).toBe(0.5)
    expect(m.visible).toBe(true)
  })

  it('creates with custom shape and dimensions', () => {
    const m = createMask({ shape: 'circle', radius: 48, inverted: true, anchorX: 0, anchorY: 1 })
    expect(m.type).toBe('Mask')
    expect(m.shape).toBe('circle')
    expect(m.radius).toBe(48)
    expect(m.inverted).toBe(true)
    expect(m.anchorX).toBe(0)
    expect(m.anchorY).toBe(1)
    // non-overridden defaults remain
    expect(m.width).toBe(64)
    expect(m.height).toBe(64)
    expect(m.visible).toBe(true)
  })

  it('creates with custom rect dimensions', () => {
    const m = createMask({ shape: 'rect', width: 128, height: 256, visible: false })
    expect(m.type).toBe('Mask')
    expect(m.shape).toBe('rect')
    expect(m.width).toBe(128)
    expect(m.height).toBe(256)
    expect(m.visible).toBe(false)
  })
})
