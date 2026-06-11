import { Vec3 } from '../math'
import type { Vec4 } from '../math'
import type { Quat } from '../math'
import { Object3D, PerspectiveCamera } from '../scene'

export interface FlyCameraOptions {
  /** Movement speed in world units/s (default 20) */
  speed?: number
  /** Movement speed when sprint is held (default 80) */
  fastSpeed?: number
  /** Mouse look sensitivity in radians per pixel (default 0.002) */
  lookSensitivity?: number
  /** Velocity momentum decay per frame, 0–1 (default 0.85) */
  dampening?: number
  /** Minimum pitch angle in radians – clamps looking down (default -π/2 + 0.05) */
  minPitch?: number
  /** Maximum pitch angle in radians – clamps looking up (default π/2 - 0.05) */
  maxPitch?: number
  /** Invert Y axis mouse look */
  invertY?: boolean
  /** Camera never goes below this world Y value */
  minY?: number
  /**
   * AABB obstacle list. Flat array of 6-tuples:
   * [minX, minY, minZ, maxX, maxY, maxZ, ...]
   */
  obstacles?: Float32Array
}

// Re-export Vec4 and Quat for potential downstream use, even though FlyCamera
// only uses Vec3 and Mat4 internally.
export type { Vec4, Quat }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns the forward direction in world space from the camera's matrixWorld. */
function getCameraForward(cam: PerspectiveCamera, out: Vec3): Vec3 {
  const e = cam.matrixWorld.elements
  // -Z column (index 8,9,10)
  out.set(-e[8], -e[9], -e[10]).normalize()
  return out
}

/** Returns the right direction in world space from the camera's matrixWorld. */
function getCameraRight(cam: PerspectiveCamera, out: Vec3): Vec3 {
  const e = cam.matrixWorld.elements
  // +X column (index 0,1,2)
  out.set(e[0], e[1], e[2]).normalize()
  return out
}

// ---------------------------------------------------------------------------
// Particle state per-axis AABB slide collision
// ---------------------------------------------------------------------------

/**
 * Given a proposed next position `next`, slide it against all AABB obstacles
 * defined in `obstacles` (flat Float32Array of 6-tuples). `radius` is the
 * camera's collision half-extent (uniform cube).
 */
function slideAABB(next: Vec3, obstacles: Float32Array, radius: number): Vec3 {
  const count = Math.floor(obstacles.length / 6)
  for (let i = 0; i < count; i++) {
    const base = i * 6
    const bminX = obstacles[base] - radius
    const bminY = obstacles[base + 1] - radius
    const bminZ = obstacles[base + 2] - radius
    const bmaxX = obstacles[base + 3] + radius
    const bmaxY = obstacles[base + 4] + radius
    const bmaxZ = obstacles[base + 5] + radius

    if (next.x < bminX || next.x > bmaxX || next.y < bminY || next.y > bmaxY || next.z < bminZ || next.z > bmaxZ) {
      continue // not overlapping
    }

    // Compute penetration on each axis
    const overlapPX = bmaxX - next.x // pushing from -X side
    const overlapNX = next.x - bminX // pushing from +X side
    const overlapPY = bmaxY - next.y
    const overlapNY = next.y - bminY
    const overlapPZ = bmaxZ - next.z
    const overlapNZ = next.z - bminZ

    // Find axis of minimum penetration
    const minX = Math.min(overlapPX, overlapNX)
    const minY = Math.min(overlapPY, overlapNY)
    const minZ = Math.min(overlapPZ, overlapNZ)

    if (minX <= minY && minX <= minZ) {
      // Resolve on X axis
      if (overlapPX < overlapNX) {
        next.x = bmaxX
      } else {
        next.x = bminX
      }
    } else if (minY <= minX && minY <= minZ) {
      // Resolve on Y axis
      if (overlapPY < overlapNY) {
        next.y = bmaxY
      } else {
        next.y = bminY
      }
    } else {
      // Resolve on Z axis
      if (overlapPZ < overlapNZ) {
        next.z = bmaxZ
      } else {
        next.z = bminZ
      }
    }
  }
  return next
}

