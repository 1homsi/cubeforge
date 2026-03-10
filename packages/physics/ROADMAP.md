# Cubeforge Physics — Roadmap to Full Rigid Body Engine

This document tracks the upgrade of `@cubeforge/physics` from a platformer-oriented AABB system to a complete impulse-based 2D rigid body physics engine — built entirely from scratch, no external libraries.

**Goal:** 100% feature parity with Rapier 2D. Every feature Rapier supports, we support.

---

## Legend

| Icon | Meaning |
|------|---------|
| :white_check_mark: | **Done** — implemented and tested |
| :construction: | **In Progress** — actively being built |
| :white_circle: | **Planned** — not started |

---

## Current State (Baseline)

What we already have and will keep:

- :white_check_mark: Spatial grid broad phase (128×128 cells)
- :white_check_mark: Fixed timestep with accumulator (60 Hz)
- :white_check_mark: AABB overlap detection (signed overlap vector)
- :white_check_mark: Two-pass integration (X then Y) for platformer resolution
- :white_check_mark: Slope colliders (angle-based surface Y calculation)
- :white_check_mark: One-way platforms (previous-frame position check)
- :white_check_mark: Moving platform carry (static delta tracking)
- :white_check_mark: CCD with swept AABB (Minkowski sum ray approach)
- :white_check_mark: Sleeping system (velocity threshold + timer)
- :white_check_mark: Layer/mask collision filtering (string-based, AND semantics)
- :white_check_mark: Contact event diffing (enter/stay/exit for triggers, collisions, circles, compounds, capsules)
- :white_check_mark: Joint constraints — distance, spring, revolute, rope (4 iterations)
- :white_check_mark: Spatial queries — raycast, raycastAll, overlapBox, overlapCircle, sweepBox
- :white_check_mark: Circle-circle and circle-AABB detection (event-only, no response)
- :white_check_mark: Compound colliders (multi-shape)
- :white_check_mark: Capsule colliders (AABB-approximated)
- :white_check_mark: Kinematic bodies (skip gravity, resolve collisions)
- :white_check_mark: RigidBody props: mass, gravityScale, bounce, friction, lockX/Y, linearDamping, angularDamping, angularVelocity, ccd

---

## Stage 1 — Impulse Solver Core

> The foundation everything else depends on. Replace position-based correction with impulse-based collision response.

### 1.1 Contact Manifold Generation

| Task | Status | Description |
|------|--------|-------------|
| Contact point struct | :white_circle: | `ContactPoint { localA, localB, worldA, worldB, normal, penetration, normalImpulse, tangentImpulse, featureIdA, featureIdB }` |
| Contact manifold struct | :white_circle: | `ContactManifold { entityA, entityB, points[], normal, friction, restitution }` |
| AABB-AABB manifold | :white_circle: | Generate 1-2 contact points from box overlap (edge-edge, vertex-edge) |
| Circle-circle manifold | :white_circle: | Single contact point along center-to-center axis |
| Circle-AABB manifold | :white_circle: | Single contact point at nearest point on box to circle center |
| Manifold persistence | :white_circle: | Cache manifolds between frames, match contact points by feature ID for warm starting |

### 1.2 Mass Properties

| Task | Status | Description |
|------|--------|-------------|
| Density property | :white_circle: | Add `density?: number` to RigidBody (default 1.0). Mass = density × area |
| Auto-compute mass from shape | :white_circle: | Box: `density * width * height`. Circle: `density * π * r²`. Capsule: rect + two semicircles |
| Moment of inertia | :white_circle: | Box: `(1/12) * mass * (w² + h²)`. Circle: `(1/2) * mass * r²`. Capsule: composite formula |
| Center of mass | :white_circle: | Single shape: geometric center. Compound: weighted average of sub-shape centers |
| Inverse mass / inverse inertia | :white_circle: | Precompute `invMass` and `invInertia` (0 for static/kinematic). Used in every impulse calc |
| `setAdditionalMass()` | :white_circle: | Add extra mass on top of computed mass (Rapier: `set_additional_mass`) |
| `setMassProperties()` | :white_circle: | Override mass, center of mass, and inertia simultaneously |
| `recomputeMassFromColliders()` | :white_circle: | Recompute mass properties from attached colliders (Rapier: `recompute_mass_properties_from_colliders`) |
| Volume / area query | :white_circle: | `collider.area()` — return computed area of the collider shape |

### 1.3 Sequential Impulse Solver

| Task | Status | Description |
|------|--------|-------------|
| Normal impulse | :white_circle: | `j = -(1 + e) * vRel·n / (invMassA + invMassB + (rA×n)²·invIA + (rB×n)²·invIB)`. Clamp `j >= 0` |
| Apply impulse to velocity | :white_circle: | `vA -= j * n * invMassA`, `vB += j * n * invMassB` |
| Apply impulse to angular velocity | :white_circle: | `ωA -= (rA × (j * n)) * invIA`, `ωB += (rB × (j * n)) * invIB` |
| Tangent impulse (friction) | :white_circle: | Coulomb model: compute tangent direction, solve tangent impulse, clamp to `±μ * normalImpulse` |
| Position correction (Baumgarte) | :white_circle: | Push bodies apart by `β * max(0, penetration - slop) / (invMassA + invMassB)` to prevent sinking |
| Solver iterations (configurable) | :white_circle: | Default 8 velocity iterations, 4 position iterations. Configurable via `PhysicsConfig` |
| Warm starting | :white_circle: | Reuse previous frame's `normalImpulse` and `tangentImpulse` from cached manifolds as initial guess |
| Additional solver iterations per body | :white_circle: | `additionalSolverIterations: number` on RigidBody — extra iterations for everything in contact chain (Rapier parity) |

### 1.4 Restitution & Friction Combine Rules

