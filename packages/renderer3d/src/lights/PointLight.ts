import { Vec3 } from '../math';
import { Light } from './Light';

export class PointLight extends Light {
  distance: number;
  decay: number;

  constructor(color = new Vec3(1, 1, 1), intensity = 1, distance = 0, decay = 2) {
    super(color, intensity);
    this.distance = distance;
    this.decay = decay;
  }
}
