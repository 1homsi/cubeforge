import type { ECSWorld, EntityId, TransformComponent } from '@cubeforge/core'
import type { TextComponent } from './components/text'
import { GlyphAtlas } from './glyphAtlas'
import { TextLayer, TEXT_HIDDEN, TEXT_WORD_WRAP, type RunLayout } from './textLayer'
import { parseCSSColor } from './colorParser'
import { rasterizeText, textRasterKey, type TextRaster } from './textTexture'

/**
 * Batches `Text` entities through the shared glyph atlas: instead of one
 * texture and one draw call per entity, every plain-text entity becomes a run
 * of an internal {@link TextLayer}. Text the atlas cannot lay out faithfully
 * (right-to-left / complex scripts, `maxWidth` squeeze) is handed back in
 * `fallback` for the per-entity canvas path.
 */
export interface EntityTextBatcher {
  /** Runs for entities without a `layer`: drawn after sprites, ordered by `zIndex`. */
  readonly tail: TextLayer
  /** One layer per (render layer, zIndex) of entities that set `layer`: they join the sprite sort. */
  readonly sortedLayers: TextLayer[]
  /** Entities to draw through the per-entity canvas texture path, ordered by zIndex. */
  readonly fallback: EntityId[]
  /** Refresh runs from the world. `scaleHint` = zoom x device pixel ratio. */
  sync(world: ECSWorld, scaleHint: number): void
  /** Canvas2D rasterisation for the fallback path. */
  raster(text: TextComponent, scale: number): TextRaster
  rasterKey(text: TextComponent, scale: number): string
}

// Marks, shaping and right-to-left scripts the per-code-point layout cannot do.
const COMPLEX = /[̀-ͯ֐-ࣿऀ-๿‌-‏‪-‮יִ-﷿︀-️ﹰ-ﻼ]/

interface State {
  comp: TextComponent
  group: Group | null
  slot: number
  stamp: number
  // style inputs the current styleId was computed from
  q: number
  family: string | undefined
  fs: number
  weight: string | number | undefined
  fontStyle: string | undefined
  fxColor: string | undefined
  strokeColor: string | undefined
  strokeWidth: number | undefined
  shadowColor: string | undefined
  sox: number | undefined
  soy: number | undefined
  blur: number | undefined
  styleId: number
  colorSrc: string
  rgba: number
  lay: RunLayout | undefined
  baseline: string
  anchorY: number
  plainText: string
  plain: boolean
}

interface Group {
  key: string
  layer: TextLayer
  owners: State[]
  styles: Map<string, number>
}

const ALIGN: Record<string, number> = { left: 0, start: 0, center: 1, right: 2, end: 2 }

function toRGBA(css: string): number {
  const [r, g, b, a] = parseCSSColor(css)
  return (
    ((Math.round(r * 255) << 24) | (Math.round(g * 255) << 16) | (Math.round(b * 255) << 8) | Math.round(a * 255)) >>> 0
  )
}

class Batcher implements EntityTextBatcher {
  readonly tail: TextLayer
  readonly sortedLayers: TextLayer[] = []
  readonly fallback: EntityId[] = []
  readonly raster = rasterizeText
  readonly rasterKey = textRasterKey
  private readonly atlas = GlyphAtlas.shared
  private readonly groups = new Map<string, Group>()
  private readonly groupList: Group[] = []
  private readonly states = new Map<TextComponent, State>()
  private frame = 0

  constructor() {
    this.tail = new TextLayer({ atlas: this.atlas, sortByKey: true, zoomAware: false })
    const tail: Group = { key: '', layer: this.tail, owners: [], styles: new Map() }
    this.groups.set('', tail)
    this.groupList.push(tail)
  }

  private group(t: TextComponent): Group {
    const key = t.layer ? `${t.layer}\u0000${t.zIndex}` : ''
    let g = this.groups.get(key)
    if (!g) {
      const layer = new TextLayer({ atlas: this.atlas, layer: t.layer, zIndex: t.zIndex, zoomAware: false })
      g = { key, layer, owners: [], styles: new Map() }
      this.groups.set(key, g)
      this.groupList.push(g)
      this.sortedLayers.push(layer)
    }
    return g
  }

