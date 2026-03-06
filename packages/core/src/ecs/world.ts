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

  createEntity(): EntityId {
    const id = this.nextId++
    this.entities.add(id)
    this.components.set(id, new Map())
    return id
  }

  destroyEntity(id: EntityId): void {
    this.entities.delete(id)
    this.components.delete(id)
  }

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id)
  }

  addComponent<T extends Component>(id: EntityId, component: T): void {
    this.components.get(id)?.set(component.type, component)
  }

  removeComponent(id: EntityId, type: string): void {
    this.components.get(id)?.delete(type)
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
    this.queryCache.clear()
    for (const system of this.systems) {
      system.update(this, dt)
    }
  }

  clear(): void {
    this.entities.clear()
    this.components.clear()
    this.nextId = 0
  }

  get entityCount(): number {
    return this.entities.size
  }
}
