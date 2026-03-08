// Parses CSS color strings to [r, g, b, a] in 0..1 range.
// Results are cached so repeated calls (same color string) are O(1).
const cache = new Map<string, [number, number, number, number]>()

export function parseCSSColor(css: string): [number, number, number, number] {
  const hit = cache.get(css)
  if (hit) return hit

  let result: [number, number, number, number] = [1, 1, 1, 1]

  if (css.startsWith('#')) {
    const h = css.slice(1)
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16) / 255
      const g = parseInt(h[1] + h[1], 16) / 255
      const b = parseInt(h[2] + h[2], 16) / 255
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1
      result = [r, g, b, a]
    } else if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16) / 255
      const g = parseInt(h.slice(2, 4), 16) / 255
      const b = parseInt(h.slice(4, 6), 16) / 255
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      result = [r, g, b, a]
    }
  } else {
    const m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/)
    if (m) {
      result = [
        parseInt(m[1]) / 255,
        parseInt(m[2]) / 255,
        parseInt(m[3]) / 255,
        m[4] !== undefined ? parseFloat(m[4]) : 1,
      ]
    }
  }

  cache.set(css, result)
  return result
}
