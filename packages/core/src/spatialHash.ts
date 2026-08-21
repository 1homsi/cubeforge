import type { EntityId } from './ecs/world'

// ── Cell-key packing ──────────────────────────────────────────────────────────
// Cell coordinates are bit-packed into a single number instead of building a
// `${cx},${cy}` string per lookup. Supports ±32767 cells per axis (≈ ±2M world
// units at the default cellSize of 64), which is far beyond any practical map.

const KEY_OFFSET = 32768

function packKey(cx: number, cy: number): number {
  return ((cx + KEY_OFFSET) << 16) | (cy + KEY_OFFSET)
}

export class SpatialHash {
  private cellSize: number
  private cells: Map<number, Set<EntityId>> = new Map()
  private entityCells: Map<EntityId, number[]> = new Map()

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize
  }

  /**
   * Insert or update an entity at a position with given bounds.
   *
   * If the entity already occupies exactly the same set of cells (the common
   * case for slow-moving or static entities updated every frame), the update
   * is a no-op — no removal, no re-insertion, zero allocations.
   */
  insert(entity: EntityId, x: number, y: number, width: number, height: number): void {
    // Calculate which cells this entity occupies
    const minCX = Math.floor((x - width / 2) / this.cellSize)
    const maxCX = Math.floor((x + width / 2) / this.cellSize)
    const minCY = Math.floor((y - height / 2) / this.cellSize)
    const maxCY = Math.floor((y + height / 2) / this.cellSize)

    const prevCells = this.entityCells.get(entity)
    const sameCells =
      prevCells !== undefined &&
      prevCells.length === (maxCX - minCX + 1) * (maxCY - minCY + 1) &&
      (() => {
        let i = 0
        for (let cx = minCX; cx <= maxCX; cx++) {
          for (let cy = minCY; cy <= maxCY; cy++) {
            if (prevCells[i++] !== packKey(cx, cy)) return false
          }
        }
        return true
      })()
    if (sameCells) return

    // Remove old entry
    this.remove(entity)

    const cells: number[] = []
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const k = packKey(cx, cy)
        let cell = this.cells.get(k)
        if (!cell) {
          cell = new Set()
          this.cells.set(k, cell)
        }
        cell.add(entity)
        cells.push(k)
      }
    }
    this.entityCells.set(entity, cells)
  }

  remove(entity: EntityId): void {
    const cells = this.entityCells.get(entity)
    if (cells) {
      for (const k of cells) {
        const cell = this.cells.get(k)
        if (cell) {
          cell.delete(entity)
          // Prune empty cells so long-running maps don't grow without bound.
          if (cell.size === 0) this.cells.delete(k)
        }
      }
      this.entityCells.delete(entity)
    }
  }

  /**
   * Query all entities within a rectangular area.
   */
  queryRect(x: number, y: number, width: number, height: number): EntityId[] {
    const result: EntityId[] = []
    const minCX = Math.floor((x - width / 2) / this.cellSize)
    const maxCX = Math.floor((x + width / 2) / this.cellSize)
    const minCY = Math.floor((y - height / 2) / this.cellSize)
    const maxCY = Math.floor((y + height / 2) / this.cellSize)

    // Duplicates are only possible when the rect spans more than one cell —
    // so the dedupe marker set is allocated lazily, keeping single-cell
    // queries (the common case) allocation-free.
    let seen: Set<EntityId> | null = null
    if (maxCX > minCX || maxCY > minCY) seen = new Set()

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(packKey(cx, cy))
        if (!cell) continue
        for (const id of cell) {
          if (seen) {
            if (seen.has(id)) continue
            seen.add(id)
          }
          result.push(id)
        }
      }
    }
    return result
  }

  /**
   * Query all entities within a circular area.
   */
  queryCircle(cx: number, cy: number, radius: number): EntityId[] {
    return this.queryRect(cx, cy, radius * 2, radius * 2)
    // Caller can do distance check for exact circle
  }

  /** Clear all entries */
  clear(): void {
    this.cells.clear()
    this.entityCells.clear()
  }

  /** Number of tracked entities */
  get size(): number {
    return this.entityCells.size
  }
}
