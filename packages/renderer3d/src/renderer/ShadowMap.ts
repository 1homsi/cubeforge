/**
 * ShadowMapRenderer — renders depth passes from shadow-casting lights.
 *
 * For each DirectionalLight (or SpotLight) that has castShadow=true:
 *   1. Ensure shadow.map (Framebuffer) exists at the configured mapSize.
 *   2. Bind the framebuffer, clear depth.
 *   3. Render every shadow-casting object in the scene using the depth-only
 *      shadow shaders (SHADOW_VERT / SHADOW_FRAG).
 *
 * The resulting depth texture is then available as `light.shadow.map.depthTexture`
 * and bound by the main renderer when building shadow uniforms.
 */

import { Texture, Framebuffer, ShaderProgram } from '../core'
import { Mat4, Vec3 } from '../math'
import { Scene } from '../scene'
import { Light, DirectionalLight, SpotLight } from '../lights'
import { DirectionalLightShadow } from '../lights'
import { Mesh, SkinnedMesh } from '../objects'
import { SHADOW_VERT, SHADOW_FRAG, SKINNED_VERT } from '../shaders'
import { RenderState } from './RenderState'

// Variant of shadow vert for skinned meshes — reuse SKINNED_VERT as the
// shadow pass (it outputs gl_Position from skinned world position)
const SHADOW_SKINNED_FRAG = SHADOW_FRAG

