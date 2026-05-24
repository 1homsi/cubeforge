// Standard Blinn-Phong vertex shader with TBN matrix for normal mapping
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

// ── Outputs ──────────────────────────────────────────────────────────────────
out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv;
out mat3 v_TBN;
out vec4 v_lightSpacePos;

void main() {
  vec4 worldPos4 = u_modelMatrix * vec4(a_position, 1.0);
  v_worldPos = worldPos4.xyz;

  // UV
  v_uv = a_uv;

  // TBN matrix (world space)
  vec3 N = normalize(u_normalMatrix * a_normal);
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
