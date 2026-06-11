import { Material } from './Material'
import type { Vec3 } from '../math/Vec3'
import type { Texture } from '../core/Texture'

export class MeshStandardMaterial extends Material {
  override readonly type = 'MeshStandardMaterial'

  // ── Base color ───────────────────────────────────────────────────────────────
  /** Linear RGB albedo tint multiplied with albedo map (default white) */
  color: Vec3

  // ── PBR scalars ──────────────────────────────────────────────────────────────
  /** 0 = dielectric, 1 = fully metallic */
  metalness = 0

  /** 0 = mirror-smooth, 1 = fully rough */
  roughness = 0.5

  // ── Emissive ─────────────────────────────────────────────────────────────────
  /** Emissive color (linear RGB) */
  emissive: Vec3

  /** Emissive intensity multiplier */
  emissiveIntensity = 1

  // ── Texture maps ─────────────────────────────────────────────────────────────
  /** Albedo / base-color map (sRGB) */
  map: Texture | null = null

  /** Tangent-space normal map */
  normalMap: Texture | null = null

  /** XY scale applied to normals sampled from normalMap */
  normalScale: { x: number; y: number } = { x: 1, y: 1 }

  /** Combined metalness (B channel) + roughness (G channel) map — glTF convention */
  metalnessMap: Texture | null = null

  /** Alias for metalnessMap; when both are set, metalnessMap takes precedence */
  roughnessMap: Texture | null = null

  /** Ambient occlusion map (R channel) */
  aoMap: Texture | null = null

  /** Intensity of the AO map (0 = no effect, 1 = full effect) */
  aoMapIntensity = 1

  /** Emissive map — multiplied with emissive × emissiveIntensity */
  emissiveMap: Texture | null = null

  // ── Environment / reflections ─────────────────────────────────────────────────
  /** Cube map WebGLTexture used for approximate reflections */
  envMap: WebGLTexture | null = null

  /** Multiplier for environment map contribution */
  envMapIntensity = 1

  // ── IBL (Image-Based Lighting) ────────────────────────────────────────────────
  /** Irradiance cube map for diffuse IBL (convolved environment) */
  irradianceMap: WebGLTexture | null = null

  /** Prefiltered environment cube map for specular IBL (mip chain) */
  prefilteredEnvMap: WebGLTexture | null = null

  /** BRDF split-sum LUT (2D texture, uv = NdotV × roughness) */
  brdfLUT: WebGLTexture | null = null

  // ── Shading flags ─────────────────────────────────────────────────────────────
  /** When true, use flat (faceted) shading — disables normal maps */
  flatShading = false

  constructor(name = '') {
    super(name)

    // Inline Vec3 creation to avoid a circular import risk at construction time.
    // The renderer reads .x/.y/.z directly.
    this.color = { x: 1, y: 1, z: 1 } as Vec3
    this.emissive = { x: 0, y: 0, z: 0 } as Vec3
  }

  override clone(): this {
    const copy = super.clone()
    // Deep-copy value types
    copy.color = { ...this.color } as Vec3
    copy.emissive = { ...this.emissive } as Vec3
    copy.normalScale = { ...this.normalScale }
    // Texture references are shared (the renderer owns them)
    return copy
  }

  override dispose(): void {
    // Materials don't own textures by default — the scene/asset manager does.
    // Override if this material is the sole owner of its textures.
  }
}
