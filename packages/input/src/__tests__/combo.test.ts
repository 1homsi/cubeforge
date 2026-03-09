import { describe, it, expect, beforeEach } from 'vitest'
import { InputBuffer } from '../inputBuffer'
import { ComboDetector } from '../comboDetector'

describe('InputBuffer', () => {
  let buffer: InputBuffer

  beforeEach(() => {
    buffer = new InputBuffer({ bufferWindow: 0.2 })
  })

  it('record and consume within window', () => {
    const now = 1.0
    buffer.record('jump', now)
    expect(buffer.consume('jump', now + 0.1)).toBe(true)
  })

  it('expired inputs are pruned', () => {
    const now = 1.0
    buffer.record('jump', now)
    // Consuming after the window has passed should fail
    expect(buffer.consume('jump', now + 0.5)).toBe(false)
  })

  it('consume removes the action', () => {
    const now = 1.0
    buffer.record('jump', now)
    expect(buffer.consume('jump', now + 0.05)).toBe(true)
    // Second consume should fail — already consumed
    expect(buffer.consume('jump', now + 0.06)).toBe(false)
  })

  it('has() checks without consuming', () => {
    const now = 1.0
    buffer.record('dash', now)
    expect(buffer.has('dash', now + 0.05)).toBe(true)
    // Still there after has()
    expect(buffer.has('dash', now + 0.05)).toBe(true)
    // Consume it
    expect(buffer.consume('dash', now + 0.05)).toBe(true)
    expect(buffer.has('dash', now + 0.05)).toBe(false)
  })

  it('does not double-record same action on same frame', () => {
    const now = 1.0
    buffer.record('jump', now)
    buffer.record('jump', now + 0.01)
    // Only one entry, so consuming twice should fail on second
    expect(buffer.consume('jump', now + 0.05)).toBe(true)
    expect(buffer.consume('jump', now + 0.05)).toBe(false)
  })

  it('respects maxSize', () => {
    const small = new InputBuffer({ bufferWindow: 10, maxSize: 3 })
    small.record('a', 1.0)
    small.record('b', 1.1)
    // advance frame so 'c' doesn't collide with 'a' dedup
    small.update()
    small.record('c', 1.2)
    small.update()
    small.record('d', 1.3)
    // oldest ('a') should have been dropped
    expect(small.has('a', 1.3)).toBe(false)
    expect(small.has('b', 1.3)).toBe(true)
    expect(small.has('d', 1.3)).toBe(true)
  })

  it('clear removes all entries', () => {
    buffer.record('jump', 1.0)
    buffer.record('dash', 1.0)
    buffer.clear()
    expect(buffer.has('jump', 1.0)).toBe(false)
    expect(buffer.has('dash', 1.0)).toBe(false)
  })
})

describe('ComboDetector', () => {
  it('simple 3-input combo detection', () => {
    const detector = new ComboDetector({
      combos: [{ name: 'hadouken', sequence: ['down', 'forward', 'punch'], maxInterval: 0.5 }],
    })

    expect(detector.feed('down', 1.0)).toBe(null)
    expect(detector.feed('forward', 1.1)).toBe(null)
    expect(detector.feed('punch', 1.2)).toBe('hadouken')
  })

  it('combo fails if too slow between inputs', () => {
    const detector = new ComboDetector({
      combos: [{ name: 'hadouken', sequence: ['down', 'forward', 'punch'], maxInterval: 0.3 }],
    })

    detector.feed('down', 1.0)
    detector.feed('forward', 1.5) // 0.5s gap > 0.3 maxInterval
    expect(detector.feed('punch', 1.6)).toBe(null)
  })

  it('multiple combos detected independently', () => {
    const detector = new ComboDetector({
      combos: [
        { name: 'ab', sequence: ['a', 'b'], maxInterval: 0.5 },
        { name: 'cd', sequence: ['c', 'd'], maxInterval: 0.5 },
      ],
    })

    detector.feed('a', 1.0)
    expect(detector.feed('b', 1.1)).toBe('ab')

    detector.feed('c', 2.0)
    expect(detector.feed('d', 2.1)).toBe('cd')
  })

  it('fires onTrigger callback when combo detected', () => {
    let triggered = false
    const detector = new ComboDetector({
      combos: [
        {
          name: 'test',
          sequence: ['x', 'y'],
          maxInterval: 0.5,
          onTrigger: () => {
            triggered = true
          },
        },
      ],
    })

    detector.feed('x', 1.0)
    detector.feed('y', 1.1)
    expect(triggered).toBe(true)
  })

  it('clear resets history so previous partial combos are forgotten', () => {
    const detector = new ComboDetector({
      combos: [{ name: 'abc', sequence: ['a', 'b', 'c'], maxInterval: 0.5 }],
    })

    detector.feed('a', 1.0)
    detector.feed('b', 1.1)
    detector.clear()
    // 'c' alone should not complete the combo
    expect(detector.feed('c', 1.2)).toBe(null)
  })

  it('uses default maxInterval of 0.3 when not specified', () => {
    const detector = new ComboDetector({
      combos: [{ name: 'quick', sequence: ['a', 'b'] }],
    })

    detector.feed('a', 1.0)
    // Within default 0.3s
    expect(detector.feed('b', 1.2)).toBe('quick')

    detector.clear()
    detector.feed('a', 2.0)
    // Outside default 0.3s
    expect(detector.feed('b', 2.5)).toBe(null)
  })
})
