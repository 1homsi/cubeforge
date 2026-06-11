// Stars fragment shader — draws a soft circular point sprite with procedural
// twinkle based on a time-varying hash.
export const STARS_FRAG = /* glsl */ `#version 300 es
precision highp float;

in float v_brightness;

uniform float u_time; // seconds, for twinkle

out vec4 fragColor;

// Simple pseudo-random hash from a vec2 seed
float hash(vec2 p) {
  p = fract(p * vec2(234.41, 567.89));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  if (v_brightness <= 0.001) discard;

  // Circular point sprite mask
  vec2 uv  = gl_PointCoord * 2.0 - 1.0;
  float r  = dot(uv, uv);
  if (r > 1.0) discard;

  float core = exp(-r * 4.0);

  // Procedural twinkle: sample a low-frequency sine based on the fragment's
  // clip position hash.  gl_FragCoord changes per-star since each star is a
  // single point with a unique screen position.
  float seedX = floor(gl_FragCoord.x / 2.0);
  float seedY = floor(gl_FragCoord.y / 2.0);
  float h     = hash(vec2(seedX, seedY));
  float twinkle = 0.75 + 0.25 * sin(u_time * (3.0 + h * 7.0) + h * 6.2831);

  float alpha = core * v_brightness * twinkle;
  fragColor = vec4(vec3(1.0), alpha);
}
`
