import { describe, it, expect, vi } from 'vitest'
import { definePlugin } from '../plugin'
import type { Plugin } from '../plugin'

describe('definePlugin', () => {
  it('returns the same plugin object', () => {
    const plugin: Plugin = {
      name: 'test',
      systems: [],
    }
    const result = definePlugin(plugin)
    expect(result).toBe(plugin)
  })

  it('preserves all plugin fields', () => {
    const onInit = vi.fn()
    const onDestroy = vi.fn()
    const system = { update: vi.fn() }

    const plugin = definePlugin({
      name: 'my-plugin',
      systems: [system],
      onInit,
      onDestroy,
      priority: 10,
      requires: ['other-plugin'],
    })

    expect(plugin.name).toBe('my-plugin')
    expect(plugin.systems).toEqual([system])
    expect(plugin.onInit).toBe(onInit)
    expect(plugin.onDestroy).toBe(onDestroy)
    expect(plugin.priority).toBe(10)
    expect(plugin.requires).toEqual(['other-plugin'])
  })

  it('allows omitting optional fields', () => {
    const plugin = definePlugin({
      name: 'minimal',
      systems: [],
    })
    expect(plugin.onInit).toBeUndefined()
    expect(plugin.onDestroy).toBeUndefined()
    expect(plugin.priority).toBeUndefined()
    expect(plugin.requires).toBeUndefined()
  })

  it('allows multiple systems', () => {
    const s1 = { update: vi.fn() }
    const s2 = { update: vi.fn() }
    const s3 = { update: vi.fn() }
    const plugin = definePlugin({
      name: 'multi',
      systems: [s1, s2, s3],
    })
    expect(plugin.systems).toHaveLength(3)
  })

  it('allows empty requires array', () => {
    const plugin = definePlugin({
      name: 'no-deps',
      systems: [],
      requires: [],
    })
    expect(plugin.requires).toEqual([])
  })

  it('allows negative priority', () => {
    const plugin = definePlugin({
      name: 'low-priority',
      systems: [],
      priority: -5,
    })
    expect(plugin.priority).toBe(-5)
  })

  it('allows zero priority', () => {
    const plugin = definePlugin({
      name: 'default-priority',
      systems: [],
      priority: 0,
    })
    expect(plugin.priority).toBe(0)
  })

  it('onInit receives engine argument', () => {
    const onInit = vi.fn()
    const plugin = definePlugin({
      name: 'init-test',
      systems: [],
      onInit,
    })
    const fakeEngine = { ecs: {} }
    plugin.onInit!(fakeEngine)
    expect(onInit).toHaveBeenCalledWith(fakeEngine)
  })

  it('onDestroy receives engine argument', () => {
    const onDestroy = vi.fn()
    const plugin = definePlugin({
      name: 'destroy-test',
      systems: [],
      onDestroy,
    })
    const fakeEngine = { ecs: {} }
    plugin.onDestroy!(fakeEngine)
    expect(onDestroy).toHaveBeenCalledWith(fakeEngine)
  })
})
