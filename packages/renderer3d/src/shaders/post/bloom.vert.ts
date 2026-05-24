// Bloom / post-processing fullscreen-quad vertex shader
// Shared by both the extraction and blur passes
export const BLOOM_VERT = /* glsl */ `#version 300 es
precision highp float;

// Fullscreen triangle: draw with gl.drawArrays(gl.TRIANGLES, 0, 3)
// No VBO needed — positions are generated from gl_VertexID
// (-1,-1), (3,-1), (-1,3) covers the entire clip space

out vec2 v_uv;

void main() {
  // Generate a fullscreen triangle from vertex id
  vec2 pos = vec2(
    float((gl_VertexID << 1) & 2) * 2.0 - 1.0,
    float(gl_VertexID & 2) * 2.0 - 1.0
  );
  v_uv        = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`
