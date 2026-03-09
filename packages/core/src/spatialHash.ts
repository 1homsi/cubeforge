import type { EntityId } from './ecs/world'

export class SpatialHash {
  private cellSize: number
  private cells: Map<string, Set<EntityId>> = new Map()
  private entityCells: Map<EntityId, string[]> = new Map()

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`
  }

  /**
   * Insert or update an entity at a position with given bounds.
   */
  insert(entity: EntityId, x: number, y: number, width: number, height: number): void {
    // Remove old entry
    this.remove(entity)

    // Calculate which cells this entity occupies
    const minCX = Math.floor((x - width / 2) / this.cellSize)
    const maxCX = Math.floor((x + width / 2) / this.cellSize)
    const minCY = Math.floor((y - height / 2) / this.cellSize)
    const maxCY = Math.floor((y + height / 2) / this.cellSize)

    const cells: string[] = []
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const k = this.key(cx, cy)
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
        this.cells.get(k)?.delete(entity)
      }
      this.entityCells.delete(entity)
    }
  }

  /**
   * Query all entities within a rectangular area.
   */
  queryRect(x: number, y: number, width: number, height: number): EntityId[] {
    const result = new Set<EntityId>()
    const minCX = Math.floor((x - width / 2) / this.cellSize)
    const maxCX = Math.floor((x + width / 2) / this.cellSize)
    const minCY = Math.floor((y - height / 2) / this.cellSize)
    const maxCY = Math.floor((y + height / 2) / this.cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this.key(cx, cy))
        if (cell) for (const id of cell) result.add(id)
      }
    }
    return [...result]
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
