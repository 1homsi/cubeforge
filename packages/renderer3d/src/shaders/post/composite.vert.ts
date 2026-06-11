// Final composite pass vertex shader — fullscreen triangle, same as bloom.vert
export const COMPOSITE_VERT = /* glsl */ `#version 300 es
precision highp float;

out vec2 v_uv;

void main() {
  vec2 pos = vec2(
    float((gl_VertexID << 1) & 2) * 2.0 - 1.0,
    float(gl_VertexID & 2) * 2.0 - 1.0
  );
  v_uv        = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`