| Task | Status | Description |
|------|--------|-------------|
| Coefficient combine enum | :white_circle: | `CombineRule = 'average' \| 'min' \| 'max' \| 'multiply'` |
| Per-collider friction coefficient | :white_circle: | Add `friction: number` to collider (default 0.5) |
| Per-collider restitution | :white_circle: | Add `restitution: number` to collider (default 0.0) — replaces RigidBody `bounce` |
| Combine rule priority | :white_circle: | Max > Multiply > Min > Average. Higher priority rule wins when two colliders disagree |
| Per-collider friction combine rule | :white_circle: | `frictionCombineRule: CombineRule` — override global rule per collider |
| Per-collider restitution combine rule | :white_circle: | `restitutionCombineRule: CombineRule` — override global rule per collider |
| Velocity threshold for restitution | :white_circle: | Skip bounce if relative velocity < threshold (prevents micro-bouncing at rest) |

### 1.5 Integration Changes

| Task | Status | Description |
|------|--------|-------------|
| Remove X-then-Y two-pass for rigid body mode | :white_circle: | Impulse solver handles both axes simultaneously |
| Keep X-then-Y as opt-in for platformer mode | :white_circle: | `PhysicsConfig.mode: 'rigidbody' \| 'platformer'` — backward compatible |
| Semi-implicit Euler integration | :white_circle: | Apply forces → update velocity → update position (current order, but forces are new) |
| Rotation integration | :white_circle: | `rotation += angularVelocity * dt` each step (currently exists but not driven by collisions) |

### 1.6 Rigid Body State

| Task | Status | Description |
|------|--------|-------------|
| Enabled/disabled toggle | :white_circle: | `setEnabled(bool)` / `isEnabled()` — disabled bodies are skipped entirely (no collision, no integration) |
| Max linear velocity clamping | :white_circle: | `maxLinearVelocity: number` — clamp linear velocity magnitude each step |
| Max angular velocity clamping | :white_circle: | `maxAngularVelocity: number` — clamp angular velocity each step |
| Velocity at point query | :white_circle: | `velocityAtPoint(x, y)` — returns linear + angular contribution at world-space point |
| Kinetic energy query | :white_circle: | `kineticEnergy()` — `0.5 * mass * v² + 0.5 * inertia * ω²` |
| Gravitational potential energy query | :white_circle: | `potentialEnergy(gravity)` — `mass * gravity * height` |
| Position prediction | :white_circle: | `predictPosition(dt)` — extrapolate position using current velocity and forces |
| User data | :white_circle: | `userData: unknown` field on RigidBody, Collider, and Joint — arbitrary user-attached data |

### 1.7 Tests

| Task | Status | Description |
|------|--------|-------------|
| Ball drop on static floor | :white_circle: | Verify bounce height matches restitution coefficient |
| Two balls collide | :white_circle: | Verify momentum conservation: `m1*v1 + m2*v2 = const` |
| Ball hits box off-center | :white_circle: | Verify angular velocity is generated on both bodies |
| Stack of 5 boxes | :white_circle: | Verify stable stacking (no jitter, no sinking) over 300 frames |
| Heavy box pushes light box | :white_circle: | Verify mass ratio affects response (heavy barely slows, light flies) |
| Friction test | :white_circle: | Box on angled surface: high friction = stays, low friction = slides |
| Disabled body ignored | :white_circle: | `setEnabled(false)` — body doesn't collide or integrate |
| Velocity clamping | :white_circle: | Body with `maxLinearVelocity=100` never exceeds that speed |

---

## Stage 2 — Shape Parity

> Upgrade all collider shapes to participate in the impulse solver with proper contact generation. Match every shape Rapier supports.

### 2.1 Circle Collider Physics Response

| Task | Status | Description |
|------|--------|-------------|
| Circle-circle collision response | :white_circle: | Currently event-only. Add separation + impulse using center-to-center normal |
| Circle-AABB collision response | :white_circle: | Currently event-only. Nearest-point normal, impulse, and angular response |
| Circle-circle CCD | :white_circle: | Swept circle vs circle (closest approach along relative velocity) |
| Circle-AABB CCD | :white_circle: | Swept circle vs box (Minkowski sum with rounded corners) |

### 2.2 Real Capsule Collision

| Task | Status | Description |
|------|--------|-------------|
| Capsule representation | :white_circle: | Two endpoints + radius (line segment with thickness) |
| Capsule-AABB narrow phase | :white_circle: | Closest point on segment to box, then circle-box test at that point |
| Capsule-circle narrow phase | :white_circle: | Closest point on segment to circle center, then circle-circle test |
| Capsule-capsule narrow phase | :white_circle: | Closest points between two segments, then circle-circle test |
| Capsule mass properties | :white_circle: | Rectangle area + two semicircle areas. Inertia: composite formula |

### 2.3 Convex Polygon Collider

| Task | Status | Description |
|------|--------|-------------|
| ConvexPolygonCollider component | :white_circle: | `vertices: Vec2[]` (convex hull, wound CCW). Max 8 vertices for performance |
| SAT (Separating Axis Theorem) | :white_circle: | Test all edge normals of both polygons. Find axis of minimum penetration |
| Polygon-polygon contact points | :white_circle: | Clipping: reference face vs incident face → 1-2 contact points |
| Polygon-circle contact | :white_circle: | Find closest edge/vertex to circle center, compute normal and penetration |
| Polygon-AABB contact | :white_circle: | AABB is a special case of polygon (4 vertices). Reuse SAT |
| Polygon mass properties | :white_circle: | Shoelace formula for area, composite triangulation for inertia |
| React component | :white_circle: | `<ConvexCollider vertices={[{x,y}, ...]} />` |

### 2.4 Triangle Collider

