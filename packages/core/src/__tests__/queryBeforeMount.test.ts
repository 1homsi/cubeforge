import { describe, expect, it } from 'vitest'
import { ECSWorld } from '../ecs/world'

describe('queries before components mount', () => {
  it('discovers components registered after an empty multi-component query', () => {
    const world = new ECSWorld()
    expect(world.query('Transform', 'Sprite')).toEqual([])
    const id = world.createEntity()
    world.addComponent(id, { type: 'Transform' })
    expect(world.query('Transform', 'Sprite')).toEqual([])
    world.addComponent(id, { type: 'Sprite' })
    expect(world.query('Transform', 'Sprite')).toEqual([id])
    world.removeComponent(id, 'Sprite')
    expect(world.query('Transform', 'Sprite')).toEqual([])
    world.addComponent(id, { type: 'Sprite' })
    expect(world.query('Transform', 'Sprite')).toEqual([id])
  })
})
