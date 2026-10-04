/**
 * Renderer counters. One instance per render system, mutated in place every
 * frame (no per-frame allocation). Fields marked "frame" reset at the start of
 * each rendered frame; the rest are running totals or current sizes.
 */
export interface RenderStats {
  /** frame: GL draw calls of any kind (instanced batches, parallax, post-process). */
  drawCalls: number
  /** frame: quad instances submitted across all instanced draws. */
  instances: number
  /** frame: instanced sprite batches flushed (subset of drawCalls). */
  batches: number
  /** frame: Transform+Sprite entities considered by the sprite pass. */
  spritesConsidered: number
  /** frame: sprites rejected by frustum culling. */
  spritesCulled: number
  /** frame: texture uploads (texImage2D / texSubImage2D). */
  textureUploads: number
  /** frame: approximate bytes uploaded to textures (w * h * 4). */
  textureUploadBytes: number
  /** Live GPU textures created by the renderer (excluding the 1x1 white texture). */
  textureCount: number
  /** Approximate GPU memory held by those textures, in bytes (w * h * 4). */
  textureBytes: number
  /** total: text texture cache hits / misses since creation. */
  textCacheHits: number
  textCacheMisses: number
  /** total: sprite texture cache hits / misses since creation. */
  textureCacheHits: number
  textureCacheMisses: number
  /** total: rendered frames (excludes idle-skipped frames). */
  frames: number
}

export function createRenderStats(): RenderStats {
  return {
    drawCalls: 0,
    instances: 0,
    batches: 0,
    spritesConsidered: 0,
    spritesCulled: 0,
    textureUploads: 0,
    textureUploadBytes: 0,
    textureCount: 0,
    textureBytes: 0,
    textCacheHits: 0,
    textCacheMisses: 0,
    textureCacheHits: 0,
    textureCacheMisses: 0,
    frames: 0,
  }
}

export function resetRenderFrameStats(s: RenderStats): void {
  s.drawCalls = 0
  s.instances = 0
  s.batches = 0
  s.spritesConsidered = 0
  s.spritesCulled = 0
  s.textureUploads = 0
  s.textureUploadBytes = 0
}

/** Whole-engine stats for the last frame. Timings are milliseconds. */
export interface EngineStats {
  /** Total frames stepped. */
  frame: number
  /** Wall time between the last two frame starts. */
  frameIntervalMs: number
  /** Time spent in `ecs.update` (all systems, including render). */
  updateMs: number
  /** `updateMs` minus render: ECS + game systems. */
  systemsMs: number
  /** ScriptSystem time (per-entity script / React-registered update callbacks). */
  scriptMs: number
  physicsMs: number
  renderMs: number
  entityCount: number
  render: RenderStats
}

export function createEngineStats(render: RenderStats = createRenderStats()): EngineStats {
  return {
    frame: 0,
    frameIntervalMs: 0,
    updateMs: 0,
    systemsMs: 0,
    scriptMs: 0,
    physicsMs: 0,
    renderMs: 0,
    entityCount: 0,
    render,
  }
}

/** Copy `src` into `out` (allocating `out` only when omitted). */
export function copyEngineStats(src: EngineStats, out?: EngineStats): EngineStats {
  const o = out ?? createEngineStats()
  const r = o.render
  Object.assign(o, src)
  o.render = Object.assign(r, src.render)
  return o
}
