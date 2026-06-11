export const EQUIRECT_TO_CUBEMAP_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;

uniform mat4 u_projection;
uniform mat4 u_view;

out vec3 v_localPos;

void main() {
  v_localPos  = a_position;
  gl_Position = u_projection * u_view * vec4(a_position, 1.0);
}
`
