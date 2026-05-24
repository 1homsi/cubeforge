/**
 * CubeCamera
 *
 * An Object3D that captures the scene from its world position into a cubemap
 * render target (renderTarget).  Used for real-time reflections / IBL probes.
 *
 * Usage:
 *   const cc = new CubeCamera(0.1, 100, 256)
 *   scene.add(cc)
 *
 *   // In your render loop (before the main render call):
 *   cc.update(renderer.gl, scene, renderer)
 *
 *   // Assign to a material:
 *   mesh.material.envMap = cc.renderTarget
 *
 * Implementation note
 * -------------------
 * The CubeCamera renders each of the six faces by calling
 * WebGLRenderer3D.render() with a dedicated 90° perspective camera.  Because
 * the renderer draws to the screen FBO after the main pass, we blit from the
 * default framebuffer to the face FBO immediately after each face render.
 * For a more efficient implementation, expose a `renderToTarget(fbo)` method
 * on WebGLRenderer3D and call that instead.
 */

import { Object3D } from '../scene/Object3D'
import { Scene, PerspectiveCamera } from '../scene'
import type { WebGLRenderer3D } from '../renderer/WebGLRenderer3D'

// ---------------------------------------------------------------------------
// Face descriptors — six cardinal directions
// ---------------------------------------------------------------------------

interface FaceDesc {
  /** Direction the camera looks toward (world space). */
  target: [number, number, number]
  /** Up vector for this face (world space). */
  up: [number, number, number]
}

const FACE_DESCS: FaceDesc[] = [
  { target: [1, 0, 0], up: [0, -1, 0] }, // +X
  { target: [-1, 0, 0], up: [0, -1, 0] }, // -X
  { target: [0, 1, 0], up: [0, 0, 1] }, // +Y
  { target: [0, -1, 0], up: [0, 0, -1] }, // -Y
  { target: [0, 0, 1], up: [0, -1, 0] }, // +Z
  { target: [0, 0, -1], up: [0, -1, 0] }, // -Z
]

// ---------------------------------------------------------------------------
// CubeCamera
// ---------------------------------------------------------------------------

export class CubeCamera extends Object3D {
  /** The captured cubemap WebGLTexture.  Null until the first update() call. */
  renderTarget: WebGLTexture | null = null

  near: number
  far: number

  private readonly _resolution: number
  private _faceFBOs: WebGLFramebuffer[] = []
  private _depthRBO: WebGLRenderbuffer | null = null

  /** Six PerspectiveCameras — one per cubemap face. */
  private readonly _faceCams: PerspectiveCamera[]

  constructor(near = 0.1, far = 100, resolution = 256) {
    super()
    this.near = near
    this.far = far
    this._resolution = resolution
    // 90° FOV, 1:1 aspect ratio for cubemap faces.
    this._faceCams = FACE_DESCS.map(() => new PerspectiveCamera(90, 1, near, far))
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Capture the scene into this camera's renderTarget cubemap.
   * Call once per frame (or less often) before rendering the main scene.
   */
  update(gl: WebGL2RenderingContext, scene: Scene, renderer: WebGLRenderer3D): void {
    if (!this.renderTarget) {
      this._allocate(gl)
    }

    const size = this._resolution

    // Get our world position.
    this.updateMatrixWorld(true)
    const e = this.matrixWorld.elements
    const wx = e[12],
      wy = e[13],
      wz = e[14]

    for (let face = 0; face < 6; face++) {
      const cam = this._faceCams[face]
      const desc = FACE_DESCS[face]

      // Position the face camera at our world position.
      cam.position.set(wx, wy, wz)
      cam.updateMatrix()
      cam.updateMatrixWorld(true)

      // Look at the face target direction.
      cam.lookAt({
        x: wx + desc.target[0],
        y: wy + desc.target[1],
        z: wz + desc.target[2],
      } as any)
      cam.updateMatrixWorld(true)

      // Render the scene with this face camera.
      // renderer.render() writes to the screen by default (or its internal HDR FBO).
      renderer.render(scene, cam)

      // Blit the rendered result from the default READ framebuffer to our face FBO.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._faceFBOs[face])
      gl.blitFramebuffer(
        0,
        0,
        renderer.canvas.width,
        renderer.canvas.height,
        0,
        0,
        size,
        size,
        gl.COLOR_BUFFER_BIT,
        gl.LINEAR,
      )
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    }

    // Generate mipmaps so materials can sample different roughness levels.
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.renderTarget)
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
  }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.renderTarget) {
      gl.deleteTexture(this.renderTarget)
      this.renderTarget = null
    }
    for (const fbo of this._faceFBOs) {
      gl.deleteFramebuffer(fbo)
    }
    this._faceFBOs = []
    if (this._depthRBO) {
      gl.deleteRenderbuffer(this._depthRBO)
      this._depthRBO = null
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _allocate(gl: WebGL2RenderingContext): void {
    const size = this._resolution

    const canHalf = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')
    const internalFormat = canHalf ? gl.RGBA16F : gl.RGBA8
    const format = gl.RGBA
    const type = canHalf ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE

    // Allocate cubemap texture.
    const cubemap = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap)
    for (let face = 0; face < 6; face++) {
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, internalFormat, size, size, 0, format, type, null)
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
    this.renderTarget = cubemap

    // Shared depth renderbuffer for all six face FBOs.
    const rbo = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, size, size)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    this._depthRBO = rbo

    // One FBO per face.
    for (let face = 0; face < 6; face++) {
      const fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(
        gl.DRAW_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        cubemap,
        0,
      )
      gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
      this._faceFBOs.push(fbo)
    }
  }
}
