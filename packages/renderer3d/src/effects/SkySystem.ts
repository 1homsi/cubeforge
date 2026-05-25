/**
 * SkySystem — physically-based procedural sky with sun, moon, stars, and a
 * configurable day-night cycle driven by a 0–1 timeOfDay value.
 *
 * Creates two meshes and adds them to the scene:
 *   1. A large inverted sphere rendered with Preetham atmospheric scattering.
 *   2. An InstancedMesh of point-sprite stars that fade with sun elevation.
 */

import { Vec3 } from '../math'
import { Scene } from '../scene'
import { Mesh } from '../objects'
import { SphereGeometry, BufferGeometry, BufferAttribute } from '../geometry'
import { ShaderMaterial } from '../material'
import { SKY_VERT, SKY_FRAG, STARS_VERT, STARS_FRAG } from '../shaders'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SkyOptions {
  /** Atmosphere haze (1 = crystal clear, 10 = heavy haze). Default 2. */
  turbidity?: number
  /** Rayleigh scattering intensity. Default 1. */
  rayleigh?: number
  /** Mie scattering coefficient (sun halo spread). Default 0.005. */
  mieCoefficient?: number
  /** Mie phase asymmetry factor. Default 0.8. */
  mieDirectionalG?: number
  /** Initial normalised direction to the sun. Default (1, 1, 1) normalised. */
  sunPosition?: Vec3
  /** World up vector. Default Y. */
  up?: Vec3
  /** Render a moon disc. Default true. */
  moonEnabled?: boolean
  /** Render stars at night. Default true. */
  starsEnabled?: boolean
  /** Number of star instances. Default 2000. */
  starCount?: number
}

// ---------------------------------------------------------------------------
// SkySystem
// ---------------------------------------------------------------------------

export class SkySystem {
  options: SkyOptions

  private readonly _scene: Scene
  private readonly _skyMesh: Mesh
  private readonly _starMesh: Mesh | null
  private readonly _skyMat: ShaderMaterial
  private readonly _starMat: ShaderMaterial | null

  private _sunDir = new Vec3(1, 1, 1)
  private _startTime: number

