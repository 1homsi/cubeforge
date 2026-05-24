/**
 * AudioOcclusion — geometry-based 3D spatial audio with occlusion.
 *
 * Uses the Web Audio API (PannerNode per source) and raycasts from the
 * listener to each source through occluder bounding boxes to attenuate
 * volume for obstructed sources.
 */

import { Vec3 } from '../math'
import { Object3D } from '../scene'
import { Mesh } from '../objects'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioSource3D {
  id: string
  position: Vec3
  panner: PannerNode
  gainNode: GainNode
  /** Base volume before occlusion (0–1). */
  baseVolume: number
  /** The connected AudioBufferSourceNode (if playing). */
  _sourceNode: AudioBufferSourceNode | null
}

export interface AudioOcclusionOptions {
  /** Reuse an existing AudioContext, or one is created automatically. */
  context?: AudioContext
  /** Distance-based rolloff factor (default 1). */
  rolloffFactor?: number
  /** Distance at which the source plays at full volume (default 1). */
  refDistance?: number
  /** Distance beyond which the source is silent (default 100). */
  maxDistance?: number
  /** Volume multiplier applied per occluder hit (default 0.5). */
  occlusionAttenuation?: number
  /** Maximum raycasts performed per update call (default 8). */
  maxRaycasts?: number
  /** Minimum seconds between full occlusion sweeps (default 0.1). */
  updateInterval?: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Simple axis-aligned bounding box for ray intersection. */
interface AABB {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

function rayIntersectsAABB(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  aabb: AABB,
): boolean {
  // Slab method
  let tmin = 0
  let tmax = maxDist

  const axes: [number, number, number, number, number, number][] = [
    [ox, dx, aabb.minX, aabb.maxX, 0, 0],
    [oy, dy, aabb.minY, aabb.maxY, 0, 0],
    [oz, dz, aabb.minZ, aabb.maxZ, 0, 0],
  ]

  for (const [o, d, bmin, bmax] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < bmin || o > bmax) return false
    } else {
      const invD = 1 / d
      let t1 = (bmin - o) * invD
      let t2 = (bmax - o) * invD
      if (t1 > t2) {
        const tmp = t1
        t1 = t2
        t2 = tmp
      }
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) return false
    }
  }
  return tmax >= 0
}

/** Extract an AABB from an Object3D tree (uses matrixWorld + bounding box). */
function getWorldAABB(obj: Object3D): AABB | null {
  // Collect all Mesh children and union their bounding spheres as AABBs
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity
  let found = false

  obj.traverseVisible((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry
    if (!geo.boundingSphere) geo.computeBoundingSphere()
    const bs = geo.boundingSphere
    if (!bs) return

    const mw = mesh.matrixWorld.elements
    const cx = mw[0] * bs.center.x + mw[4] * bs.center.y + mw[8] * bs.center.z + mw[12]
    const cy = mw[1] * bs.center.x + mw[5] * bs.center.y + mw[9] * bs.center.z + mw[13]
    const cz = mw[2] * bs.center.x + mw[6] * bs.center.y + mw[10] * bs.center.z + mw[14]

    // Approximate world-space radius
    const sx = Math.sqrt(mw[0] ** 2 + mw[1] ** 2 + mw[2] ** 2)
    const sy = Math.sqrt(mw[4] ** 2 + mw[5] ** 2 + mw[6] ** 2)
    const sz = Math.sqrt(mw[8] ** 2 + mw[9] ** 2 + mw[10] ** 2)
    const r = bs.radius * Math.max(sx, sy, sz)

    minX = Math.min(minX, cx - r)
    maxX = Math.max(maxX, cx + r)
    minY = Math.min(minY, cy - r)
    maxY = Math.max(maxY, cy + r)
    minZ = Math.min(minZ, cz - r)
    maxZ = Math.max(maxZ, cz + r)
    found = true
  })

  if (!found) return null
  return { minX, minY, minZ, maxX, maxY, maxZ }
}

