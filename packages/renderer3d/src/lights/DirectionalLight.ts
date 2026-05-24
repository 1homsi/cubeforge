import { Vec3 } from '../math';
import { Object3D } from '../scene';
import { Light } from './Light';
import { DirectionalLightShadow } from './DirectionalLightShadow';

export class DirectionalLight extends Light {
  target: Object3D;
  declare shadow: DirectionalLightShadow;

  constructor(color = new Vec3(1, 1, 1), intensity = 1) {
    super(color, intensity);
    this.target = new Object3D();
    this.shadow = new DirectionalLightShadow();
  }
}
