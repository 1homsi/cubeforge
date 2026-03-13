/**
 * Interpolation buffer for smooth remote entity movement.
 *
 * Holds a ring of timestamped snapshots from a remote peer and returns a
 * linearly interpolated value at a render time that lags behind real-time
 * by `bufferMs`. This guarantees two samples are always available for
 * interpolation as long as packets arrive regularly.
 *
 * ### Usage
 * ```ts
 * const buf = new InterpolationBuffer({ bufferMs: 100 })
 *
 * // On every received network state:
 * room.onMessage((msg) => {
 *   if (msg.type === 'entity:state') {
 *     buf.push(Date.now(), msg.payload as InterpolationState)
 *   }
 * })
 *
 * // Each render frame (inside a Script useUpdate):
 * const state = buf.sample(Date.now())
 * if (state) {
 *   transform.x = state.x
 *   transform.y = state.y
 * }
 * ```
 */

export interface InterpolationState {
  x: number
  y: number
  /** Rotation in radians — interpolated via shortest-path slerp. */
  angle?: number
  /** Any additional numeric fields are lerped automatically. */
  [key: string]: number | undefined
}

export interface InterpolationBufferConfig {
  /**
   * How many milliseconds behind real-time to sample (default 100 ms).
   * Higher = smoother but more visible latency.
   * Lower = less latency but more jitter on packet loss.
   * Rule of thumb: ~1.5× your expected one-way network latency.
   */
  bufferMs?: number
  /** Maximum number of snapshots to keep (default 32). */
  capacity?: number
}

interface Snapshot {
  timestamp: number
  state: InterpolationState
}

export class InterpolationBuffer {
  private readonly _snapshots: Snapshot[] = []
  private readonly _bufferMs: number
  private readonly _capacity: number

  constructor(config: InterpolationBufferConfig = {}) {
    this._bufferMs = config.bufferMs ?? 100
    this._capacity = config.capacity ?? 32
  }

  /**
   * Push a new state snapshot received from the remote peer.
   *
   * @param timestamp - Arrival time in ms (`Date.now()`).
   * @param state - The entity state at that timestamp.
   */
  push(timestamp: number, state: InterpolationState): void {
    this._snapshots.push({ timestamp, state })
    if (this._snapshots.length > this._capacity) {
      this._snapshots.shift()
    }
  }

  /**
   * Sample the interpolated state at `renderTime - bufferMs`.
   *
   * Returns `null` when no snapshots have been received yet.
   * When the sample time is ahead of all received snapshots (stall),
   * returns the last known state to avoid popping.
   *
   * @param renderTime - Current time in ms (`Date.now()`).
   */
  sample(renderTime: number): InterpolationState | null {
    const snaps = this._snapshots
    if (snaps.length === 0) return null

    const sampleTime = renderTime - this._bufferMs

    // Find the two snapshots that bracket sampleTime.
    let before: Snapshot | null = null
    let after: Snapshot | null = null

    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].timestamp <= sampleTime) {
        before = snaps[i]
        after = snaps[i + 1] ?? null
        break
      }
    }

    // sampleTime is before the oldest snapshot — no data yet, hold first known.
    if (before === null) return { ...snaps[0].state }

    // sampleTime is past all snapshots — hold last known state.
    if (after === null) return { ...snaps[snaps.length - 1].state }

    const t = clamp01((sampleTime - before.timestamp) / (after.timestamp - before.timestamp))
    return lerpState(before.state, after.state, t)
  }

  /** Number of snapshots currently buffered. */
  get length(): number {
    return this._snapshots.length
  }

  /** Clear all buffered snapshots. */
  clear(): void {
    this._snapshots.length = 0
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function lerpAngle(a: number, b: number, t: number): number {
  // Shortest-path angle interpolation.
  let diff = b - a
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return a + diff * t
}

function lerpState(a: InterpolationState, b: InterpolationState, t: number): InterpolationState {
  const result: InterpolationState = {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }

  if (a.angle !== undefined && b.angle !== undefined) {
    result.angle = lerpAngle(a.angle, b.angle, t)
  }

  // Lerp any additional numeric fields present on both states.
  for (const key of Object.keys(a)) {
    if (key === 'x' || key === 'y' || key === 'angle') continue
    const av = a[key]
    const bv = b[key]
    if (typeof av === 'number' && typeof bv === 'number') {
      result[key] = av + (bv - av) * t
    }
  }

  return result
}
