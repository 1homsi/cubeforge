import { describe, it, expect, beforeEach } from 'vitest'
import { ECSWorld } from '../ecs/world'
import { findByTag } from '../ecs/worldQueries'

describe('worldQueries', () => {
  let world: ECSWorld

  beforeEach(() => {
    world = new ECSWorld()
  })

  describe('findByTag', () => {
    it('returns empty array when no entities have tags', () => {
      const result = findByTag(world, 'player')
      expect(result).toEqual([])
    })

    it('returns entities matching the given tag', () => {
      const id = world.createEntity()
      world.addComponent(id, { type: 'Tag', tags: ['player'] })

      const result = findByTag(world, 'player')
      expect(result).toContain(id)
    })

    it('returns multiple entities with the same tag', () => {
      const a = world.createEntity()
      const b = world.createEntity()
      world.addComponent(a, { type: 'Tag', tags: ['enemy'] })
      world.addComponent(b, { type: 'Tag', tags: ['enemy'] })

      const result = findByTag(world, 'enemy')
      expect(result).toHaveLength(2)
      expect(result).toContain(a)
      expect(result).toContain(b)
    })

    it('does not return entities whose tags do not match', () => {
      const a = world.createEntity()
      const b = world.createEntity()
      world.addComponent(a, { type: 'Tag', tags: ['player'] })
      world.addComponent(b, { type: 'Tag', tags: ['enemy'] })

      const result = findByTag(world, 'player')
      expect(result).toContain(a)
      expect(result).not.toContain(b)
    })

    it('handles entities with multiple tags', () => {
      const id = world.createEntity()
      world.addComponent(id, { type: 'Tag', tags: ['enemy', 'boss', 'damageable'] })

      expect(findByTag(world, 'enemy')).toContain(id)
      expect(findByTag(world, 'boss')).toContain(id)
      expect(findByTag(world, 'damageable')).toContain(id)
      expect(findByTag(world, 'player')).not.toContain(id)
    })

    it('does not return entities without a Tag component', () => {
      const id = world.createEntity()
      world.addComponent(id, { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })

      const result = findByTag(world, 'anything')
      expect(result).not.toContain(id)
    })

    it('returns empty array after entity is destroyed', () => {
      const id = world.createEntity()
      world.addComponent(id, { type: 'Tag', tags: ['player'] })
      world.destroyEntity(id)

      expect(findByTag(world, 'player')).toEqual([])
    })

    it('does not return entity after tag component is removed', () => {
      const id = world.createEntity()
      world.addComponent(id, { type: 'Tag', tags: ['player'] })
      world.removeComponent(id, 'Tag')

      expect(findByTag(world, 'player')).not.toContain(id)
    })
  })

  describe('ECSWorld.findByTag (built-in)', () => {
    it('returns first entity with matching tag', () => {
      const id = world.createEntity()
      world.addComponent(id, { type: 'Tag', tags: ['goal'] })

      expect(world.findByTag('goal')).toBe(id)
    })

    it('returns undefined when no match', () => {
      expect(world.findByTag('ghost')).toBeUndefined()
    })

    it('findAllByTag returns all matching entities', () => {
      const a = world.createEntity()
      const b = world.createEntity()
      world.addComponent(a, { type: 'Tag', tags: ['coin'] })
      world.addComponent(b, { type: 'Tag', tags: ['coin'] })

      const result = world.findAllByTag('coin')
      expect(result).toHaveLength(2)
      expect(result).toContain(a)
      expect(result).toContain(b)
    })

    it('findAllByTag returns empty array when no match', () => {
      expect(world.findAllByTag('invisible')).toEqual([])
    })
  })
})
