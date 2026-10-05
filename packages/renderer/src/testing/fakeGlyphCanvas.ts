import type { GlyphAtlasOptions } from '../glyphAtlas'

/**
 * Canvas stand-in for glyph atlases in headless tests: every glyph is 0.6 em
 * wide (spaces 0.3 em), 0.7 em above and 0.2 em below the baseline. Records
 * how many glyphs were drawn.
 */
export function createFakeGlyphCanvas(): {
  createCanvas: NonNullable<GlyphAtlasOptions['createCanvas']>
  drawn: string[]
} {
  const drawn: string[] = []
  const createCanvas = (width: number, height: number) => {
    const state = { font: '10px sans-serif' }
    const px = () => Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 10)
    const noop = () => {}
    const ctx = new Proxy(
      {
        measureText: (ch: string) => {
          const em = px()
          const w = (ch === ' ' ? 0.3 : 0.6) * em
          return {
            width: w,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: ch === ' ' ? 0 : w,
            actualBoundingBoxAscent: ch === ' ' ? 0 : 0.7 * em,
            actualBoundingBoxDescent: ch === ' ' ? 0 : 0.2 * em,
            fontBoundingBoxAscent: 0.8 * em,
            fontBoundingBoxDescent: 0.2 * em,
          }
        },
        fillText: (ch: string) => void drawn.push(ch),
        strokeText: noop,
      } as Record<string, unknown>,
      {
        get: (t, k: string) => (k === 'font' ? state.font : k in t ? t[k] : noop),
        set: (t, k: string, v) => {
          if (k === 'font') state.font = v as string
          else t[k] = v
          return true
        },
      },
    )
    return { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement
  }
  return { createCanvas, drawn }
}
