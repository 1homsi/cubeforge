import { describe, it, expect } from 'vitest'
import { mergeTileColliders } from '../tilemapMerge'

describe('mergeTileColliders', () => {
  it('returns empty array for an empty grid', () => {
    expect(mergeTileColliders([], 16, 16, 0, 0)).toEqual([])
  })

  it('returns empty array when no cells are solid', () => {
    const grid = [
      [false, false],
      [false, false],
    ]

    expect(mergeTileColliders(grid, 16, 16, 0, 0)).toEqual([])
  })

  it('creates one collider for a single solid tile', () => {
    const grid = [[true]]

    expect(mergeTileColliders(grid, 16, 20, 10, 30)).toEqual([{ x: 18, y: 40, width: 16, height: 20 }])
  })

  it('merges a horizontal run into one rectangle', () => {
    const grid = [[true, true, true]]

    expect(mergeTileColliders(grid, 8, 10, 0, 0)).toEqual([{ x: 12, y: 5, width: 24, height: 10 }])
  })

  it('merges a vertical run into one rectangle', () => {
    const grid = [[true], [true], [true]]

    expect(mergeTileColliders(grid, 6, 4, 2, 8)).toEqual([{ x: 5, y: 14, width: 6, height: 12 }])
  })

  it('merges a filled block into one rectangle', () => {
    const grid = [
      [true, true],
      [true, true],
    ]

    expect(mergeTileColliders(grid, 10, 12, 5, 7)).toEqual([{ x: 15, y: 19, width: 20, height: 24 }])
  })

  it('splits disjoint islands into separate rectangles', () => {
    const grid = [
      [true, false, true],
      [true, false, true],
    ]

    expect(mergeTileColliders(grid, 10, 10, 0, 0)).toEqual([
      { x: 5, y: 10, width: 10, height: 20 },
      { x: 25, y: 10, width: 10, height: 20 },
    ])
  })

  it('does not merge through holes inside a shape', () => {
    const grid = [
      [true, true, true],
      [true, false, true],
    ]

    expect(mergeTileColliders(grid, 10, 10, 0, 0)).toEqual([
      { x: 15, y: 5, width: 30, height: 10 },
      { x: 5, y: 15, width: 10, height: 10 },
      { x: 25, y: 15, width: 10, height: 10 },
    ])
  })

  it('stops vertical growth when a later row is only partially filled', () => {
    const grid = [
      [true, true],
      [true, false],
      [true, false],
    ]

    expect(mergeTileColliders(grid, 10, 10, 0, 0)).toEqual([
      { x: 10, y: 5, width: 20, height: 10 },
      { x: 5, y: 20, width: 10, height: 20 },
    ])
  })

  it('respects origin offsets when computing rectangle centers', () => {
    const grid = [[false, true]]

    expect(mergeTileColliders(grid, 12, 14, 100, 200)).toEqual([{ x: 118, y: 207, width: 12, height: 14 }])
  })
})