  private detach(st: State): void {
    const g = st.group!
    const i = st.slot
    const last = g.layer.count - 1
    g.layer.removeAt(i)
    if (i !== last) {
      g.owners[i] = g.owners[last]
      g.owners[i].slot = i
    }
    g.owners.length = last
    st.group = null
  }

  sync(world: ECSWorld, scaleHint: number): void {
    const frame = ++this.frame
    // Raster density: the atlas already rasterises at 2x; go to 4x / 8x when zoomed in.
    const q = scaleHint <= 2 ? 1 : scaleHint <= 4 ? 2 : 4
    this.fallback.length = 0
    const fb = this.fallback
    for (const id of world.query('Transform', 'Text')) {
      const t = world.getComponent<TextComponent>(id, 'Text')!
      if (!t.visible) continue
      const st = this.states.get(t) ?? this.newState(t)
      if (st.plainText !== t.text) {
        st.plainText = t.text
        st.plain = !COMPLEX.test(t.text)
      }
      if (!st.plain) {
        fb.push(id)
        continue
      }
      const tr = world.getComponent<TransformComponent>(id, 'Transform')!
      if (!this.write(st, t, tr, q)) fb.push(id)
      st.stamp = frame
    }
    // Drop runs whose entity vanished, hid, or went to the fallback path.
    for (let gi = this.groupList.length - 1; gi >= 0; gi--) {
      const g = this.groupList[gi]
      for (let i = g.layer.count - 1; i >= 0; i--) {
        const st = g.owners[i]
        if (st.stamp !== frame) {
          this.detach(st)
          this.states.delete(st.comp)
        }
      }
      if (g.key !== '' && g.layer.count === 0) {
        this.groups.delete(g.key)
        this.groupList.splice(gi, 1)
        this.sortedLayers.splice(this.sortedLayers.indexOf(g.layer), 1)
      }
    }
    if (fb.length > 1)
      fb.sort(
        (a, b) =>
          world.getComponent<TextComponent>(a, 'Text')!.zIndex - world.getComponent<TextComponent>(b, 'Text')!.zIndex,
      )
  }

  private newState(t: TextComponent): State {
    const st: State = {
      comp: t,
      group: null,
      slot: -1,
      stamp: 0,
      q: 0,
      family: undefined,
      fs: 0,
      weight: undefined,
      fontStyle: undefined,
      fxColor: undefined,
      strokeColor: undefined,
      strokeWidth: undefined,
      shadowColor: undefined,
      sox: undefined,
      soy: undefined,
      blur: undefined,
      styleId: 0,
      colorSrc: '',
      rgba: 0xffffffff,
      lay: undefined,
      baseline: '',
      anchorY: 0,
      plainText: '\u0000',
      plain: true,
    }
    this.states.set(t, st)
    return st
  }