// ---------------------------------------------------------------------------
// FlyCamera
// ---------------------------------------------------------------------------

export class FlyCamera {
  readonly camera: PerspectiveCamera
  enabled: boolean

  private _canvas: HTMLCanvasElement
  private _speed: number
  private _fastSpeed: number
  private _sensitivity: number
  private _dampening: number
  private _minPitch: number
  private _maxPitch: number
  private _invertY: boolean
  private _minY: number | undefined
  private _obstacles: Float32Array | undefined

  // Current euler angles for the camera orientation
  private _yaw: number // rotation around world Y
  private _pitch: number // rotation around local X

  // Velocity in world space
  private _velocity: Vec3

  // Key state
  private _keys: Set<string>

  // Pointer lock state
  private _locked: boolean

  // Pan-to state
  private _panTarget: Vec3 | null
  private _panDuration: number
  private _panElapsed: number
  private _panStart: Vec3

  // Follow state
  private _followTarget: Object3D | null
  private _followDistance: number
  private _followHeight: number

  // Reusable scratch vectors
  private _tmpFwd: Vec3
  private _tmpRight: Vec3
  private _tmpUp: Vec3

  // Bound event handlers (stored so we can removeEventListener later)
  private _onMouseMove: (e: MouseEvent) => void
  private _onKeyDown: (e: KeyboardEvent) => void
  private _onKeyUp: (e: KeyboardEvent) => void
  private _onPointerLockChange: () => void
  private _onPointerLockError: () => void
  private _onCanvasClick: () => void