export class ShadowMapRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly state: RenderState

  /** Cached shadow programs: 'static' | 'skinned' */
  private _shadowProgram: ShaderProgram | null = null
  private _shadowSkinnedProgram: ShaderProgram | null = null

  /** Minimal VAO for shadow pass (shares geometry buffers from state cache) */

  constructor(gl: WebGL2RenderingContext, state: RenderState) {
    this.gl = gl
    this.state = state
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  render(scene: Scene, lights: Light[]): void {
    const { gl } = this

    const shadowProgram = this._getShadowProgram(false)
    const shadowSkinnedProgram = this._getShadowProgram(true)

    for (const light of lights) {
      if (!light.castShadow) continue
      if (!(light instanceof DirectionalLight) && !(light instanceof SpotLight)) continue

      const shadow = light.shadow
      if (!shadow) continue

      // ── CSM path: delegate to CascadeShadowMap when configured ───────────────
      if (light instanceof DirectionalLight && shadow instanceof DirectionalLightShadow && shadow.csm !== null) {
        const csm = shadow.csm
        // We need the camera and light direction; the camera is stored on the
        // RenderState.  Derive light direction from the light's target.
        const camera = this.state.currentCamera
        if (camera) {
          const lightPos = new Vec3()
          light.matrixWorld.getPosition(lightPos)
          const targetPos = new Vec3()
          light.target.getWorldPosition(targetPos)
          const lightDir = new Vec3(targetPos.x - lightPos.x, targetPos.y - lightPos.y, targetPos.z - lightPos.z)
          csm.update(camera, lightDir)
          csm.render(gl, scene, this.state)
        }
        // Restore viewport (caller resets it, but be safe)
        gl.cullFace(gl.BACK)
        continue
      }

      // ── Ensure framebuffer is created ──
      if (!shadow.map) {
        shadow.map = this._createShadowFramebuffer(shadow.mapSize.width, shadow.mapSize.height)
      }

      // ── Update light camera ──
      if (light instanceof DirectionalLight) {
        // Update the shadow camera to match the light transform
        shadow.camera.position.set(light.position.x, light.position.y, light.position.z)
        const target = light.target
        shadow.camera.lookAt(target.position)
        shadow.camera.updateMatrixWorld(true)
        shadow.camera.updateProjectionMatrix()
      }

      // Build light-space matrix
      const lightSpaceMat = new Mat4().multiplyMatrices(
        shadow.camera.projectionMatrix,
        shadow.camera.matrixWorldInverse,
      )

      // ── Bind shadow framebuffer ──
      shadow.map.bind()
      gl.viewport(0, 0, shadow.mapSize.width, shadow.mapSize.height)
      gl.clear(gl.DEPTH_BUFFER_BIT)

      // Enable depth testing for shadow pass
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.depthMask(true)

      // Front-face culling to reduce peter-panning
      gl.enable(gl.CULL_FACE)
      gl.cullFace(gl.FRONT)

      // ── Render every shadow-casting mesh ──
      scene.traverseVisible((obj) => {
        const mesh = obj as Mesh
        if (!mesh.isMesh || !mesh.castShadow) return

        const isSkinned = !!(mesh as SkinnedMesh).isSkinnedMesh
        const program = isSkinned ? shadowSkinnedProgram : shadowProgram

        this.state.glState.useProgram(program.handle)

        // Model matrix
        program.setUniformMat4fv('u_modelMatrix', mesh.matrixWorld.elements)
        program.setUniformMat4fv('u_lightSpaceMatrix', lightSpaceMat.elements)

        // Skinning uniforms
        if (isSkinned) {
          const sm = mesh as SkinnedMesh
          if (sm.skeleton) {
            sm.skeleton.update(gl)
            if (sm.skeleton.boneTexture) {
              this.state.glState.bindTexture(0, gl.TEXTURE_2D, sm.skeleton.boneTexture)
              program.setUniform1i('u_boneTexture', 0)
              program.setUniform1i('u_boneCount', sm.skeleton.bones.length)
            }
          }
        }

        // Upload geometry and get VAO
        const vao = this.state.getGeometryVAO(mesh.geometry, program)
        vao.bind()

        // Draw
        const geo = mesh.geometry
        const hasIdx = geo.index !== null
        const start = geo.drawRange.start
        const count =
          geo.drawRange.count === Infinity
            ? hasIdx
              ? geo.index!.count
              : (geo.getAttribute('position')?.count ?? 0)
            : geo.drawRange.count

        if (hasIdx) {
          const indexType = geo.index!.data instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
          gl.drawElements(gl.TRIANGLES, count, indexType, start * (indexType === gl.UNSIGNED_INT ? 4 : 2))
        } else {
          gl.drawArrays(gl.TRIANGLES, start, count)
        }
      })

      // Restore back-face culling
      gl.cullFace(gl.BACK)

      shadow.map.unbind()
    }

    // Restore full viewport (caller is responsible for this, but reset just in case)
    gl.cullFace(gl.BACK)
  }

  dispose(): void {
    this._shadowProgram?.dispose()
    this._shadowSkinnedProgram?.dispose()
    this._shadowProgram = null
    this._shadowSkinnedProgram = null
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _getShadowProgram(skinned: boolean): ShaderProgram {
    if (skinned) {
      if (!this._shadowSkinnedProgram) {
        // Use the full skinned vert with the minimal shadow frag
        this._shadowSkinnedProgram = new ShaderProgram(this.gl, SKINNED_VERT, SHADOW_SKINNED_FRAG)
      }
      return this._shadowSkinnedProgram
    }

    if (!this._shadowProgram) {
      this._shadowProgram = new ShaderProgram(this.gl, SHADOW_VERT, SHADOW_FRAG)
    }
    return this._shadowProgram
  }

  private _createShadowFramebuffer(width: number, height: number): Framebuffer {
    const { gl } = this

    const fbo = new Framebuffer(gl, width, height)

    // Depth texture (the actual shadow map)
    const depthTex = Texture.createDepth(gl, width, height)
    // Enable hardware shadow comparison
    gl.bindTexture(gl.TEXTURE_2D, depthTex.handle)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL)
    gl.bindTexture(gl.TEXTURE_2D, null)

    fbo.attachDepth(depthTex)

    // Attach a color renderbuffer for spec compliance (shadow pass doesn't write color)
    // Use a tiny color texture to satisfy completeness checks
    const colorTex = Texture.createEmpty(gl, width, height, {
      internalFormat: gl.RGBA8,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
    })
    fbo.attachColor(colorTex, 0)

    fbo.check()
    return fbo
  }
}
