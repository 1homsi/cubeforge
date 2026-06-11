// Final composite fragment shader
// Combines the HDR scene texture with the bloom texture, applies:
//   - Exposure
//   - Reinhard / ACES tonemapping (selected via u_tonemapMode)
//   - Bloom additive blend
//   - Vignette
//   - sRGB gamma correction
export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_hdrBuffer;    // HDR scene (linear)
uniform sampler2D u_bloomTexture; // blurred bloom (linear)

uniform float u_exposure;         // e.g. 1.0
uniform float u_bloomStrength;    // e.g. 0.04
uniform int   u_tonemapMode;      // 0 = Reinhard, 1 = ACES, 2 = linear clamp
uniform float u_vignetteStrength; // 0 = off, 1 = full, e.g. 0.35
uniform float u_vignetteRadius;   // falloff start, e.g. 0.75
uniform float u_saturation;       // 1.0 = neutral, <1 = desaturate, >1 = boost
uniform float u_contrast;         // 1.0 = neutral
uniform float u_brightness;       // 0.0 = neutral (added to color after contrast)

// ── Tone mapping ──────────────────────────────────────────────────────────────
vec3 tonemapReinhard(vec3 color) {
  return color / (color + vec3(1.0));
}

// ACES film approximation by Krzysztof Narkowicz
vec3 tonemapACES(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 linearToSRGB(vec3 c) {
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

void main() {
  // ── Sample buffers ──
  vec3 hdr   = texture(u_hdrBuffer, v_uv).rgb;
  vec3 bloom = texture(u_bloomTexture, v_uv).rgb;

  // ── Bloom composite ──
  hdr = hdr + bloom * u_bloomStrength;

  // ── Exposure ──
  hdr *= u_exposure;

  // ── Brightness / contrast ──
  hdr = (hdr - 0.5) * u_contrast + 0.5 + u_brightness;

  // ── Saturation ──
  float luma = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
  hdr = mix(vec3(luma), hdr, u_saturation);

  // ── Tone mapping ──
  vec3 ldr;
  if (u_tonemapMode == 1) {
    ldr = tonemapACES(hdr);
  } else if (u_tonemapMode == 2) {
    ldr = clamp(hdr, 0.0, 1.0);
  } else {
    ldr = tonemapReinhard(hdr);
  }

  // ── Vignette ──
  vec2 vigUV = v_uv * 2.0 - 1.0; // center at 0,0
  float dist  = length(vigUV);
  float vig   = 1.0 - smoothstep(u_vignetteRadius, 1.0, dist) * u_vignetteStrength;
  ldr        *= vig;

  // ── Gamma correction ──
  ldr = linearToSRGB(ldr);

  fragColor = vec4(ldr, 1.0);
}
`
