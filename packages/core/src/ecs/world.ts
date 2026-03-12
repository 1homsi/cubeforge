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

/**
 * A compact incremental update relative to a known baseline `WorldSnapshot`.
 * Produced by `ECSWorld.getDeltaSnapshot`, consumed by `applyDeltaSnapshot`.
 */
export interface DeltaSnapshot {
  nextId: number
  rngState: number
  /** Entities that were added or whose components changed since baseline. */
  changed: WorldSnapshot['entities']
  /** IDs of entities that were destroyed since baseline. */
  removed: number[]
}

/**
 * Merge a `DeltaSnapshot` onto a `baseline` WorldSnapshot, returning a new
 * full snapshot that reflects the current world state.
 *
 * This is a pure function — neither the baseline nor the delta is mutated.
 *
 * @example
 * const delta = world.getDeltaSnapshot(prevSnap)
 * sendOverNetwork(delta)   // much smaller than a full snapshot
 * // On the receiving end:
 * const newSnap = applyDeltaSnapshot(prevSnap, delta)
 * remoteWorld.restoreSnapshot(newSnap)
 */
export function applyDeltaSnapshot(baseline: WorldSnapshot, delta: DeltaSnapshot): WorldSnapshot {
  const removedSet = new Set(delta.removed)
  const changedMap = new Map(delta.changed.map((e) => [e.id, e]))

  const entities: WorldSnapshot['entities'] = []
  for (const entity of baseline.entities) {
    if (removedSet.has(entity.id)) continue
    entities.push(changedMap.get(entity.id) ?? entity)
    changedMap.delete(entity.id)
  }
  // Entities in `changed` that weren't in baseline are new — append them
  for (const entity of changedMap.values()) {
    entities.push(entity)
  }

  return { nextId: delta.nextId, rngState: delta.rngState, entities }
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

  /** Asset manager reference — set by Game, available in Script callbacks via world.assets */
  assets!: {
    getImage(src: string): HTMLImageElement | undefined
    loadImage(src: string): Promise<HTMLImageElement>
  }

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

  // Flush pending dirty flags into the query cache immediately.
  // Called inline at the top of query() so any mid-frame mutation
  // (destroyEntity, addComponent, removeComponent) is reflected before
  // the next query returns its results — prevents stale entity IDs from
  // appearing in results for systems that run later in the same frame.
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

  // Returns all entities that have ALL of the requested component types.
  // Uses archetype superset matching — no per-entity scan.
  query(...types: string[]): EntityId[] {
    this.flushDirty()

    const key = types.slice().sort().join('\x00')
    const cached = this.queryCache.get(key)
    if (cached) return cached

    const result: EntityId[] = []
    for (const arch of this.archetypes.values()) {
      // Skip archetypes that don't have all requested types
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
    this.nextId = snapshot.nextId
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

  // ── Binary snapshot ─────────────────────────────────────────────────────────
  //
  // Binary format (little-endian):
  //   [4] nextId       uint32
  //   [4] rngState     uint32
  //   [4] entityCount  uint32
  //   for each entity:
  //     [4] id              uint32
  //     [2] componentCount  uint16
  //     for each component:
  //       [2] typeLen uint16  — byte length of the type string (UTF-8)
  //       [N] type    bytes
  //       [4] dataLen uint32  — byte length of JSON component body (without `type`)
  //       [N] data    bytes
  //
  // Storing `type` separately avoids repeating it inside each JSON body,
  // which measurably reduces size in worlds with many entities.

  /**
   * Serialise the world state into a compact binary format.
   *
   * Smaller than JSON for large worlds because entity IDs are fixed-width
   * integers and the `type` string is stored once per component rather than
   * duplicated as a JSON key in every body.
   *
   * Compatible with `restoreSnapshotBinary`.
   */
  getSnapshotBinary(): Uint8Array {
    const enc = new TextEncoder()
    const snap = this.getSnapshot()

    // Pre-encode to measure total size
    const eecs: Array<{ id: number; comps: Array<{ tb: Uint8Array; db: Uint8Array }> }> = snap.entities.map(
      ({ id, components }) => ({
        id,
        comps: components.map((comp) => {
          const { type, ...rest } = comp as unknown as Record<string, unknown>
          void type
          return { tb: enc.encode(comp.type), db: enc.encode(JSON.stringify(rest)) }
        }),
      }),
    )

    let size = 12 // nextId + rngState + entityCount
    for (const { comps } of eecs) {
      size += 6 // id (4) + componentCount (2)
      for (const { tb, db } of comps) size += 2 + tb.byteLength + 4 + db.byteLength
    }

    const buf = new ArrayBuffer(size)
    const view = new DataView(buf)
    const u8 = new Uint8Array(buf)
    let o = 0

    view.setUint32(o, snap.nextId, true); o += 4
    view.setUint32(o, snap.rngState, true); o += 4
    view.setUint32(o, eecs.length, true); o += 4

    for (const { id, comps } of eecs) {
      view.setUint32(o, id, true); o += 4
      view.setUint16(o, comps.length, true); o += 2
      for (const { tb, db } of comps) {
        view.setUint16(o, tb.byteLength, true); o += 2
        u8.set(tb, o); o += tb.byteLength
        view.setUint32(o, db.byteLength, true); o += 4
        u8.set(db, o); o += db.byteLength
      }
    }

    return u8
  }

  /**
   * Restore world state from a binary buffer produced by `getSnapshotBinary`.
   */
  restoreSnapshotBinary(data: Uint8Array): void {
    const dec = new TextDecoder()
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let o = 0

    const nextId = view.getUint32(o, true); o += 4
    const rngState = view.getUint32(o, true); o += 4
    const entityCount = view.getUint32(o, true); o += 4

    const entities: WorldSnapshot['entities'] = []
    for (let e = 0; e < entityCount; e++) {
      const id = view.getUint32(o, true); o += 4
      const compCount = view.getUint16(o, true); o += 2
      const components: Component[] = []
      for (let c = 0; c < compCount; c++) {
        const typeLen = view.getUint16(o, true); o += 2
        const type = dec.decode(data.subarray(o, o + typeLen)); o += typeLen
        const dataLen = view.getUint32(o, true); o += 4
        const body = JSON.parse(dec.decode(data.subarray(o, o + dataLen))) as Record<string, unknown>
        o += dataLen
        components.push({ type, ...body } as Component)
      }
      entities.push({ id, components })
    }

    this.restoreSnapshot({ nextId, rngState, entities })
  }

  // ── Delta snapshot ──────────────────────────────────────────────────────────

  /**
   * Compute a delta snapshot relative to `baseline`.
   *
   * Only includes entities whose components differ from `baseline`.
   * Entities deleted since `baseline` appear in `removed`.
   *
   * Pair with `applyDeltaSnapshot` to reconstruct the full snapshot from a
   * baseline + a sequence of deltas without sending full world state each tick.
   */
  getDeltaSnapshot(baseline: WorldSnapshot): DeltaSnapshot {
    const current = this.getSnapshot()
    const baseMap = new Map(baseline.entities.map((e) => [e.id, e]))
    const changed: WorldSnapshot['entities'] = []
    const removed: number[] = []

    for (const entity of current.entities) {
      const base = baseMap.get(entity.id)
      if (!base || JSON.stringify(entity.components) !== JSON.stringify(base.components)) {
        changed.push(entity)
      }
    }

    const currentIds = new Set(current.entities.map((e) => e.id))
    for (const { id } of baseline.entities) {
      if (!currentIds.has(id)) removed.push(id)
    }

    return { nextId: current.nextId, rngState: current.rngState, changed, removed }
  }

  addSystem(system: System): void {
    this.systems.push(system)
  }

  removeSystem(system: System): void {
    const idx = this.systems.indexOf(system)
    if (idx !== -1) this.systems.splice(idx, 1)
  }

  update(dt: number): void {
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