| Task | Status | Description |
|------|--------|-------------|
| TriangleCollider component | :white_circle: | `a: Vec2, b: Vec2, c: Vec2` — dedicated triangle shape (optimized vs generic polygon) |
| Triangle-circle contact | :white_circle: | Closest point on triangle boundary to circle center |
| Triangle-AABB contact | :white_circle: | SAT with 3 edge normals + AABB axes |
| Triangle-triangle contact | :white_circle: | SAT with all 6 edge normals |
| Triangle mass properties | :white_circle: | Area: `0.5 * |cross(b-a, c-a)|`. Inertia: `(mass/18) * (dot(a,a) + dot(b,b) + dot(c,c) - dot(a,b) - dot(a,c) - dot(b,c))` |
| React component | :white_circle: | `<TriangleCollider a={{x,y}} b={{x,y}} c={{x,y}} />` |

### 2.5 Edge / Segment Collider

| Task | Status | Description |
|------|--------|-------------|
| SegmentCollider component | :white_circle: | `start: Vec2, end: Vec2` — infinitely thin line segment |
| Edge-circle contact | :white_circle: | Closest point on segment to circle, check distance < radius |
| Edge-AABB contact | :white_circle: | Segment vs box intersection (parametric line-AABB) |
| Edge-polygon contact | :white_circle: | Closest point on segment to polygon edge/vertex |
| Edge normal | :white_circle: | Perpendicular to segment direction, one-sided (like a wall) |
| Chain of edges (Polyline) | :white_circle: | `PolylineCollider { vertices: Vec2[] }` — connected sequence of line segments |
| React component | :white_circle: | `<SegmentCollider start={{x,y}} end={{x,y}} />`, `<PolylineCollider vertices={[...]} />` |

### 2.6 HeightField Collider

| Task | Status | Description |
|------|--------|-------------|
| HeightFieldCollider component | :white_circle: | `heights: number[], scale: { x, y }` — terrain from regular grid of height values |
| HeightField-circle contact | :white_circle: | Find grid cell, compute segment at that cell, circle-segment test |
| HeightField-AABB contact | :white_circle: | Find overlapping cells, treat each cell edge as segment |
| HeightField-polygon contact | :white_circle: | Find overlapping cells, SAT against each cell segment |
| React component | :white_circle: | `<HeightFieldCollider heights={[...]} scaleX={1} scaleY={1} />` |

### 2.7 HalfSpace Collider

| Task | Status | Description |
|------|--------|-------------|
| HalfSpaceCollider component | :white_circle: | `normal: Vec2` — infinite half-plane (ground plane). No AABB — always in broad phase |
| HalfSpace-circle contact | :white_circle: | Distance from circle center to plane, subtract radius |
| HalfSpace-AABB contact | :white_circle: | Project all 4 corners onto normal, find deepest |
| HalfSpace-polygon contact | :white_circle: | Project all vertices onto normal, clip against plane |
| React component | :white_circle: | `<HalfSpaceCollider normalX={0} normalY={-1} />` |

### 2.8 TriMesh Collider

| Task | Status | Description |
|------|--------|-------------|
| TriMeshCollider component | :white_circle: | `vertices: Vec2[], indices: number[]` — arbitrary triangle mesh for complex static geometry |
| Internal AABB tree | :white_circle: | Build BVH over triangles for efficient broad phase |
| TriMesh-circle contact | :white_circle: | Query BVH → triangle-circle test on candidates |
| TriMesh-AABB contact | :white_circle: | Query BVH → triangle-AABB test on candidates |
| React component | :white_circle: | `<TriMeshCollider vertices={[...]} indices={[...]} />` |

### 2.9 Rounded Shape Variants

| Task | Status | Description |
|------|--------|-------------|
| RoundCuboid | :white_circle: | AABB with rounded corners (border radius). Minkowski sum of smaller box + circle |
| RoundTriangle | :white_circle: | Triangle with rounded corners. Minkowski sum of smaller triangle + circle |
| RoundConvexPolygon | :white_circle: | Convex polygon with rounded corners. Inset polygon + circle |
| Rounded shape contact generation | :white_circle: | Compute contact on inner shape, then push outward by border radius |
| `borderRadius` prop on colliders | :white_circle: | `<BoxCollider borderRadius={4} />`, `<ConvexCollider borderRadius={2} />`, etc. |

### 2.10 Collider State & Properties

| Task | Status | Description |
|------|--------|-------------|
| Collider enabled/disabled toggle | :white_circle: | `setEnabled(bool)` / `isEnabled()` — disabled colliders are skipped in narrow phase |
| Collider position offset | :white_circle: | `offsetX`, `offsetY`, `offsetRotation` — position relative to parent rigid body |
| Collider mass override | :white_circle: | `setMass(m)` — explicit mass instead of density-based auto-compute |
| Contact skin | :white_circle: | `contactSkin: number` — forces solver to maintain a gap/margin around collider (prevents tunneling at rest) |
| Contact force event threshold | :white_circle: | `contactForceEventThreshold: number` — minimum force to trigger contact force events on this collider |
| Sensor flag | :white_check_mark: | Already implemented as `isTrigger` — detects intersections, no contact forces |
| AABB computation | :white_circle: | `computeAABB()`, `computeSweptAABB(vel, dt)` — return tight bounding box for any shape |

### 2.11 Tests

| Task | Status | Description |
|------|--------|-------------|
| Circle bounces off floor | :white_circle: | Restitution works for circles |
| Circle rolls on surface | :white_circle: | Friction generates angular velocity on circles |
| Capsule character stands on slope | :white_circle: | Capsule doesn't slide on gentle slopes |
| Convex polygon stacking | :white_circle: | Triangles and pentagons stack stably |
| Edge collider as ground | :white_circle: | Entities rest on edge segments |
| Triangle collider pyramid | :white_circle: | Triangles stack and respond correctly |
| HeightField terrain walk | :white_circle: | Body rolls/slides across heightfield terrain |
| HalfSpace infinite ground | :white_circle: | Bodies rest on half-space plane |
| TriMesh static level | :white_circle: | Complex static geometry collides correctly |
| Rounded box vs circle | :white_circle: | Rounded corners produce smooth contact normals |
| Disabled collider ignored | :white_circle: | `setEnabled(false)` — collider doesn't participate in detection |

