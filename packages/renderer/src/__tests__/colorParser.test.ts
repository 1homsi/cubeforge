import { describe, it, expect } from 'vitest'
import { parseCSSColor } from '../colorParser'

describe('parseCSSColor', () => {
  describe('hex #rrggbb', () => {
    it('parses #000000 as black', () => {
      const [r, g, b, a] = parseCSSColor('#000000')
      expect(r).toBe(0)
      expect(g).toBe(0)
      expect(b).toBe(0)
      expect(a).toBe(1)
    })

    it('parses #ffffff as white', () => {
      const [r, g, b, a] = parseCSSColor('#ffffff')
      expect(r).toBe(1)
      expect(g).toBe(1)
      expect(b).toBe(1)
      expect(a).toBe(1)
    })

    it('parses #ff0000 as red', () => {
      const [r, g, b, a] = parseCSSColor('#ff0000')
      expect(r).toBe(1)
      expect(g).toBe(0)
      expect(b).toBe(0)
      expect(a).toBe(1)
    })

    it('parses #00ff00 as green', () => {
      const [r, g, b, a] = parseCSSColor('#00ff00')
      expect(r).toBe(0)
      expect(g).toBe(1)
      expect(b).toBe(0)
    })

    it('parses #0000ff as blue', () => {
      const [r, g, b, a] = parseCSSColor('#0000ff')
      expect(r).toBe(0)
      expect(g).toBe(0)
      expect(b).toBe(1)
    })

    it('parses midrange values', () => {
      const [r, g, b] = parseCSSColor('#808080')
      expect(r).toBeCloseTo(128 / 255)
      expect(g).toBeCloseTo(128 / 255)
      expect(b).toBeCloseTo(128 / 255)
    })
  })

  describe('hex #rrggbbaa', () => {
    it('parses 8-digit hex with alpha', () => {
      const [r, g, b, a] = parseCSSColor('#ff000080')
      expect(r).toBe(1)
      expect(g).toBe(0)
      expect(b).toBe(0)
      expect(a).toBeCloseTo(128 / 255)
    })

    it('parses full opacity 8-digit hex', () => {
      const [, , , a] = parseCSSColor('#ffffffff')
      expect(a).toBe(1)
    })

    it('parses zero opacity', () => {
      const [, , , a] = parseCSSColor('#ffffff00')
      expect(a).toBe(0)
    })
  })

  describe('hex #rgb', () => {
    it('parses #fff as white', () => {
      const [r, g, b, a] = parseCSSColor('#fff')
      expect(r).toBe(1)
      expect(g).toBe(1)
      expect(b).toBe(1)
      expect(a).toBe(1)
    })

    it('parses #000 as black', () => {
      const [r, g, b] = parseCSSColor('#000')
      expect(r).toBe(0)
      expect(g).toBe(0)
      expect(b).toBe(0)
    })

    it('parses #f00 as red', () => {
      const [r, g, b] = parseCSSColor('#f00')
      expect(r).toBe(1)
      expect(g).toBe(0)
      expect(b).toBe(0)
    })

    it('parses #abc correctly (expands to #aabbcc)', () => {
      const [r, g, b] = parseCSSColor('#abc')
      expect(r).toBeCloseTo(0xaa / 255)
      expect(g).toBeCloseTo(0xbb / 255)
      expect(b).toBeCloseTo(0xcc / 255)
    })
  })

  describe('hex #rgba', () => {
    it('parses 4-digit hex with alpha', () => {
      const [r, g, b, a] = parseCSSColor('#f008')
      expect(r).toBe(1)
      expect(g).toBe(0)
      expect(b).toBe(0)
      expect(a).toBeCloseTo(0x88 / 255)
    })
  })

  describe('rgb()', () => {
    it('parses rgb(255, 0, 0)', () => {
      const [r, g, b, a] = parseCSSColor('rgb(255, 0, 0)')
      expect(r).toBe(1)
      expect(g).toBe(0)
      expect(b).toBe(0)
      expect(a).toBe(1)
    })

    it('parses rgb(0, 128, 255)', () => {
      const [r, g, b] = parseCSSColor('rgb(0, 128, 255)')
      expect(r).toBe(0)
      expect(g).toBeCloseTo(128 / 255)
      expect(b).toBe(1)
    })

    it('parses rgb(0, 0, 0)', () => {
      const [r, g, b] = parseCSSColor('rgb(0, 0, 0)')
      expect(r).toBe(0)
      expect(g).toBe(0)
      expect(b).toBe(0)
    })
  })

  describe('rgba()', () => {
    it('parses rgba(255, 0, 0, 0.5)', () => {
      const [r, g, b, a] = parseCSSColor('rgba(255, 0, 0, 0.5)')
      expect(r).toBe(1)
      expect(g).toBe(0)
      expect(b).toBe(0)
      expect(a).toBe(0.5)
    })

    it('parses rgba(0, 0, 0, 0)', () => {
      const [, , , a] = parseCSSColor('rgba(0, 0, 0, 0)')
      expect(a).toBe(0)
    })

    it('parses rgba(255, 255, 255, 1)', () => {
      const [r, g, b, a] = parseCSSColor('rgba(255, 255, 255, 1)')
      expect(r).toBe(1)
      expect(g).toBe(1)
      expect(b).toBe(1)
      expect(a).toBe(1)
    })
  })

  describe('caching', () => {
    it('returns the same reference for repeated calls', () => {
      const a = parseCSSColor('#ff0000')
      const b = parseCSSColor('#ff0000')
      expect(a).toBe(b)
    })

    it('returns different references for different colors', () => {
      const a = parseCSSColor('#ff0001')
      const b = parseCSSColor('#00ff02')
      expect(a).not.toBe(b)
    })
  })

  describe('fallback', () => {
    it('returns white for unrecognized format', () => {
      const [r, g, b, a] = parseCSSColor('not-a-color')
      expect(r).toBe(1)
      expect(g).toBe(1)
      expect(b).toBe(1)
      expect(a).toBe(1)
    })
  })
})
