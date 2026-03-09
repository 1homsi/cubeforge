import { describe, it, expect, beforeEach } from 'vitest'
import { ECSWorld } from '../ecs/world'
import { createHierarchy, setParent, removeParent, getDescendants } from '../ecs/hierarchy'
import type { HierarchyComponent } from '../ecs/hierarchy'
import { HierarchySystem, type WorldTransformComponent } from '../ecs/hierarchySystem'
import { createTransform } from '../components/transform'

describe('Hierarchy', () => {
  let world: ECSWorld

  beforeEach(() => {
    world = new ECSWorld()
  })

  describe('createHierarchy', () => {
    it('creates a hierarchy component with no parent by default', () => {
      const h = createHierarchy()
      expect(h.type).toBe('Hierarchy')
      expect(h.parent).toBeNull()
      expect(h.children).toEqual([])
    })

    it('creates a hierarchy component with a specified parent', () => {
      const h = createHierarchy(42)
      expect(h.parent).toBe(42)
      expect(h.children).toEqual([])
    })
  })

  describe('setParent / removeParent', () => {
    it('correctly updates both parent and child', () => {
      const parent = world.createEntity()
      const child = world.createEntity()

      setParent(world, child, parent)

      const parentH = world.getComponent<HierarchyComponent>(parent, 'Hierarchy')!
      const childH = world.getComponent<HierarchyComponent>(child, 'Hierarchy')!

      expect(childH.parent).toBe(parent)
      expect(parentH.children).toContain(child)
    })

    it('creates Hierarchy components if they do not exist', () => {
      const parent = world.createEntity()
      const child = world.createEntity()

      expect(world.hasComponent(parent, 'Hierarchy')).toBe(false)
      expect(world.hasComponent(child, 'Hierarchy')).toBe(false)

      setParent(world, child, parent)

      expect(world.hasComponent(parent, 'Hierarchy')).toBe(true)
      expect(world.hasComponent(child, 'Hierarchy')).toBe(true)
    })

    it('removes child from old parent when reparenting', () => {
      const parent1 = world.createEntity()
      const parent2 = world.createEntity()
      const child = world.createEntity()

      setParent(world, child, parent1)
      setParent(world, child, parent2)

      const p1H = world.getComponent<HierarchyComponent>(parent1, 'Hierarchy')!
      const p2H = world.getComponent<HierarchyComponent>(parent2, 'Hierarchy')!
      const childH = world.getComponent<HierarchyComponent>(child, 'Hierarchy')!

      expect(p1H.children).not.toContain(child)
      expect(p2H.children).toContain(child)
      expect(childH.parent).toBe(parent2)
    })

    it('does not add duplicate children', () => {
      const parent = world.createEntity()
      const child = world.createEntity()

      setParent(world, child, parent)
      setParent(world, child, parent)

      const parentH = world.getComponent<HierarchyComponent>(parent, 'Hierarchy')!
      expect(parentH.children.filter((c) => c === child)).toHaveLength(1)
    })

    it('removeParent clears the relationship', () => {
      const parent = world.createEntity()
      const child = world.createEntity()

      setParent(world, child, parent)
      removeParent(world, child)

      const parentH = world.getComponent<HierarchyComponent>(parent, 'Hierarchy')!
      const childH = world.getComponent<HierarchyComponent>(child, 'Hierarchy')!

      expect(childH.parent).toBeNull()
      expect(parentH.children).not.toContain(child)
    })

    it('removeParent is a no-op when child has no parent', () => {
      const child = world.createEntity()
      world.addComponent(child, createHierarchy())

      // Should not throw
      removeParent(world, child)

      const childH = world.getComponent<HierarchyComponent>(child, 'Hierarchy')!
      expect(childH.parent).toBeNull()
    })

    it('removeParent is a no-op when child has no Hierarchy component', () => {
      const child = world.createEntity()

      // Should not throw
      removeParent(world, child)
    })
  })

  describe('getDescendants', () => {
    it('returns empty array for entity with no children', () => {
      const entity = world.createEntity()
      world.addComponent(entity, createHierarchy())

      expect(getDescendants(world, entity)).toEqual([])
    })

    it('returns direct children', () => {
      const parent = world.createEntity()
      const child1 = world.createEntity()
      const child2 = world.createEntity()

      setParent(world, child1, parent)
      setParent(world, child2, parent)

      const descendants = getDescendants(world, parent)
      expect(descendants).toContain(child1)
      expect(descendants).toContain(child2)
      expect(descendants).toHaveLength(2)
    })

    it('returns nested descendants (grandchildren)', () => {
      const grandparent = world.createEntity()
      const parent = world.createEntity()
      const child = world.createEntity()

      setParent(world, parent, grandparent)
      setParent(world, child, parent)

      const descendants = getDescendants(world, grandparent)
      expect(descendants).toContain(parent)
      expect(descendants).toContain(child)
      expect(descendants).toHaveLength(2)
    })

    it('returns correct tree for complex hierarchy', () => {
      //       root
      //      /    \
      //     a      b
      //    / \
      //   c   d
      const root = world.createEntity()
      const a = world.createEntity()
      const b = world.createEntity()
      const c = world.createEntity()
      const d = world.createEntity()

      setParent(world, a, root)
      setParent(world, b, root)
      setParent(world, c, a)
      setParent(world, d, a)

      const descendants = getDescendants(world, root)
      expect(descendants).toContain(a)
      expect(descendants).toContain(b)
      expect(descendants).toContain(c)
      expect(descendants).toContain(d)
      expect(descendants).toHaveLength(4)

      const aDescendants = getDescendants(world, a)
      expect(aDescendants).toContain(c)
      expect(aDescendants).toContain(d)
      expect(aDescendants).toHaveLength(2)

      expect(getDescendants(world, b)).toHaveLength(0)
    })

    it('returns empty for entity without Hierarchy component', () => {
      const entity = world.createEntity()
      expect(getDescendants(world, entity)).toEqual([])
    })
  })
})