---

## Stage 3 — Forces & Impulses API

> Give users a proper API for applying forces, impulses, and torques from gameplay code.

### 3.1 Force Accumulator

| Task | Status | Description |
|------|--------|-------------|
| `forceX`, `forceY` fields on RigidBody | :white_circle: | Accumulated forces, cleared after each step |
| `torque` field on RigidBody | :white_circle: | Accumulated torque, cleared after each step |
| Integration: `velocity += (force * invMass) * dt` | :white_circle: | Apply accumulated force during velocity integration |
| Integration: `angVel += (torque * invInertia) * dt` | :white_circle: | Apply accumulated torque during angular integration |

### 3.2 API Methods

| Task | Status | Description |
|------|--------|-------------|
| `addForce(fx, fy)` | :white_circle: | Add to force accumulator. Continuous force (call every frame) |
| `addTorque(t)` | :white_circle: | Add to torque accumulator |
| `addForceAtPoint(fx, fy, px, py)` | :white_circle: | Decomposes into force + torque: `torque += (p - com) × f` |
| `applyImpulse(ix, iy)` | :white_circle: | Instant velocity change: `velocity += impulse * invMass` |
| `applyTorqueImpulse(t)` | :white_circle: | Instant angular change: `angVel += t * invInertia` |
| `applyImpulseAtPoint(ix, iy, px, py)` | :white_circle: | Impulse + angular impulse from off-center point |
| `resetForces()` | :white_circle: | Zero force accumulator |
| `resetTorques()` | :white_circle: | Zero torque accumulator |

### 3.3 React Hooks

| Task | Status | Description |
|------|--------|-------------|
| `useForces(entityId)` hook | :white_circle: | Returns `{ addForce, addTorque, addForceAtPoint, applyImpulse, applyTorqueImpulse, applyImpulseAtPoint }` |
| Update `useKinematicBody` | :white_circle: | Add `setVelocity(vx, vy)`, `setAngularVelocity(w)` |

### 3.4 Body Type Improvements

| Task | Status | Description |
|------|--------|-------------|
| `lockRotation` prop | :white_circle: | Prevents angular velocity changes (invInertia = 0 in solver) |
| Enabled translations / rotations | :white_circle: | `enabledTranslationsX`, `enabledTranslationsY` — per-axis lock (Rapier: `set_enabled_translations`) |
| Kinematic position-based mode | :white_circle: | `setNextPosition(x, y)` — engine computes velocity from position delta |
| Kinematic velocity-based mode | :white_circle: | Current behavior — user sets velocity, engine integrates position |
| `setNextRotation(angle)` | :white_circle: | Kinematic rotation target — engine computes angular velocity from rotation delta |
| Dominance groups | :white_circle: | `dominance: number` (-127 to 127). Higher dominance body treated as infinite mass in contacts |
| Active collision types | :white_circle: | Flags controlling which body-type pairs generate contacts (e.g. kinematic-fixed, kinematic-kinematic) |

### 3.5 Tests

| Task | Status | Description |
|------|--------|-------------|
| Rocket thrust (continuous force) | :white_circle: | Body accelerates upward against gravity with `addForce(0, -1000)` |
| Explosion (radial impulse) | :white_circle: | `applyImpulseAtPoint` on nearby bodies — verify correct angular + linear response |
| Spinning top (torque) | :white_circle: | `addTorque()` spins a body, angular damping slows it |
| Dominance: player pushes crate | :white_circle: | High-dominance body moves low-dominance body without being affected |
| Kinematic position-based | :white_circle: | `setNextPosition` moves body and computes correct velocity for contacts |

---

## Stage 4 — Joints & Constraints Upgrade

> Expand the joint system with new types, motors, limits, and full Rapier joint parity.

### 4.1 New Joint Types

| Task | Status | Description |
|------|--------|-------------|
| Fixed joint | :white_circle: | Lock relative position AND rotation between two bodies. Like welding |
| Prismatic joint (slider) | :white_circle: | Allow movement along one axis only. Two anchor points + axis direction |
| Weld joint | :white_circle: | Alias for fixed joint with break threshold |
| Generic joint | :white_circle: | Configurable per-axis locks — can represent revolute, prismatic, fixed, or any custom constraint |

### 4.2 Joint Motors

| Task | Status | Description |
|------|--------|-------------|
| Motor on revolute joint | :white_circle: | Target angular velocity OR target angle, with stiffness + damping (PD controller) |
| Motor on prismatic joint | :white_circle: | Target linear velocity OR target position along axis |
| `maxForce` limit | :white_circle: | Clamp motor impulse to prevent infinite force |
| Spring-like motor model | :white_circle: | Motor equation with stiffness + damping coefficients (Rapier: `MotorModel::ForceBased`) |

### 4.3 Joint Limits

| Task | Status | Description |
|------|--------|-------------|
| Revolute angle limits | :white_circle: | `minAngle`, `maxAngle` — clamp relative rotation |
| Prismatic distance limits | :white_circle: | `minDistance`, `maxDistance` — clamp translation along axis |
| Rope joint max length | :white_check_mark: | Already implemented — only enforces max, allows slack |
| Spring rest length | :white_check_mark: | Already implemented — Hooke's law with damping |

### 4.4 Joint Breaking

| Task | Status | Description |
|------|--------|-------------|
| Break force threshold | :white_circle: | If constraint impulse exceeds threshold, remove the joint |
| Break event | :white_circle: | Emit `jointBreak` event with joint ID and break force |

