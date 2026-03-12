import { describe, it, expect, vi } from 'vitest'
import {
  createPostProcessStack,
  vignetteEffect,
  scanlineEffect,
  chromaticAberrationEffect,
  type PostProcessEffect,
} from '../postProcess'

function makeCtx(): CanvasRenderingContext2D {
  const gradient = {
    addColorStop: vi.fn(),
  }
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn().mockReturnValue(gradient),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(4 * 4 * 4),
      width: 4,
      height: 4,
    }),
    putImageData: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

describe('createPostProcessStack', () => {
  it('creates an empty stack', () => {
    const stack = createPostProcessStack()
    // apply with no effects should not throw
    const ctx = makeCtx()
    expect(() => stack.apply(ctx, 100, 100, 0.016)).not.toThrow()
  })

  it('add registers an effect', () => {
    const stack = createPostProcessStack()
    const effect = vi.fn() as PostProcessEffect
    const ctx = makeCtx()
    stack.add(effect)
    stack.apply(ctx, 100, 100, 0.016)
    expect(effect).toHaveBeenCalledOnce()
  })

  it('applies multiple effects in order', () => {
    const stack = createPostProcessStack()
    const calls: number[] = []
    const e1: PostProcessEffect = () => calls.push(1)
    const e2: PostProcessEffect = () => calls.push(2)
    stack.add(e1)
    stack.add(e2)
    stack.apply(makeCtx(), 100, 100, 0.016)
    expect(calls).toEqual([1, 2])
  })

  it('remove unregisters an effect', () => {
    const stack = createPostProcessStack()
    const effect = vi.fn() as PostProcessEffect
    stack.add(effect)
    stack.remove(effect)
    stack.apply(makeCtx(), 100, 100, 0.016)
    expect(effect).not.toHaveBeenCalled()
  })

  it('remove is a no-op for unregistered effect', () => {
    const stack = createPostProcessStack()
    const effect = vi.fn() as PostProcessEffect
    expect(() => stack.remove(effect)).not.toThrow()
  })

  it('does not add same effect twice', () => {
    const stack = createPostProcessStack()
    const effect = vi.fn() as PostProcessEffect
    stack.add(effect)
    stack.add(effect)
    stack.apply(makeCtx(), 100, 100, 0.016)
    expect(effect).toHaveBeenCalledOnce()
  })

  it('clear removes all effects', () => {
    const stack = createPostProcessStack()
    const e1 = vi.fn() as PostProcessEffect
    const e2 = vi.fn() as PostProcessEffect
    stack.add(e1)
    stack.add(e2)
    stack.clear()
    stack.apply(makeCtx(), 100, 100, 0.016)
    expect(e1).not.toHaveBeenCalled()
    expect(e2).not.toHaveBeenCalled()
  })

  it('apply calls ctx.save and ctx.restore per effect', () => {
    const stack = createPostProcessStack()
    stack.add(vi.fn())
    stack.add(vi.fn())
    const ctx = makeCtx()
    stack.apply(ctx, 100, 100, 0.016)
    expect(ctx.save).toHaveBeenCalledTimes(2)
    expect(ctx.restore).toHaveBeenCalledTimes(2)
  })

  it('passes width, height, and dt to each effect', () => {
    const stack = createPostProcessStack()
    const effect = vi.fn() as PostProcessEffect
    stack.add(effect)
    const ctx = makeCtx()
    stack.apply(ctx, 800, 600, 0.033)
    expect(effect).toHaveBeenCalledWith(ctx, 800, 600, 0.033)
  })
})

describe('vignetteEffect', () => {
  it('creates a function', () => {
    expect(typeof vignetteEffect()).toBe('function')
  })

  it('calls createRadialGradient with screen center', () => {
    const effect = vignetteEffect(0.4)
    const ctx = makeCtx()
    effect(ctx, 200, 100, 0.016)
    expect(ctx.createRadialGradient).toHaveBeenCalled()
  })

  it('calls fillRect with full screen dimensions', () => {
    const effect = vignetteEffect()
    const ctx = makeCtx()
    effect(ctx, 300, 200, 0.016)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 300, 200)
  })

  it('uses default intensity 0.4', () => {
    const effect = vignetteEffect()
    const ctx = makeCtx()
    // Should not throw with default params
    expect(() => effect(ctx, 100, 100, 0.016)).not.toThrow()
  })

  it('accepts custom intensity', () => {
    const effect = vignetteEffect(0.8)
    const ctx = makeCtx()
    expect(() => effect(ctx, 100, 100, 0.016)).not.toThrow()
  })
})

describe('scanlineEffect', () => {
  it('creates a function', () => {
    expect(typeof scanlineEffect()).toBe('function')
  })

  it('draws scanlines across the height', () => {
    const effect = scanlineEffect(3, 0.15)
    const ctx = makeCtx()
    effect(ctx, 100, 30, 0.016)
    // 30/3 = 10 lines
    expect(ctx.fillRect).toHaveBeenCalledTimes(10)
  })

  it('each line has full width', () => {
    const effect = scanlineEffect(5, 0.1)
    const ctx = makeCtx()
    effect(ctx, 200, 10, 0.016)
    // Called with (0, y, width=200, 1) for each line
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls[0][2]).toBe(200)
  })

  it('uses default gap 3', () => {
    const effect = scanlineEffect()
    const ctx = makeCtx()
    effect(ctx, 100, 9, 0.016)
    // 9/3 = 3 scanlines
    expect(ctx.fillRect).toHaveBeenCalledTimes(3)
  })
})

describe('chromaticAberrationEffect', () => {
  it('creates a function', () => {
    expect(typeof chromaticAberrationEffect()).toBe('function')
  })

  it('is a no-op for zero-size canvas', () => {
    const effect = chromaticAberrationEffect(2)
    const ctx = makeCtx()
    expect(() => effect(ctx, 0, 0, 0.016)).not.toThrow()
    expect(ctx.getImageData).not.toHaveBeenCalled()
  })

  it('reads and writes image data for non-zero canvas', () => {
    const effect = chromaticAberrationEffect(2)
    const ctx = makeCtx()
    effect(ctx, 4, 4, 0.016)
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 4, 4)
    expect(ctx.putImageData).toHaveBeenCalled()
  })
})

