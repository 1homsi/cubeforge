import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { EngineContext } from '../context'

export interface GridOptions<T> {
  /** Number of columns. */
  width: number
  /** Number of rows. */
  height: number
  /**
   * Default cell value. Can be a plain value (each cell shares the reference) or a
   * factory `(x, y) => T` called for each cell during initialization.
   */
  fill: T | ((x: number, y: number) => T)
}

export interface GridCell<T> {
  x: number
  y: number
  value: T
}

export interface GridControls<T> {
  width: number
  height: number
  /** Read a cell value. Returns undefined for out-of-bounds coords. */
  get(x: number, y: number): T | undefined
  /** Write a cell value. No-op for out-of-bounds coords. */
  set(x: number, y: number, value: T): void
  /** True if (x, y) is within the grid bounds. */
  inBounds(x: number, y: number): boolean
  /** Swap the values of two cells. */
  swap(ax: number, ay: number, bx: number, by: number): void
  /** Iterate over every cell. */
  forEach(cb: (cell: GridCell<T>) => void): void
  /** Find the first cell matching a predicate. */
  find(pred: (cell: GridCell<T>) => boolean): GridCell<T> | undefined
  /** Count the cells matching a predicate. */
  count(pred: (cell: GridCell<T>) => boolean): number
  /**
   * Return the 4-neighborhood (N/E/S/W) or 8-neighborhood (including diagonals)
   * of a cell, as `{ x, y, value }` entries. Out-of-bounds neighbors are omitted.
   */
  neighbors(x: number, y: number, diagonal?: boolean): GridCell<T>[]
  /** Reset every cell to a new value (or factory). */
  fill(value: T | ((x: number, y: number) => T)): void
  /** Deep-copy the grid as a 2D array `arr[y][x]`. */
  toArray(): T[][]
  /** Replace the entire grid contents from a 2D array. */
  fromArray(arr: T[][]): void
}

/**
 * A reactive 2D board state for puzzle and turn-based games. Calls to `set`,
 * `swap`, `fill`, and `fromArray` trigger a re-render and call
 * `engine.loop.markDirty()`, so in onDemand mode the canvas updates automatically.
 *
 * The underlying storage is a flat array indexed `y * width + x`.
 *
 * @example
 * ```tsx
 * type Tile = 'empty' | 'wall' | 'box'
 *
 * function Sokoban() {
 *   const board = useGrid<Tile>({ width: 10, height: 10, fill: 'empty' })
 *   board.set(1, 1, 'wall')
 *   const walls = board.count((c) => c.value === 'wall')
 *   // render by iterating board.forEach(...)
 * }
 * ```
 */
export function useGrid<T>({ width, height, fill }: GridOptions<T>): GridControls<T> {
  const engine = useContext(EngineContext)
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const dataRef = useRef<T[] | null>(null)
  if (dataRef.current === null) {
    const arr: T[] = new Array(width * height)
    if (typeof fill === 'function') {
      const factory = fill as (x: number, y: number) => T
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          arr[y * width + x] = factory(x, y)
        }
      }
    } else {
      for (let i = 0; i < arr.length; i++) arr[i] = fill
    }
    dataRef.current = arr
  }

  const markChanged = useCallback(() => {
    engine?.loop.markDirty()
    bump()
  }, [engine, bump])

  const inBounds = useCallback((x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height, [width, height])

  const get = useCallback(
    (x: number, y: number): T | undefined => {
      if (!inBounds(x, y)) return undefined
      return dataRef.current![y * width + x]
    },
    [width, inBounds],
  )

  const set = useCallback(
    (x: number, y: number, value: T) => {
      if (!inBounds(x, y)) return
      const data = dataRef.current!
      const idx = y * width + x
      if (data[idx] === value) return
      data[idx] = value
      markChanged()
    },
    [width, inBounds, markChanged],
  )

  const swap = useCallback(
    (ax: number, ay: number, bx: number, by: number) => {
      if (!inBounds(ax, ay) || !inBounds(bx, by)) return
      const data = dataRef.current!
      const ai = ay * width + ax
      const bi = by * width + bx
      if (data[ai] === data[bi]) return
      const tmp = data[ai]
      data[ai] = data[bi]
      data[bi] = tmp
      markChanged()
    },
    [width, inBounds, markChanged],
  )

  const forEach = useCallback(
    (cb: (cell: GridCell<T>) => void) => {
      const data = dataRef.current!
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          cb({ x, y, value: data[y * width + x] })
        }
      }
    },
    [width, height],
  )

  const find = useCallback(
    (pred: (cell: GridCell<T>) => boolean): GridCell<T> | undefined => {
      const data = dataRef.current!
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cell = { x, y, value: data[y * width + x] }
          if (pred(cell)) return cell
        }
      }
      return undefined
    },
    [width, height],
  )

  const count = useCallback(
    (pred: (cell: GridCell<T>) => boolean): number => {
      const data = dataRef.current!
      let n = 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (pred({ x, y, value: data[y * width + x] })) n++
        }
      }
      return n
    },
    [width, height],
  )

  const neighbors = useCallback(
    (x: number, y: number, diagonal = false): GridCell<T>[] => {
      const data = dataRef.current!
      const result: GridCell<T>[] = []
      const offsets = diagonal
        ? [
            [-1, -1],
            [0, -1],
            [1, -1],
            [-1, 0],
            [1, 0],
            [-1, 1],
            [0, 1],
            [1, 1],
          ]
        : [
            [0, -1],
            [-1, 0],
            [1, 0],
            [0, 1],
          ]
      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy
        if (inBounds(nx, ny)) result.push({ x: nx, y: ny, value: data[ny * width + nx] })
      }
      return result
    },
    [width, inBounds],
  )

  const fillAll = useCallback(
    (value: T | ((x: number, y: number) => T)) => {
      const data = dataRef.current!
      if (typeof value === 'function') {
        const factory = value as (x: number, y: number) => T
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            data[y * width + x] = factory(x, y)
          }
        }
      } else {
        for (let i = 0; i < data.length; i++) data[i] = value
      }
      markChanged()
    },
    [width, height, markChanged],
  )

  const toArray = useCallback((): T[][] => {
    const data = dataRef.current!
    const out: T[][] = new Array(height)
    for (let y = 0; y < height; y++) {
      const row: T[] = new Array(width)
      for (let x = 0; x < width; x++) row[x] = data[y * width + x]
      out[y] = row
    }
    return out
  }, [width, height])

  const fromArray = useCallback(
    (arr: T[][]) => {
      const data = dataRef.current!
      for (let y = 0; y < height; y++) {
        const row = arr[y]
        if (!row) continue
        for (let x = 0; x < width; x++) {
          if (x < row.length) data[y * width + x] = row[x]
        }
      }
      markChanged()
    },
    [width, height, markChanged],
  )

  // version is not used in the returned value directly, but the closures capture
  // dataRef which is mutable; bumping version forces re-render so consumers that
  // read via forEach/get see fresh values.
  void version

  return useMemo(
    () => ({
      width,
      height,
      get,
      set,
      inBounds,
      swap,
      forEach,
      find,
      count,
      neighbors,
      fill: fillAll,
      toArray,
      fromArray,
    }),
    [width, height, get, set, inBounds, swap, forEach, find, count, neighbors, fillAll, toArray, fromArray, version],
  )
}
