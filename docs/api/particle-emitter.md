# ParticleEmitter

Attaches a particle system to an entity. Particles spawn at the entity's Transform position and move according to speed, spread angle, and gravity settings. All parameters are configurable per-emitter.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `active` | boolean | `true` | Whether particles are currently being emitted |
| `preset` | ParticlePreset | — | Named preset. Values can be overridden by explicit props. |
| `rate` | number | `20` | Particles emitted per second |
| `speed` | number | `80` | Initial speed of each particle in pixels per second |
| `spread` | number | `Math.PI` | Angle spread in radians (Math.PI = full half-circle) |
| `angle` | number | `-Math.PI / 2` | Base emit direction in radians (0 = right, -PI/2 = up) |
| `particleLife` | number | `0.8` | Lifetime of each particle in seconds |
| `particleSize` | number | `4` | Particle size in pixels |
| `color` | string | `'#ffffff'` | Particle colour |
| `gravity` | number | `200` | Gravity applied to particles in pixels per second squared |
| `maxParticles` | number | `100` | Maximum live particles at once. Old particles are recycled. |

## Example

```tsx
<Entity>
  <Transform x={200} y={300} />
  <ParticleEmitter
    active={isOnFire}
    rate={40}
    speed={80}
    spread={Math.PI * 0.4}
    angle={-Math.PI / 2}
    particleLife={1.0}
    particleSize={3}
    color="#ff6b35"
    gravity={-80}
    maxParticles={200}
  />
</Entity>
```

## Presets

Named presets configure all values for common effects. You can override any preset prop:

```tsx
<ParticleEmitter preset="dust" active={isLanding} />
<ParticleEmitter preset="sparks" active={isHit} color="#4fc3f7" />
<ParticleEmitter preset="smoke" active={isOnFire} rate={60} />
```

Available presets: `"dust"`, `"sparks"`, `"smoke"`.

## Toggling emission

Toggle `active` to start and stop emitting without unmounting:

```tsx
const [landing, setLanding] = useState(false)

<ParticleEmitter active={landing} preset="dust" />
```

Set `active={false}` when the effect should stop. Existing live particles continue until their lifetime expires.

## Notes

- The emitter spawns at the entity's Transform position each frame. If the entity moves, particles spawn at the new position.
- `gravity` in `<ParticleEmitter>` is independent of world gravity — it applies only to particles, not the entity.
- `active` is synced every render. All other props are set on mount.
