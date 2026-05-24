import { Vec3 } from '../math';
import { Light } from './Light';

export class AmbientLight extends Light {
  constructor(color = new Vec3(1, 1, 1), intensity = 1) {
    super(color, intensity);
  }
}