  constructor(scene: Scene, opts: SkyOptions = {}) {
    this._scene = scene
    this._startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000

    this.options = {
      turbidity: opts.turbidity ?? 2,
      rayleigh: opts.rayleigh ?? 1,
      mieCoefficient: opts.mieCoefficient ?? 0.005,
      mieDirectionalG: opts.mieDirectionalG ?? 0.8,
      sunPosition: opts.sunPosition ?? new Vec3(1, 1, 1),
      up: opts.up ?? new Vec3(0, 1, 0),
      moonEnabled: opts.moonEnabled ?? true,
      starsEnabled: opts.starsEnabled !== false,
      starCount: opts.starCount ?? 2000,
    }

    // Normalise initial sun direction
    const sp = this.options.sunPosition!
    const spLen = Math.sqrt(sp.x * sp.x + sp.y * sp.y + sp.z * sp.z) || 1
    this._sunDir.set(sp.x / spLen, sp.y / spLen, sp.z / spLen)

    // ── Sky sphere mesh ──────────────────────────────────────────────────────
    // Large sphere, radius 450.  Invert normals by using negative scale so the
    // inside faces the camera.
    const skyGeo = new SphereGeometry(450, 32, 16)
    this._skyMat = new ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        u_sunDirection: { value: [this._sunDir.x, this._sunDir.y, this._sunDir.z] },
        u_turbidity: { value: this.options.turbidity },
        u_rayleigh: { value: this.options.rayleigh },
        u_mieCoefficient: { value: this.options.mieCoefficient },
        u_mieDirectionalG: { value: this.options.mieDirectionalG },
        u_up: { value: [0, 1, 0] },
        // u_viewMatrix, u_projectionMatrix, u_cameraPosition are set by the
        // renderer — do NOT put them in the uniforms dict or the ShaderMaterial
        // handler will overwrite the correct values with zeros.
      },
    })
    // Sky shader bypasses the model matrix — it places the dome centred on the
    // camera using `a_position + u_cameraPosition`.  Render both faces so the
    // sky is visible regardless of sphere winding direction.
    this._skyMat.side = 'double'
    this._skyMat.depthWrite = false

    this._skyMesh = new Mesh(skyGeo, this._skyMat)
    this._skyMesh.frustumCulled = false
    this._skyMesh.renderOrder = -1000
    scene.add(this._skyMesh)

    // ── Star point-cloud Mesh ─────────────────────────────────────────────────
    if (this.options.starsEnabled) {
      const starCount = this.options.starCount!
      this._starMat = new ShaderMaterial({
        vertexShader: STARS_VERT,
        fragmentShader: STARS_FRAG,
        drawMode: 'points',
        uniforms: {
          u_sunElevation: { value: 0.5 },
          u_starSize: { value: 2.5 },
          u_time: { value: 0 },
          // u_viewMatrix, u_projectionMatrix, u_cameraPosition set by renderer
        },
      })
      this._starMat.transparent = true
      this._starMat.depthWrite = false

      // Each vertex is a unit-sphere direction — the star shader scales it to
      // a 400-unit radius and uses gl_PointSize for rendering.
      const positions = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        // Marsaglia method for uniform sampling on a sphere
        let x1: number, x2: number, s: number
        do {
          x1 = Math.random() * 2 - 1
          x2 = Math.random() * 2 - 1
          s = x1 * x1 + x2 * x2
        } while (s >= 1)

        const sq = Math.sqrt(1 - s)
        positions[i * 3 + 0] = 2 * x1 * sq
        positions[i * 3 + 1] = Math.abs(2 * x2 * sq) // bias to upper hemisphere
        positions[i * 3 + 2] = 1 - 2 * s
      }

      const starGeo = new BufferGeometry()
      starGeo.setAttribute('position', new BufferAttribute(positions, 3))

      this._starMesh = new Mesh(starGeo, this._starMat)
      this._starMesh.frustumCulled = false
      this._starMesh.renderOrder = -999

      scene.add(this._starMesh)
    } else {
      this._starMesh = null
      this._starMat = null
    }
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Update the sky for the given time of day.
   * @param timeOfDay  0–1 (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk)
   */
  update(timeOfDay: number): void {
    // Map timeOfDay to sun elevation angle: peaks at 0.5 (noon)
    const angle = (timeOfDay - 0.25) * Math.PI * 2 // 0 at dawn, π/2 at noon
    const elevation = Math.sin(angle)
    const azimuth = timeOfDay * Math.PI * 2

    const sunX = Math.cos(elevation) * Math.sin(azimuth)
    const sunY = elevation // simplified: y ~ sin(elevation)
    const sunZ = Math.cos(elevation) * Math.cos(azimuth)

    // Normalise
    const len = Math.sqrt(sunX * sunX + sunY * sunY + sunZ * sunZ) || 1
    this._sunDir.set(sunX / len, sunY / len, sunZ / len)

    // Update sky shader uniforms
    this._skyMat.uniforms['u_sunDirection'].value = [this._sunDir.x, this._sunDir.y, this._sunDir.z]
    this._skyMat.uniforms['u_turbidity'].value = this.options.turbidity
    this._skyMat.uniforms['u_rayleigh'].value = this.options.rayleigh
    this._skyMat.uniforms['u_mieCoefficient'].value = this.options.mieCoefficient
    this._skyMat.uniforms['u_mieDirectionalG'].value = this.options.mieDirectionalG

    // Update star shader
    if (this._starMat) {
      // Sun elevation in 0..1 space (0 = below horizon, 1 = zenith)
      const elev01 = Math.max(0, this._sunDir.y)
      this._starMat.uniforms['u_sunElevation'].value = elev01

      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000
      this._starMat.uniforms['u_time'].value = now - this._startTime
    }
  }

  /** Current sun direction (normalised, pointing away from origin toward sun). */
  getSunDirection(): Vec3 {
    return this._sunDir.clone()
  }

  /** Approximate sun colour temperature at the current time. */
  getSunColor(): Vec3 {
    const elev = this._sunDir.y
    if (elev < 0) return new Vec3(0, 0, 0)
    // Dawn/dusk: warm orange-red; noon: white
    const t = Math.min(elev * 4, 1)
    return new Vec3(1.0, 0.3 + 0.7 * t, 0.1 + 0.9 * t)
  }

  /** Approximate sky ambient colour at the current time. */
  getAmbientColor(): Vec3 {
    const elev = this._sunDir.y
    if (elev < 0) {
      // Night: deep blue
      return new Vec3(0.02, 0.02, 0.05)
    }
    const t = Math.min(elev * 3, 1)
    return new Vec3(0.1 + 0.3 * t, 0.15 + 0.4 * t, 0.25 + 0.5 * t)
  }

  dispose(): void {
    this._scene.remove(this._skyMesh)
    if (this._starMesh) this._scene.remove(this._starMesh)
  }
}
