import { describe, it, expect, vi } from 'vitest'
import { createScript } from '../components/script'

describe('createScript', () => {
  it('creates a Script component with the given update function', () => {
    const update = vi.fn()
    const s = createScript(update)
    expect(s.type).toBe('Script')
    expect(s.update).toBe(update)
  })

  it('update function is callable', () => {
    const update = vi.fn()
    const s = createScript(update)
    s.update(0 as never, {} as never, {} as never, 0.016)
    expect(update).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith(0, {}, {}, 0.016)
  })

  it('update receives correct arguments', () => {
    const update = vi.fn()
    const s = createScript(update)
    const mockWorld = { entities: new Map() }
    const mockInput = { isDown: vi.fn() }
    s.update(42 as never, mockWorld as never, mockInput, 0.033)
    expect(update).toHaveBeenCalledWith(42, mockWorld, mockInput, 0.033)
  })

  it('type is Script', () => {
    const s = createScript(() => {})
    expect(s.type).toBe('Script')
  })

  it('update function can be replaced', () => {
    const update1 = vi.fn()
    const update2 = vi.fn()
    const s = createScript(update1)
    s.update = update2
    s.update(0 as never, {} as never, {}, 0.016)
    expect(update1).not.toHaveBeenCalled()
    expect(update2).toHaveBeenCalledOnce()
  })

  it('multiple calls create independent components', () => {
    const u1 = vi.fn()
    const u2 = vi.fn()
    const s1 = createScript(u1)
    const s2 = createScript(u2)
    expect(s1.update).not.toBe(s2.update)
  })
})
