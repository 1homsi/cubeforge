// Depth-only vertex shader for rendering the shadow map
// Renders geometry from the light's perspective to produce a depth texture
export const SHADOW_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;

uniform mat4 u_lightSpaceMatrix;
uniform mat4 u_modelMatrix;

void main() {
  gl_Position = u_lightSpaceMatrix * u_modelMatrix * vec4(a_position, 1.0);
}
`
