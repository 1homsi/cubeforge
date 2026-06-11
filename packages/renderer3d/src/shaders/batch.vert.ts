// Batched-mesh vertex shader.
// Like standard.vert, but reads the per-item world transform from a floating-
// point texture (u_batchMatrixTexture) instead of a single u_modelMatrix
// uniform. Each item has one mat4 stored as 4 consecutive RGBA32F texels.
// The per-vertex integer attribute a_drawId selects which item's matrix to use.
export const BATCH_VERT = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

// ── Attributes ──────────────────────────────────────────────────────────────
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 a_tangent;
// Per-vertex item index (flat, written during addGeometry)
layout(location = 5) in float a_drawId;

// ── Uniforms ─────────────────────────────────────────────────────────────────
// Floating-point texture that stores one mat4 per row (4 texels wide).
// Width = 4, Height = maxItemCount.
uniform sampler2D u_batchMatrixTexture;
uniform int       u_batchMatrixTextureWidth; // always 4
uniform mat4      u_viewMatrix;
uniform mat4      u_projectionMatrix;
uniform mat4      u_lightSpaceMatrix;

// ── Outputs ──────────────────────────────────────────────────────────────────
out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv;
out mat3 v_TBN;
out vec4 v_lightSpacePos;

// Fetch the mat4 for item 'id' from the matrix texture.
mat4 fetchMatrix(int id) {
  // Each item occupies 4 consecutive texels in a row: (0,id) … (3,id)
  // textureSize returns (width, height) in texels.
  ivec2 sz = textureSize(u_batchMatrixTexture, 0);
  float fw = float(sz.x);
  float fh = float(sz.y);
  float row = (float(id) + 0.5) / fh;
  vec4 c0 = texture(u_batchMatrixTexture, vec2(0.5 / fw, row));
  vec4 c1 = texture(u_batchMatrixTexture, vec2(1.5 / fw, row));
  vec4 c2 = texture(u_batchMatrixTexture, vec2(2.5 / fw, row));
  vec4 c3 = texture(u_batchMatrixTexture, vec2(3.5 / fw, row));
  // mat4 is column-major: mat4(col0, col1, col2, col3)
  return mat4(c0, c1, c2, c3);
}

void main() {
  int itemId = int(a_drawId);
  mat4 modelMatrix = fetchMatrix(itemId);

  vec4 worldPos4 = modelMatrix * vec4(a_position, 1.0);
  v_worldPos = worldPos4.xyz;
  v_uv = a_uv;

  // Normal matrix: transpose(inverse(M)) upper-left 3x3 — computed in place.
  mat3 m3 = mat3(modelMatrix);
  // For uniform-scale transforms this is just mat3(modelMatrix); for a proper
  // implementation we compute the cofactor matrix (avoids a full inverse).
  float det = dot(cross(m3[0], m3[1]), m3[2]);
  mat3 normalMat = (1.0 / det) * mat3(
    cross(m3[1], m3[2]),
    cross(m3[2], m3[0]),
    cross(m3[0], m3[1])
  );

  vec3 N = normalize(normalMat * a_normal);
  vec3 T = normalize(normalMat * a_tangent.xyz);
  T = normalize(T - dot(T, N) * N);
  vec3 B = cross(N, T) * a_tangent.w;
  v_TBN = mat3(T, B, N);
  v_normal = N;

  v_lightSpacePos = u_lightSpaceMatrix * worldPos4;

  gl_Position = u_projectionMatrix * u_viewMatrix * worldPos4;
}
`
