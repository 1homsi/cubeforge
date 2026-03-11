import { describe, it, expect } from 'vitest'
import { createNineSlice } from '../components/nineSlice'

describe('createNineSlice', () => {
  it('creates with correct type and required fields', () => {
    const ns = createNineSlice('panel.png', 200, 100)
    expect(ns.type).toBe('NineSlice')
    expect(ns.src).toBe('panel.png')
    expect(ns.width).toBe(200)
    expect(ns.height).toBe(100)
  })

  it('has default border values of 8', () => {
    const ns = createNineSlice('panel.png', 100, 100)
    expect(ns.borderTop).toBe(8)
    expect(ns.borderRight).toBe(8)
    expect(ns.borderBottom).toBe(8)
    expect(ns.borderLeft).toBe(8)
  })

  it('has default zIndex of 0', () => {
    const ns = createNineSlice('panel.png', 100, 100)
    expect(ns.zIndex).toBe(0)
  })

  it('accepts custom border values', () => {
    const ns = createNineSlice('panel.png', 100, 100, {
      borderTop: 12,
      borderRight: 16,
      borderBottom: 12,
      borderLeft: 16,
    })
    expect(ns.borderTop).toBe(12)
    expect(ns.borderRight).toBe(16)
    expect(ns.borderBottom).toBe(12)
    expect(ns.borderLeft).toBe(16)
  })

  it('accepts custom zIndex', () => {
    const ns = createNineSlice('panel.png', 100, 100, { zIndex: 5 })
    expect(ns.zIndex).toBe(5)
  })

  it('fields are mutable', () => {
    const ns = createNineSlice('panel.png', 100, 100)
    ns.width = 300
    ns.height = 200
    expect(ns.width).toBe(300)
    expect(ns.height).toBe(200)
  })
})
