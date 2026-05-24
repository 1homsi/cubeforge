import { Vec3, Mat4 } from '../math'
import { Scene, Camera } from '../scene'
import { InstancedMesh } from '../objects'
import { PlaneGeometry } from '../geometry'
import { MeshBasicMaterial } from '../material'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WeatherType = 'clear' | 'rain' | 'snow' | 'storm' | 'fog'

export interface WeatherOptions {
  /** Maximum number of particles (default 2000) */
  particleCount?: number
  /** Wind velocity X in world units/s (default 0) */
  windX?: number
  /** Wind velocity Z in world units/s (default 0) */
  windZ?: number

  // Rain
  /** Length of rain streak geometry in world units (default 0.5) */
  rainLength?: number
  /** Fall speed of rain particles (default 30) */
  rainSpeed?: number
  /** Rain particle color (default white) */
  rainColor?: Vec3

  // Snow
  /** Flake radius in world units (default 0.05) */
  snowRadius?: number
  /** Fall speed of snow particles (default 2) */
  snowSpeed?: number
  /** Snow particle color (default white) */
  snowColor?: Vec3

  // Fog
  fogNear?: number
  fogFar?: number
  fogColor?: Vec3

  /** XZ spawn radius around the camera (default 50) */
  spawnRadius?: number
  /** Y range above camera to spawn particles (default 30) */
  spawnHeight?: number
}

// ---------------------------------------------------------------------------
// Internal particle state
// ---------------------------------------------------------------------------

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** Phase offset for flutter/sinusoidal motion */
  phase: number
  /** Life in [0, 1] — used to blend transition */
  life: number
}

// ---------------------------------------------------------------------------
// Shader source – billboard particle
// ---------------------------------------------------------------------------

// A minimal particle vertex shader that orients quads toward the camera.
// The InstancedMesh stores one 4x4 world-transform per instance.
// We treat it as a plain world-space transform (no billboard here —
// for a full billboard the renderer would need extra support). Instead
// we simply tilt the plane geometry in software before writing instanceMatrix.

// ---------------------------------------------------------------------------
// WeatherSystem
// ---------------------------------------------------------------------------

const _mat4 = new Mat4()

/**
 * Seeded pseudo-random number generator (xorshift32).
 */
class RNG {
  private _s: number
  constructor(seed = 12345) {
    this._s = seed >>> 0 || 1
  }
  next(): number {
    let x = this._s
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    this._s = x >>> 0
    return (this._s >>> 0) / 0x100000000
  }
}

export class WeatherSystem {
  weatherType: WeatherType

  private _scene: Scene
  private _opts: Required<WeatherOptions>
  private _particles: Particle[]
  private _mesh: InstancedMesh | null
  private _mat: MeshBasicMaterial

  // Transition state
  private _transitioning: boolean
  private _transitionTarget: WeatherType
  private _transitionTime: number
  private _transitionElapsed: number

  // Wind
  private _windX: number
  private _windZ: number

  private _rng: RNG

