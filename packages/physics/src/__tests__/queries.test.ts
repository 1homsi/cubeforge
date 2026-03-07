import { describe, it, expect } from 'bun:test'
import { ECSWorld, createTransform, findByTag, createTag } from '@cubeforge/core'
import { createBoxCollider } from '../components/boxCollider'
import { overlapBox, raycast } from '../queries'

function addCollider(world: ECSWorld, x: number, y: number, w: number, h: number, opts?: Parameters<typeof createBoxCollider>[2]) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createBoxCollider(w, h, opts))
  return id
}

// ── findByTag ─────────────────────────────────────────────────────────────────

describe('findByTag', () => {
  it('returns entities with matching tag', () => {
    const world = new ECSWorld()
    const a = world.createEntity()
    world.addComponent(a, createTag('enemy'))
    const b = world.createEntity()
    world.addComponent(b, createTag('player'))
    const c = world.createEntity()
    world.addComponent(c, createTag('enemy'))

    const enemies = findByTag(world, 'enemy')
    expect(enemies).toContain(a)
    expect(enemies).toContain(c)
    expect(enemies).not.toContain(b)
  })

  it('returns empty array when no matches', () => {
    const world = new ECSWorld()
    expect(findByTag(world, 'ghost')).toEqual([])
  })
})

// ── overlapBox ────────────────────────────────────────────────────────────────

describe('overlapBox', () => {
  it('returns entities overlapping the test box', () => {
    const world = new ECSWorld()
    const a = addCollider(world, 0, 0, 20, 20)    // center 0,0 — overlaps test box at origin
    const b = addCollider(world, 100, 100, 20, 20) // far away

    const hits = overlapBox(world, 0, 0, 20, 20)
    expect(hits).toContain(a)
    expect(hits).not.toContain(b)
  })

  it('returns empty when nothing overlaps', () => {
    const world = new ECSWorld()
    addCollider(world, 200, 200, 10, 10)
    expect(overlapBox(world, 0, 0, 5, 5)).toEqual([])
  })

  it('filters by tag', () => {
    const world = new ECSWorld()
    const a = addCollider(world, 0, 0, 20, 20)
    world.addComponent(a, createTag('enemy'))

    const b = addCollider(world, 0, 0, 20, 20)
    world.addComponent(b, createTag('wall'))

    const hits = overlapBox(world, 0, 0, 20, 20, { tag: 'enemy' })
    expect(hits).toContain(a)
    expect(hits).not.toContain(b)
  })

  it('filters by layer', () => {
    const world = new ECSWorld()
    const a = addCollider(world, 0, 0, 20, 20, { layer: 'solid' })
    const b = addCollider(world, 0, 0, 20, 20, { layer: 'trigger' })

    const hits = overlapBox(world, 0, 0, 20, 20, { layer: 'solid' })
    expect(hits).toContain(a)
    expect(hits).not.toContain(b)
  })

  it('excludes specified entities', () => {
    const world = new ECSWorld()
    const a = addCollider(world, 0, 0, 20, 20)
    const b = addCollider(world, 0, 0, 20, 20)

    const hits = overlapBox(world, 0, 0, 20, 20, { exclude: [a] })
    expect(hits).not.toContain(a)
    expect(hits).toContain(b)
  })
})

// ── raycast ───────────────────────────────────────────────────────────────────

describe('raycast', () => {
  it('returns null when nothing is hit', () => {
    const world = new ECSWorld()
    addCollider(world, 1000, 1000, 20, 20)
    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 200)
    expect(hit).toBeNull()
  })

  it('returns hit when ray intersects a collider', () => {
    const world = new ECSWorld()
    const wall = addCollider(world, 100, 0, 20, 40)
    // Ray from left, shooting right
    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 200)
    expect(hit).not.toBeNull()
    expect(hit!.entityId).toBe(wall)
  })

  it('returns null when ray is too short to reach the collider', () => {
    const world = new ECSWorld()
    addCollider(world, 200, 0, 20, 20)
    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 50)
    expect(hit).toBeNull()
  })

  it('returns the closest of multiple hits', () => {
    const world = new ECSWorld()
    const near = addCollider(world, 50, 0, 10, 40)
    addCollider(world, 150, 0, 10, 40)

    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 300)
    expect(hit!.entityId).toBe(near)
  })

  it('skips trigger colliders by default', () => {
    const world = new ECSWorld()
    addCollider(world, 50, 0, 20, 40, { isTrigger: true })
    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 200)
    expect(hit).toBeNull()
  })

  it('includes triggers when includeTriggers is true', () => {
    const world = new ECSWorld()
    const trigger = addCollider(world, 50, 0, 20, 40, { isTrigger: true })
    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 200, { includeTriggers: true })
    expect(hit!.entityId).toBe(trigger)
  })

  it('hit distance is approximately correct', () => {
    const world = new ECSWorld()
    // Wall centered at x=100, half-width=10, so left edge at x=90
    addCollider(world, 100, 0, 20, 40)
    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 200)
    expect(hit!.distance).toBeCloseTo(90, 0)
  })

  it('returns left-face normal for ray hitting right side of box', () => {
    const world = new ECSWorld()
    addCollider(world, 100, 0, 20, 40)
    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 200)
    // Ray enters through left face: normal points left (-1, 0)
    expect(hit!.normal.x).toBe(-1)
    expect(hit!.normal.y).toBe(0)
  })

  it('filters by tag', () => {
    const world = new ECSWorld()
    const wall = addCollider(world, 100, 0, 20, 40)
    world.addComponent(wall, createTag('wall'))

    const ghost = addCollider(world, 60, 0, 20, 40)
    world.addComponent(ghost, createTag('ghost'))

    const hit = raycast(world, { x: 0, y: 0 }, { x: 1, y: 0 }, 300, { tag: 'wall' })
    expect(hit!.entityId).toBe(wall)
  })
})
