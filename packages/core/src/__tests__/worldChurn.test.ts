import { describe, it, expect } from 'vitest'
import { ECSWorld } from '../ecs/world'
import type { Component } from '../ecs/world'

interface Pos extends Component {
  type: 'Pos'
  v: number
}
interface Tag extends Component {
  type: 'Tag2'
  v: number
}
const pos = (v: number): Pos => ({ type: 'Pos', v })
const tag = (v: number): Tag => ({ type: 'Tag2', v })

describe('ECSWorld entity churn', () => {
  it('keeps every other entity readable after destroying the first one', () => {
    const w = new ECSWorld()
    const ids = Array.from({ length: 5 }, (_, i) => {
      const e = w.createEntity()
      w.addComponent(e, pos(i))
      return e
    })
    w.destroyEntity(ids[0])
    for (let i = 1; i < 5; i++) expect(w.getComponent<Pos>(ids[i], 'Pos')?.v).toBe(i)
  })

  it('re-homes every component type of the entity moved into the freed slot', () => {
    const w = new ECSWorld()
    const a = w.createEntity()
    const b = w.createEntity()
    const c = w.createEntity()
    w.addComponent(a, pos(1))
    w.addComponent(b, pos(2))
    w.addComponent(c, pos(3))
    w.addComponent(c, tag(30))
    w.destroyEntity(a)
    expect(w.getComponent<Pos>(c, 'Pos')?.v).toBe(3)
    expect(w.getComponent<Tag>(c, 'Tag2')?.v).toBe(30)
    expect(w.hasComponent(c, 'Tag2')).toBe(true)
    expect(w.getComponent<Pos>(b, 'Pos')?.v).toBe(2)
    expect(
      w
        .getEntityComponents(c)
        .map((x) => x.type)
        .sort(),
    ).toEqual(['Pos', 'Tag2'])
  })

  it('does not leak a destroyed entity components into the entity created next', () => {
    const w = new ECSWorld()
    const a = w.createEntity()
    const b = w.createEntity()
    w.addComponent(a, pos(1))
    w.addComponent(b, pos(2))
    w.addComponent(b, tag(20))
    w.destroyEntity(a) // b moves into a's slot, its old slot becomes free
    const fresh = w.createEntity() // takes the freed slot
    expect(w.hasComponent(fresh, 'Pos')).toBe(false)
    expect(w.hasComponent(fresh, 'Tag2')).toBe(false)
    expect(w.getComponent(fresh, 'Pos')).toBeUndefined()
    w.addComponent(fresh, pos(9))
    expect(w.getComponent<Pos>(fresh, 'Pos')?.v).toBe(9)
    expect(w.getComponent<Pos>(b, 'Pos')?.v).toBe(2)
    expect(w.getComponent<Tag>(b, 'Tag2')?.v).toBe(20)
  })

  it('supports removeComponent on an entity that was relocated by a destroy', () => {
    const w = new ECSWorld()
    const a = w.createEntity()
    const b = w.createEntity()
    w.addComponent(a, pos(1))
    w.addComponent(b, pos(2))
    w.addComponent(b, tag(20))
    w.destroyEntity(a)
    w.removeComponent(b, 'Pos')
    expect(w.hasComponent(b, 'Pos')).toBe(false)
    expect(w.getComponent<Tag>(b, 'Tag2')?.v).toBe(20)
    expect(w.query('Pos')).toEqual([])
    expect(w.query('Tag2')).toEqual([b])
  })

  it('matches a reference model under heavy randomized create/destroy/add/remove churn', () => {
    const w = new ECSWorld()
    // Reference model: id -> { Pos?: n, Tag2?: n }
    const model = new Map<number, { Pos?: number; Tag2?: number }>()
    let seed = 987654321
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    const check = () => {
      expect(w.entityCount).toBe(model.size)
      for (const [id, comps] of model) {
        expect(w.getComponent<Pos>(id, 'Pos')?.v).toBe(comps.Pos)
        expect(w.getComponent<Tag>(id, 'Tag2')?.v).toBe(comps.Tag2)
      }
      const expectPos = [...model].filter(([, c]) => c.Pos !== undefined).map(([id]) => id)
      const expectBoth = [...model].filter(([, c]) => c.Pos !== undefined && c.Tag2 !== undefined).map(([id]) => id)
      expect([...w.query('Pos')].sort((x, y) => x - y)).toEqual(expectPos.sort((x, y) => x - y))
      expect([...w.query('Pos', 'Tag2')].sort((x, y) => x - y)).toEqual(expectBoth.sort((x, y) => x - y))
    }

    for (let step = 0; step < 4000; step++) {
      const ids = [...model.keys()]
      const r = rnd()
      if (r < 0.35 || ids.length === 0) {
        const id = w.createEntity()
        const comps: { Pos?: number; Tag2?: number } = {}
        if (rnd() < 0.8) {
          comps.Pos = step
          w.addComponent(id, pos(step))
        }
        if (rnd() < 0.5) {
          comps.Tag2 = -step
          w.addComponent(id, tag(-step))
        }
        model.set(id, comps)
      } else if (r < 0.65) {
        const id = ids[(rnd() * ids.length) | 0]
        w.destroyEntity(id)
        model.delete(id)
      } else if (r < 0.85) {
        const id = ids[(rnd() * ids.length) | 0]
        const comps = model.get(id)!
        if (comps.Tag2 === undefined) {
          comps.Tag2 = step
          w.addComponent(id, tag(step))
        } else {
          delete comps.Tag2
          w.removeComponent(id, 'Tag2')
        }
      } else {
        const id = ids[(rnd() * ids.length) | 0]
        const comps = model.get(id)!
        if (comps.Pos === undefined) {
          comps.Pos = step
          w.addComponent(id, pos(step))
        } else {
          delete comps.Pos
          w.removeComponent(id, 'Pos')
        }
      }
      if (step % 50 === 0) check()
    }
    check()
  })

  it('survives a snapshot round-trip after churn', () => {
    const w = new ECSWorld()
    const ids = Array.from({ length: 20 }, (_, i) => {
      const e = w.createEntity()
      w.addComponent(e, pos(i))
      return e
    })
    for (const id of ids.filter((_, i) => i % 3 === 0)) w.destroyEntity(id)
    const snap = w.getSnapshot()
    const w2 = new ECSWorld()
    w2.restoreSnapshot(snap)
    for (const id of ids.filter((_, i) => i % 3 !== 0)) {
      expect(w2.getComponent<Pos>(id, 'Pos')?.v).toBe(w.getComponent<Pos>(id, 'Pos')?.v)
    }
  })
})

describe('ECSWorld query cache', () => {
  it('caches empty multi-type results and invalidates them when the type appears', () => {
    const w = new ECSWorld()
    const e = w.createEntity()
    w.addComponent(e, pos(1))
    const first = w.query('Pos', 'Tag2')
    expect(first).toEqual([])
    expect(w.query('Tag2', 'Pos')).toBe(first)
    w.addComponent(e, tag(5))
    expect(w.query('Pos', 'Tag2')).toEqual([e])
    expect(w.query('Tag2', 'Pos', 'Missing')).toEqual([])
  })
})