  constructor(camera: PerspectiveCamera, canvas: HTMLCanvasElement, opts: FlyCameraOptions = {}) {
    this.camera = camera
    this._canvas = canvas
    this.enabled = true

    this._speed = opts.speed ?? 20
    this._fastSpeed = opts.fastSpeed ?? 80
    this._sensitivity = opts.lookSensitivity ?? 0.002
    this._dampening = opts.dampening ?? 0.85
    this._minPitch = opts.minPitch ?? -Math.PI / 2 + 0.05
    this._maxPitch = opts.maxPitch ?? Math.PI / 2 - 0.05
    this._invertY = opts.invertY ?? false
    this._minY = opts.minY
    this._obstacles = opts.obstacles

    // Derive initial yaw/pitch from camera's current orientation
    this._yaw = 0
    this._pitch = 0
    this._extractAnglesFromCamera()

    this._velocity = new Vec3()
    this._keys = new Set()
    this._locked = false

    this._panTarget = null
    this._panDuration = 0
    this._panElapsed = 0
    this._panStart = new Vec3()

    this._followTarget = null
    this._followDistance = 5
    this._followHeight = 2

    this._tmpFwd = new Vec3()
    this._tmpRight = new Vec3()
    this._tmpUp = new Vec3()

    // Build bound handlers
    this._onMouseMove = (e: MouseEvent) => this._handleMouseMove(e)
    this._onKeyDown = (e: KeyboardEvent) => this._handleKeyDown(e)
    this._onKeyUp = (e: KeyboardEvent) => this._handleKeyUp(e)
    this._onPointerLockChange = () => this._handlePointerLockChange()
    this._onPointerLockError = () => this._handlePointerLockError()
    this._onCanvasClick = () => {
      if (this.enabled && !this._locked) {
        this._canvas.requestPointerLock()
      }
    }

    document.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('keydown', this._onKeyDown)
    document.addEventListener('keyup', this._onKeyUp)
    document.addEventListener('pointerlockchange', this._onPointerLockChange)
    document.addEventListener('pointerlockerror', this._onPointerLockError)
    this._canvas.addEventListener('click', this._onCanvasClick)
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get isLocked(): boolean {
    return this._locked
  }

  lock(): void {
    this._canvas.requestPointerLock()
  }

  unlock(): void {
    document.exitPointerLock()
  }

  /**
   * Smoothly pan the camera to `target` over `duration` seconds.
   * Cancels any ongoing pan.
   */
  panTo(target: Vec3, duration: number): void {
    this._panTarget = target.clone()
    this._panDuration = duration
    this._panElapsed = 0
    this._panStart.set(this.camera.position.x, this.camera.position.y, this.camera.position.z)
    // Clear follow mode while panning
    this._followTarget = null
  }

  /**
   * Follow a target Object3D from behind at a given distance + height offset.
   * Pass null to revert to free-fly.
   */
  follow(target: Object3D | null, distance = 5, heightOffset = 2): void {
    this._followTarget = target
    this._followDistance = distance
    this._followHeight = heightOffset
    // Cancel any active pan
    this._panTarget = null
  }

  /**
   * Call each frame with the elapsed time in seconds.
   */
  update(dt: number): void {
    if (!this.enabled) return

    // --- Follow mode ---
    if (this._followTarget !== null) {
      this._updateFollow(dt)
      return
    }

    // --- Pan-to mode ---
    if (this._panTarget !== null) {
      this._updatePan(dt)
      return
    }

    // --- Free-fly mode ---
    this._updateFreeFly(dt)
  }

  dispose(): void {
    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
    document.removeEventListener('pointerlockchange', this._onPointerLockChange)
    document.removeEventListener('pointerlockerror', this._onPointerLockError)
    this._canvas.removeEventListener('click', this._onCanvasClick)
    if (this._locked) {
      document.exitPointerLock()
    }
  }

  // ---------------------------------------------------------------------------
  // Private – event handlers
  // ---------------------------------------------------------------------------

  private _handleMouseMove(e: MouseEvent): void {
    if (!this._locked || !this.enabled) return

    const dx = e.movementX
    const dy = e.movementY

    this._yaw -= dx * this._sensitivity
    const pitchDelta = (this._invertY ? -dy : dy) * this._sensitivity
    this._pitch -= pitchDelta
    this._pitch = Math.max(this._minPitch, Math.min(this._maxPitch, this._pitch))

    this._applyAngles()
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    this._keys.add(e.code)
  }

  private _handleKeyUp(e: KeyboardEvent): void {
    this._keys.delete(e.code)
  }

  private _handlePointerLockChange(): void {
    this._locked = document.pointerLockElement === this._canvas
  }

  private _handlePointerLockError(): void {
    this._locked = false
    console.warn('FlyCamera: pointer lock error')
  }

  // ---------------------------------------------------------------------------
  // Private – update modes
  // ---------------------------------------------------------------------------

  private _updateFreeFly(dt: number): void {
    const sprint = this._keys.has('ControlLeft') || this._keys.has('ControlRight')
    const speed = sprint ? this._fastSpeed : this._speed

    // Get current basis vectors
    getCameraForward(this.camera, this._tmpFwd)
    getCameraRight(this.camera, this._tmpRight)
    // Up is always world Y for movement (strafe up/down)
    this._tmpUp.set(0, 1, 0)

    let wx = 0,
      wy = 0,
      wz = 0

    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) {
      wx += this._tmpFwd.x
      wy += this._tmpFwd.y
      wz += this._tmpFwd.z
    }
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) {
      wx -= this._tmpFwd.x
      wy -= this._tmpFwd.y
      wz -= this._tmpFwd.z
    }
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) {
      wx += this._tmpRight.x
      wy += this._tmpRight.y
      wz += this._tmpRight.z
    }
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) {
      wx -= this._tmpRight.x
      wy -= this._tmpRight.y
      wz -= this._tmpRight.z
    }
    if (this._keys.has('Space')) {
      wy += 1
    }
    if (this._keys.has('ShiftLeft') || this._keys.has('ShiftRight')) {
      wy -= 1
    }

    // Normalise wishdir if non-zero
    const wLen = Math.sqrt(wx * wx + wy * wy + wz * wz)
    if (wLen > 0) {
      wx /= wLen
      wy /= wLen
      wz /= wLen
    }

    // Accelerate velocity toward wishdir * speed
    this._velocity.x += wx * speed * dt
    this._velocity.y += wy * speed * dt
    this._velocity.z += wz * speed * dt

    // Exponential dampening
    const damp = Math.pow(this._dampening, dt * 60)
    this._velocity.scale(damp)

    // Proposed next position
    const nx = this.camera.position.x + this._velocity.x * dt
    const ny = this.camera.position.y + this._velocity.y * dt
    const nz = this.camera.position.z + this._velocity.z * dt

    const next = new Vec3(nx, ny, nz)

    // Apply floor clamp
    if (this._minY !== undefined && next.y < this._minY) {
      next.y = this._minY
      this._velocity.y = 0
    }

    // Apply AABB slide collision
    if (this._obstacles && this._obstacles.length >= 6) {
      slideAABB(next, this._obstacles, 0.4)
    }

    this.camera.position.set(next.x, next.y, next.z)
    this.camera.updateMatrixWorld(true)
  }

  private _updatePan(dt: number): void {
    if (this._panTarget === null) return

    this._panElapsed += dt
    const t = this._panDuration > 0 ? Math.min(this._panElapsed / this._panDuration, 1) : 1

    // Smooth step
    const st = t * t * (3 - 2 * t)

    this.camera.position.set(
      this._panStart.x + (this._panTarget.x - this._panStart.x) * st,
      this._panStart.y + (this._panTarget.y - this._panStart.y) * st,
      this._panStart.z + (this._panTarget.z - this._panStart.z) * st,
    )
    this.camera.updateMatrixWorld(true)

    if (t >= 1) {
      this._panTarget = null
    }
  }

  private _updateFollow(dt: number): void {
    if (this._followTarget === null) return

    // Get target world position
    const targetPos = new Vec3()
    this._followTarget.getWorldPosition(targetPos)

    // Compute desired camera position: behind the target
    // Use the target's forward direction (negative Z of its matrixWorld)
    const tFwd = new Vec3()
    this._followTarget.getWorldDirection(tFwd)

    const desired = new Vec3(
      targetPos.x - tFwd.x * this._followDistance,
      targetPos.y + this._followHeight,
      targetPos.z - tFwd.z * this._followDistance,
    )

    // Lerp camera toward desired
    const lerpFactor = Math.min(1, 5 * dt)
    this.camera.position.lerp(desired, lerpFactor)

    // Look at target
    const lookTarget = new Vec3(targetPos.x, targetPos.y + this._followHeight * 0.5, targetPos.z)
    this.camera.lookAt(lookTarget)
    this.camera.updateMatrixWorld(true)

    // Re-extract angles so free-fly resumes naturally if follow is cleared
    this._extractAnglesFromCamera()
  }

  // ---------------------------------------------------------------------------
  // Private – orientation helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract yaw and pitch from the camera's current quaternion so we can
   * resume mouse-look from the correct orientation.
   */
  private _extractAnglesFromCamera(): void {
    // Update world matrix to get a fresh matrixWorld
    this.camera.updateMatrixWorld(true)
    const fwd = new Vec3()
    getCameraForward(this.camera, fwd)
    this._yaw = Math.atan2(fwd.x, fwd.z)
    this._pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)))
  }

  /**
   * Rebuild the camera's quaternion from current _yaw and _pitch angles.
   * Uses YXZ Euler order: yaw first (world Y), then pitch (local X).
   */
  private _applyAngles(): void {
    this.camera.quaternion.setFromEuler(this._pitch, this._yaw, 0, 'YXZ')
    this.camera.updateMatrixWorld(true)
  }
}
