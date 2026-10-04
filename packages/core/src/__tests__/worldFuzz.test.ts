import { describe, it, expect } from 'vitest'
import { ECSWorld } from '../ecs/world'
import type { Component, EntityId } from '../ecs/world'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TYPES = ['A', 'B', 'C', 'D', 'E']
type Model = Map<EntityId, Map<string, number>>
interface V extends Component {
  v: number
}

function run(seed: number, steps: number) {
  const r = rng(seed)
  const int = (n: number) => Math.floor(r() * n)
  const w = new ECSWorld()
  const model: Model = new Map()
  const everIssued: EntityId[] = []
  const issued = new Set<EntityId>()
  let counter = 0

  const pickAny = (): EntityId | undefined =>
    everIssued.length ? everIssued[int(everIssued.length)] : undefined
  const pickLive = (): EntityId | undefined => {
    if (!model.size) return undefined
    const ids = [...model.keys()]
    return ids[int(ids.length)]
  }
  const randTypes = () => TYPES.filter(() => r() < 0.4)

  const destroy = (id: EntityId) => {
    w.destroyEntity(id)
    model.delete(id)
  }
  const add = (id: EntityId, t: string) => {
    const v = counter++
    w.addComponent(id, { type: t, v } as V)
    model.get(id)?.set(t, v)
  }
  const remove = (id: EntityId, t: string) => {
    w.removeComponent(id, t)
    model.get(id)?.delete(t)
  }
  const expected = (types: string[]) =>
    [...model.entries()].filter(([, c]) => types.every((t) => c.has(t))).map(([id]) => id)

  const check = (id: EntityId) => {
    const c = model.get(id)
    expect(w.hasEntity(id)).toBe(!!c)
    for (const t of TYPES) {
      expect(w.hasComponent(id, t)).toBe(!!c?.has(t))
      expect(w.getComponent<V>(id, t)?.v).toBe(c?.get(t))
    }
  }

  const mutate = () => {
    const op = int(10)
    if (op < 3) {
      const id = w.createEntity()
      expect(model.has(id)).toBe(false)
      expect(issued.has(id)).toBe(false)
      issued.add(id)
      everIssued.push(id)
      model.set(id, new Map())
      for (const t of randTypes()) add(id, t)
    } else if (op < 6) {
      const id = r() < 0.2 ? pickAny() : pickLive()
      if (id !== undefined) destroy(id)
    } else if (op < 8) {
      const id = r() < 0.1 ? pickAny() : pickLive()
      if (id !== undefined) add(id, TYPES[int(TYPES.length)])
    } else {
      const id = r() < 0.1 ? pickAny() : pickLive()
      if (id !== undefined) remove(id, TYPES[int(TYPES.length)])
    }
  }

  w.addSystem({
    update(world) {
      for (const id of world.query('A')) {
        if (r() < 0.05) destroy(id)
        else if (r() < 0.05) add(id, 'E')
        else if (r() < 0.05) remove(id, 'A')
        else if (model.has(id)) expect(world.getComponent<V>(id, 'A')?.v).toBe(model.get(id)!.get('A'))
      }
      if (r() < 0.3) {
        const id = world.createEntity()
        everIssued.push(id)
        model.set(id, new Map())
        add(id, 'A')
      }
    },
  })

  for (let step = 0; step < steps; step++) {
    const kind = int(20)
    if (kind < 14) mutate()
    else if (kind < 17) {
      const types = randTypes()
      const got = w.query(...types)
      expect(new Set(got).size).toBe(got.length)
      expect([...got].sort((a, b) => a - b)).toEqual(expected(types).sort((a, b) => a - b))
      const one = w.queryOne(...types)
      if (got.length) expect(got).toContain(one)
      else expect(one).toBeUndefined()
      for (const id of got) {
        if (r() < 0.1) mutate()
        if (r() < 0.1) destroy(id)
        check(id)
      }
    } else if (kind < 19) {
      w.update(1 / 60)
    } else {
      const id = pickAny()
      if (id !== undefined) check(id)
    }
    if (step % 997 === 0) {
      expect(w.entityCount).toBe(model.size)
      expect([...w.getAllEntityIds()].sort((a, b) => a - b)).toEqual([...model.keys()].sort((a, b) => a - b))
      for (const id of everIssued) check(id)
    }
  }
  for (const id of everIssued) check(id)
}

describe('ECSWorld fuzz against a model', () => {
  for (const seed of [1, 2, 3, 42, 1337, 9001, 31337, 777]) {
    it(`seed ${seed}`, () => run(seed, 4000))
  }
})
