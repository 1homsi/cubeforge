import { describe, it, expect } from 'vitest'
import { createNavGrid, findPath, setWalkable } from '../nav/pathfind'

function cells(path: { x: number; y: number }[], cellSize = 10): Array<[number, number]> {
  return path.map((point) => [Math.floor(point.x / cellSize), Math.floor(point.y / cellSize)])
}

describe('pathfind', () => {
  describe('createNavGrid', () => {
    it('creates a grid with all cells walkable', () => {
      const grid = createNavGrid(3, 2, 16)

      expect(grid.cols).toBe(3)
      expect(grid.rows).toBe(2)
      expect(grid.cellSize).toBe(16)
      expect(grid.walkable).toEqual([true, true, true, true, true, true])
    })
  })

  describe('setWalkable', () => {
    it('updates a cell in bounds', () => {
      const grid = createNavGrid(3, 3, 10)

      setWalkable(grid, 1, 2, false)

      expect(grid.walkable[7]).toBe(false)
    })

    it('ignores out of bounds writes', () => {
      const grid = createNavGrid(2, 2, 10)

      setWalkable(grid, -1, 0, false)
      setWalkable(grid, 0, -1, false)
      setWalkable(grid, 2, 0, false)
      setWalkable(grid, 0, 2, false)

      expect(grid.walkable).toEqual([true, true, true, true])
    })
  })

  describe('findPath', () => {
    it('returns a single centered waypoint when start and goal are in the same cell', () => {
      const grid = createNavGrid(4, 4, 10)

      const path = findPath(grid, { x: 1, y: 1 }, { x: 9, y: 9 })

      expect(path).toEqual([{ x: 5, y: 5 }])
    })

    it('returns an empty path when the start cell is blocked', () => {
      const grid = createNavGrid(3, 3, 10)
      setWalkable(grid, 0, 0, false)

      expect(findPath(grid, { x: 1, y: 1 }, { x: 25, y: 25 })).toEqual([])
    })

    it('returns an empty path when the goal cell is blocked', () => {
      const grid = createNavGrid(3, 3, 10)
      setWalkable(grid, 2, 2, false)

      expect(findPath(grid, { x: 1, y: 1 }, { x: 25, y: 25 })).toEqual([])
    })

    it('returns an empty path when start is outside the grid', () => {
      const grid = createNavGrid(3, 3, 10)

      expect(findPath(grid, { x: -1, y: 5 }, { x: 25, y: 25 })).toEqual([])
    })

    it('returns an empty path when goal is outside the grid', () => {
      const grid = createNavGrid(3, 3, 10)

      expect(findPath(grid, { x: 5, y: 5 }, { x: 35, y: 25 })).toEqual([])
    })

    it('builds a straight horizontal path through cell centers', () => {
      const grid = createNavGrid(4, 1, 10)

      const path = findPath(grid, { x: 1, y: 1 }, { x: 39, y: 1 })

      expect(path).toEqual([
        { x: 5, y: 5 },
        { x: 15, y: 5 },
        { x: 25, y: 5 },
        { x: 35, y: 5 },
      ])
    })

    it('builds a diagonal path when diagonals are open', () => {
      const grid = createNavGrid(3, 3, 10)

      const path = findPath(grid, { x: 1, y: 1 }, { x: 29, y: 29 })

      expect(path).toEqual([
        { x: 5, y: 5 },
        { x: 15, y: 15 },
        { x: 25, y: 25 },
      ])
    })

    it('does not cut diagonally through blocked corners', () => {
      const grid = createNavGrid(2, 2, 10)
      setWalkable(grid, 1, 0, false)
      setWalkable(grid, 0, 1, false)

      const path = findPath(grid, { x: 1, y: 1 }, { x: 19, y: 19 })

      expect(path).toEqual([])
    })

    it('detours through an open gap instead of a blocked wall', () => {
      const grid = createNavGrid(5, 5, 10)

      for (let row = 0; row < 5; row++) {
        if (row !== 2) setWalkable(grid, 2, row, false)
      }

      const path = findPath(grid, { x: 1, y: 21 }, { x: 49, y: 21 })

      expect(cells(path)).toEqual([
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
        [4, 2],
      ])
    })

    it('uses floored world positions to pick start and goal cells', () => {
      const grid = createNavGrid(3, 3, 10)

      const path = findPath(grid, { x: 19.9, y: 0.1 }, { x: 20.1, y: 29.9 })

      expect(cells(path)[0]).toEqual([1, 0])
      expect(cells(path).at(-1)).toEqual([2, 2])
      expect(path).toHaveLength(3)
    })

    it('returns an empty path when obstacles isolate the goal', () => {
      const grid = createNavGrid(3, 3, 10)
      setWalkable(grid, 1, 0, false)
      setWalkable(grid, 0, 1, false)
      setWalkable(grid, 1, 1, false)

      const path = findPath(grid, { x: 1, y: 1 }, { x: 25, y: 25 })

      expect(path).toEqual([])
    })

    it('routes around a single blocked cell', () => {
      const grid = createNavGrid(3, 3, 10)
      setWalkable(grid, 1, 1, false)

      const path = findPath(grid, { x: 1, y: 1 }, { x: 29, y: 29 })

      expect(cells(path)[0]).toEqual([0, 0])
      expect(cells(path).at(-1)).toEqual([2, 2])
      expect(cells(path)).not.toContainEqual([1, 1])
      expect(path.length).toBeGreaterThan(3)
    })

    it('returns centered world coordinates for every waypoint', () => {
      const grid = createNavGrid(2, 2, 8)

      const path = findPath(grid, { x: 0, y: 0 }, { x: 15, y: 15 })

      expect(path).toEqual([
        { x: 4, y: 4 },
        { x: 12, y: 12 },
      ])
    })
  })
})
