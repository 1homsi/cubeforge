import { describe, expect, it } from 'vitest'
import { computeWebGLSceneHash } from '../webglRenderSystem'

type ComponentBag = Record<string, unknown>

function createWorld(componentsByEntity: Record<number, ComponentBag>) {
  return {
    query: (...names: string[]) =>
      Object.entries(componentsByEntity)
        .filter(([, components]) => names.every((name) => components[name] !== undefined))
        .map(([id]) => Number(id)),
    getComponent: <T>(id: number, name: string) => componentsByEntity[id]?.[name] as T | undefined,
  }
}

function baseSprite(overrides: ComponentBag = {}) {
  return {
    type: 'Sprite',
    width: 32,
    height: 32,
    color: '#ffffff',
    offsetX: 0,
    offsetY: 0,
    zIndex: 0,
    visible: true,
    flipX: false,
    flipY: false,
    anchorX: 0.5,
    anchorY: 0.5,
    frameIndex: 0,
    blendMode: 'normal',
    layer: 'default',
    opacity: 1,
    shape: 'rect',
    borderRadius: 0,
    strokeWidth: 0,
    starPoints: 5,
    starInnerRadius: 0.4,
    ...overrides,
  }
}

function baseTransform(overrides: ComponentBag = {}) {
  return {
    type: 'Transform',
    x: 10,
    y: 20,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    ...overrides,
  }
}

function hash(componentsByEntity: Record<number, ComponentBag>, overrides: ComponentBag = {}) {
  return computeWebGLSceneHash({
    world: createWorld(componentsByEntity),
    camX: 0,
    camY: 0,
    zoom: 1,
    shakeX: 0,
    shakeY: 0,
    background: '#000000',
    postProcessOptions: {},
    textureRevision: 0,
    overlayRevision: 0,
    dynamicCanvases: new Map(),
    ...overrides,
  })
}

describe('computeWebGLSceneHash', () => {
  it('changes when visible sprite draw state changes', () => {
    const before = hash({
      1: { Transform: baseTransform(), Sprite: baseSprite() },
    })
    const after = hash({
      1: { Transform: baseTransform(), Sprite: baseSprite({ color: '#ff0000', zIndex: 5 }) },
    })

    expect(after).not.toBe(before)
  })

  it('changes when text content or layout changes', () => {
    const before = hash({
      1: {
        Transform: baseTransform(),
        Text: {
          type: 'Text',
          text: 'Score',
          fontSize: 16,
          fontFamily: 'monospace',
          color: '#ffffff',
          align: 'center',
          baseline: 'middle',
          zIndex: 10,
          visible: true,
          offsetX: 0,
          offsetY: 0,
        },
      },
    })
    const after = hash({
      1: {
        Transform: baseTransform(),
        Text: {
          type: 'Text',
          text: 'Score: 10',
          fontSize: 24,
          fontFamily: 'monospace',
          color: '#ffffff',
          align: 'center',
          baseline: 'middle',
          zIndex: 10,
          visible: true,
          offsetX: 4,
          offsetY: 0,
        },
      },
    })

    expect(after).not.toBe(before)
  })

  it('changes when parallax or frame-level renderer state changes', () => {
    const components = {
      1: {
        ParallaxLayer: {
          type: 'ParallaxLayer',
          src: '/sky.png',
          speedX: 0.2,
          speedY: 0,
          repeatX: true,
          repeatY: false,
          zIndex: -10,
          offsetX: 0,
          offsetY: 0,
          imageWidth: 256,
          imageHeight: 128,
        },
      },
    }

    const before = hash(components)
    const after = hash(
      {
        1: {
          ParallaxLayer: {
            ...components[1].ParallaxLayer,
            offsetX: 12,
          },
        },
      },
      {
        background: '#112233',
        postProcessOptions: { bloom: { enabled: true, intensity: 0.9 } },
        textureRevision: 2,
        overlayRevision: 1,
      },
    )

    expect(after).not.toBe(before)
  })

  it('changes when a dynamic canvas revision changes', () => {
    const components = {
      1: { Transform: baseTransform(), Sprite: baseSprite({ dynamicSrc: 'hud' }) },
    }

    const before = hash(components, {
      dynamicCanvases: new Map([['hud', { version: 1 }]]),
    })
    const after = hash(components, {
      dynamicCanvases: new Map([['hud', { version: 2 }]]),
    })

    expect(after).not.toBe(before)
  })

  it('forces redraw for custom sprite draws and active simulation effects', () => {
    expect(
      hash({
        1: { Transform: baseTransform(), Sprite: baseSprite({ customDraw: () => undefined }) },
      }),
    ).toBe(-1)

    expect(
      hash({
        1: { AnimationState: { type: 'AnimationState', playing: true } },
      }),
    ).toBe(-1)
  })
})
