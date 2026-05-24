// Billboard particle vertex shader
// Each particle is a single point; the fragment shader draws a quad using gl_PointCoord
// Renderer must call gl.enable(gl.PROGRAM_POINT_SIZE) and draw with gl.POINTS
export const PARTICLE_VERT = /* glsl */ `#version 300 es
precision highp float;

// Per-particle attributes (instanced or per-vertex)
layout(location = 0) in vec3  a_position;   // world position
layout(location = 1) in vec4  a_color;      // RGBA tint
layout(location = 2) in float a_size;       // particle size in pixels
layout(location = 3) in float a_rotation;   // rotation in radians (used in frag)
layout(location = 4) in float a_life;       // normalized life [0,1]; fade out near 1

uniform mat4  u_viewMatrix;
uniform mat4  u_projectionMatrix;
uniform float u_viewportHeight;    // pixels, for size attenuation
uniform float u_sizeAttenuation;   // 0 = constant screen size, 1 = perspective scale

out vec4  v_color;
out float v_rotation;
out float v_life;

void main() {
  vec4 viewPos = u_viewMatrix * vec4(a_position, 1.0);

  // Perspective size attenuation
  float perspScale = u_viewportHeight / (2.0 * -viewPos.z);
  float pointSize  = mix(a_size, a_size * perspScale, u_sizeAttenuation);

  v_color    = a_color;
  v_rotation = a_rotation;
  v_life     = a_life;

  gl_Position  = u_projectionMatrix * viewPos;
  gl_PointSize = max(1.0, pointSize);
}
`
