export const GBUFFER_NORMAL_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_viewNormal;

out vec4 fragColor;

void main() {
  // Pack view-space normal [-1,1] → [0,1] for RGBA8 storage.
  vec3 n = normalize(v_viewNormal);
  fragColor = vec4(n * 0.5 + 0.5, 1.0);
}
`
