// Bloom fragment shader — two modes:
//   BLOOM_EXTRACT (define): threshold pass, outputs bright pixels only
//   (no define): Gaussian blur pass, horizontal or vertical controlled by u_horizontal
// Two-pass Gaussian uses 9-tap kernel (σ ≈ 4)
export const BLOOM_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_inputTexture;  // scene HDR (extract) or previous blur pass (blur)

// ── Extraction uniforms ───────────────────────────────────────────────────────
#ifdef BLOOM_EXTRACT
uniform float u_threshold;    // luminance threshold, e.g. 1.0
uniform float u_knee;         // soft knee width, e.g. 0.1

// Soft-knee threshold by Jimenez et al.
vec3 quadraticThreshold(vec3 color, float threshold, float knee) {
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float rq   = clamp(luma - (threshold - knee), 0.0, 2.0 * knee);
  rq         = (rq * rq) / (4.0 * knee + 0.00001);
  return color * max(rq, luma - threshold) / max(luma, 0.00001);
}

void main() {
  vec3 color = texture(u_inputTexture, v_uv).rgb;
  fragColor  = vec4(quadraticThreshold(color, u_threshold, u_knee), 1.0);
}

#else
// ── Gaussian blur uniforms ────────────────────────────────────────────────────
uniform bool  u_horizontal;        // true = horizontal pass, false = vertical
uniform float u_blurScale;         // scale factor for spread, e.g. 1.0

// 9-tap Gaussian weights (σ ≈ 4, normalised)
const float WEIGHTS[5] = float[](0.227027, 0.194595, 0.121622, 0.054054, 0.016216);

void main() {
  vec2 texelSize = vec2(1.0) / vec2(textureSize(u_inputTexture, 0)) * u_blurScale;
  vec3 result    = texture(u_inputTexture, v_uv).rgb * WEIGHTS[0];

  vec2 dir = u_horizontal ? vec2(texelSize.x, 0.0) : vec2(0.0, texelSize.y);

  for (int i = 1; i < 5; ++i) {
    float offset = float(i);
    result += texture(u_inputTexture, v_uv + dir * offset).rgb * WEIGHTS[i];
    result += texture(u_inputTexture, v_uv - dir * offset).rgb * WEIGHTS[i];
  }

  fragColor = vec4(result, 1.0);
}
#endif
`
