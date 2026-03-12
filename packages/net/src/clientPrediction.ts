import type { ECSWorld, WorldSnapshot } from '@cubeforge/core'

export interface PredictionConfig {
  /** ECS world instance. */
  world: ECSWorld
  /** Number of frames to keep in the rollback buffer (default 60). */
  bufferSize?: number
  /**
   * Optional re-simulation callback. When provided, `applyCorrection` will
   * re-simulate all frames from `tick+1` to the last saved frame using this
   * function after restoring the server snapshot.
   *
   * @param world - The world to simulate against.
   * @param inputs - The input state recorded for this tick via `saveFrame`.
   * @param dt - The fixed timestep for this tick (from `tickDt`).
   */
  simulate?: (world: ECSWorld, inputs: Record<string, boolean>, dt: number) => void
  /**
   * Fixed simulation timestep in seconds used when re-simulating frames
   * after a server correction (default 1/60).
   */
  tickDt?: number
}

interface FrameEntry {
  snapshot: WorldSnapshot
  inputs: Record<string, boolean>
}

/**
 * ClientPrediction — snapshot-based rollback with re-simulation for
 * client-side prediction.
 *
 * ### Basic usage (rollback only)
 * ```ts
 * const pred = new ClientPrediction({ world })
 * // Each tick:
 * pred.saveFrame(tick)
 * runLocalPhysics()
 * // On server correction:
 * pred.applyCorrection(serverSnapshot, tick)
 * ```
 *
 * ### With re-simulation
 * When a `simulate` function is provided, `applyCorrection` will:
 * 1. Restore the server-authoritative snapshot at `tick`.
 * 2. Re-run `simulate(world, inputs, dt)` for every buffered frame after
 *    `tick`, using the inputs recorded with each `saveFrame` call.
 * 3. Purge frames ≤ `tick` (superseded by server authority).
 *
 * ```ts
 * const pred = new ClientPrediction({
 *   world,
 *   simulate: (world, inputs, dt) => {
 *     applyInputs(world, inputs)
 *     physicsSystem.update(world, dt)
 *   },
 * })
 * // Each tick, pass current inputs:
 * pred.saveFrame(tick, { ArrowLeft: input.isDown('ArrowLeft'), Space: input.isDown('Space') })
 * ```
 */
export class ClientPrediction {
  private readonly _world: ECSWorld
  private readonly _bufferSize: number
  private readonly _simulate?: PredictionConfig['simulate']
  private readonly _tickDt: number
  /** Circular frame buffer: tick → { snapshot, inputs } */
  private readonly _frames = new Map<number, FrameEntry>()

  constructor(config: PredictionConfig) {
    this._world = config.world
    this._bufferSize = config.bufferSize ?? 60
    this._simulate = config.simulate
    this._tickDt = config.tickDt ?? 1 / 60
  }

  /**
   * Capture the current world state for the given tick.
   *
   * @param tick - Current simulation tick.
   * @param inputs - Input state this tick. Stored for re-simulation when a
   *   server correction arrives. Pass an empty object if not using re-simulation.
   */
  saveFrame(tick: number, inputs: Record<string, boolean> = {}): void {
    this._frames.set(tick, {
      snapshot: this._world.getSnapshot(),
      inputs,
    })

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
    const entry = this._frames.get(tick)
    if (!entry) return false
    this._world.restoreSnapshot(entry.snapshot)
    return true
  }

  /**
   * Apply a server-authoritative correction for the given tick, then
   * optionally re-simulate all subsequent buffered frames.
   *
   * If a `simulate` function was provided in config, this method replays every
   * frame from `tick+1` up to the last buffered tick using saved input records,
   * reconciling local prediction with server authority without a visible pop.
   *
   * @param serverSnapshot - Authoritative world state from the server.
   * @param tick - The tick the server snapshot corresponds to.
   */
  applyCorrection(serverSnapshot: unknown, tick: number): void {
    this._world.restoreSnapshot(serverSnapshot as WorldSnapshot)

    // Re-simulate forward using stored inputs if a simulate fn is provided
    if (this._simulate) {
      const laterTicks = [...this._frames.keys()].filter((t) => t > tick).sort((a, b) => a - b)
      for (const t of laterTicks) {
        const entry = this._frames.get(t)
        if (entry) {
          this._simulate(this._world, entry.inputs, this._tickDt)
        }
      }
    }

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