### 4.5 Joint State & Properties

| Task | Status | Description |
|------|--------|-------------|
| Joint enabled/disabled toggle | :white_circle: | `setEnabled(bool)` / `isEnabled()` — disabled joints are skipped in solver |
| Contacts enabled per joint | :white_circle: | `contactsEnabled: bool` — control whether colliders on joined bodies generate contacts with each other |
| Local anchors | :white_circle: | `localAnchorA: Vec2`, `localAnchorB: Vec2` — attach points in body-local space |
| Local axes | :white_circle: | `localAxisA: Vec2` — orientation reference for prismatic/generic joints |
| User data on joints | :white_circle: | `userData: unknown` — arbitrary user-attached data |

### 4.6 Multibody Joints

| Task | Status | Description |
|------|--------|-------------|
| Multibody joint set | :white_circle: | Reduced-coordinate articulated bodies — tree structure of bodies connected by joints |
| Multibody revolute | :white_circle: | Revolute joint in reduced coordinates — ragdolls, robotic arms |
| Multibody prismatic | :white_circle: | Prismatic joint in reduced coordinates — pistons, telescoping arms |
| Multibody fixed | :white_circle: | Fixed joint in reduced coordinates — rigid sub-assemblies |
| Forward kinematics | :white_circle: | Compute world-space transforms from joint angles |
| React component | :white_circle: | `<MultibodyJoint type="revolute" parent="bodyA" />` |

### 4.7 Tests

| Task | Status | Description |
|------|--------|-------------|
| Revolute door hinge | :white_circle: | Door swings open when pushed, stops at angle limits |
| Prismatic elevator | :white_circle: | Platform moves along vertical axis only, motor drives it |
| Wrecking ball (rope + motor) | :white_circle: | Rope joint with revolute motor — ball swings and hits wall |
| Breakable bridge | :white_circle: | Fixed joints connecting planks, break under heavy load |
| Joint enabled toggle | :white_circle: | Disabling joint lets bodies move freely, re-enabling reconnects |
| Generic joint configs | :white_circle: | Generic joint replicates revolute, prismatic, and fixed behavior |
| Multibody ragdoll | :white_circle: | Chain of bodies connected by revolute multibody joints — stable articulation |

---

## Stage 5 — Queries, Filtering & Solver Polish

> Fill remaining gaps in spatial queries, collision filtering, and solver stability. Full Rapier query parity.

### 5.1 Spatial Queries

| Task | Status | Description |
|------|--------|-------------|
| `projectPoint(x, y)` | :white_circle: | Find nearest collider to a point + distance + projected point on surface |
| `projectPointWithFeature(x, y)` | :white_circle: | Same as `projectPoint` but also returns geometric feature ID (which edge/vertex was closest) |
| `containsPoint(x, y)` | :white_circle: | Return all colliders whose shape contains the given point |
| `shapeCast(shape, origin, direction, maxDist)` | :white_circle: | Sweep any shape (circle, box, capsule) along a ray — returns first hit |
| `shapeCastNonlinear(shape, motion)` | :white_circle: | Sweep shape with arbitrary continuous motion (rotation + translation) — returns first hit |
| `intersectShape(shape, position)` | :white_circle: | Return all colliders overlapping a given shape at a position |
| `intersectAABB(min, max)` | :white_circle: | Return all colliders whose AABBs overlap a given AABB (conservative, broad-phase only) |
| `intersectRay(origin, dir, maxDist, callback)` | :white_circle: | Enumerate all colliders hit by ray via callback (not just first or sorted) |
| Ray `solid` flag | :white_circle: | When `solid=true` and ray origin is inside a shape, report TOI=0 instead of passing through |
| Query filter predicates | :white_circle: | `filter: (entityId) => boolean` callback on all query functions |
| Query filter by body type | :white_circle: | Exclude static, kinematic, or sleeping bodies from query results |
| Query filter by collision group | :white_circle: | Filter by numeric collision group membership/filter masks |
| Query exclude specific entity | :white_circle: | `excludeEntity: EntityId` — skip one specific entity in query results |
| Query exclude specific collider | :white_circle: | `excludeCollider: ColliderId` — skip one specific collider in query results |

### 5.2 Collision Filtering

| Task | Status | Description |
|------|--------|-------------|
| Solver groups | :white_circle: | Separate from collision groups: detect overlap + fire events, but skip impulse response |
| Numeric collision groups (32-bit) | :white_circle: | `membership: number, filter: number` (bitwise AND). 32-bit masks (Rapier parity) |
| Numeric solver groups (32-bit) | :white_circle: | Same bitmask system for solver groups — controls force generation independently from detection |
| Active collision types | :white_circle: | Flags enabling interactions between specific body-type pairs (e.g. kinematic-fixed) |
| Active events per collider | :white_circle: | Flags controlling which events fire for this collider (collision events, contact force events) |
| Active hooks per collider | :white_circle: | Flags controlling which hooks apply to this collider (contact filtering, contact modification) |
| Physics hooks: filter contact pair | :white_circle: | `onContactFilter(a, b) => boolean` — user decides if contact should be processed |
| Physics hooks: filter intersection pair | :white_circle: | `onIntersectionFilter(a, b) => boolean` — user decides if sensor intersection fires |
| Physics hooks: modify solver contacts | :white_circle: | `onContactModify(manifold) => void` — user can change friction, restitution, normal, tangent velocity per contact |
| Conveyor belt tangent velocity | :white_circle: | Set tangent surface velocity via contact modification — objects slide along surface (Rapier parity) |
| One-way platforms via hooks | :white_circle: | Implement one-way platforms by selectively deleting contacts in `onContactModify` |

### 5.3 Contact Force Events

