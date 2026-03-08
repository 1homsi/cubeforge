export interface MergedRect {
  x: number      // world x (center)
  y: number      // world y (center)
  width: number   // pixels
  height: number  // pixels
}

/**
 * Merge adjacent solid tiles into larger rectangles using a greedy algorithm.
 * Iterates rows, extends horizontally, then extends downward.
 */
export function mergeTileColliders(
  solidGrid: boolean[][],  // [row][col]
  tileWidth: number,
  tileHeight: number,
  originX: number,   // world-space origin of the tilemap
  originY: number,
): MergedRect[] {
  const rows = solidGrid.length
  if (rows === 0) return []
  const cols = solidGrid[0].length

  const visited: boolean[][] = []
  for (let r = 0; r < rows; r++) {
    visited[r] = new Array(cols).fill(false)
  }

  const rects: MergedRect[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!solidGrid[row][col] || visited[row][col]) continue

      // Extend right: find max column where all cells are solid and not visited
      let maxCol = col
      while (maxCol + 1 < cols && solidGrid[row][maxCol + 1] && !visited[row][maxCol + 1]) {
        maxCol++
      }

      // Extend down: for each subsequent row, check if the entire horizontal span is solid and not visited
      let maxRow = row
      outer:
      for (let r = row + 1; r < rows; r++) {
        for (let c = col; c <= maxCol; c++) {
          if (!solidGrid[r][c] || visited[r][c]) break outer
        }
        maxRow = r
      }

      // Mark all cells in the rectangle as visited
      for (let r = row; r <= maxRow; r++) {
        for (let c = col; c <= maxCol; c++) {
          visited[r][c] = true
        }
      }

      // Calculate center position and dimensions
      const spanCols = maxCol - col + 1
      const spanRows = maxRow - row + 1
      const width = spanCols * tileWidth
      const height = spanRows * tileHeight

      const x = originX + col * tileWidth + width / 2
      const y = originY + row * tileHeight + height / 2

      rects.push({ x, y, width, height })
    }
  }

  return rects
}
