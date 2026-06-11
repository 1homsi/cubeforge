// Depth pre-pass fragment shader
// Color writes are disabled by the renderer (gl.colorMask(false,...))
// but a valid fragment shader is still required
export const DEPTH_FRAG = /* glsl */ `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
  // Depth pre-pass: only the depth buffer is updated.
  // The renderer will call gl.colorMask(false, false, false, false) before this pass.
  fragColor = vec4(1.0);
}
`
