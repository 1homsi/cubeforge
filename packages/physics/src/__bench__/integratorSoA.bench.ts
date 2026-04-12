/**
 * Prototype benchmark: AoS (array-of-structs, current impl) vs SoA
 * (struct-of-arrays, typed-array-backed) rigid-body integrator.
 *
 * Not wired into the main physics pipeline — this is a standalone bench used
 * to validate whether an SoA refactor of physics body storage is worth
 * pursuing for a future perf pass.
 *
 * Run with:
 *   pnpm --filter @cubeforge/physics exec tsx src/__bench__/integratorSoA.bench.ts
 * or:
 *   npx tsx packages/physics/src/__bench__/integratorSoA.bench.ts
 *
 * The benchmark simulates a single fixed-step integrator pass over N bodies,
 * applying gravity, integrating forces to velocity, linear + angular damping,
 * and velocity clamping. It does NOT include collision detection, constraint
 * solving, or position integration — those will be separate benchmarks if we
 * decide to proceed.
 */

// ── AoS (current implementation shape) ───────────────────────────────────────

interface AoSBody {
  vx: number
  vy: number
  forceX: number
  forceY: number
  torque: number
  invMass: number
  invInertia: number
  gravityScale: number
  linearDamping: number
  angularDamping: number
  angularVelocity: number
  maxLinearVelocity: number
  maxAngularVelocity: number
  isStatic: boolean
  isKinematic: boolean
  sleeping: boolean
  lockX: boolean
  lockY: boolean
  lockRotation: boolean
  enabled: boolean
  mass: number
}

function makeAoSBody(): AoSBody {
  return {
    vx: Math.random() * 10 - 5,
    vy: Math.random() * 10 - 5,
    forceX: 0,
    forceY: 0,
    torque: 0,
    invMass: 1,
    invInertia: 0.5,
    gravityScale: 1,
    linearDamping: 0.01,
    angularDamping: 0.05,
    angularVelocity: Math.random() - 0.5,
    maxLinearVelocity: 500,
    maxAngularVelocity: 20,
    isStatic: false,
    isKinematic: false,
    sleeping: false,
    lockX: false,
    lockY: false,
    lockRotation: false,
    enabled: true,
    mass: 1,
  }
}

function integrateAoS(bodies: AoSBody[], dt: number, gravity: number): void {
  for (const rb of bodies) {
    if (!rb.enabled || rb.sleeping || rb.isStatic || rb.isKinematic) continue

    if (!rb.lockY) rb.forceY += gravity * rb.gravityScale * rb.mass

    if (rb.invMass > 0) {
      rb.vx += rb.forceX * rb.invMass * dt
      rb.vy += rb.forceY * rb.invMass * dt
    }
    if (rb.invInertia > 0) {
      rb.angularVelocity += rb.torque * rb.invInertia * dt
    }

    rb.forceX = 0
    rb.forceY = 0
    rb.torque = 0

    if (rb.lockX) rb.vx = 0
    if (rb.lockY) rb.vy = 0
    if (rb.lockRotation) rb.angularVelocity = 0

    if (rb.linearDamping > 0) {
      rb.vx *= 1 - rb.linearDamping
      rb.vy *= 1 - rb.linearDamping
    }
    if (rb.angularDamping > 0) {
      rb.angularVelocity *= 1 - rb.angularDamping
    }

    if (rb.maxLinearVelocity > 0) {
      const speed = Math.sqrt(rb.vx * rb.vx + rb.vy * rb.vy)
      if (speed > rb.maxLinearVelocity) {
        const scale = rb.maxLinearVelocity / speed
        rb.vx *= scale
        rb.vy *= scale
      }
    }
    if (rb.maxAngularVelocity > 0) {
      if (Math.abs(rb.angularVelocity) > rb.maxAngularVelocity) {
        rb.angularVelocity = Math.sign(rb.angularVelocity) * rb.maxAngularVelocity
      }
    }
  }
}

// ── SoA implementation ───────────────────────────────────────────────────────

// Flag bits packed into a single Uint8Array for cache density.
const FLAG_ENABLED = 1 << 0
const FLAG_STATIC = 1 << 1
const FLAG_KINEMATIC = 1 << 2
const FLAG_SLEEPING = 1 << 3
const FLAG_LOCK_X = 1 << 4
const FLAG_LOCK_Y = 1 << 5
const FLAG_LOCK_ROTATION = 1 << 6

class SoABodyStore {
  readonly capacity: number
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly forceX: Float32Array
  readonly forceY: Float32Array
  readonly torque: Float32Array
  readonly invMass: Float32Array
  readonly invInertia: Float32Array
  readonly gravityScale: Float32Array
  readonly linearDamping: Float32Array
  readonly angularDamping: Float32Array
  readonly angularVelocity: Float32Array
  readonly maxLinearVelocity: Float32Array
  readonly maxAngularVelocity: Float32Array
  readonly mass: Float32Array
  readonly flags: Uint8Array

