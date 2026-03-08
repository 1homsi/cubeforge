import { useCallback } from 'react'
import { createNavGrid, setWalkable, findPath } from '@cubeforge/core'
import type { NavGrid, Vec2Like } from '@cubeforge/core'

export interface PathfindingControls {
  createGrid(cols: number, rows: number, cellSize: number): NavGrid
  setWalkable(grid: NavGrid, col: number, row: number, walkable: boolean): void
  findPath(grid: NavGrid, start: Vec2Like, goal: Vec2Like): Vec2Like[]
}

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
