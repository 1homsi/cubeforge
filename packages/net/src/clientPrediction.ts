import type { ECSWorld, WorldSnapshot } from '@cubeforge/core'

export interface PredictionConfig {
  /** ECS world instance. */
  world: ECSWorld
  /** Number of frames to keep in the rollback buffer (default 60). */
  bufferSize?: number
}

/**
 * ClientPrediction — snapshot-based rollback for client-side prediction.
 *
 * Usage pattern:
 *   1. Call `saveFrame(tick)` once per simulation tick, just before running
 *      local physics/input prediction.
 *   2. When an authoritative server snapshot arrives for a past tick, call
 *      `applyCorrection(serverSnapshot, tick)` which rolls back to that tick,
 *      restores authoritative state, and discards stale buffered frames.
 *   3. Call `rollbackTo(tick)` directly when you need to rewind without
 *      applying an external correction (e.g. local replay).
 */
export class ClientPrediction {
  private readonly _world: ECSWorld
  private readonly _bufferSize: number
  /** Circular frame buffer: tick → WorldSnapshot */
  private readonly _frames = new Map<number, WorldSnapshot>()

  constructor(config: PredictionConfig) {
    this._world = config.world
    this._bufferSize = config.bufferSize ?? 60
  }

  /** Capture the current world state for the given tick. */
  saveFrame(tick: number): void {
    this._frames.set(tick, this._world.getSnapshot())

    // Evict frames older than bufferSize.
    const minTick = tick - this._bufferSize
    for (const key of this._frames.keys()) {
      if (key < minTick) this._frames.delete(key)
    }
  }

  /**
   * Restore world state to the snapshot saved at `tick`.
   * Returns `true` if the snapshot was found, `false` otherwise.
   */
  rollbackTo(tick: number): boolean {
    const snapshot = this._frames.get(tick)
    if (!snapshot) return false
    this._world.restoreSnapshot(snapshot)
    return true
  }

  /**
   * Apply a server-authoritative correction for the given tick.
   *
   * Restores the provided `serverSnapshot` directly into the world (no local
   * buffer lookup needed — the server is the authority) and purges buffered
   * frames older than `tick` since they are now superseded.
   */
  applyCorrection(serverSnapshot: unknown, tick: number): void {
    this._world.restoreSnapshot(serverSnapshot as WorldSnapshot)

    // Discard frames up to and including the corrected tick.
    for (const key of this._frames.keys()) {
      if (key <= tick) this._frames.delete(key)
    }
  }

  /** Number of frames currently held in the buffer. */
  get bufferedFrameCount(): number {
    return this._frames.size
  }
}
