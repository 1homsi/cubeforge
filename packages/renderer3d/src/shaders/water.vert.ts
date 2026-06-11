// Water vertex shader — passes clip-space position for depth fade
// and world position + screen position for refraction/reflection UVs
export const WATER_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform float u_time;

// Gentle vertex-level wave displacement
uniform float u_waveAmplitude;  // e.g. 0.05
uniform float u_waveFrequency;  // e.g. 2.0
uniform float u_waveSpeed;      // e.g. 0.5

out vec3 v_worldPos;
out vec2 v_uv;
out vec4 v_clipPos;      // for projective screen UVs
out float v_viewDepth;   // camera-space depth for depth fade

void main() {
  // Vertex wave displacement (Y axis)
  float waveOffset = sin(a_position.x * u_waveFrequency + u_time * u_waveSpeed) *
                     cos(a_position.z * u_waveFrequency * 0.8 + u_time * u_waveSpeed * 0.7);
  vec3 displaced = a_position + vec3(0.0, waveOffset * u_waveAmplitude, 0.0);

  vec4 worldPos4 = u_modelMatrix * vec4(displaced, 1.0);
  v_worldPos     = worldPos4.xyz;
  v_uv           = a_uv;

  vec4 viewPos  = u_viewMatrix * worldPos4;
  v_viewDepth   = -viewPos.z; // positive = in front of camera

  v_clipPos     = u_projectionMatrix * viewPos;
  gl_Position   = v_clipPos;
}
`
