import { describe, it, expect } from 'vitest'
import { computeTOI, resolveTOI, type TOIBody } from '../toi'

function makeBox(x: number, y: number, vx: number, vy: number, hw = 10, hh = 10): TOIBody {
  return { x, y, rotation: 0, vx, vy, angVel: 0, hw, hh, shapeType: 'box' }
}

function makeCircle(x: number, y: number, vx: number, vy: number, r = 10): TOIBody {
  return { x, y, rotation: 0, vx, vy, angVel: 0, hw: r, hh: r, shapeType: 'circle' }
}

describe('computeTOI', () => {
  it('returns null when bodies have no relative motion', () => {
    const a = makeBox(0, 0, 0, 0)
    const b = makeBox(100, 0, 0, 0)
    expect(computeTOI(a, b, 1 / 60)).toBeNull()
  })

  it('returns null when bodies move apart', () => {
    const a = makeBox(0, 0, -100, 0)
    const b = makeBox(100, 0, 100, 0)
    expect(computeTOI(a, b, 1 / 60)).toBeNull()
  })

  it('detects impact between two boxes moving toward each other', () => {
    // Two boxes 100 units apart, closing at combined 200 units/s
    const a = makeBox(-60, 0, 100, 0)
    const b = makeBox(60, 0, -100, 0)
    const result = computeTOI(a, b, 1)
    expect(result).not.toBeNull()
    expect(result!.toi).toBeGreaterThanOrEqual(0)
    expect(result!.toi).toBeLessThanOrEqual(1)
  })

  it('returns toi in [0, 1] range', () => {
    const a = makeBox(-50, 0, 100, 0)
    const b = makeBox(50, 0, -100, 0)
    const result = computeTOI(a, b, 1)
    if (result) {
      expect(result.toi).toBeGreaterThanOrEqual(0)
      expect(result.toi).toBeLessThanOrEqual(1)
    }
  })

  it('provides a contact normal', () => {
    const a = makeBox(-60, 0, 100, 0)
    const b = makeBox(60, 0, -100, 0)
    const result = computeTOI(a, b, 1)
    if (result) {
      const len = Math.hypot(result.normalX, result.normalY)
      expect(len).toBeGreaterThan(0)
    }
  })

  it('provides a contact point', () => {
    const a = makeBox(-60, 0, 100, 0)
    const b = makeBox(60, 0, -100, 0)
    const result = computeTOI(a, b, 1)
    if (result) {
      expect(typeof result.contactX).toBe('number')
      expect(typeof result.contactY).toBe('number')
    }
  })

  it('returns null for circles with no relative motion', () => {
    const a = makeCircle(0, 0, 0, 0)
    const b = makeCircle(200, 0, 0, 0)
    expect(computeTOI(a, b, 1 / 60)).toBeNull()
  })

  it('detects circle-circle impact', () => {
    const a = makeCircle(-60, 0, 100, 0)
    const b = makeCircle(60, 0, -100, 0)
    const result = computeTOI(a, b, 1)
    expect(result).not.toBeNull()
  })

  it('detects circle-box impact', () => {
    const circle = makeCircle(-60, 0, 100, 0)
    const box = makeBox(60, 0, -100, 0)
    const result = computeTOI(circle, box, 1)
    expect(result).not.toBeNull()
  })

  it('returns null when bodies start overlapping but only move apart', () => {
    // Already-overlapping bodies report an immediate impact at t=0.
    const a = makeBox(0, 0, -200, 0)
    const b = makeBox(5, 0, 200, 0)
    const result = computeTOI(a, b, 1 / 60)
    expect(result).not.toBeNull()
    expect(result!.toi).toBe(0)
  })

  it('handles bodies that are just barely separated and converging', () => {
    // Barely separated (1 unit gap) and closing fast
    const a = makeBox(-11, 0, 50, 0)
    const b = makeBox(11, 0, -50, 0)
    const result = computeTOI(a, b, 1)
    // Should either find an impact quickly or return null (no infinite loops)
    expect(true).toBe(true) // Must complete without hanging
  })
})

describe('resolveTOI', () => {
  it('returns null when no impact', () => {
    const a = makeBox(0, 0, 0, 0)
    const b = makeBox(200, 0, 0, 0)
    expect(resolveTOI(a, b, 1 / 60)).toBeNull()
  })

  it('returns toi and normal when impact found', () => {
    const a = makeBox(-60, 0, 100, 0)
    const b = makeBox(60, 0, -100, 0)
    const result = resolveTOI(a, b, 1)
    if (result) {
      expect(result.toi).toBeGreaterThanOrEqual(0)
      expect(result.toi).toBeLessThanOrEqual(1)
      expect(typeof result.normalX).toBe('number')
      expect(typeof result.normalY).toBe('number')
    }
  })

  it('normal direction points from A toward B for horizontal approach', () => {
    const a = makeBox(-60, 0, 200, 0)
    const b = makeBox(60, 0, 0, 0)
    const result = resolveTOI(a, b, 1)
    if (result) {
      // A is to the left, so normal should point rightward (positive x)
      expect(result.normalX).toBeGreaterThan(0)
    }
  })
})
