/** Maps frame names to frameIndex numbers */
export type SpriteAtlas = Record<string, number>

/**
 * Helper to build an atlas from a grid spritesheet.
 * columns = number of frames per row.
 * names = frame names in row-major order.
 */
export function createAtlas(names: string[], _columns: number): SpriteAtlas {
  const atlas: SpriteAtlas = {}
  names.forEach((name, i) => {
    atlas[name] = i
  })
  return atlas
}