| Task | Status | Description |
|------|--------|-------------|
| Contact impulse reporting | :white_circle: | After solver: emit `contactForce` event with total normal + tangent impulse magnitude |
| `useContactForce(entityId, handler)` hook | :white_circle: | `handler(other, totalImpulse, normal)` — gameplay can react to impact strength |
| Impact threshold | :white_circle: | Only emit contact force events above a configurable impulse threshold |

### 5.4 Solver Stability

| Task | Status | Description |
|------|--------|-------------|
| Warm starting | :white_circle: | Persist impulses across frames, apply 85% of previous impulse as initial guess |
| Contact point matching | :white_circle: | Match current frame's contact points to previous frame's by feature ID (edge index, vertex index) |
| Split impulse for position correction | :white_circle: | Separate velocity solver from position solver to prevent energy gain from penetration correction |
| Island detection | :white_circle: | Group connected bodies into islands. Solve islands independently. Sleep entire islands when idle |
| Sub-stepping | :white_circle: | Optional 2x or 4x sub-steps per fixed step (configurable via `PhysicsConfig.substeps`) |
| CCD sub-step count | :white_circle: | Configurable CCD substeps for nonlinear motion (Rapier: integration parameters) |

### 5.5 Tests

| Task | Status | Description |
|------|--------|-------------|
| `projectPoint` nearest surface | :white_circle: | Point near box corner returns correct nearest point |
| `projectPointWithFeature` edge ID | :white_circle: | Returns correct feature ID (edge index) for nearest surface |
| `shapeCast` circle through gap | :white_circle: | Circle sweep correctly detects gap too narrow to pass |
| `shapeCastNonlinear` spinning shape | :white_circle: | Rotating shape sweep detects collision missed by linear sweep |
| `intersectShape` overlap query | :white_circle: | Returns all overlapping colliders for a given shape |
| `intersectAABB` broad query | :white_circle: | Returns all colliders in an AABB region |
| Solver groups: ghost platforms | :white_circle: | Player detects platform (events fire) but passes through (no impulse) |
| Contact force: breakable objects | :white_circle: | Object breaks when contact impulse exceeds threshold |
| Conveyor belt | :white_circle: | Object slides along surface with tangent velocity |
| 20-box stack stability | :white_circle: | Stack remains stable for 600+ frames with warm starting |
| Island sleeping | :white_circle: | Two separate stacks — disturbing one doesn't wake the other |

---

## Stage 6 — Character Controller

> Built-in character controller that handles slopes, stairs, snapping, and interaction with dynamic bodies.

### 6.1 Core Character Controller

| Task | Status | Description |
|------|--------|-------------|
| `CharacterController` class | :white_circle: | Manages desired movement → actual movement with collision resolution |
| `move(desiredTranslation)` | :white_circle: | Apply translation, resolve collisions, return actual movement + grounded state |
| Collision callback | :white_circle: | Report each collision hit during movement: `{ entity, normal, penetration }` — chronological order |
| Up vector configuration | :white_circle: | Define which direction is "up" for slope/ground calculations (default `{0, -1}`) |
| Character offset | :white_circle: | `offset: number` — small gap maintained around character for numerical stability |
| Works with any collider shape | :white_circle: | Ball, cuboid, capsule — any shape can be used as character collider |
| Translation only | :white_circle: | Character controller only handles translation, not rotation |

### 6.2 Slope Handling

| Task | Status | Description |
|------|--------|-------------|
| Max climb angle | :white_circle: | `maxSlopeClimbAngle: number` (radians). Slopes steeper than this block movement |
| Min slide angle | :white_circle: | `minSlopeSlideAngle: number`. Slopes between climb and slide angles cause sliding |
| Slope force | :white_circle: | On slopes steeper than slide angle, apply downhill force proportional to angle |

### 6.3 Auto-Step (Stairs)

| Task | Status | Description |
|------|--------|-------------|
| Step height | :white_circle: | `maxStepHeight: number`. Obstacles shorter than this are climbed automatically |
| Step width | :white_circle: | `minStepWidth: number`. Step must be at least this wide to climb (prevents climbing walls) |
| Include dynamic bodies | :white_circle: | Option to auto-step onto dynamic bodies or only statics |

### 6.4 Snap to Ground

| Task | Status | Description |
|------|--------|-------------|
| Snap distance | :white_circle: | `snapToGroundDistance: number`. When slightly above ground, teleport down |
| Disable on jump | :white_circle: | Disable snap when character is moving upward (jumping) |

### 6.5 Dynamic Body Interaction

| Task | Status | Description |
|------|--------|-------------|
| Push dynamic bodies | :white_circle: | When character collides with dynamic body, apply impulse proportional to character velocity |
| Push force multiplier | :white_circle: | `pushForce: number` — scale the impulse applied to pushed bodies |
| Ride dynamic platforms | :white_circle: | Inherit velocity from dynamic body the character is standing on |

### 6.6 Filtering

| Task | Status | Description |
|------|--------|-------------|
| Filter by flags | :white_circle: | Exclude sensors, exclude fixed bodies, etc. |
| Filter by collision groups | :white_circle: | Use collision group masks to filter character interactions |
| Custom filter predicate | :white_circle: | `filter: (entityId) => boolean` — user decides if character collides with entity |

### 6.7 React Integration

| Task | Status | Description |
|------|--------|-------------|
| `useCharacterController(entityId, config)` | :white_circle: | Hook that creates and returns controller bound to an entity |
| `<CharacterController>` component | :white_circle: | Declarative component wrapping the hook |
| Migrate `usePlatformerController` | :white_circle: | Rewrite to use CharacterController internally |
| Migrate `useTopDownMovement` | :white_circle: | Rewrite to use CharacterController internally |

### 6.8 Tests

