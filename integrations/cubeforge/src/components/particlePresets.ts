export type ParticlePreset = 'explosion' | 'spark' | 'smoke' | 'coinPickup' | 'jumpDust'

export interface ParticleEmitterConfig {
  rate?: number
  speed?: number
  spread?: number
  angle?: number
  particleLife?: number
  particleSize?: number
  color?: string
  gravity?: number
  maxParticles?: number
}

export const PARTICLE_PRESETS: Record<ParticlePreset, ParticleEmitterConfig> = {
  explosion: {
    rate: 60,
    speed: 200,
    spread: Math.PI * 2,
    angle: 0,
    particleLife: 0.5,
    particleSize: 6,
    color: '#ff6b35',
    gravity: 300,
    maxParticles: 80,
  },
  spark: {
    rate: 40,
    speed: 150,
    spread: Math.PI * 2,
    angle: 0,
    particleLife: 0.3,
    particleSize: 3,
    color: '#ffd54f',
    gravity: 400,
    maxParticles: 50,
  },
  smoke: {
    rate: 15,
    speed: 30,
    spread: 0.5,
    angle: -Math.PI / 2,
    particleLife: 1.2,
    particleSize: 10,
    color: '#90a4ae',
    gravity: -20,
    maxParticles: 40,
  },
  coinPickup: {
    rate: 30,
    speed: 80,
    spread: Math.PI * 2,
    angle: -Math.PI / 2,
    particleLife: 0.4,
    particleSize: 4,
    color: '#ffd700',
    gravity: 200,
    maxParticles: 20,
  },
  jumpDust: {
    rate: 25,
    speed: 60,
    spread: Math.PI,
    angle: Math.PI / 2,
    particleLife: 0.3,
    particleSize: 5,
    color: '#b0bec5',
    gravity: 80,
    maxParticles: 20,
  },
}
