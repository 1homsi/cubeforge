// Skinned vertex shader — standard.vert extended with joint/weight skinning
// Bone matrices are stored in a float texture: 4 RGBA pixels per bone = one mat4
// layout: boneTexture[boneIndex * 4 + col], col ∈ {0,1,2,3}
// Optional features: USE_MORPHTARGETS (injected dynamically with MORPHTARGETS_COUNT
// and per-target attribute declarations by RenderState before compilation)
export const SKINNED_VERT = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

// ── Attributes ──────────────────────────────────────────────────────────────
layout(location = 0) in vec3  a_position;
layout(location = 1) in vec3  a_normal;
layout(location = 2) in vec2  a_uv;
layout(location = 3) in vec4  a_tangent;
layout(location = 4) in uvec4 a_joints;   // bone indices
layout(location = 5) in vec4  a_weights;  // bone weights (must sum to 1)

// ── Uniforms ─────────────────────────────────────────────────────────────────
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat4 u_lightSpaceMatrix;

// Bone texture: RGBA32F, width = 4, height = boneCount
uniform sampler2D u_boneTexture;
uniform int       u_boneCount;

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

// ── Helpers ───────────────────────────────────────────────────────────────────
mat4 getBoneMatrix(uint boneIndex) {
  // Each bone uses 4 consecutive texels (one per column of mat4)
  // Texture is width=4, height=boneCount → fetch col 0..3 at row=boneIndex
  float y = (float(boneIndex) + 0.5) / float(u_boneCount);
  vec4 c0 = texture(u_boneTexture, vec2(0.125, y)); // (0.5/4)
  vec4 c1 = texture(u_boneTexture, vec2(0.375, y));
  vec4 c2 = texture(u_boneTexture, vec2(0.625, y));
  vec4 c3 = texture(u_boneTexture, vec2(0.875, y));
  return mat4(c0, c1, c2, c3);
}

void main() {
  // ── Morph targets (applied before skinning) ──
#ifdef USE_MORPHTARGETS
  vec3 morphedPosition = a_position;
  vec3 morphedNormal   = a_normal;
  // Per-target contributions are unrolled via the MORPHTARGETS_APPLY block
  // that RenderState injects immediately below.
  MORPHTARGETS_APPLY
  #define SKIN_POSITION morphedPosition
  #define SKIN_NORMAL   morphedNormal
#else
  #define SKIN_POSITION a_position
  #define SKIN_NORMAL   a_normal
#endif

  // ── Skin matrix (linear blend skinning) ──
  mat4 skinMat =
    a_weights.x * getBoneMatrix(a_joints.x) +
    a_weights.y * getBoneMatrix(a_joints.y) +
    a_weights.z * getBoneMatrix(a_joints.z) +
    a_weights.w * getBoneMatrix(a_joints.w);

  vec4 skinnedPos    = skinMat * vec4(SKIN_POSITION, 1.0);
  vec3 skinnedNormal = mat3(skinMat) * SKIN_NORMAL;
  vec3 skinnedTangent= mat3(skinMat) * a_tangent.xyz;

  vec4 worldPos4 = u_modelMatrix * skinnedPos;
  v_worldPos     = worldPos4.xyz;
  v_uv           = a_uv;

  // TBN (world space)
  mat3 normalMat = transpose(inverse(mat3(u_modelMatrix)));
  vec3 N = normalize(normalMat * skinnedNormal);
  vec3 T = normalize(normalMat * skinnedTangent);
  T = normalize(T - dot(T, N) * N);
  vec3 B = cross(N, T) * a_tangent.w;
  v_TBN   = mat3(T, B, N);
  v_normal = N;

  v_lightSpacePos = u_lightSpaceMatrix * worldPos4;
  gl_Position     = u_projectionMatrix * u_viewMatrix * worldPos4;
}
`
