import { describe, it, expect } from 'vitest'
import { createSprite } from '../components/sprite'
import type { SpriteShape } from '../components/sprite'

describe('createSprite', () => {
  it('creates a Sprite with required width and height', () => {
    const s = createSprite({ width: 32, height: 32 })
    expect(s.type).toBe('Sprite')
    expect(s.width).toBe(32)
    expect(s.height).toBe(32)
  })

  describe('default values', () => {
    const s = createSprite({ width: 10, height: 10 })

    it('default color is #ffffff', () => {
      expect(s.color).toBe('#ffffff')
    })

    it('default offsets are 0', () => {
      expect(s.offsetX).toBe(0)
      expect(s.offsetY).toBe(0)
    })

    it('default zIndex is 0', () => {
      expect(s.zIndex).toBe(0)
    })

    it('default visible is true', () => {
      expect(s.visible).toBe(true)
    })

    it('default flipX and flipY are false', () => {
      expect(s.flipX).toBe(false)
      expect(s.flipY).toBe(false)
    })

    it('default anchor is center (0.5, 0.5)', () => {
      expect(s.anchorX).toBe(0.5)
      expect(s.anchorY).toBe(0.5)
    })

    it('default frameIndex is 0', () => {
      expect(s.frameIndex).toBe(0)
    })

    it('default blendMode is normal', () => {
      expect(s.blendMode).toBe('normal')
    })

    it('default layer is default', () => {
      expect(s.layer).toBe('default')
    })

    it('default opacity is 1', () => {
      expect(s.opacity).toBe(1)
    })

    it('default shape is rect', () => {
      expect(s.shape).toBe('rect')
    })

    it('default borderRadius is 0', () => {
      expect(s.borderRadius).toBe(0)
    })

    it('default strokeWidth is 0', () => {
      expect(s.strokeWidth).toBe(0)
    })

    it('default starPoints is 5', () => {
      expect(s.starPoints).toBe(5)
    })

    it('default starInnerRadius is 0.4', () => {
      expect(s.starInnerRadius).toBe(0.4)
    })

    it('default src is undefined', () => {
      expect(s.src).toBeUndefined()
    })

    it('default strokeColor is undefined', () => {
      expect(s.strokeColor).toBeUndefined()
    })

    it('default tint is undefined', () => {
      expect(s.tint).toBeUndefined()
    })
  })

  describe('custom values', () => {
    it('accepts custom color', () => {
      const s = createSprite({ width: 10, height: 10, color: '#ff0000' })
      expect(s.color).toBe('#ff0000')
    })

    it('accepts custom opacity', () => {
      const s = createSprite({ width: 10, height: 10, opacity: 0.5 })
      expect(s.opacity).toBe(0.5)
    })

    it('accepts flip options', () => {
      const s = createSprite({ width: 10, height: 10, flipX: true, flipY: true })
      expect(s.flipX).toBe(true)
      expect(s.flipY).toBe(true)
    })

    it('accepts blendMode', () => {
      const s = createSprite({ width: 10, height: 10, blendMode: 'additive' })
      expect(s.blendMode).toBe('additive')
    })

    it('accepts stroke options', () => {
      const s = createSprite({ width: 10, height: 10, strokeColor: '#00ff00', strokeWidth: 2 })
      expect(s.strokeColor).toBe('#00ff00')
      expect(s.strokeWidth).toBe(2)
    })
  })

  describe('shape types', () => {
    const shapes: SpriteShape[] = ['rect', 'circle', 'ellipse', 'roundedRect', 'triangle', 'star', 'pentagon', 'hexagon']

    shapes.forEach((shape) => {
      it(`accepts shape "${shape}"`, () => {
        const s = createSprite({ width: 20, height: 20, shape })
        expect(s.shape).toBe(shape)
      })
    })
  })

  describe('star shape options', () => {
    it('accepts custom starPoints', () => {
      const s = createSprite({ width: 20, height: 20, shape: 'star', starPoints: 8 })
      expect(s.starPoints).toBe(8)
    })

    it('accepts custom starInnerRadius', () => {
      const s = createSprite({ width: 20, height: 20, shape: 'star', starInnerRadius: 0.6 })
      expect(s.starInnerRadius).toBe(0.6)
    })
  })

  describe('sprite sheet options', () => {
    it('accepts frameWidth and frameHeight', () => {
      const s = createSprite({ width: 128, height: 128, frameWidth: 32, frameHeight: 32 })
      expect(s.frameWidth).toBe(32)
      expect(s.frameHeight).toBe(32)
    })

    it('accepts frameColumns', () => {
      const s = createSprite({ width: 128, height: 128, frameColumns: 4 })
      expect(s.frameColumns).toBe(4)
    })

    it('accepts frame for legacy sprite sheets', () => {
      const s = createSprite({ width: 32, height: 32, frame: { sx: 0, sy: 0, sw: 32, sh: 32 } })
      expect(s.frame).toEqual({ sx: 0, sy: 0, sw: 32, sh: 32 })
    })
  })

  describe('tiling options', () => {
    it('accepts tileX and tileY', () => {
      const s = createSprite({ width: 100, height: 100, tileX: true, tileY: true })
      expect(s.tileX).toBe(true)
      expect(s.tileY).toBe(true)
    })

    it('accepts tileSizeX and tileSizeY', () => {
      const s = createSprite({ width: 100, height: 100, tileSizeX: 16, tileSizeY: 16 })
      expect(s.tileSizeX).toBe(16)
      expect(s.tileSizeY).toBe(16)
    })
  })
})