// ---------------------------------------------------------------------------
// AudioOcclusion
// ---------------------------------------------------------------------------

export class AudioOcclusion {
  readonly context: AudioContext

  private readonly _opts: Required<AudioOcclusionOptions>
  private readonly _sources = new Map<string, AudioSource3D>()

  /** Listener world position (updated by setListener). */
  private readonly _listenerPos = new Vec3()

  /** Round-robin update index so we distribute raycasts across frames. */
  private _roundRobinIdx = 0

  /** Time accumulator for throttled updates. */
  private _timeSinceUpdate = 0

  constructor(opts?: AudioOcclusionOptions) {
    this._opts = {
      context: opts?.context ?? new AudioContext(),
      rolloffFactor: opts?.rolloffFactor ?? 1,
      refDistance: opts?.refDistance ?? 1,
      maxDistance: opts?.maxDistance ?? 100,
      occlusionAttenuation: opts?.occlusionAttenuation ?? 0.5,
      maxRaycasts: opts?.maxRaycasts ?? 8,
      updateInterval: opts?.updateInterval ?? 0.1,
    }
    this.context = this._opts.context
  }

  // ---------------------------------------------------------------------------
  // Listener
  // ---------------------------------------------------------------------------

  /**
   * Update the audio listener's position and orientation.
   * Call once per frame, typically with the camera's world-space values.
   */
  setListener(position: Vec3, forward: Vec3, up: Vec3): void {
    this._listenerPos.set(position.x, position.y, position.z)
    const listener = this.context.listener

    if (listener.positionX !== undefined) {
      listener.positionX.setValueAtTime(position.x, this.context.currentTime)
      listener.positionY.setValueAtTime(position.y, this.context.currentTime)
      listener.positionZ.setValueAtTime(position.z, this.context.currentTime)
      listener.forwardX.setValueAtTime(forward.x, this.context.currentTime)
      listener.forwardY.setValueAtTime(forward.y, this.context.currentTime)
      listener.forwardZ.setValueAtTime(forward.z, this.context.currentTime)
      listener.upX.setValueAtTime(up.x, this.context.currentTime)
      listener.upY.setValueAtTime(up.y, this.context.currentTime)
      listener.upZ.setValueAtTime(up.z, this.context.currentTime)
    } else {
      // Older API fallback
      ;(listener as { setPosition?(x: number, y: number, z: number): void }).setPosition?.(
        position.x,
        position.y,
        position.z,
      )
      ;(
        listener as { setOrientation?(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void }
      ).setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z)
    }
  }

  // ---------------------------------------------------------------------------
  // Sources
  // ---------------------------------------------------------------------------

  /** Register a new spatial audio source. Returns the AudioSource3D descriptor. */
  addSource(id: string, position: Vec3, audioBuffer?: AudioBuffer): AudioSource3D {
    if (this._sources.has(id)) {
      return this._sources.get(id)!
    }

    const ctx = this.context

    const gainNode = ctx.createGain()
    gainNode.gain.value = 1.0

    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.rolloffFactor = this._opts.rolloffFactor
    panner.refDistance = this._opts.refDistance
    panner.maxDistance = this._opts.maxDistance
    panner.positionX.setValueAtTime(position.x, ctx.currentTime)
    panner.positionY.setValueAtTime(position.y, ctx.currentTime)
    panner.positionZ.setValueAtTime(position.z, ctx.currentTime)

    // Routing: sourceNode → gainNode → panner → destination
    gainNode.connect(panner)
    panner.connect(ctx.destination)

    const src: AudioSource3D = {
      id,
      position: new Vec3(position.x, position.y, position.z),
      panner,
      gainNode,
      baseVolume: 1.0,
      _sourceNode: null,
    }

    if (audioBuffer) {
      const sourceNode = ctx.createBufferSource()
      sourceNode.buffer = audioBuffer
      sourceNode.loop = true
      sourceNode.connect(gainNode)
      sourceNode.start(0)
      src._sourceNode = sourceNode
    }

    this._sources.set(id, src)
    return src
  }

