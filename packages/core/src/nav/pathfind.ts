/**
 * Grid-based A* pathfinding.
 *
 * Coordinates:
 * - Grid cells are (col, row), origin at top-left.
 * - World positions are converted to grid cells via cellSize.
 */

import type { Vec2Like } from './types'
export type { Vec2Like }

export interface NavGrid {
  readonly cols: number
  readonly rows: number
  readonly cellSize: number
  readonly walkable: boolean[]
}

/** Create a new navigation grid. All cells start walkable. */
export function createNavGrid(cols: number, rows: number, cellSize: number): NavGrid {
  return {
    cols,
    rows,
    cellSize,
    walkable: new Array(cols * rows).fill(true),
  }
}

/** Set the walkability of a specific cell. */
export function setWalkable(grid: NavGrid, col: number, row: number, walkable: boolean): void {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return
  ;(grid.walkable as boolean[])[row * grid.cols + col] = walkable
}

function isWalkable(grid: NavGrid, col: number, row: number): boolean {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return false
  return grid.walkable[row * grid.cols + col]
}

function worldToCell(grid: NavGrid, wx: number, wy: number): { col: number; row: number } {
  return {
    col: Math.floor(wx / grid.cellSize),
    row: Math.floor(wy / grid.cellSize),
  }
}

function cellToWorld(grid: NavGrid, col: number, row: number): Vec2Like {
  return {
    x: (col + 0.5) * grid.cellSize,
    y: (row + 0.5) * grid.cellSize,
  }
}

function heuristic(ac: number, ar: number, bc: number, br: number): number {
  // Diagonal (Chebyshev) heuristic
  const dc = Math.abs(ac - bc)
  const dr = Math.abs(ar - br)
  return (dc + dr) + (Math.SQRT2 - 2) * Math.min(dc, dr)
}

/**
 * Find a path from `start` to `goal` in world-space coordinates using A*.
 *
 * Returns an array of world-space waypoints (center of each cell on the path),
 * or an empty array if no path exists.
 *
 * @example
 * ```ts
 * const grid = createNavGrid(20, 15, 32)
 * setWalkable(grid, 5, 3, false) // mark a wall
 * const path = findPath(grid, { x: 16, y: 16 }, { x: 400, y: 240 })
 * ```
 */
export function findPath(
  grid: NavGrid,
  start: Vec2Like,
  goal: Vec2Like,
): Vec2Like[] {
  const sc = worldToCell(grid, start.x, start.y)
  const gc = worldToCell(grid, goal.x, goal.y)

  if (!isWalkable(grid, sc.col, sc.row) || !isWalkable(grid, gc.col, gc.row)) {
    return []
  }

  const key = (col: number, row: number): number => row * grid.cols + col

  const openSet = new MinHeap<{ col: number; row: number; f: number }>((a, b) => a.f - b.f)
  const gScore = new Map<number, number>()
  const cameFrom = new Map<number, number>()

  const startKey = key(sc.col, sc.row)
  gScore.set(startKey, 0)
  openSet.push({ col: sc.col, row: sc.row, f: heuristic(sc.col, sc.row, gc.col, gc.row) })

  // Neighbours: 8-directional
  const dirs = [
    [0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1],
    [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2],
  ]

  while (!openSet.isEmpty()) {
    const current = openSet.pop()!
    const ck = key(current.col, current.row)

    if (current.col === gc.col && current.row === gc.row) {
      // Reconstruct path
      const path: Vec2Like[] = []
      let k: number | undefined = ck
      while (k !== undefined) {
        const col = k % grid.cols
        const row = Math.floor(k / grid.cols)
        path.unshift(cellToWorld(grid, col, row))
        k = cameFrom.get(k)
      }
      return path
    }

    const cg = gScore.get(ck) ?? Infinity

    for (const [dc, dr, cost] of dirs) {
      const nc = current.col + dc
      const nr = current.row + dr
      if (!isWalkable(grid, nc, nr)) continue
      // Diagonal: require both cardinal neighbours walkable to avoid corner-cutting
      if (Math.abs(dc) === 1 && Math.abs(dr) === 1) {
        if (!isWalkable(grid, current.col + dc, current.row)) continue
        if (!isWalkable(grid, current.col, current.row + dr)) continue
      }
      const nk = key(nc, nr)
      const ng = cg + cost
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng)
        cameFrom.set(nk, ck)
        const f = ng + heuristic(nc, nr, gc.col, gc.row)
        openSet.push({ col: nc, row: nr, f })
      }
    }
  }

  return [] // No path found
}

// ── Binary min-heap ────────────────────────────────────────────────────────────

class MinHeap<T> {
  private data: T[] = []
  constructor(private readonly compare: (a: T, b: T) => number) {}

  push(item: T): void {
    this.data.push(item)
    this.bubbleUp(this.data.length - 1)
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined
    const top = this.data[0]
    const last = this.data.pop()!
    if (this.data.length > 0) {
      this.data[0] = last
      this.sinkDown(0)
    }
    return top
  }

  isEmpty(): boolean { return this.data.length === 0 }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.compare(this.data[i], this.data[parent]) >= 0) break
      ;[this.data[i], this.data[parent]] = [this.data[parent], this.data[i]]
      i = parent
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length
    while (true) {
      let smallest = i
      const l = 2 * i + 1
      const r = 2 * i + 2
      if (l < n && this.compare(this.data[l], this.data[smallest]) < 0) smallest = l
      if (r < n && this.compare(this.data[r], this.data[smallest]) < 0) smallest = r
      if (smallest === i) break
      ;[this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]]
      i = smallest
    }
  }
}