  constructor(capacity: number) {
    this.capacity = capacity
    this.vx = new Float32Array(capacity)
    this.vy = new Float32Array(capacity)
    this.forceX = new Float32Array(capacity)
    this.forceY = new Float32Array(capacity)
    this.torque = new Float32Array(capacity)
    this.invMass = new Float32Array(capacity)
    this.invInertia = new Float32Array(capacity)
    this.gravityScale = new Float32Array(capacity)
    this.linearDamping = new Float32Array(capacity)
    this.angularDamping = new Float32Array(capacity)
    this.angularVelocity = new Float32Array(capacity)
    this.maxLinearVelocity = new Float32Array(capacity)
    this.maxAngularVelocity = new Float32Array(capacity)
    this.mass = new Float32Array(capacity)
    this.flags = new Uint8Array(capacity)
  }

  static fromAoS(bodies: AoSBody[]): SoABodyStore {
    const s = new SoABodyStore(bodies.length)
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]
      s.vx[i] = b.vx
      s.vy[i] = b.vy
      s.forceX[i] = b.forceX
      s.forceY[i] = b.forceY
      s.torque[i] = b.torque
      s.invMass[i] = b.invMass
      s.invInertia[i] = b.invInertia
      s.gravityScale[i] = b.gravityScale
      s.linearDamping[i] = b.linearDamping
      s.angularDamping[i] = b.angularDamping
      s.angularVelocity[i] = b.angularVelocity
      s.maxLinearVelocity[i] = b.maxLinearVelocity
      s.maxAngularVelocity[i] = b.maxAngularVelocity
      s.mass[i] = b.mass
      let f = 0
      if (b.enabled) f |= FLAG_ENABLED
      if (b.isStatic) f |= FLAG_STATIC
      if (b.isKinematic) f |= FLAG_KINEMATIC
      if (b.sleeping) f |= FLAG_SLEEPING
      if (b.lockX) f |= FLAG_LOCK_X
      if (b.lockY) f |= FLAG_LOCK_Y
      if (b.lockRotation) f |= FLAG_LOCK_ROTATION
      s.flags[i] = f
    }
    return s
  }
}

function integrateSoA(s: SoABodyStore, dt: number, gravity: number): void {
  const n = s.capacity
  const vx = s.vx
  const vy = s.vy
  const forceX = s.forceX
  const forceY = s.forceY
  const torque = s.torque
  const invMass = s.invMass
  const invInertia = s.invInertia
  const gravityScale = s.gravityScale
  const linearDamping = s.linearDamping
  const angularDamping = s.angularDamping
  const angularVelocity = s.angularVelocity
  const maxLinearVelocity = s.maxLinearVelocity
  const maxAngularVelocity = s.maxAngularVelocity
  const mass = s.mass
  const flags = s.flags

  const SKIP_MASK = FLAG_STATIC | FLAG_KINEMATIC | FLAG_SLEEPING

  for (let i = 0; i < n; i++) {
    const f = flags[i]
    if (!(f & FLAG_ENABLED)) continue
    if (f & SKIP_MASK) continue

    const lockX = (f & FLAG_LOCK_X) !== 0
    const lockY = (f & FLAG_LOCK_Y) !== 0
    const lockRotation = (f & FLAG_LOCK_ROTATION) !== 0

    let fY = forceY[i]
    if (!lockY) fY += gravity * gravityScale[i] * mass[i]

    const im = invMass[i]
    let newVx = vx[i]
    let newVy = vy[i]
    if (im > 0) {
      newVx += forceX[i] * im * dt
      newVy += fY * im * dt
    }
    let newW = angularVelocity[i]
    const iI = invInertia[i]
    if (iI > 0) {
      newW += torque[i] * iI * dt
    }

    forceX[i] = 0
    forceY[i] = 0
    torque[i] = 0

    if (lockX) newVx = 0
    if (lockY) newVy = 0
    if (lockRotation) newW = 0

    const ld = linearDamping[i]
    if (ld > 0) {
      const k = 1 - ld
      newVx *= k
      newVy *= k
    }
    const ad = angularDamping[i]
    if (ad > 0) {
      newW *= 1 - ad
    }

    const maxLin = maxLinearVelocity[i]
    if (maxLin > 0) {
      const speed = Math.sqrt(newVx * newVx + newVy * newVy)
      if (speed > maxLin) {
        const scale = maxLin / speed
        newVx *= scale
        newVy *= scale
      }
    }
    const maxAng = maxAngularVelocity[i]
    if (maxAng > 0) {
      const absW = newW < 0 ? -newW : newW
      if (absW > maxAng) {
        newW = newW < 0 ? -maxAng : maxAng
      }
    }

    vx[i] = newVx
    vy[i] = newVy
    angularVelocity[i] = newW
  }
}