  constructor(scene: Scene, opts: WeatherOptions = {}) {
    this._scene = scene
    this._rng = new RNG(42)

    this._opts = {
      particleCount: opts.particleCount ?? 2000,
      windX: opts.windX ?? 0,
      windZ: opts.windZ ?? 0,
      rainLength: opts.rainLength ?? 0.5,
      rainSpeed: opts.rainSpeed ?? 30,
      rainColor: opts.rainColor ?? new Vec3(0.7, 0.8, 1.0),
      snowRadius: opts.snowRadius ?? 0.05,
      snowSpeed: opts.snowSpeed ?? 2,
      snowColor: opts.snowColor ?? new Vec3(1, 1, 1),
      fogNear: opts.fogNear ?? 10,
      fogFar: opts.fogFar ?? 100,
      fogColor: opts.fogColor ?? new Vec3(0.8, 0.8, 0.85),
      spawnRadius: opts.spawnRadius ?? 50,
      spawnHeight: opts.spawnHeight ?? 30,
    }

    this._windX = this._opts.windX
    this._windZ = this._opts.windZ

    this.weatherType = 'clear'
    this._transitioning = false
    this._transitionTarget = 'clear'
    this._transitionTime = 0
    this._transitionElapsed = 0

    this._particles = []
    this._mat = new MeshBasicMaterial('weather_mat')
    this._mesh = null

    // Start with clear weather (no particles)
    this._applyWeatherImmediate('clear')
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setWeather(type: WeatherType, transitionTime = 0): void {
    if (type === this.weatherType && !this._transitioning) return

    if (transitionTime <= 0) {
      this._applyWeatherImmediate(type)
    } else {
      this._transitioning = true
      this._transitionTarget = type
      this._transitionTime = transitionTime
      this._transitionElapsed = 0
    }
  }

  setWind(x: number, z: number): void {
    this._windX = x
    this._windZ = z
  }

  /**
   * Call each frame.
   * @param camera Used to re-center the spawn area around the viewer.
   * @param dt     Delta time in seconds.
   */
  update(camera: Camera, dt: number): void {
    // Handle transitions
    if (this._transitioning) {
      this._transitionElapsed += dt
      if (this._transitionElapsed >= this._transitionTime) {
        this._applyWeatherImmediate(this._transitionTarget)
        this._transitioning = false
      } else {
        // Lerp fog params partway
        const t = this._transitionElapsed / this._transitionTime
        this._lerpFog(this._transitionTarget, t)
      }
    }

    if (this._mesh === null || this.weatherType === 'clear' || this.weatherType === 'fog') return

    const camX = camera.position.x
    const camY = camera.position.y
    const camZ = camera.position.z

    const spawnR = this._opts.spawnRadius
    const spawnH = this._opts.spawnHeight
    const count = this._particles.length

    const isRain = this.weatherType === 'rain' || this.weatherType === 'storm'
    const isSnow = this.weatherType === 'snow'

    const fallSpeed = isRain
      ? this.weatherType === 'storm'
        ? this._opts.rainSpeed * 1.8
        : this._opts.rainSpeed
      : this._opts.snowSpeed

    for (let i = 0; i < count; i++) {
      const p = this._particles[i]
      p.life += dt

      if (isRain) {
        // Rain falls with wind tilt
        p.x += (this._windX + p.vx) * dt
        p.y -= fallSpeed * dt
        p.z += (this._windZ + p.vz) * dt
      } else if (isSnow) {
        // Snow flutters with a sinusoidal drift
        const flutter = Math.sin(p.life * 1.5 + p.phase) * 0.3
        p.x += (this._windX + flutter) * dt
        p.y -= fallSpeed * dt
        p.z += (this._windZ + flutter * 0.7) * dt
      }

      // Respawn when below camera or out of XZ bounds
      const dx = p.x - camX
      const dz = p.z - camZ
      const outXZ = Math.abs(dx) > spawnR || Math.abs(dz) > spawnR
      const outY = p.y < camY - spawnH * 0.5

      if (outY || outXZ) {
        this._respawnParticle(p, camX, camY, camZ, spawnR, spawnH)
      }

      // Write instance matrix
      const scaleX = isRain ? 0.02 : this._opts.snowRadius
      const scaleY = isRain ? this._opts.rainLength : this._opts.snowRadius

      // Tilt rain by wind direction
      const windTiltX = isRain ? (this._windX / Math.max(fallSpeed, 1)) * 0.5 : 0
      const windTiltZ = isRain ? (this._windZ / Math.max(fallSpeed, 1)) * 0.5 : 0

      _mat4.identity()
      const e = _mat4.elements
      // Build a TRS matrix: scale + rotation (tilt for rain) + translation
      // For billboard simplicity we build a Y-up oriented quad scaled appropriately.
      // Tilt around X for wind Z, around Z for wind X.
      const cosTX = Math.cos(-windTiltZ)
      const sinTX = Math.sin(-windTiltZ)
      const cosTZ = Math.cos(windTiltX)
      const sinTZ = Math.sin(windTiltX)

      // Combined rotation: Rx * Rz (small angles, approximation is fine)
      // Row-major column-major: Mat4 is column-major
      e[0] = scaleX * cosTZ
      e[1] = scaleX * sinTZ * cosTX
      e[2] = scaleX * sinTZ * sinTX
      e[3] = 0
      e[4] = 0
      e[5] = scaleY * cosTX
      e[6] = scaleY * -sinTX
      e[7] = 0
      e[8] = -scaleX * sinTZ
      e[9] = scaleX * cosTZ * sinTX
      e[10] = scaleX * cosTZ * cosTX
      e[11] = 0
      e[12] = p.x
      e[13] = p.y
      e[14] = p.z
      e[15] = 1

      this._mesh!.setMatrixAt(i, _mat4)
    }

    this._mesh!.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    if (this._mesh !== null) {
      this._scene.remove(this._mesh)
      this._mesh.geometry.dispose()
      this._mesh = null
    }
    // Clear fog
    this._scene.fog = null
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _applyWeatherImmediate(type: WeatherType): void {
    this.weatherType = type

    // Remove existing mesh
    if (this._mesh !== null) {
      this._scene.remove(this._mesh)
      this._mesh.geometry.dispose()
      this._mesh = null
    }

    this._particles = []

    if (type === 'clear') {
      this._scene.fog = null
      return
    }

    if (type === 'fog') {
      this._scene.fog = {
        color: this._opts.fogColor.clone(),
        near: this._opts.fogNear,
        far: this._opts.fogFar,
      }
      return
    }

    // Rain / Snow / Storm – build instanced mesh
    const count =
      type === 'storm' ? this._opts.particleCount : Math.floor(this._opts.particleCount * (type === 'snow' ? 0.4 : 0.7))

    const geo = new PlaneGeometry(1, 1)

    const color = type === 'snow' ? this._opts.snowColor : this._opts.rainColor
    this._mat.color.set(color.x, color.y, color.z)

    this._mesh = new InstancedMesh(geo, this._mat, count)
    this._mesh.frustumCulled = false
    this._scene.add(this._mesh)

    // Initialise particles at random positions in a box around origin
    const r = this._opts.spawnRadius
    const h = this._opts.spawnHeight
    for (let i = 0; i < count; i++) {
      const p: Particle = {
        x: (this._rng.next() * 2 - 1) * r,
        y: (this._rng.next() * 2 - 1) * h * 0.5,
        z: (this._rng.next() * 2 - 1) * r,
        vx: (this._rng.next() - 0.5) * 0.5,
        vy: 0,
        vz: (this._rng.next() - 0.5) * 0.5,
        phase: this._rng.next() * Math.PI * 2,
        life: this._rng.next() * 10,
      }
      this._particles.push(p)
    }

    // Storm also adds fog
    if (type === 'storm') {
      this._scene.fog = {
        color: new Vec3(0.6, 0.6, 0.7),
        near: 5,
        far: 40,
      }
    } else {
      this._scene.fog = null
    }
  }

  private _respawnParticle(p: Particle, camX: number, camY: number, camZ: number, r: number, h: number): void {
    p.x = camX + (this._rng.next() * 2 - 1) * r
    p.y = camY + h
    p.z = camZ + (this._rng.next() * 2 - 1) * r
    p.vx = (this._rng.next() - 0.5) * 0.5
    p.vz = (this._rng.next() - 0.5) * 0.5
    p.life = 0
  }

  private _lerpFog(targetType: WeatherType, t: number): void {
    const srcFog = this._scene.fog
    if (targetType === 'fog' || targetType === 'storm') {
      const targetNear = targetType === 'fog' ? this._opts.fogNear : 5
      const targetFar = targetType === 'fog' ? this._opts.fogFar : 40
      const targetColor = targetType === 'fog' ? this._opts.fogColor : new Vec3(0.6, 0.6, 0.7)

      if (srcFog === null) {
        this._scene.fog = {
          color: new Vec3(targetColor.x * t, targetColor.y * t, targetColor.z * t),
          near: 1000 * (1 - t) + targetNear * t,
          far: 1000 * (1 - t) + targetFar * t,
        }
      } else {
        srcFog.near += (targetNear - srcFog.near) * t
        srcFog.far += (targetFar - srcFog.far) * t
        srcFog.color.x += (targetColor.x - srcFog.color.x) * t
        srcFog.color.y += (targetColor.y - srcFog.color.y) * t
        srcFog.color.z += (targetColor.z - srcFog.color.z) * t
      }
    } else if (targetType === 'clear') {
      if (srcFog !== null) {
        // Fade fog out
        srcFog.far += (10000 - srcFog.far) * t
      }
    }
  }
}
