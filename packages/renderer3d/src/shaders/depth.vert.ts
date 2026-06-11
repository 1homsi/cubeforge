// Depth pre-pass vertex shader
// Used to populate the depth buffer before the main opaque pass (reduces overdraw)
export const DEPTH_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;

void main() {
  gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 1.0);
}
`
