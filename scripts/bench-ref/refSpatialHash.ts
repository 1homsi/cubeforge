/**
 * VERBATIM copy of the pre-optimization SpatialHash implementation.
 * Used ONLY as a benchmark reference — do not import from engine code.
 */
export class RefSpatialHash {
  private cellSize: number
  private cells: Map<string, Set<number>> = new Map()
  private entityCells: Map<number, string[]> = new Map()

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`
  }

  insert(entity: number, x: number, y: number, width: number, height: number): void {
    this.remove(entity)
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

  remove(entity: number): void {
    const cells = this.entityCells.get(entity)
    if (cells) {
      for (const k of cells) {
        this.cells.get(k)?.delete(entity)
      }
      this.entityCells.delete(entity)
    }
  }

  queryRect(x: number, y: number, width: number, height: number): number[] {
    const result = new Set<number>()
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

  queryCircle(cx: number, cy: number, radius: number): number[] {
    return this.queryRect(cx, cy, radius * 2, radius * 2)
  }

  clear(): void {
    this.cells.clear()
    this.entityCells.clear()
  }

  get size(): number {
    return this.entityCells.size
  }
}
