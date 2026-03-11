import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInputContext } from '../inputContext'

describe('createInputContext', () => {
  it('defaults to gameplay context', () => {
    const ctx = createInputContext()
    expect(ctx.active).toBe('gameplay')
  })

  it('accepts a custom default context', () => {
    const ctx = createInputContext('ui')
    expect(ctx.active).toBe('ui')
  })

  describe('push', () => {
    it('pushes a context onto the stack', () => {
      const ctx = createInputContext()
      ctx.push('pause')
      expect(ctx.active).toBe('pause')
    })

    it('can push multiple contexts', () => {
      const ctx = createInputContext()
      ctx.push('pause')
      ctx.push('cutscene')
      expect(ctx.active).toBe('cutscene')
    })

    it('allows duplicate contexts', () => {
      const ctx = createInputContext()
      ctx.push('pause')
      ctx.push('pause')
      expect(ctx.stack).toEqual(['gameplay', 'pause', 'pause'])
    })
  })

  describe('pop', () => {
    it('pops the topmost occurrence', () => {
      const ctx = createInputContext()
      ctx.push('pause')
      ctx.pop('pause')
      expect(ctx.active).toBe('gameplay')
    })

    it('does nothing if context is not in stack', () => {
      const ctx = createInputContext()
      ctx.pop('cutscene')
      expect(ctx.active).toBe('gameplay')
    })

    it('pops only the topmost duplicate', () => {
      const ctx = createInputContext()
      ctx.push('pause')
      ctx.push('ui')
      ctx.push('pause')
      ctx.pop('pause')
      expect(ctx.active).toBe('ui')
    })

    it('can pop back to default', () => {
      const ctx = createInputContext()
      ctx.push('pause')
      ctx.push('cutscene')
      ctx.pop('cutscene')
      ctx.pop('pause')
      expect(ctx.active).toBe('gameplay')
    })
  })

  describe('stack', () => {
    it('returns a copy of the stack', () => {
      const ctx = createInputContext()
      const stack = ctx.stack
      stack.push('rogue')
      expect(ctx.stack).toEqual(['gameplay'])
    })

    it('includes all pushed contexts', () => {
      const ctx = createInputContext()
      ctx.push('pause')
      ctx.push('ui')
      expect(ctx.stack).toEqual(['gameplay', 'pause', 'ui'])
    })
  })

  describe('onChange', () => {
    it('calls listener when context changes', () => {
      const ctx = createInputContext()
      const listener = vi.fn()
      ctx.onChange(listener)
      ctx.push('pause')
      expect(listener).toHaveBeenCalledWith('pause')
    })

    it('calls listener on pop', () => {
      const ctx = createInputContext()
      ctx.push('pause')
      const listener = vi.fn()
      ctx.onChange(listener)
      ctx.pop('pause')
      expect(listener).toHaveBeenCalledWith('gameplay')
    })

    it('returns unsubscribe function', () => {
      const ctx = createInputContext()
      const listener = vi.fn()
      const unsub = ctx.onChange(listener)
      unsub()
      ctx.push('pause')
      expect(listener).not.toHaveBeenCalled()
    })

    it('notifies multiple listeners', () => {
      const ctx = createInputContext()
      const l1 = vi.fn()
      const l2 = vi.fn()
      ctx.onChange(l1)
      ctx.onChange(l2)
      ctx.push('ui')
      expect(l1).toHaveBeenCalledWith('ui')
      expect(l2).toHaveBeenCalledWith('ui')
    })
  })
})
