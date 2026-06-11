import { OrthographicCamera } from '../scene'
import { LightShadow } from './LightShadow'
import type { CascadeShadowMap } from '../renderer/CascadeShadowMap'

export class DirectionalLightShadow extends LightShadow {
  declare camera: OrthographicCamera
  left: number
  right: number
  top: number
  bottom: number

  /**
   * Optional Cascade Shadow Map.  When set, ShadowMapRenderer will delegate
   * to CascadeShadowMap.render() instead of the basic single-map path.
   */
  csm: CascadeShadowMap | null = null

  constructor() {
    super(new OrthographicCamera(-10, 10, 10, -10, 0.5, 500))
    this.left = -10
    this.right = 10
    this.top = 10
    this.bottom = -10
  }

  updateFrustum(): void {
    const cam = this.camera
    cam.left = this.left
    cam.right = this.right
    cam.top = this.top
    cam.bottom = this.bottom
    cam.updateProjectionMatrix()
  }
}