describe('HierarchySystem', () => {
  let world: ECSWorld
  let system: HierarchySystem

  beforeEach(() => {
    world = new ECSWorld()
    system = new HierarchySystem()
  })

  it('sets WorldTransform equal to Transform for root entities', () => {
    const entity = world.createEntity()
    world.addComponent(entity, createTransform(100, 200, 0.5, 2, 3))
    world.addComponent(entity, createHierarchy())

    system.update(world, 0)

    const wt = world.getComponent<WorldTransformComponent>(entity, 'WorldTransform')!
    expect(wt).toBeDefined()
    expect(wt.x).toBe(100)
    expect(wt.y).toBe(200)
    expect(wt.rotation).toBe(0.5)
    expect(wt.scaleX).toBe(2)
    expect(wt.scaleY).toBe(3)
  })

  it('composes child transform with parent transform (no rotation)', () => {
    const parent = world.createEntity()
    world.addComponent(parent, createTransform(100, 200))
    world.addComponent(parent, createHierarchy())

    const child = world.createEntity()
    world.addComponent(child, createTransform(20, -10))
    setParent(world, child, parent)

    system.update(world, 0)

    const wt = world.getComponent<WorldTransformComponent>(child, 'WorldTransform')!
    expect(wt.x).toBeCloseTo(120)
    expect(wt.y).toBeCloseTo(190)
    expect(wt.rotation).toBeCloseTo(0)
    expect(wt.scaleX).toBeCloseTo(1)
    expect(wt.scaleY).toBeCloseTo(1)
  })

  it('composes child transform with parent rotation', () => {
    const parent = world.createEntity()
    world.addComponent(parent, createTransform(0, 0, Math.PI / 2)) // 90 degrees
    world.addComponent(parent, createHierarchy())

    const child = world.createEntity()
    world.addComponent(child, createTransform(10, 0))
    setParent(world, child, parent)

    system.update(world, 0)

    const wt = world.getComponent<WorldTransformComponent>(child, 'WorldTransform')!
    // Rotated 90 degrees: (10, 0) -> (0, 10)
    expect(wt.x).toBeCloseTo(0, 5)
    expect(wt.y).toBeCloseTo(10, 5)
    expect(wt.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('composes child transform with parent scale', () => {
    const parent = world.createEntity()
    world.addComponent(parent, createTransform(0, 0, 0, 2, 3))
    world.addComponent(parent, createHierarchy())

    const child = world.createEntity()
    world.addComponent(child, createTransform(10, 5))
    setParent(world, child, parent)

    system.update(world, 0)

    const wt = world.getComponent<WorldTransformComponent>(child, 'WorldTransform')!
    expect(wt.x).toBeCloseTo(20) // 10 * 2
    expect(wt.y).toBeCloseTo(15) // 5 * 3
    expect(wt.scaleX).toBeCloseTo(2)
    expect(wt.scaleY).toBeCloseTo(3)
  })

  it('handles nested hierarchy (grandparent -> parent -> child)', () => {
    const gp = world.createEntity()
    world.addComponent(gp, createTransform(100, 100))
    world.addComponent(gp, createHierarchy())

    const p = world.createEntity()
    world.addComponent(p, createTransform(50, 0))
    setParent(world, p, gp)

    const c = world.createEntity()
    world.addComponent(c, createTransform(10, 0))
    setParent(world, c, p)

    system.update(world, 0)

    const gpWt = world.getComponent<WorldTransformComponent>(gp, 'WorldTransform')!
    expect(gpWt.x).toBeCloseTo(100)
    expect(gpWt.y).toBeCloseTo(100)

    const pWt = world.getComponent<WorldTransformComponent>(p, 'WorldTransform')!
    expect(pWt.x).toBeCloseTo(150)
    expect(pWt.y).toBeCloseTo(100)

    const cWt = world.getComponent<WorldTransformComponent>(c, 'WorldTransform')!
    expect(cWt.x).toBeCloseTo(160)
    expect(cWt.y).toBeCloseTo(100)
  })

  it('handles nested hierarchy with rotation and scale', () => {
    const parent = world.createEntity()
    world.addComponent(parent, createTransform(0, 0, Math.PI / 2, 2, 2))
    world.addComponent(parent, createHierarchy())

    const child = world.createEntity()
    world.addComponent(child, createTransform(5, 0, Math.PI / 4, 0.5, 0.5))
    setParent(world, child, parent)

    system.update(world, 0)

    const wt = world.getComponent<WorldTransformComponent>(child, 'WorldTransform')!
    // Parent rotated 90 degrees with scale 2: (5,0) -> (0, 10)
    expect(wt.x).toBeCloseTo(0, 5)
    expect(wt.y).toBeCloseTo(10, 5)
    expect(wt.rotation).toBeCloseTo(Math.PI / 2 + Math.PI / 4)
    expect(wt.scaleX).toBeCloseTo(1)
    expect(wt.scaleY).toBeCloseTo(1)
  })

  it('orphaned child after removeParent gets root-like WorldTransform', () => {
    const parent = world.createEntity()
    world.addComponent(parent, createTransform(100, 100))
    world.addComponent(parent, createHierarchy())

    const child = world.createEntity()
    world.addComponent(child, createTransform(20, 30))
    setParent(world, child, parent)

    system.update(world, 0)
    let wt = world.getComponent<WorldTransformComponent>(child, 'WorldTransform')!
    expect(wt.x).toBeCloseTo(120)
    expect(wt.y).toBeCloseTo(130)

    // Remove parent — child becomes a root
    removeParent(world, child)
    system.update(world, 0)

    wt = world.getComponent<WorldTransformComponent>(child, 'WorldTransform')!
    expect(wt.x).toBeCloseTo(20)
    expect(wt.y).toBeCloseTo(30)
  })

  it('does nothing when no entities have Hierarchy + Transform', () => {
    const entity = world.createEntity()
    world.addComponent(entity, createTransform(10, 20))
    // No Hierarchy component

    system.update(world, 0)

    expect(world.hasComponent(entity, 'WorldTransform')).toBe(false)
  })
})
