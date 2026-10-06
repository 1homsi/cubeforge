// GPU frame timing via EXT_disjoint_timer_query_webgl2. Loaded lazily
// (`import('./gpuTimer')`) only when a consumer asks for GPU time, so games
// that never read it pay no bundle or per-frame cost.

import type { RenderStats } from '@cubeforge/core'

interface TimerExt {
  readonly TIME_ELAPSED_EXT: number
  readonly GPU_DISJOINT_EXT: number
}

/** Queries in flight; results arrive 1-3 frames late, so a short ring never stalls. */
const RING = 6
/** Smoothing factor of the exponential average. */
const ALPHA = 0.1

class GpuTimer {
  /** Latest finished measurement in ms, or null before the first result. */
  ms: number | null = null
  /** Exponential average of `ms`. */
  avg: number | null = null
  private readonly queries: (WebGLQuery | null)[] = new Array(RING).fill(null)
  /** Slot states: 0 free, 1 submitted (waiting for the GPU). */
  private readonly pending = new Uint8Array(RING)
  /** Submission order of pending slots (oldest first). */
  private readonly order: number[] = []
  private active = -1

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly ext: TimerExt,
  ) {}

  /** Returns null when the extension is missing (or the context is lost). */
  static create(gl: WebGL2RenderingContext): GpuTimer | null {
    if (gl.isContextLost()) return null
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null
    return ext ? new GpuTimer(gl, ext) : null
  }

  /** Start timing a frame. Also collects results of earlier frames. Never blocks. */
  begin(): void {
    const { gl } = this
    if (this.active >= 0 || gl.isContextLost()) return
    this.collect()
    let slot = -1
    for (let i = 0; i < RING; i++) {
      if (!this.pending[i]) {
        slot = i
        break
      }
    }
    if (slot < 0) return // the GPU is RING frames behind: skip this frame's sample
    const q = (this.queries[slot] ??= gl.createQuery())
    if (!q) return
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q)
    this.active = slot
  }

  /** Stop timing the frame started by `begin`. */
  end(): void {
    const slot = this.active
    if (slot < 0) return
    this.active = -1
    const { gl } = this
    if (gl.isContextLost()) return
    gl.endQuery(this.ext.TIME_ELAPSED_EXT)
    this.pending[slot] = 1
    this.order.push(slot)
  }

  private collect(): void {
    const { gl, order } = this
    if (order.length === 0) return
    // A disjoint event (GPU switch, power throttle) invalidates every pending result.
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean
    while (order.length > 0) {
      const slot = order[0]
      const q = this.queries[slot]!
      if (!disjoint && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break
      order.shift()
      this.pending[slot] = 0
      if (disjoint) continue
      const ms = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6
      this.ms = ms
      this.avg = this.avg === null ? ms : this.avg + (ms - this.avg) * ALPHA
    }
  }

  /** GL objects died with the context. Drop them; the next `begin` recreates queries. */
  contextRestored(): void {
    this.queries.fill(null)
    this.pending.fill(0)
    this.order.length = 0
    this.active = -1
    this.ms = null
    this.avg = null
  }

  dispose(): void {
    const { gl } = this
    if (!gl.isContextLost()) {
      if (this.active >= 0) gl.endQuery(this.ext.TIME_ELAPSED_EXT)
      for (const q of this.queries) if (q) gl.deleteQuery(q)
    }
    this.contextRestored()
  }
}

/** Owned by the RenderSystem: switches the timer on/off and publishes results into `RenderStats`. */
export class GpuTiming {
  private timer: GpuTimer | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly stats: RenderStats,
  ) {}

  /** Returns whether a timer is measuring (false when the extension is missing). */
  set(on: boolean): boolean {
    const s = this.stats
    if (!on) {
      this.timer?.dispose()
      this.timer = null
      s.gpuMs = s.gpuMsAvg = s.gpuTimerSupported = null
      return false
    }
    if (!this.timer) {
      this.timer = GpuTimer.create(this.gl)
      s.gpuTimerSupported = this.timer !== null
    }
    return this.timer !== null
  }

  begin(): void {
    this.timer?.begin()
  }

  end(): void {
    const t = this.timer
    if (!t) return
    t.end()
    this.stats.gpuMs = t.ms
    this.stats.gpuMsAvg = t.avg
  }

  contextRestored(): void {
    this.timer?.contextRestored()
  }

  dispose(): void {
    this.set(false)
  }
}
