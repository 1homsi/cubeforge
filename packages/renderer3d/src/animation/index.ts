import type { Object3D } from '../scene'
import { Quat } from '../math/Quat'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type InterpolationMode = 'LINEAR' | 'STEP' | 'CUBICSPLINE'
export type TrackProperty = 'position' | 'quaternion' | 'scale' | 'morphTargetInfluences'

export interface KeyframeTrack {
  nodeName: string
  nodeIndex: number
  property: TrackProperty
  times: Float32Array // keyframe timestamps in seconds
  values: Float32Array // packed values: 3 floats for position/scale, 4 for quaternion
  interpolation: InterpolationMode
}

export interface AnimationClip {
  name: string
  tracks: KeyframeTrack[]
  duration: number
}

// ---------------------------------------------------------------------------
// Cross-fade descriptor (internal)
// ---------------------------------------------------------------------------

interface CrossFade {
  target: AnimationAction
  duration: number
  elapsed: number
}

// ---------------------------------------------------------------------------
// Interpolation helpers
// ---------------------------------------------------------------------------

/** Find the last keyframe index whose time <= t (binary search) */
function findKeyframe(times: Float32Array, t: number): number {
  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (times[mid]! <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Hermite basis functions for GLTF CUBICSPLINE (p0, m0, p1, m1, t) */
function hermite(t: number): [number, number, number, number] {
  const t2 = t * t
  const t3 = t2 * t
  return [
    2 * t3 - 3 * t2 + 1, // h00  (p0 weight)
    t3 - 2 * t2 + t, // h10  (m0 weight, scaled by dt)
    -2 * t3 + 3 * t2, // h01  (p1 weight)
    t3 - t2, // h11  (m1 weight, scaled by dt)
  ]
}

/**
 * Interpolate a 3-component (position/scale) keyframe track.
 * Returns [x, y, z].
 */
function interpolateVec3(track: KeyframeTrack, t: number): [number, number, number] {
  const { times, values, interpolation } = track
  const n = times.length

  if (n === 1) {
    if (interpolation === 'CUBICSPLINE') {
      // GLTF cubicspline: stride = 3 * 3 (in-tangent + value + out-tangent per keyframe)
      return [values[3]!, values[4]!, values[5]!]
    }
    return [values[0]!, values[1]!, values[2]!]
  }

  if (t <= times[0]!) {
    if (interpolation === 'CUBICSPLINE') return [values[3]!, values[4]!, values[5]!]
    return [values[0]!, values[1]!, values[2]!]
  }
  if (t >= times[n - 1]!) {
    if (interpolation === 'CUBICSPLINE') {
      const base = (n - 1) * 9
      return [values[base + 3]!, values[base + 4]!, values[base + 5]!]
    }
    const base = (n - 1) * 3
    return [values[base]!, values[base + 1]!, values[base + 2]!]
  }

  const i = findKeyframe(times, t)
  const i1 = Math.min(i + 1, n - 1)
  const t0 = times[i]!
  const t1 = times[i1]!
  const dt = t1 - t0
  const alpha = dt > 0 ? (t - t0) / dt : 0

  if (interpolation === 'STEP') {
    const base = i * 3
    return [values[base]!, values[base + 1]!, values[base + 2]!]
  }

  if (interpolation === 'LINEAR') {
    const b0 = i * 3
    const b1 = i1 * 3
    return [
      values[b0]! + (values[b1]! - values[b0]!) * alpha,
      values[b0 + 1]! + (values[b1 + 1]! - values[b0 + 1]!) * alpha,
      values[b0 + 2]! + (values[b1 + 2]! - values[b0 + 2]!) * alpha,
    ]
  }

  // CUBICSPLINE – GLTF spec
  // Each keyframe stores: [in-tangent(3), value(3), out-tangent(3)] = stride 9
  const stride = 9
  const b0 = i * stride
  const b1 = i1 * stride
  // in-tangent of keyframe i: b0[0..2]
  // value of keyframe i:      b0[3..5]
  // out-tangent of keyframe i: b0[6..8]
  // in-tangent of keyframe i1: b1[0..2]
  // value of keyframe i1:      b1[3..5]

  const [h00, h10, h01, h11] = hermite(alpha)

  return [
    h00 * values[b0 + 3]! + h10 * dt * values[b0 + 6]! + h01 * values[b1 + 3]! + h11 * dt * values[b1 + 0]!,
    h00 * values[b0 + 4]! + h10 * dt * values[b0 + 7]! + h01 * values[b1 + 4]! + h11 * dt * values[b1 + 1]!,
    h00 * values[b0 + 5]! + h10 * dt * values[b0 + 8]! + h01 * values[b1 + 5]! + h11 * dt * values[b1 + 2]!,
  ]
}

/**
 * Interpolate a 4-component (quaternion) keyframe track.
 * Returns [x, y, z, w].
 */
function interpolateQuat(track: KeyframeTrack, t: number): [number, number, number, number] {
  const { times, values, interpolation } = track
  const n = times.length

  if (n === 1) {
    if (interpolation === 'CUBICSPLINE') return [values[4]!, values[5]!, values[6]!, values[7]!]
    return [values[0]!, values[1]!, values[2]!, values[3]!]
  }

  if (t <= times[0]!) {
    if (interpolation === 'CUBICSPLINE') return [values[4]!, values[5]!, values[6]!, values[7]!]
    return [values[0]!, values[1]!, values[2]!, values[3]!]
  }
  if (t >= times[n - 1]!) {
    if (interpolation === 'CUBICSPLINE') {
      const base = (n - 1) * 12
      return [values[base + 4]!, values[base + 5]!, values[base + 6]!, values[base + 7]!]
    }
    const base = (n - 1) * 4
    return [values[base]!, values[base + 1]!, values[base + 2]!, values[base + 3]!]
  }

  const i = findKeyframe(times, t)
  const i1 = Math.min(i + 1, n - 1)
  const t0 = times[i]!
  const t1 = times[i1]!
  const dt = t1 - t0
  const alpha = dt > 0 ? (t - t0) / dt : 0

  if (interpolation === 'STEP') {
    const b = i * 4
    return [values[b]!, values[b + 1]!, values[b + 2]!, values[b + 3]!]
  }

  if (interpolation === 'LINEAR') {
    // slerp between consecutive quaternions
    const b0 = i * 4
    const b1 = i1 * 4
    const qa = new Quat(values[b0]!, values[b0 + 1]!, values[b0 + 2]!, values[b0 + 3]!)
    const qb = new Quat(values[b1]!, values[b1 + 1]!, values[b1 + 2]!, values[b1 + 3]!)
    qa.slerp(qb, alpha)
    return [qa.x, qa.y, qa.z, qa.w]
  }

  // CUBICSPLINE – GLTF spec, stride = 3 * 4 = 12
  const stride = 12
  const b0 = i * stride
  const b1 = i1 * stride

  const [h00, h10, h01, h11] = hermite(alpha)

  // Compute raw interpolated quaternion from hermite spline
  let rx = h00 * values[b0 + 4]! + h10 * dt * values[b0 + 8]! + h01 * values[b1 + 4]! + h11 * dt * values[b1 + 0]!
  let ry = h00 * values[b0 + 5]! + h10 * dt * values[b0 + 9]! + h01 * values[b1 + 5]! + h11 * dt * values[b1 + 1]!
  let rz = h00 * values[b0 + 6]! + h10 * dt * values[b0 + 10]! + h01 * values[b1 + 6]! + h11 * dt * values[b1 + 2]!
  let rw = h00 * values[b0 + 7]! + h10 * dt * values[b0 + 11]! + h01 * values[b1 + 7]! + h11 * dt * values[b1 + 3]!

  // Must normalize per GLTF spec §(Quaternion Cubic Spline Interpolation)
  const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw)
  if (len > 0) {
    rx /= len
    ry /= len
    rz /= len
    rw /= len
  }

  return [rx, ry, rz, rw]
}

// ---------------------------------------------------------------------------
// AnimationAction
// ---------------------------------------------------------------------------

export class AnimationAction {
  clip: AnimationClip
  weight: number
  timeScale: number
  loop: 'once' | 'repeat' | 'pingpong'
  clampWhenFinished: boolean

  /** @internal */ _time: number
  /** @internal */ _playing: boolean
  /** @internal */ _pingpongDir: 1 | -1
  /** @internal */ _crossFades: CrossFade[]
  /** @internal */ _finished: boolean

  constructor(clip: AnimationClip) {
    this.clip = clip
    this.weight = 1
    this.timeScale = 1
    this.loop = 'repeat'
    this.clampWhenFinished = false
    this._time = 0
    this._playing = false
    this._pingpongDir = 1
    this._crossFades = []
    this._finished = false
  }

  get isRunning(): boolean {
    return this._playing
  }

  get time(): number {
    return this._time
  }

  play(): this {
    this._playing = true
    this._finished = false
    return this
  }

  stop(): this {
    this._playing = false
    this._time = 0
    this._pingpongDir = 1
    this._finished = false
    return this
  }

  pause(): this {
    this._playing = false
    return this
  }

  reset(): this {
    this._time = 0
    this._pingpongDir = 1
    this._finished = false
    return this
  }

  setWeight(w: number): this {
    this.weight = Math.max(0, Math.min(1, w))
    return this
  }

  setTimeScale(ts: number): this {
    this.timeScale = ts
    return this
  }

  setLoop(mode: 'once' | 'repeat' | 'pingpong'): this {
    this.loop = mode
    return this
  }

  /**
   * Start a cross-fade from this action to `target` over `duration` seconds.
   * The current weight will gradually decrease to 0 while target's weight
   * rises to 1.
   */
  crossFadeTo(target: AnimationAction, duration: number): this {
    this._crossFades.push({ target, duration, elapsed: 0 })
    target._playing = true
    target._finished = false
    target.weight = 0
    return this
  }

  /** @internal – called by AnimationMixer.update */
  _advance(dt: number): void {
    if (!this._playing || this._finished) return

    const scaledDt = dt * this.timeScale
    const duration = this.clip.duration

    // Process active cross-fades
    for (let fi = this._crossFades.length - 1; fi >= 0; fi--) {
      const cf = this._crossFades[fi]!
      cf.elapsed += Math.abs(dt)
      const progress = duration > 0 ? Math.min(1, cf.elapsed / cf.duration) : 1
      // Transfer weight
      this.weight = Math.max(0, 1 - progress)
      cf.target.weight = progress
      if (progress >= 1) {
        this.stop()
        this._crossFades.splice(fi, 1)
      }
    }

    if (this.loop === 'once') {
      this._time += scaledDt
      if (this._time >= duration) {
        this._time = this.clampWhenFinished ? duration : duration
        this._finished = true
        this._playing = false
      }
    } else if (this.loop === 'repeat') {
      if (duration > 0) this._time = (((this._time + scaledDt) % duration) + duration) % duration
    } else {
      // pingpong
      this._time += scaledDt * this._pingpongDir
      if (this._time >= duration) {
        this._time = duration
        this._pingpongDir = -1
      } else if (this._time <= 0) {
        this._time = 0
        this._pingpongDir = 1
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Accumulated blend result (internal)
// ---------------------------------------------------------------------------

interface BlendResult {
  posX: number
  posY: number
  posZ: number
  posW: number
  sclX: number
  sclY: number
  sclZ: number
  sclW: number
  // Quaternion: accumulated as weighted sum (nlerp)
  quatX: number
  quatY: number
  quatZ: number
  quatW: number
  totalWeight: number
}

// ---------------------------------------------------------------------------
// AnimationMixer
// ---------------------------------------------------------------------------

export class AnimationMixer {
  private _root: Object3D
  private _actions: Map<string, AnimationAction> = new Map()

  constructor(root: Object3D) {
    this._root = root
  }

  /** Get or create an AnimationAction for the given clip */
  clipAction(clip: AnimationClip): AnimationAction {
    const existing = this._actions.get(clip.name)
    if (existing) return existing
    const action = new AnimationAction(clip)
    this._actions.set(clip.name, action)
    return action
  }

  /** Advance all playing actions by dt seconds and apply transforms */
  update(dt: number): void {
    // Step 1: advance time / cross-fades
    for (const action of this._actions.values()) {
      action._advance(dt)
    }

    // Step 2: collect active actions
    const activeActions: AnimationAction[] = []
    for (const action of this._actions.values()) {
      if (action.weight > 0 && (action._playing || action.clampWhenFinished)) {
        activeActions.push(action)
      }
    }

    if (activeActions.length === 0) return

    // Step 3: accumulate per-node blend targets
    // nodeBlends: nodeName → BlendResult
    const nodeBlends = new Map<string, BlendResult>()

    for (const action of activeActions) {
      const { clip, weight } = action
      const t = action._time

      for (const track of clip.tracks) {
        const { nodeName, property } = track

        if (!nodeBlends.has(nodeName)) {
          nodeBlends.set(nodeName, {
            posX: 0,
            posY: 0,
            posZ: 0,
            posW: 0,
            sclX: 0,
            sclY: 0,
            sclZ: 0,
            sclW: 0,
            quatX: 0,
            quatY: 0,
            quatZ: 0,
            quatW: 0,
            totalWeight: 0,
          })
        }

        const blend = nodeBlends.get(nodeName)!

        if (property === 'position') {
          const [x, y, z] = interpolateVec3(track, t)
          blend.posX += x * weight
          blend.posY += y * weight
          blend.posZ += z * weight
          blend.posW += weight
        } else if (property === 'scale') {
          const [x, y, z] = interpolateVec3(track, t)
          blend.sclX += x * weight
          blend.sclY += y * weight
          blend.sclZ += z * weight
          blend.sclW += weight
        } else if (property === 'quaternion') {
          const [x, y, z, w] = interpolateQuat(track, t)
          // nlerp: accumulate weighted components, normalize later
          // Flip sign if dot with accumulated sum is negative (shortest path)
          const dot = blend.quatX * x + blend.quatY * y + blend.quatZ * z + blend.quatW * w
          const sign = dot < 0 ? -1 : 1
          blend.quatX += x * weight * sign
          blend.quatY += y * weight * sign
          blend.quatZ += z * weight * sign
          blend.quatW += w * weight * sign
          blend.totalWeight += weight
        } else if (property === 'morphTargetInfluences') {
          // Apply directly – blending morph targets by weighted average
          const node = this._findNode(nodeName)
          if (node) {
            const influences = (node as unknown as { morphTargetInfluences?: number[] }).morphTargetInfluences
            if (influences) {
              const [x, y, z] = interpolateVec3(track, t)
              influences[0] = (influences[0] ?? 0) + x * weight
              influences[1] = (influences[1] ?? 0) + y * weight
              influences[2] = (influences[2] ?? 0) + z * weight
            }
          }
        }
      }
    }

    // Step 4: apply accumulated blends to nodes
    for (const [nodeName, blend] of nodeBlends) {
      const node = this._findNode(nodeName)
      if (!node) continue

      if (blend.posW > 0) {
        const invW = 1 / blend.posW
        node.position.set(blend.posX * invW, blend.posY * invW, blend.posZ * invW)
      }

      if (blend.sclW > 0) {
        const invW = 1 / blend.sclW
        node.scale.set(blend.sclX * invW, blend.sclY * invW, blend.sclZ * invW)
      }

      if (blend.totalWeight > 0) {
        // Normalize the accumulated quaternion (nlerp finish)
        const len = Math.sqrt(
          blend.quatX * blend.quatX + blend.quatY * blend.quatY + blend.quatZ * blend.quatZ + blend.quatW * blend.quatW,
        )
        if (len > 0) {
          node.quaternion.set(blend.quatX / len, blend.quatY / len, blend.quatZ / len, blend.quatW / len)
        }
      }
    }
  }

  /** Stop all actions immediately */
  stopAllAction(): void {
    for (const action of this._actions.values()) {
      action.stop()
    }
  }

  /** Remove and uncache all actions associated with a clip */
  uncacheClip(clip: AnimationClip): void {
    this._actions.delete(clip.name)
  }

  /** Find a node by name in the root subtree */
  private _findNode(name: string): Object3D | null {
    if (this._root.name === name) return this._root
    const found = this._root.getObjectByName(name)
    return found ?? null
  }
}
