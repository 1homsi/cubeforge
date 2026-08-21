/**
 * VERBATIM copy of the pre-optimization ECSWorld implementation.
 * Used ONLY as a benchmark reference — do not import from engine code.
 */
export type EntityId = number

export interface Component {
  readonly type: string
}

export interface System {
  update(world: RefWorld, dt: number): void
}

export interface WorldSnapshot {
  nextId: number
  rngState: number
  entities: Array<{ id: EntityId; components: Component[] }>
}

function _valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((value, index) => _valuesEqual(value, b[index]))
  }
  const recordA = a as Record<string, unknown>
  const recordB = b as Record<string, unknown>
  const keysA = Object.keys(recordA)
  if (keysA.length !== Object.keys(recordB).length) return false
  return keysA.every(
    (key) => Object.prototype.hasOwnProperty.call(recordB, key) && _valuesEqual(recordA[key], recordB[key]),
  )
}

function _componentsChanged(a: Component[], b: Component[]): boolean {
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    const ca = a[i] as unknown as Record<string, unknown>
    const cb = b[i] as unknown as Record<string, unknown>
    if (ca['type'] !== cb['type']) return true
    const keysA = Object.keys(ca)
    if (keysA.length !== Object.keys(cb).length) return true
    for (const k of keysA) {
      if (!_valuesEqual(ca[k], cb[k])) return true
    }
  }
  return false
}

interface Archetype {
  readonly key: string
  readonly types: ReadonlySet<string>
  entities: EntityId[]
}

export class RefWorld {
  private nextId = 0
  private componentIndex = new Map<EntityId, Map<string, Component>>()
  private _rngState = 0
  private _deterministic = false
  assets!: { getImage(src: string): HTMLImageElement | undefined; loadImage(src: string): Promise<HTMLImageElement> }
  private archetypes = new Map<string, Archetype>()
  private entityArchetype = new Map<EntityId, string>()
  private systems: System[] = []
  private queryCache = new Map<string, EntityId[]>()
  private dirtyTypes = new Set<string>()
  private dirtyAll = false

  private getOrCreateArchetype(types: Iterable<string>): Archetype {
    const arr = [...types].sort()
    const key = arr.join('\x00')
    let arch = this.archetypes.get(key)
    if (!arch) {
      arch = { key, types: new Set(arr), entities: [] }
      this.archetypes.set(key, arch)
    }
    return arch
  }

  private moveToArchetype(id: EntityId, newArch: Archetype): void {
    const oldKey = this.entityArchetype.get(id)
    if (oldKey !== undefined) {
      const oldArch = this.archetypes.get(oldKey)
      if (oldArch) {
        const idx = oldArch.entities.indexOf(id)
        if (idx !== -1) oldArch.entities.splice(idx, 1)
      }
    }
    newArch.entities.push(id)
    this.entityArchetype.set(id, newArch.key)
  }

  createEntity(): EntityId {
    const id = this.nextId++
    this.componentIndex.set(id, new Map())
    const emptyArch = this.getOrCreateArchetype([])
    emptyArch.entities.push(id)
    this.entityArchetype.set(id, emptyArch.key)
    this.dirtyAll = true
    return id
  }

  destroyEntity(id: EntityId): void {
    if (!this.componentIndex.has(id)) return
    const comps = this.componentIndex.get(id)
    if (comps) {
      for (const type of comps.keys()) this.dirtyTypes.add(type)
    }
    const archKey = this.entityArchetype.get(id)
    if (archKey !== undefined) {
      const arch = this.archetypes.get(archKey)
      if (arch) {
        const idx = arch.entities.indexOf(id)
        if (idx !== -1) arch.entities.splice(idx, 1)
      }
    }
    this.componentIndex.delete(id)
    this.entityArchetype.delete(id)
    this.dirtyAll = true
  }

  hasEntity(id: EntityId): boolean {
    return this.componentIndex.has(id)
  }

  addComponent<T extends Component>(id: EntityId, component: T): void {
    const comps = this.componentIndex.get(id)
    if (!comps) return
    comps.set(component.type, component)
    this.dirtyTypes.add(component.type)
    const newArch = this.getOrCreateArchetype(comps.keys())
    this.moveToArchetype(id, newArch)
  }

  removeComponent(id: EntityId, type: string): void {
    const comps = this.componentIndex.get(id)
    if (!comps) return
    comps.delete(type)
    this.dirtyTypes.add(type)
    const newArch = this.getOrCreateArchetype(comps.keys())
    this.moveToArchetype(id, newArch)
  }

  getComponent<T extends Component>(id: EntityId, type: string): T | undefined {
    return this.componentIndex.get(id)?.get(type) as T | undefined
  }

  hasComponent(id: EntityId, type: string): boolean {
    return this.componentIndex.get(id)?.has(type) ?? false
  }

  getAllEntityIds(): EntityId[] {
    return [...this.componentIndex.keys()]
  }

  private flushDirty(): void {
    if (this.dirtyAll) {
      this.queryCache.clear()
      this.dirtyAll = false
      this.dirtyTypes.clear()
    } else if (this.dirtyTypes.size > 0) {
      for (const key of this.queryCache.keys()) {
        if (key === '') {
          this.queryCache.delete(key)
          continue
        }
        const keyTypes = key.split('\x00')
        if (keyTypes.some((t) => this.dirtyTypes.has(t))) {
          this.queryCache.delete(key)
        }
      }
      this.dirtyTypes.clear()
    }
  }

  query(...types: string[]): EntityId[] {
    this.flushDirty()
    const key = types.length === 0 ? '' : types.length === 1 ? types[0] : types.sort().join('\x00')
    const cached = this.queryCache.get(key)
    if (cached) return cached
    const result: EntityId[] = []
    for (const arch of this.archetypes.values()) {
      if (types.every((t) => arch.types.has(t))) {
        for (const id of arch.entities) result.push(id)
      }
    }
    this.queryCache.set(key, result)
    return result
  }

  queryOne(...types: string[]): EntityId | undefined {
    this.flushDirty()
    for (const arch of this.archetypes.values()) {
      if (types.every((t) => arch.types.has(t))) {
        if (arch.entities.length > 0) return arch.entities[0]
      }
    }
    return undefined
  }

  get entityCount(): number {
    return this.componentIndex.size
  }

  getSnapshot(): WorldSnapshot {
    const entities: WorldSnapshot['entities'] = []
    for (const [id, comps] of this.componentIndex) {
      const components: Component[] = []
      for (const comp of comps.values()) {
        components.push(JSON.parse(JSON.stringify(comp)) as Component)
      }
      entities.push({ id, components })
    }
    return { nextId: this.nextId, rngState: this._rngState, entities }
  }
}
