export type EntityId = number

export interface Component {
  readonly type: string
}

export interface System {
  update(world: ECSWorld, dt: number): void
}

export class ECSWorld {
  private nextId = 0
  private entities = new Set<EntityId>()
  private components = new Map<EntityId, Map<string, Component>>()
  private systems: System[] = []
  private queryCache = new Map<string, EntityId[]>()
  // Component types modified since last update() — drives selective cache invalidation
  private dirtyTypes = new Set<string>()
  // Set when entity count changes (createEntity/destroyEntity) — forces full cache clear
  private dirtyAll = false

  createEntity(): EntityId {
    const id = this.nextId++
    this.entities.add(id)
    this.components.set(id, new Map())
    this.dirtyAll = true
    return id
  }

  destroyEntity(id: EntityId): void {
    const comps = this.components.get(id)
    if (comps) {
      for (const type of comps.keys()) {
        this.dirtyTypes.add(type)
      }
    }
    this.entities.delete(id)
    this.components.delete(id)
    this.dirtyAll = true
  }

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id)
  }

  addComponent<T extends Component>(id: EntityId, component: T): void {
    this.components.get(id)?.set(component.type, component)
    this.dirtyTypes.add(component.type)
  }

  removeComponent(id: EntityId, type: string): void {
    this.components.get(id)?.delete(type)
    this.dirtyTypes.add(type)
  }

  getComponent<T extends Component>(id: EntityId, type: string): T | undefined {
    return this.components.get(id)?.get(type) as T | undefined
  }

  hasComponent(id: EntityId, type: string): boolean {
    return this.components.get(id)?.has(type) ?? false
  }

  // Returns all entities that have ALL of the given component types
  query(...types: string[]): EntityId[] {
    const key = types.slice().sort().join('\x00')
    const cached = this.queryCache.get(key)
    if (cached) return cached
    const result: EntityId[] = []
    for (const id of this.entities) {
      const comps = this.components.get(id)!
      let match = true
      for (const t of types) {
        if (!comps.has(t)) { match = false; break }
      }
      if (match) result.push(id)
    }
    this.queryCache.set(key, result)
    return result
  }

  queryOne(...types: string[]): EntityId | undefined {
    for (const id of this.entities) {
      const comps = this.components.get(id)!
      let match = true
      for (const t of types) {
        if (!comps.has(t)) { match = false; break }
      }
      if (match) return id
    }
    return undefined
  }

  addSystem(system: System): void {
    this.systems.push(system)
  }

  removeSystem(system: System): void {
    const idx = this.systems.indexOf(system)
    if (idx !== -1) this.systems.splice(idx, 1)
  }

  update(dt: number): void {
    // Selective cache invalidation: only invalidate entries whose component types changed.
    // On frames where nothing changed (static scenes), the cache is never cleared.
    if (this.dirtyAll) {
      this.queryCache.clear()
    } else if (this.dirtyTypes.size > 0) {
      for (const key of this.queryCache.keys()) {
        // Empty key = query() with no types — always invalidate when any type is dirty
        if (key === '') {
          this.queryCache.delete(key)
          continue
        }
        const keyTypes = key.split('\x00')
        if (keyTypes.some(t => this.dirtyTypes.has(t))) {
          this.queryCache.delete(key)
        }
      }
    }
    this.dirtyAll = false
    this.dirtyTypes.clear()

    for (const system of this.systems) {
      system.update(this, dt)
    }
  }

  clear(): void {
    this.entities.clear()
    this.components.clear()
    this.queryCache.clear()
    this.dirtyTypes.clear()
    this.dirtyAll = false
    this.nextId = 0
  }

  get entityCount(): number {
    return this.entities.size
  }
}
