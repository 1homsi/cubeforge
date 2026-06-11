import { Material } from './Material'

/**
 * A uniform slot — mirrors the Three.js convention so patterns are transferable.
 * The renderer reads `.value` and maps it to the appropriate gl.uniform* call.
 *
 * Supported value types:
 *   number                       → uniform1f
 *   [number, number]             → uniform2f
 *   [number, number, number]     → uniform3f
 *   [number, number, number, number] → uniform4f
 *   Float32Array (length 9)      → uniformMatrix3fv
 *   Float32Array (length 16)     → uniformMatrix4fv
 *   Float32Array (other length)  → uniform1fv / uniform2fv / uniform3fv / uniform4fv
 *   number[] (flat)              → matched by length as above
 *   WebGLTexture | Texture       → bound to a texture unit; value is the sampler index
 *   boolean                      → uniform1i (0 or 1)
 *   Int32Array                   → uniform1iv
 */
export type UniformValue = unknown

export interface Uniform {
  value: UniformValue
}

/**
 * Custom GLSL material — supply your own vertex and fragment shader source.
 *
 * The renderer compiles the shaders, prepends `#define` directives from
 * `defines`, and then calls the uniform setters for each entry in `uniforms`.
 *
 * Usage:
 * ```ts
 * const mat = new ShaderMaterial({
 *   vertexShader:   myVert,
 *   fragmentShader: myFrag,
 *   uniforms: {
 *     u_time:  { value: 0 },
 *     u_color: { value: [1, 0.5, 0] },
 *   },
 *   defines: {
 *     USE_FOG: true,
 *     MAX_LIGHTS: 4,
 *   },
 * })
 * ```
 */
export class ShaderMaterial extends Material {
  override readonly type = 'ShaderMaterial'

  /** GLSL ES vertex shader source (must start with #version 300 es for glslVersion '300 es') */
  vertexShader: string

  /** GLSL ES fragment shader source */
  fragmentShader: string

  /**
   * Uniform definitions — the renderer iterates these and calls the appropriate
   * WebGL uniform setter for each.
   */
  uniforms: Record<string, Uniform>

  /**
   * Preprocessor defines prepended to both shaders before compilation.
   * `true` → `#define KEY`
   * `false` → omitted
   * `number | string` → `#define KEY value`
   */
  defines: Record<string, string | number | boolean>

  /**
   * GLSL version string injected at the top of each shader.
   * '300 es' → `#version 300 es`  (WebGL2, default)
   * '100'    → `#version 100`      (WebGL1 / ESSL 1.00)
   */
  glslVersion: '300 es' | '100'

  /**
   * GL primitive draw mode used by the renderer.
   * 'triangles' (default) → gl.TRIANGLES
   * 'points'              → gl.POINTS  (enables gl_PointSize in vertex shader)
   * 'lines'               → gl.LINES
   */
  drawMode: 'triangles' | 'points' | 'lines'

  constructor(
    options: {
      vertexShader?: string
      fragmentShader?: string
      uniforms?: Record<string, Uniform>
      defines?: Record<string, string | number | boolean>
      glslVersion?: '300 es' | '100'
      drawMode?: 'triangles' | 'points' | 'lines'
      name?: string
    } = {},
  ) {
    super(options.name ?? '')
    this.vertexShader = options.vertexShader ?? 'void main() { gl_Position = vec4(0.0); }'
    this.fragmentShader = options.fragmentShader ?? 'void main() {}'
    this.uniforms = options.uniforms ?? {}
    this.defines = options.defines ?? {}
    this.glslVersion = options.glslVersion ?? '300 es'
    this.drawMode = options.drawMode ?? 'triangles'
  }

  /**
   * Build the `#define` block that is prepended to shader source strings.
   * Called by the renderer before compilation.
   */
  buildDefinesBlock(): string {
    const lines: string[] = []
    for (const [key, val] of Object.entries(this.defines)) {
      if (val === false) continue
      if (val === true) {
        lines.push(`#define ${key}`)
      } else {
        lines.push(`#define ${key} ${val}`)
      }
    }
    return lines.join('\n')
  }

  /**
   * Inject defines into a raw shader source string.
   * The defines block is inserted after the `#version` directive so the
   * GLSL version line remains first (required by the spec).
   */
  injectDefines(shaderSource: string): string {
    const definesBlock = this.buildDefinesBlock()
    if (!definesBlock) return shaderSource

    // Find the end of the #version line and insert after it
    const versionEnd = shaderSource.indexOf('\n')
    if (versionEnd === -1) return definesBlock + '\n' + shaderSource
    return shaderSource.slice(0, versionEnd + 1) + definesBlock + '\n' + shaderSource.slice(versionEnd + 1)
  }

  override clone(): this {
    const copy = super.clone()
    // Deep-copy mutable objects
    copy.uniforms = Object.fromEntries(Object.entries(this.uniforms).map(([k, u]) => [k, { value: u.value }]))
    copy.defines = { ...this.defines }
    return copy
  }
}
