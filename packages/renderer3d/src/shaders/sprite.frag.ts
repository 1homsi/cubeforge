// Billboard sprite fragment shader
// Samples an optional texture map and multiplies by u_color × u_opacity.
// Discards fully-transparent fragments.
export const SPRITE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

#ifdef USE_MAP
uniform sampler2D u_map;
#endif

uniform vec3  u_color;
uniform float u_opacity;

out vec4 fragColor;

void main() {
  vec4 result = vec4(u_color, u_opacity);

#ifdef USE_MAP
  vec4 texColor = texture(u_map, v_uv);
  result *= texColor;
#endif

  // Discard nearly-transparent fragments to avoid depth artifacts
  if (result.a < 0.01) discard;

  fragColor = result;
}
`
