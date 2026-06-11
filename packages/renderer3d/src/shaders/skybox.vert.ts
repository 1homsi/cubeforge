// Skybox vertex shader — renders a unit cube that always surrounds the camera
// The view matrix is stripped of translation so the box moves with the camera
export const SKYBOX_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;

// View matrix with translation zeroed-out is passed as u_viewRotation
uniform mat4 u_viewRotation;   // mat4(mat3(viewMatrix)) — removes translation
uniform mat4 u_projectionMatrix;

out vec3 v_localPos;

void main() {
  v_localPos = a_position;

  // Push the skybox to the far plane by setting w == z after perspective divide
  vec4 pos    = u_projectionMatrix * u_viewRotation * vec4(a_position, 1.0);
  gl_Position = pos.xyww; // z = w → NDC depth = 1.0 (maximum)
}
`