| Task | Status | Description |
|------|--------|-------------|
| Walk up 30° slope | :white_circle: | Character climbs gentle slope normally |
| Blocked by 60° slope | :white_circle: | Character cannot climb steep slope (maxClimbAngle = 45°) |
| Climb stairs | :white_circle: | Character walks up sequence of 16px steps smoothly |
| Snap downhill | :white_circle: | Character stays grounded when walking down slope |
| Push crate | :white_circle: | Character pushes dynamic box by walking into it |
| Capsule character controller | :white_circle: | Character controller works correctly with capsule collider |
| Circle character controller | :white_circle: | Character controller works correctly with ball collider |

---

## Stage 7 — Pipeline, Serialization & Debug

> System-level features: collision-only pipeline, world snapshotting, debug rendering, and cross-platform determinism.

### 7.1 Collision-Only Pipeline

| Task | Status | Description |
|------|--------|-------------|
| `CollisionPipeline` class | :white_circle: | Run collision detection without dynamics — useful for spatial queries without physics simulation |
| Broad phase only mode | :white_circle: | Run only broad phase to get potential collision pairs |
| Contact graph | :white_circle: | Stores contact pairs + contact points for non-sensor colliders |
| Intersection graph | :white_circle: | Stores intersection pairs involving at least one sensor |

### 7.2 Serialization / Snapshotting

| Task | Status | Description |
|------|--------|-------------|
| `takeSnapshot()` | :white_circle: | Serialize entire physics world to `Uint8Array` — all bodies, colliders, joints, solver state |
| `restoreSnapshot(data)` | :white_circle: | Deserialize `Uint8Array` back into a complete physics world |
| Snapshot format versioning | :white_circle: | Version header to handle forward/backward compat |
| JSON serialization | :white_circle: | `toJSON()` / `fromJSON()` — human-readable alternative to binary snapshot |
| Selective snapshot | :white_circle: | Snapshot subset of world (specific islands or entity groups) |
| Snapshot hash | :white_circle: | `snapshotHash()` — deterministic hash for replay verification |

### 7.3 Debug Rendering

| Task | Status | Description |
|------|--------|-------------|
| `DebugRenderPipeline` class | :white_circle: | Backend-agnostic line-based debug renderer (Rapier: `DebugRenderPipeline`) |
| Render rigid body outlines | :white_circle: | Outline of every rigid body (colored by type: dynamic, static, kinematic, sleeping) |
| Render collider shapes | :white_circle: | All collider shapes — boxes, circles, capsules, polygons, edges, heightfields |
| Render contact points | :white_circle: | Dots at contact points, lines showing contact normal |
| Render joints | :white_circle: | Lines connecting joint anchors |
| Render AABBs | :white_circle: | Broad-phase bounding boxes |
| Render center of mass | :white_circle: | Cross marker at each body's center of mass |
| Render velocity vectors | :white_circle: | Arrow showing linear velocity direction and magnitude |
| Configurable render flags | :white_circle: | Select which elements to render (bodies, colliders, contacts, joints, AABBs, etc.) |
| Configurable colors | :white_circle: | Per-element-type color configuration |
| `DebugRenderBackend` interface | :white_circle: | Pluggable backend — default uses Canvas2D overlay, users can implement custom |

### 7.4 Cross-Platform Determinism

| Task | Status | Description |
|------|--------|-------------|
| Deterministic broad phase | :white_circle: | Ensure spatial grid produces identical pair order regardless of insertion order |
| Deterministic solver | :white_circle: | Ensure contact/island iteration order is deterministic |
| Avoid transcendental functions | :white_circle: | Replace `Math.sin`/`Math.cos`/`Math.atan2` in physics with deterministic approximations where needed |
| Determinism test suite | :white_circle: | Run identical simulation across multiple environments, verify snapshot hashes match |
| Document determinism guarantees | :white_circle: | Clearly document what is and isn't guaranteed (same browser = deterministic, cross-browser = best effort) |

### 7.5 Tests

| Task | Status | Description |
|------|--------|-------------|
| Snapshot round-trip | :white_circle: | `restoreSnapshot(takeSnapshot())` produces identical simulation |
| JSON round-trip | :white_circle: | `fromJSON(toJSON())` produces identical simulation |
| Snapshot hash stability | :white_circle: | Same initial conditions → same hash after N frames |
| Collision-only pipeline | :white_circle: | Detect overlaps without running dynamics |
| Debug render all shapes | :white_circle: | Every shape type renders correct outline |
| Determinism: 1000-frame replay | :white_circle: | Two identical simulations produce identical snapshot hashes at frame 1000 |

---

## PhysicsConfig

New configuration object passed to the physics system:

```typescript
interface PhysicsConfig {
  /** Physics mode. 'platformer' preserves current X-then-Y behavior.
   *  'rigidbody' uses impulse solver. Default: 'rigidbody' */
  mode: 'rigidbody' | 'platformer'

  /** Global gravity vector. Default: { x: 0, y: 980 } */
  gravity: { x: number; y: number }

  /** Number of velocity constraint solver iterations. Default: 8 */
  velocityIterations: number

  /** Number of position correction iterations. Default: 4 */
  positionIterations: number

  /** Fixed timestep in seconds. Default: 1/60 */
  fixedTimestep: number

  /** Maximum accumulated time before clamping. Default: 0.1 */
  maxAccumulator: number

  /** Number of sub-steps per fixed step. Default: 1 */
  substeps: number

  /** Number of CCD sub-steps. Default: 1 */
  ccdSubsteps: number

  /** Position correction factor (Baumgarte). Default: 0.2 */
  positionCorrectionFactor: number

  /** Penetration slop — allowed overlap before correction. Default: 0.5 */
  penetrationSlop: number

  /** Velocity threshold below which restitution is ignored. Default: 20 */
  restitutionThreshold: number

  /** Enable warm starting. Default: true */
  warmStarting: boolean

  /** Warm starting factor (0-1). Default: 0.85 */
  warmStartingFactor: number

  /** Default friction coefficient. Default: 0.5 */
  defaultFriction: number

  /** Default restitution coefficient. Default: 0.0 */
  defaultRestitution: number

  /** Default density. Default: 1.0 */
  defaultDensity: number

  /** Default contact skin. Default: 0.0 */
  defaultContactSkin: number

  /** Friction/restitution combine rule. Default: 'average' */
  coefficientCombineRule: 'average' | 'min' | 'max' | 'multiply'

  /** Enable cross-platform determinism mode. Default: false */
  deterministic: boolean
}
```

