import { describe, it, expect } from 'vitest'
import { InterpolationBuffer } from '../interpolation'

describe('InterpolationBuffer', () => {
  it('returns null when empty', () => {
    const buf = new InterpolationBuffer()
    expect(buf.sample(Date.now())).toBeNull()
  })

  it('tracks length correctly', () => {
    const buf = new InterpolationBuffer()
    expect(buf.length).toBe(0)
    buf.push(0, { x: 0, y: 0 })
    expect(buf.length).toBe(1)
  })

  it('clears all snapshots', () => {
    const buf = new InterpolationBuffer()
    buf.push(0, { x: 0, y: 0 })
    buf.push(100, { x: 1, y: 0 })
    buf.clear()
    expect(buf.length).toBe(0)
    expect(buf.sample(50)).toBeNull()
  })

  it('evicts oldest snapshots when capacity is exceeded', () => {
    const buf = new InterpolationBuffer({ capacity: 3 })
    buf.push(0, { x: 0, y: 0 })
    buf.push(1, { x: 1, y: 0 })
    buf.push(2, { x: 2, y: 0 })
    buf.push(3, { x: 3, y: 0 })
    expect(buf.length).toBe(3)
  })

  it('interpolates x and y between two snapshots at t=0.5', () => {
    const buf = new InterpolationBuffer({ bufferMs: 0 })
    buf.push(0, { x: 0, y: 0 })
    buf.push(100, { x: 100, y: 200 })

    const result = buf.sample(50)
    expect(result?.x).toBeCloseTo(50)
    expect(result?.y).toBeCloseTo(100)
  })

  it('interpolates at t=0 (exact before timestamp)', () => {
    const buf = new InterpolationBuffer({ bufferMs: 0 })
    buf.push(0, { x: 0, y: 0 })
    buf.push(100, { x: 100, y: 0 })

    const result = buf.sample(0)
    expect(result?.x).toBeCloseTo(0)
  })

  it('interpolates at t=1 (exact after timestamp)', () => {
    const buf = new InterpolationBuffer({ bufferMs: 0 })
    buf.push(0, { x: 0, y: 0 })
    buf.push(100, { x: 100, y: 0 })

    const result = buf.sample(100)
    expect(result?.x).toBeCloseTo(100)
  })

  it('holds last known state when sample time is past all snapshots', () => {
    const buf = new InterpolationBuffer({ bufferMs: 0 })
    buf.push(0, { x: 10, y: 20 })
    buf.push(100, { x: 50, y: 60 })

    // Sample at 999 — past all snapshots
    const result = buf.sample(999)
    expect(result?.x).toBeCloseTo(50)
    expect(result?.y).toBeCloseTo(60)
  })

  it('holds first known state when sample time is before all snapshots', () => {
    const buf = new InterpolationBuffer({ bufferMs: 0 })
    buf.push(500, { x: 99, y: 0 })

    // sample at t=0, before any snapshot
    const result = buf.sample(0)
    expect(result?.x).toBeCloseTo(99)
  })

  it('respects bufferMs lag', () => {
    const buf = new InterpolationBuffer({ bufferMs: 100 })
    buf.push(0, { x: 0, y: 0 })
    buf.push(200, { x: 200, y: 0 })

    // renderTime=200 → sampleTime=100 → t=0.5
    const result = buf.sample(200)
    expect(result?.x).toBeCloseTo(100)
  })

  it('interpolates angle via shortest path', () => {
    const buf = new InterpolationBuffer({ bufferMs: 0 })
    buf.push(0, { x: 0, y: 0, angle: Math.PI - 0.1 })
    buf.push(100, { x: 0, y: 0, angle: -(Math.PI - 0.1) })

    // Shortest path crosses PI — should interpolate through PI, not the long way
    const result = buf.sample(50)
    expect(result?.angle).toBeDefined()
    // The result should be near PI (crossing point), not near 0
    expect(Math.abs(result!.angle!)).toBeGreaterThan(Math.PI * 0.8)
  })

  it('lerps additional numeric fields', () => {
    const buf = new InterpolationBuffer({ bufferMs: 0 })
    buf.push(0, { x: 0, y: 0, hp: 100 })
    buf.push(100, { x: 0, y: 0, hp: 0 })

    const result = buf.sample(50)
    expect(result?.hp).toBeCloseTo(50)
  })
})
