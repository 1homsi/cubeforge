// Depth-only fragment shader for shadow map pass
// No color output — depth is written implicitly by gl_FragDepth / depth buffer
// An explicit fragColor output is required by WebGL2 spec for completeness
export const SHADOW_FRAG = /* glsl */ `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
  // Depth is automatically written to the depth attachment.
  // Output a dummy color for framebuffer completeness (color attachment not used).
  fragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
}
`
