import { useCallback } from 'react'
import { createNavGrid, setWalkable, findPath } from '@cubeforge/core'
import type { NavGrid, Vec2Like } from '@cubeforge/core'

export interface PathfindingControls {
  /** Create a new navigation grid. All cells default to walkable. */
  createGrid(cols: number, rows: number, cellSize: number): NavGrid
  /** Set the walkability of a single cell. */
  setWalkable(grid: NavGrid, col: number, row: number, walkable: boolean): void
  /**
   * Find a path from `start` to `goal` using A*.
   * Returns world-space waypoints or an empty array if no path exists.
   */
  findPath(grid: NavGrid, start: Vec2Like, goal: Vec2Like): Vec2Like[]
}

/**
 * Returns stable references to pathfinding utilities.
 *
 * @example
 * ```tsx
 * function Enemy({ navGrid }) {
 *   const { findPath } = usePathfinding()
 *   return (
 *     <Script update={(id, world, input, dt) => {
 *       const path = findPath(navGrid, pos, playerPos)
 *       if (path.length > 1) moveToward(path[1])
 *     }} />
 *   )
 * }
 * ```
 */
export function usePathfinding(): PathfindingControls {
  const createGrid$ = useCallback(
    (cols: number, rows: number, cellSize: number) => createNavGrid(cols, rows, cellSize),
    [],
  )
  const setWalkable$ = useCallback(
    (grid: NavGrid, col: number, row: number, walkable: boolean) => setWalkable(grid, col, row, walkable),
    [],
  )
  const findPath$ = useCallback(
    (grid: NavGrid, start: Vec2Like, goal: Vec2Like) => findPath(grid, start, goal),
    [],
  )
  return { createGrid: createGrid$, setWalkable: setWalkable$, findPath: findPath$ }
}
