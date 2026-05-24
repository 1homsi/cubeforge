import { Camera } from '../scene';
import { Framebuffer } from '../core';

export class LightShadow {
  camera: Camera;
  bias: number;
  normalBias: number;
  radius: number;
  mapSize: { width: number; height: number };
  map: Framebuffer | null;

  constructor(camera: Camera) {
    this.camera = camera;
    this.bias = -0.0005;
    this.normalBias = 0;
    this.radius = 1;
    this.mapSize = { width: 1024, height: 1024 };
    this.map = null;
  }
}
