export const EQUIRECT_TO_CUBEMAP_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_localPos;

uniform sampler2D u_equirectMap;

out vec4 fragColor;

const vec2 INV_ATAN = vec2(0.1591549, 0.3183099); // (1/(2*PI), 1/PI)

vec2 sampleSphericalMap(vec3 v) {
  // atan2(v.z, v.x) → [-PI, PI], convert to [0,1]
  // asin(v.y)        → [-PI/2, PI/2], convert to [0,1]
  vec2 uv = vec2(atan(v.z, v.x), asin(clamp(v.y, -1.0, 1.0)));
  uv *= INV_ATAN;
  uv += 0.5;
  return uv;
}

void main() {
  vec3 dir = normalize(v_localPos);
  vec2 uv  = sampleSphericalMap(dir);
  vec3 col = texture(u_equirectMap, uv).rgb;
  fragColor = vec4(col, 1.0);
}
`
