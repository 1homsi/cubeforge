import { describe, it, expect } from 'vitest'
import { createParallaxLayer } from '../components/parallaxLayer'

describe('createParallaxLayer', () => {
  it('creates with correct type', () => {
    const pl = createParallaxLayer({
      src: 'mountains.png',
      speedX: 0.3,
      speedY: 0,
      repeatX: true,
      repeatY: false,
      zIndex: -100,
      offsetX: 0,
      offsetY: 0,
      imageWidth: 0,
      imageHeight: 0,
    })
    expect(pl.type).toBe('ParallaxLayer')
  })

  it('preserves all passed properties', () => {
    const pl = createParallaxLayer({
      src: 'sky.png',
      speedX: 0.1,
      speedY: 0.05,
      repeatX: true,
      repeatY: true,
      zIndex: -200,
      offsetX: 10,
      offsetY: 20,
      imageWidth: 512,
      imageHeight: 256,
    })
    expect(pl.src).toBe('sky.png')
    expect(pl.speedX).toBe(0.1)
    expect(pl.speedY).toBe(0.05)
    expect(pl.repeatX).toBe(true)
    expect(pl.repeatY).toBe(true)
    expect(pl.zIndex).toBe(-200)
    expect(pl.offsetX).toBe(10)
    expect(pl.offsetY).toBe(20)
    expect(pl.imageWidth).toBe(512)
    expect(pl.imageHeight).toBe(256)
  })

  it('supports zero speed (fixed background)', () => {
    const pl = createParallaxLayer({
      src: 'bg.png',
      speedX: 0,
      speedY: 0,
      repeatX: false,
      repeatY: false,
      zIndex: -300,
      offsetX: 0,
      offsetY: 0,
      imageWidth: 0,
      imageHeight: 0,
    })
    expect(pl.speedX).toBe(0)
    expect(pl.speedY).toBe(0)
  })

  it('supports full camera speed (1.0)', () => {
    const pl = createParallaxLayer({
      src: 'fg.png',
      speedX: 1,
      speedY: 1,
      repeatX: true,
      repeatY: false,
      zIndex: 0,
      offsetX: 0,
      offsetY: 0,
      imageWidth: 0,
      imageHeight: 0,
    })
    expect(pl.speedX).toBe(1)
    expect(pl.speedY).toBe(1)
  })

  it('fields are mutable', () => {
    const pl = createParallaxLayer({
      src: 'bg.png',
      speedX: 0.5,
      speedY: 0,
      repeatX: true,
      repeatY: false,
      zIndex: -100,
      offsetX: 0,
      offsetY: 0,
      imageWidth: 0,
      imageHeight: 0,
    })
    pl.imageWidth = 1024
    pl.imageHeight = 512
    expect(pl.imageWidth).toBe(1024)
    expect(pl.imageHeight).toBe(512)
  })
})