// ── Benchmark harness ────────────────────────────────────────────────────────

function bench(label: string, fn: () => void, iterations: number): number {
  // Warm up
  for (let i = 0; i < 3; i++) fn()
  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn()
  const end = performance.now()
  const total = end - start
  const per = total / iterations
  const perMs = per.toFixed(4)
  process.stdout.write(`  ${label.padEnd(18)} ${total.toFixed(1).padStart(7)} ms total  (${perMs} ms / iter)\n`)
  return per
}

function run(bodyCount: number, iterations: number): void {
  process.stdout.write(`\n▸ ${bodyCount.toLocaleString()} bodies × ${iterations.toLocaleString()} integration steps\n`)

  const aosBodies: AoSBody[] = []
  for (let i = 0; i < bodyCount; i++) aosBodies.push(makeAoSBody())
  const soaStore = SoABodyStore.fromAoS(aosBodies)

  const aosTime = bench(
    'AoS (heap objects)',
    () => {
      // Re-randomize forces to prevent damping from zeroing everything out
      for (let i = 0; i < aosBodies.length; i++) {
        aosBodies[i].forceX = (i & 3) - 1.5
        aosBodies[i].forceY = ((i >> 1) & 3) - 1.5
      }
      integrateAoS(aosBodies, 1 / 60, 980)
    },
    iterations,
  )
  const soaTime = bench(
    'SoA (typed arrays)',
    () => {
      for (let i = 0; i < soaStore.capacity; i++) {
        soaStore.forceX[i] = (i & 3) - 1.5
        soaStore.forceY[i] = ((i >> 1) & 3) - 1.5
      }
      integrateSoA(soaStore, 1 / 60, 980)
    },
    iterations,
  )

  const speedup = aosTime / soaTime
  const pct = ((speedup - 1) * 100).toFixed(1)
  const faster = speedup > 1
  process.stdout.write(
    `  → SoA is ${speedup.toFixed(2)}x ${faster ? 'faster' : 'slower'} (${faster ? '+' : ''}${pct}%)\n`,
  )
}

// ── Narrow-access benchmark ──────────────────────────────────────────────────
//
// SoA typically wins when a loop touches only a small subset of each struct's
// fields (good cache density). The full integrator above touches ~14 fields,
// so AoS wins. Here we benchmark a loop that only reads/writes velocity — the
// kind of loop broad-phase, ZST visibility culling, or debug drawing might do.

function narrowAoS(bodies: AoSBody[]): number {
  let sum = 0
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]
    sum += b.vx + b.vy
  }
  return sum
}

function narrowSoA(s: SoABodyStore): number {
  let sum = 0
  const vx = s.vx
  const vy = s.vy
  const n = s.capacity
  for (let i = 0; i < n; i++) {
    sum += vx[i] + vy[i]
  }
  return sum
}

function runNarrow(bodyCount: number, iterations: number): void {
  process.stdout.write(
    `\n▸ narrow-access (vx+vy only), ${bodyCount.toLocaleString()} bodies × ${iterations.toLocaleString()} passes\n`,
  )
  const aosBodies: AoSBody[] = []
  for (let i = 0; i < bodyCount; i++) aosBodies.push(makeAoSBody())
  const soaStore = SoABodyStore.fromAoS(aosBodies)

  let sinkAos = 0
  let sinkSoa = 0
  const aosTime = bench(
    'AoS (narrow)',
    () => {
      sinkAos += narrowAoS(aosBodies)
    },
    iterations,
  )
  const soaTime = bench(
    'SoA (narrow)',
    () => {
      sinkSoa += narrowSoA(soaStore)
    },
    iterations,
  )
  // Keep sinks live so the JIT doesn't dead-code them
  if (sinkAos === sinkSoa * 1e-30) process.stdout.write('')

  const speedup = aosTime / soaTime
  const pct = ((speedup - 1) * 100).toFixed(1)
  const faster = speedup > 1
  process.stdout.write(
    `  → SoA is ${speedup.toFixed(2)}x ${faster ? 'faster' : 'slower'} (${faster ? '+' : ''}${pct}%)\n`,
  )
}

process.stdout.write('\n=== Rigid-body integrator: AoS vs SoA ===\n')
process.stdout.write(`(Node ${process.version})\n`)
run(100, 10000)
run(1000, 5000)
run(10_000, 1000)
run(50_000, 200)

runNarrow(10_000, 5000)
runNarrow(100_000, 500)
process.stdout.write('\n')
