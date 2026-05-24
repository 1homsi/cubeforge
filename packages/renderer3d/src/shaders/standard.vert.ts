// Standard Blinn-Phong vertex shader with TBN matrix for normal mapping
// Optional features: USE_MORPHTARGETS (injected dynamically with MORPHTARGETS_COUNT
// and per-target attribute declarations by RenderState before compilation)
export const STANDARD_VERT = /* glsl */ `#version 300 es
precision highp float;

// ── Attributes ──────────────────────────────────────────────────────────────
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 a_tangent; // xyz = tangent, w = handedness

// ── Uniforms ─────────────────────────────────────────────────────────────────
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;     // transpose(inverse(modelMatrix)) upper-left 3x3
uniform mat4 u_lightSpaceMatrix; // for shadow mapping

// ── Morph target uniforms ─────────────────────────────────────────────────────
#ifdef USE_MORPHTARGETS
uniform float u_morphTargetInfluences[MORPHTARGETS_COUNT];
#endif

// ── Outputs ──────────────────────────────────────────────────────────────────
out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv;
out mat3 v_TBN;
out vec4 v_lightSpacePos;

void main() {
  // ── Morph targets ──
#ifdef USE_MORPHTARGETS
  vec3 morphedPosition = a_position;
  vec3 morphedNormal   = a_normal;
  // Per-target contributions are unrolled via the MORPHTARGETS_APPLY block
  // that RenderState injects immediately below.
  MORPHTARGETS_APPLY
  vec4 worldPos4 = u_modelMatrix * vec4(morphedPosition, 1.0);
  // Use morphed normal for TBN computation below
  #define VERT_POSITION morphedPosition
  #define VERT_NORMAL   morphedNormal
#else
  vec4 worldPos4 = u_modelMatrix * vec4(a_position, 1.0);
  #define VERT_POSITION a_position
  #define VERT_NORMAL   a_normal
#endif
  v_worldPos = worldPos4.xyz;

  // UV
  v_uv = a_uv;

  // TBN matrix (world space)
  vec3 N = normalize(u_normalMatrix * VERT_NORMAL);
  vec3 T = normalize(u_normalMatrix * a_tangent.xyz);
  T = normalize(T - dot(T, N) * N); // re-orthogonalize
  vec3 B = cross(N, T) * a_tangent.w; // w encodes handedness (+1/-1)
  v_TBN = mat3(T, B, N);
  v_normal = N;

  // Shadow map position
  v_lightSpacePos = u_lightSpaceMatrix * worldPos4;

  gl_Position = u_projectionMatrix * u_viewMatrix * worldPos4;
}
`
