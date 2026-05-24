// Sky vertex shader — renders a large sphere; the fragment shader computes
// atmospheric scattering from the vertex's world-space direction vector.
export const SKY_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;

uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
// Sky sphere is always centred on the camera; remove the translation component.
uniform vec3 u_cameraPosition;

out vec3 v_worldDir;

void main() {
  // Direction from camera to sky dome vertex (no translation contribution)
  v_worldDir = normalize(a_position);

  // Place the sky at the camera position so it always surrounds the viewer.
  vec4 clipPos = u_projectionMatrix * u_viewMatrix * vec4(a_position + u_cameraPosition, 1.0);
  // Push to far plane: set z = w so depth = 1.0 after perspective divide.
  gl_Position = clipPos.xyww;
}
`