  /** Update (or create) the run for `st`. Returns false when the text needs the canvas path. */
  private write(st: State, t: TextComponent, tr: TransformComponent, q: number): boolean {
    let g = this.group(t)
    if (st.group !== g) {
      if (st.group) this.detach(st)
      const i = g.layer.add(t.text, 0, 0)
      g.owners[i] = st
      st.group = g
      st.slot = i
      st.lay = undefined
      st.q = 0 // force a style lookup in the new layer
    }
    const layer = g.layer
    const i = st.slot
    const hasFx = !!(t.strokeColor && t.strokeWidth) || !!t.shadowColor
    const fs = t.fontSize ?? 16
    const fxColor = hasFx ? t.color : ''
    if (
      st.q !== q ||
      st.family !== t.fontFamily ||
      st.fs !== fs ||
      st.weight !== t.fontWeight ||
      st.fontStyle !== t.fontStyle ||
      st.fxColor !== fxColor ||
      st.strokeColor !== t.strokeColor ||
      st.strokeWidth !== t.strokeWidth ||
      st.shadowColor !== t.shadowColor ||
      st.sox !== t.shadowOffsetX ||
      st.soy !== t.shadowOffsetY ||
      st.blur !== t.shadowBlur
    ) {
      st.q = q
      st.family = t.fontFamily
      st.fs = fs
      st.weight = t.fontWeight
      st.fontStyle = t.fontStyle
      st.fxColor = fxColor
      st.strokeColor = t.strokeColor
      st.strokeWidth = t.strokeWidth
      st.shadowColor = t.shadowColor
      st.sox = t.shadowOffsetX
      st.soy = t.shadowOffsetY
      st.blur = t.shadowBlur
      const sig = `${t.fontFamily}|${fs}|${t.fontWeight ?? ''}|${t.fontStyle ?? ''}|${fxColor}|${t.strokeColor ?? ''}|${t.strokeWidth ?? 0}|${t.shadowColor ?? ''}|${t.shadowOffsetX ?? 2}|${t.shadowOffsetY ?? 2}|${t.shadowBlur ?? 0}|${q}`
      let id = g.styles.get(sig)
      if (id === undefined) {
        id = layer.addStyle({
          fontFamily: t.fontFamily ?? 'monospace',
          fontSize: fs * q,
          weight: t.fontWeight,
          italic: t.fontStyle === 'italic',
          color: hasFx ? t.color : undefined,
          outlineColor: t.strokeColor && t.strokeWidth ? t.strokeColor : undefined,
          outlineWidth: t.strokeColor && t.strokeWidth ? t.strokeWidth * q : undefined,
          shadowColor: t.shadowColor,
          shadowOffsetX: (t.shadowOffsetX ?? 2) * q,
          shadowOffsetY: (t.shadowOffsetY ?? 2) * q,
          shadowBlur: (t.shadowBlur ?? 0) * q,
        })
        g.styles.set(sig, id)
      }
      st.styleId = id
    }
    if (!hasFx) {
      if (st.colorSrc !== t.color) {
        st.colorSrc = t.color
        st.rgba = toRGBA(t.color ?? '#ffffff')
      }
      layer.color[i] = st.rgba
    } else layer.color[i] = 0xffffffff
    layer.setText(i, t.text)
    layer.x[i] = tr.x + t.offsetX
    layer.y[i] = tr.y + t.offsetY
    layer.rotation[i] = tr.rotation
    layer.size[i] = fs
    layer.style[i] = st.styleId
    layer.alpha[i] = t.opacity ?? 1
    layer.sortKey[i] = t.zIndex
    layer.lineHeight[i] = t.lineHeight ?? 1.2
    const align = ALIGN[t.align] ?? 1
    layer.align[i] = align
    layer.anchorX[i] = align / 2
    const wrap = !!(t.wordWrap && t.maxWidth)
    layer.maxWidth[i] = t.maxWidth ?? 0
    layer.flags[i] = wrap ? TEXT_WORD_WRAP : 0
    const lay = layer.layout(i)
    const as = layer.atlasStyle(st.styleId)
    if (!t.wordWrap && t.maxWidth && lay.width * (fs / as.rasterSize) > t.maxWidth + 0.5) {
      // fillText(maxWidth) squeezes the line; only the canvas path can.
      layer.flags[i] |= TEXT_HIDDEN
      return false
    }
    if (lay !== st.lay || st.baseline !== t.baseline) {
      st.lay = lay
      st.baseline = t.baseline
      const lineH = (t.lineHeight ?? 1.2) * as.rasterSize
      const em = as.ascent + as.descent
      const top = (lineH - em) / 2
      const ref =
        t.baseline === 'top' || t.baseline === 'hanging'
          ? top
          : t.baseline === 'alphabetic'
            ? top + as.ascent
            : t.baseline === 'bottom' || t.baseline === 'ideographic'
              ? top + em
              : lineH / 2
      st.anchorY = lay.height > 0 ? ref / lay.height : 0
    }
    layer.anchorY[i] = st.anchorY
    return true
  }
}

export function createEntityTextBatcher(): EntityTextBatcher {
  return new Batcher()
}