---

## Backward Compatibility

The existing platformer physics **will not break**. The plan:

1. `mode: 'platformer'` preserves the current X-then-Y two-pass system, slopes, one-way platforms, and all existing behavior exactly as-is.
2. `mode: 'rigidbody'` enables the new impulse solver, angular response, and full rigid body dynamics.
3. Default mode will be `'rigidbody'` for new projects, but existing games can opt into `'platformer'` for the proven platformer-tuned behavior.
4. All existing props (`bounce`, `friction`, `lockX`, `lockY`, etc.) continue to work in both modes.
5. New props (`density`, `restitution`, `lockRotation`, `dominance`) are additive — old code doesn't need them.
6. Contact events (enter/stay/exit) work identically in both modes.
7. String-based `layer`/`mask` filtering continues to work alongside new numeric collision groups.

---

## Implementation Order & Dependencies

```
Stage 1 (Impulse Solver Core)
  ├── 1.1 Contact Manifolds
  ├── 1.2 Mass Properties
  ├── 1.3 Sequential Impulse Solver  ← depends on 1.1 + 1.2
  ├── 1.4 Combine Rules
  ├── 1.5 Integration Changes
  ├── 1.6 Rigid Body State
  └── 1.7 Tests

Stage 2 (Shape Parity)              ← depends on Stage 1
  ├── 2.1 Circle Response
  ├── 2.2 Real Capsule
  ├── 2.3 Convex Polygon (SAT)
  ├── 2.4 Triangle
  ├── 2.5 Edge / Segment / Polyline
  ├── 2.6 HeightField
  ├── 2.7 HalfSpace
  ├── 2.8 TriMesh
  ├── 2.9 Rounded Variants
  ├── 2.10 Collider State
  └── 2.11 Tests

Stage 3 (Forces API)                ← depends on Stage 1
  ├── 3.1 Force Accumulator
  ├── 3.2 API Methods
  ├── 3.3 React Hooks
  ├── 3.4 Body Type Improvements
  └── 3.5 Tests

Stage 4 (Joints Upgrade)            ← depends on Stage 1
  ├── 4.1 New Joint Types
  ├── 4.2 Motors
  ├── 4.3 Limits
  ├── 4.4 Breaking
  ├── 4.5 Joint State & Properties
  ├── 4.6 Multibody Joints
  └── 4.7 Tests

Stage 5 (Queries & Polish)          ← depends on Stage 2
  ├── 5.1 Spatial Queries
  ├── 5.2 Filtering
  ├── 5.3 Contact Force Events
  ├── 5.4 Solver Stability
  └── 5.5 Tests

Stage 6 (Character Controller)      ← depends on Stage 1 + 2
  ├── 6.1 Core Controller
  ├── 6.2 Slopes
  ├── 6.3 Auto-Step
  ├── 6.4 Snap to Ground
  ├── 6.5 Dynamic Push
  ├── 6.6 Filtering
  ├── 6.7 React Integration
  └── 6.8 Tests

Stage 7 (Pipeline & Serialization)  ← depends on Stage 1 + 5
  ├── 7.1 Collision-Only Pipeline
  ├── 7.2 Serialization / Snapshotting
  ├── 7.3 Debug Rendering
  ├── 7.4 Cross-Platform Determinism
  └── 7.5 Tests
```

Stages 2, 3, and 4 can be worked on in parallel after Stage 1 is complete.
Stage 7 can begin after Stage 5, or partially in parallel (serialization is independent).

---

## Key Formulas Reference

### Normal Impulse (1D simplified)
```
j = -(1 + e) * (vRel · n) / (invMassA + invMassB + (rA × n)² * invIA + (rB × n)² * invIB)
j = max(j, 0)  // no pulling
```

### Tangent Impulse (Coulomb Friction)
```
jt = -(vRel · t) / (invMassA + invMassB + (rA × t)² * invIA + (rB × t)² * invIB)
jt = clamp(jt, -μ * jn, μ * jn)  // friction cone
```

### Applying Impulse
```
vA -= j * n * invMassA
vB += j * n * invMassB
ωA -= (rA × (j * n)) * invIA
ωB += (rB × (j * n)) * invIB
```

### Baumgarte Position Correction
```
correction = β * max(0, penetration - slop) / (invMassA + invMassB)
posA -= correction * n * invMassA / (invMassA + invMassB)
posB += correction * n * invMassB / (invMassA + invMassB)
```

### Moment of Inertia (2D)
```
Box:      I = (1/12) * m * (w² + h²)
Circle:   I = (1/2) * m * r²
Capsule:  I = I_rect + 2 * (I_semicircle + m_semi * d²)  // parallel axis theorem
Triangle: I = (m/18) * (a·a + b·b + c·c - a·b - a·c - b·c)
Polygon:  Composite triangulation from centroid
```

### 2D Cross Product (scalar)
```
a × b = a.x * b.y - a.y * b.x
```

### Convex Polygon Area (Shoelace)
```
A = 0.5 * |Σ(x_i * y_{i+1} - x_{i+1} * y_i)|
```

### SAT Overlap Test
```
For each edge normal n of both polygons:
  project all vertices of A onto n → [minA, maxA]
  project all vertices of B onto n → [minB, maxB]
  if maxA < minB or maxB < minA → separating axis found → no collision
If no separating axis found → collision on axis of minimum overlap
```
