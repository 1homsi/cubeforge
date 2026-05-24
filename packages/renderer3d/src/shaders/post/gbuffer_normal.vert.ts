export const GBUFFER_NORMAL_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;

out vec3 v_viewNormal;

void main() {
  // Transform normal to view space
  v_viewNormal = normalize(u_normalMatrix * a_normal);

  // For view-space normal matrix we need the view component as well.
  // Multiply the model normal matrix result by the view rotation.
  // Since u_normalMatrix is the transpose(inverse(model)), we apply the
  // view rotation (upper-left 3x3 of viewMatrix) afterwards.
  mat3 viewRot  = mat3(u_viewMatrix);
  v_viewNormal  = normalize(viewRot * v_viewNormal);

  gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 1.0);
}
`
