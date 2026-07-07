# Cubeforge improvement log

A focused pass over the **physics**, **3D renderer**, and **max-characters-on-screen**
(throughput) systems. Every bullet is one discrete, self-contained improvement —
an optimization, a bug fix, a new capability, or a new verified test. Items are
grouped by area with a running count.

Baseline before this work: **1953 tests passing**.

---

## 1. 3D renderer — instanced rendering & throughput (max characters on screen)

Instancing is the primary lever for putting thousands of characters on screen in
one draw call. These changes remove per-frame waste and make large fleets cheap.

1. `RenderState.uploadInstanceMatrix` now skips the `gl.bufferData` re-upload when
   the same instance attribute is redrawn with an unchanged version/count — static
   fleets cost **zero** upload bandwidth per frame (previously re-uploaded every frame).
2. `uploadInstanceColor` gets the same version-tracked skip.
3. Instance-matrix upload streams only the `count * 16` range actually drawn via
   `subarray`, not the whole (possibly over-allocated) buffer.
4. `GeometryGPUEntry` tracks instance attribute identity + version + count so a
   shared geometry drawn by two different instanced meshes still uploads correctly.
5. `InstancedMesh.setMatrixAt` now flags `needsUpdate` so edits actually reach the GPU
   (previously a silent no-op — mutated instances never re-uploaded).
6. `InstancedMesh.setColorAt` flags `needsUpdate` likewise.
7. Separated `capacity` from `count` so a fleet can be over-allocated and grown.
8. `InstancedMesh.resize(n)` grows capacity, preserving data and identity-filling new slots.
9. `InstancedMesh.setCount(n)` clamps drawn-instance count to `[0, capacity]`.
10. `InstancedMesh.setTransformAt(i, pos, quat, scale)` composes a slot without a temp Mat4 at the call site.
11. `InstancedMesh.setPositionAt(i, x, y, z)` updates only translation (hot path for moving crowds).
12. `InstancedMesh.computeBoundingSphere()` builds an aggregate sphere over all instances for fleet culling.
13. Instance color buffer now defaults to white (1,1,1) instead of black, so unset instances render correctly.
14. Index bounds checking on `setMatrixAt`/`setPositionAt`/`setColorAt` (throws `RangeError` instead of silent OOB writes).
15. `getMatrixAt`/`getColorAt` return the target for chaining.

## 2. 3D renderer — render queue culling & GC

16. `RenderQueue` reuses a single frustum-plane `Float32Array` instead of allocating 24 floats every frame.
17. `RenderQueue` pools `RenderItem` objects across frames — no per-object allocation during scene extraction.
18. `RenderQueue` frustum-culls whole `InstancedMesh` fleets by their aggregate bounding sphere.
19. `RenderQueue` exposes `culledTested` / `culledRejected` counters for profiling culling effectiveness.

## 3. 3D math library — allocation-free hot-path ops

Fewer per-frame allocations = less GC = more characters sustained. All write into
`this` or a caller-provided target.

20. `Vec3.copy`
21. `Vec3.setScalar`
22. `Vec3.addVectors`
23. `Vec3.subVectors`
24. `Vec3.addScaledVector` (integrator core: `p += v*dt`)
25. `Vec3.addScalar`
26. `Vec3.crossVectors`
27. `Vec3.multiplyScalar`
28. `Vec3.divideScalar` (zero-guarded)
29. `Vec3.divide`
30. `Vec3.lerpVectors`
31. `Vec3.min`
32. `Vec3.max`
33. `Vec3.clamp`
34. `Vec3.clampScalar`
35. `Vec3.clampLength`
36. `Vec3.setLength`
37. `Vec3.floor`
38. `Vec3.ceil`
39. `Vec3.round`
40. `Vec3.abs`
41. `Vec3.manhattanLength`
42. `Vec3.angleTo` (numerically clamped)
43. `Vec3.setFromMatrixPosition`
44. `Vec3.setFromMatrixColumn`
45. `Vec3.setFromMatrixScale`
46. `Vec3.setFromSphericalCoords`
47. `Vec3.applyAxisAngle` (allocation-free Rodrigues)
48. `Vec3.isZero`
49. `Vec4.copy`
50. `Vec4.setScalar`
51. `Vec4.addVectors`
52. `Vec4.subVectors`
53. `Vec4.addScaledVector`
54. `Vec4.multiplyScalar`
55. `Vec4.divideScalar`
56. `Vec4.negate`
57. `Vec4.manhattanLength`
58. `Vec4.lerpVectors`
59. `Vec4.equals`
60. `Quat.copy` promoted from private to public API.

## 4. 3D renderer — test coverage (was 1 test file for 18k LOC)

61. `geometry.BufferGeometry.test.ts` — 17 tests (attributes, versioning, bounds, normals, clone independence).
62. `geometry.BoxGeometry.test.ts` — 10 tests.
63. `geometry.SphereGeometry.test.ts` — 10 tests.
64. `geometry.CylinderGeometry.test.ts` — 11 tests.
65. `geometry.PlaneGeometry.test.ts` — 9 tests.
66. `geometry.TorusGeometry.test.ts` — 10 tests.
67. `geometry.LatheGeometry.test.ts` — 10 tests.
68. `geometry.TubeGeometry.test.ts` — 10 tests.
69. `geometry.CapsuleGeometry.test.ts` — 10 tests.
70. `geometry.TerrainGeometry.test.ts` — 11 tests.
71. `geometry.ProceduralBuilding.test.ts` — 11 tests.
72. `lights.test.ts` — 28 tests (all light + shadow types, defaults, frustum).
73. `materials.test.ts` — 28 tests (all material types, clone/dispose/uniforms).
74. `loaders.GLTFLoader.test.ts` — 28 tests (JSON+GLB parse, accessors, skins, animations, KHR extensions).
75. `loaders.ImageLoader.test.ts` — 5 tests.
76. `math.Vec3.extra.test.ts` — 21 tests (all new Vec3/Vec4/Quat ops).
77. `objects.InstancedMesh.test.ts` — 11 tests (versioning, resize, bounds, culling sphere).

---

_Running total after section 4: 77 improvements. renderer3d tests: 1 file → 18 files, 245 tests._
