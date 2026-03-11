import { describe, it, expect } from 'vitest'
import { createTag } from '../components/tag'

describe('createTag', () => {
  it('creates a Tag component with the given tags', () => {
    const t = createTag('player')
    expect(t.type).toBe('Tag')
    expect(t.tags).toEqual(['player'])
  })

  it('creates a Tag with multiple tags', () => {
    const t = createTag('player', 'hero', 'controllable')
    expect(t.tags).toEqual(['player', 'hero', 'controllable'])
  })

  it('creates a Tag with no tags', () => {
    const t = createTag()
    expect(t.type).toBe('Tag')
    expect(t.tags).toEqual([])
  })

  it('tags array is mutable', () => {
    const t = createTag('a')
    t.tags.push('b')
    expect(t.tags).toEqual(['a', 'b'])
  })

  it('type property is Tag', () => {
    const t = createTag('x')
    expect(t.type).toBe('Tag')
  })

  it('creates independent tag arrays', () => {
    const t1 = createTag('a')
    const t2 = createTag('b')
    t1.tags.push('c')
    expect(t2.tags).toEqual(['b'])
  })

  it('handles empty string tags', () => {
    const t = createTag('')
    expect(t.tags).toEqual([''])
  })

  it('handles duplicate tags', () => {
    const t = createTag('x', 'x', 'y')
    expect(t.tags).toEqual(['x', 'x', 'y'])
  })
})
