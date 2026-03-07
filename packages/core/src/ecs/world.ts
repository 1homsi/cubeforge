export type EntityId = number

export interface Component {
  readonly type: string
}

export interface System {
  update(world: ECSWorld, dt: number): void
}

export interface WorldSnapshot {
  nextId: number
  rngState: number
  entities: Array<{ id: EntityId; components: Component[] }>
}

// ── Archetype ─────────────────────────────────────────────────────────────────
// An archetype is a unique set of component types. All entities with exactly
// the same set of component types live in the same archetype.

interface Archetype {
  // Sorted, \x00-joined component type string — also serves as the map key
  readonly key: string
  // The component types in this archetype (sorted)
  readonly types: ReadonlySet<string>
  // Entities in this archetype (insertion order)
  entities: EntityId[]
}

// ── ECSWorld ──────────────────────────────────────────────────────────────────

export class ECSWorld {
  private nextId = 0

  // Secondary index: O(1) single-entity component lookup
  private componentIndex = new Map<EntityId, Map<string, Component>>()

  // Seeded RNG (LCG) for deterministic mode
  private _rngState = 0
  private _deterministic = false

  // Primary storage: archetypes keyed by sorted type string
  private archetypes = new Map<string, Archetype>()

  // Which archetype each entity lives in
  private entityArchetype = new Map<EntityId, string>()

  private systems: System[] = []

  // Query cache: query key → matching EntityId[]
  // Invalidated selectively when archetypes are added or entities move.
  private queryCache = new Map<string, EntityId[]>()

  // Component types touched since last update() — used for selective cache invalidation
  private dirtyTypes = new Set<string>()
  private dirtyAll = false

  // ── Internal helpers ────────────────────────────────────────────────────────

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
    // Remove from current archetype
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

  // ── Public API ──────────────────────────────────────────────────────────────

  createEntity(): EntityId {
    const id = this.nextId++
    this.componentIndex.set(id, new Map())
    // New entity starts in the empty archetype
    const emptyArch = this.getOrCreateArchetype([])
    emptyArch.entities.push(id)
    this.entityArchetype.set(id, emptyArch.key)
    this.dirtyAll = true
    return id
  }

  destroyEntity(id: EntityId): void {
    const comps = this.componentIndex.get(id)
    if (comps) {
      for (const type of comps.keys()) this.dirtyTypes.add(type)
    }
    // Remove from archetype
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

    // Move entity to new archetype (current types + new type)
    const newArch = this.getOrCreateArchetype(comps.keys())
    this.moveToArchetype(id, newArch)
  }

  removeComponent(id: EntityId, type: string): void {
    const comps = this.componentIndex.get(id)
    if (!comps) return
    comps.delete(type)
    this.dirtyTypes.add(type)

    // Move entity to new archetype (current types − removed type)
    const newArch = this.getOrCreateArchetype(comps.keys())
    this.moveToArchetype(id, newArch)
  }

  getComponent<T extends Component>(id: EntityId, type: string): T | undefined {
    return this.componentIndex.get(id)?.get(type) as T | undefined
  }

  hasComponent(id: EntityId, type: string): boolean {
    return this.componentIndex.get(id)?.has(type) ?? false
  }

  // Returns all entities that have ALL of the requested component types.
  // Uses archetype superset matching — no per-entity scan.
  query(...types: string[]): EntityId[] {
    const key = types.slice().sort().join('\x00')
    const cached = this.queryCache.get(key)
    if (cached) return cached

    const result: EntityId[] = []
    for (const arch of this.archetypes.values()) {
      // Skip archetypes that don't have all requested types
      if (types.every(t => arch.types.has(t))) {
        for (const id of arch.entities) result.push(id)
      }
    }
    this.queryCache.set(key, result)
    return result
  }

  queryOne(...types: string[]): EntityId | undefined {
    for (const arch of this.archetypes.values()) {
      if (types.every(t => arch.types.has(t))) {
        if (arch.entities.length > 0) return arch.entities[0]
      }
    }
    return undefined
  }

  /**
   * Returns the first entity that has a Tag component containing the given tag string.
   * O(n) over entities with the Tag component — use sparingly in hot paths.
   */
  findByTag(tag: string): EntityId | undefined {
    for (const id of this.query('Tag')) {
      const t = this.getComponent<{ type: 'Tag'; tags: string[] }>(id, 'Tag')
      if (t?.tags.includes(tag)) return id
    }
    return undefined
  }

  /**
   * Returns all entities that have a Tag component containing the given tag string.
   */
  findAllByTag(tag: string): EntityId[] {
    const result: EntityId[] = []
    for (const id of this.query('Tag')) {
      const t = this.getComponent<{ type: 'Tag'; tags: string[] }>(id, 'Tag')
      if (t?.tags.includes(tag)) result.push(id)
    }
    return result
  }

  // ── Deterministic RNG ───────────────────────────────────────────────────────

  /** Enable deterministic mode with a fixed seed. All internal randomness uses this RNG. */
  setDeterministicSeed(seed: number): void {
    this._rngState = seed >>> 0
    this._deterministic = true
  }

  /** Returns a pseudo-random number in [0, 1). Uses seeded LCG in deterministic mode,
   *  Math.random() otherwise. */
  rng(): number {
    if (!this._deterministic) return Math.random()
    // 32-bit LCG: Numerical Recipes constants
    this._rngState = (Math.imul(this._rngState, 1664525) + 1013904223) >>> 0
    return this._rngState / 0x100000000
  }

  // ── Snapshot / Restore ──────────────────────────────────────────────────────

  /** Capture a full serialisable snapshot of all entity/component data + RNG state. */
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

  /** Restore world state from a previously captured snapshot. */
  restoreSnapshot(snapshot: WorldSnapshot): void {
    this.clear()
    this.nextId   = snapshot.nextId
    this._rngState = snapshot.rngState
    for (const { id, components } of snapshot.entities) {
      const compMap = new Map<string, Component>()
      for (const comp of components) compMap.set(comp.type, comp)
      this.componentIndex.set(id, compMap)
      const arch = this.getOrCreateArchetype(compMap.keys())
      arch.entities.push(id)
      this.entityArchetype.set(id, arch.key)
    }
    this.dirtyAll = true
  }

  addSystem(system: System): void {
    this.systems.push(system)
  }

  removeSystem(system: System): void {
    const idx = this.systems.indexOf(system)
    if (idx !== -1) this.systems.splice(idx, 1)
  }

  update(dt: number): void {
    // Selective cache invalidation — same strategy as before
    if (this.dirtyAll) {
      this.queryCache.clear()
    } else if (this.dirtyTypes.size > 0) {
      for (const key of this.queryCache.keys()) {
        if (key === '') { this.queryCache.delete(key); continue }
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
    this.componentIndex.clear()
    this.archetypes.clear()
    this.entityArchetype.clear()
    this.queryCache.clear()
    this.dirtyTypes.clear()
    this.dirtyAll = false
    this.nextId = 0
    this._rngState = 0
    this._deterministic = false
  }

  get entityCount(): number {
    return this.componentIndex.size
  }
}