  /** Update the world-space position of an existing source. */
  moveSource(id: string, position: Vec3): void {
    const src = this._sources.get(id)
    if (!src) return
    src.position.set(position.x, position.y, position.z)
    const t = this.context.currentTime
    src.panner.positionX.setValueAtTime(position.x, t)
    src.panner.positionY.setValueAtTime(position.y, t)
    src.panner.positionZ.setValueAtTime(position.z, t)
  }

  /** Remove a source and disconnect its audio graph. */
  removeSource(id: string): void {
    const src = this._sources.get(id)
    if (!src) return

    src._sourceNode?.stop()
    src._sourceNode?.disconnect()
    src.gainNode.disconnect()
    src.panner.disconnect()

    this._sources.delete(id)
  }

  // ---------------------------------------------------------------------------
  // Occlusion update
  // ---------------------------------------------------------------------------

  /**
   * Update occlusion attenuation. Call each frame with the list of occluder
   * Object3D nodes (typically static geometry) and the elapsed time in seconds.
   *
   * Raycasts are throttled to `maxRaycasts` per call, distributed round-robin
   * across all registered sources.
   */
  update(occluders: Object3D[], dt: number): void {
    this._timeSinceUpdate += dt
    if (this._timeSinceUpdate < this._opts.updateInterval) return
    this._timeSinceUpdate = 0

    const sources = Array.from(this._sources.values())
    if (sources.length === 0) return

    // Pre-compute occluder bounding boxes once per update sweep
    const aabbs: AABB[] = []
    for (const occ of occluders) {
      const box = getWorldAABB(occ)
      if (box) aabbs.push(box)
    }

    const budget = Math.min(this._opts.maxRaycasts, sources.length)
    const lp = this._listenerPos

    for (let i = 0; i < budget; i++) {
      const idx = (this._roundRobinIdx + i) % sources.length
      const src = sources[idx]

      // Distance check
      const dx = src.position.x - lp.x
      const dy = src.position.y - lp.y
      const dz = src.position.z - lp.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist > this._opts.maxDistance) {
        // Beyond max distance — silence
        src.gainNode.gain.setTargetAtTime(0, this.context.currentTime, 0.05)
        continue
      }

      if (dist < 1e-4) {
        // Listener is at the source
        src.gainNode.gain.setTargetAtTime(src.baseVolume, this.context.currentTime, 0.05)
        continue
      }

      // Normalised ray from listener to source
      const invDist = 1 / dist
      const rdx = dx * invDist
      const rdy = dy * invDist
      const rdz = dz * invDist

      // Count occluder hits
      let hits = 0
      for (const aabb of aabbs) {
        if (rayIntersectsAABB(lp.x, lp.y, lp.z, rdx, rdy, rdz, dist, aabb)) {
          hits++
        }
      }

      const occFactor = Math.pow(this._opts.occlusionAttenuation, hits)
      const targetGain = src.baseVolume * occFactor
      // Smooth gain change to avoid clicks
      src.gainNode.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.05)
    }

    this._roundRobinIdx = (this._roundRobinIdx + budget) % sources.length
  }

  // ---------------------------------------------------------------------------
  // Asset loading
  // ---------------------------------------------------------------------------

  /** Fetch and decode an audio file from a URL. */
  async loadBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    return this.context.decodeAudioData(arrayBuffer)
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Resume the AudioContext (must be called from a user gesture). */
  resume(): Promise<void> {
    return this.context.resume()
  }

  dispose(): void {
    for (const id of this._sources.keys()) {
      this.removeSource(id)
    }
    // Do not close a context passed in from outside; only close ones we created.
    if (this.context.state !== 'closed') {
      this.context.close().catch(() => {
        /* ignore */
      })
    }
  }
}
