// Billboard particle fragment shader
// Uses gl_PointCoord for UV within each point sprite
// Supports optional texture, rotation, soft edge (radial alpha), and life-based fade
export const PARTICLE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec4  v_color;
in float v_rotation;
in float v_life;

out vec4 fragColor;

uniform sampler2D u_particleTexture;
uniform int       u_useTexture;      // 1 = sample texture, 0 = circle
uniform float     u_fadeInEnd;       // life fraction where fade-in ends  (e.g. 0.1)
uniform float     u_fadeOutStart;    // life fraction where fade-out begins (e.g. 0.8)

void main() {
  // Rotate gl_PointCoord around the center (0.5, 0.5)
  vec2 uv = gl_PointCoord - 0.5;
  float cosR = cos(v_rotation);
  float sinR = sin(v_rotation);
  uv = vec2(cosR * uv.x - sinR * uv.y,
            sinR * uv.x + cosR * uv.y) + 0.5;

  vec4 color = v_color;

  if (u_useTexture == 1) {
    // Clamp UVs — rotated sprites might sample outside [0,1]
    uv = clamp(uv, 0.0, 1.0);
    color *= texture(u_particleTexture, uv);
  } else {
    // Procedural soft circle
    float dist = length(gl_PointCoord - 0.5) * 2.0; // [0,1] from center to edge
    float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
    color.a *= alpha;
  }

  // Life-based fade in/out
  float fadeIn  = smoothstep(0.0, u_fadeInEnd,    v_life);
  float fadeOut = 1.0 - smoothstep(u_fadeOutStart, 1.0, v_life);
  color.a      *= fadeIn * fadeOut;

  if (color.a < 0.004) discard;

  fragColor = color;
}
`
