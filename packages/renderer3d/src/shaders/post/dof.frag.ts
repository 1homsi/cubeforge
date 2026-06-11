/**
 * DOF (Depth of Field) fragment shader.
 *
 * Pass 1 (COC_PASS): compute circle-of-confusion radius per pixel from depth.
 * Pass 2 (BLUR_PASS): separable hex-bokeh blur in one of three directions.
 * Pass 3 (COMBINE_PASS): composite the three directional blurs with the sharp image.
 */
export const DOF_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// ── Shared uniforms ───────────────────────────────────────────────────────────
uniform sampler2D u_colorTexture;
uniform sampler2D u_depthTexture;

// Camera reconstruction parameters
uniform float u_near;
uniform float u_far;

// DOF parameters
uniform float u_focusDistance;   // world-space distance to focus plane
uniform float u_focusRange;      // depth range that appears in focus (half-range each side)
uniform float u_bokehRadius;     // max blur radius in pixels

// Blur pass direction (used in BLUR_PASS only)
uniform vec2 u_blurDir;          // normalized direction (e.g. (1,0), (cos60,sin60), etc.)
uniform float u_texelSize;       // size of one pixel along blurDir length (1/max(w,h))

// Number of blur samples per direction
uniform int u_iterations;        // e.g. 3

// ── Utility: linearise depth from depth buffer (NDC → view-space depth) ──────
float linearDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * u_near * u_far) / (u_far + u_near - z * (u_far - u_near));
}

// ── Circle-of-confusion ───────────────────────────────────────────────────────
// Returns signed CoC in normalised [0,1] texel units × bokehRadius.
// Positive = behind focus plane, negative = in front.
float computeCoC(float depth) {
  float viewDepth = linearDepth(depth);
  float coc = (viewDepth - u_focusDistance) / max(u_focusRange, 0.0001);
  return clamp(coc, -1.0, 1.0) * u_bokehRadius;
}

// ── COC PASS ─────────────────────────────────────────────────────────────────
#ifdef COC_PASS
void main() {
  float depth = texture(u_depthTexture, v_uv).r;
  float coc   = computeCoC(depth);
  // Pack: rg = color luma preview (not used in this pass), b = coc, a = 1
  vec3  color = texture(u_colorTexture, v_uv).rgb;
  // Store CoC in alpha; keep color for reference
  fragColor   = vec4(color, coc * 0.5 + 0.5); // remap [-1,1] → [0,1]
}

// ── BLUR PASS ─────────────────────────────────────────────────────────────────
#elif defined(BLUR_PASS)
// Input is the COC_PASS output: rgb = color, a = packed CoC
void main() {
  vec4  center    = texture(u_colorTexture, v_uv);
  float centerCoc = center.a * 2.0 - 1.0; // unpack to [-1,1]
  float absCenter = abs(centerCoc) * u_bokehRadius;

  vec4  result    = vec4(0.0);
  float totalW    = 0.0;

  // Step size in UV space
  vec2 stepUV = u_blurDir * u_texelSize;

  int iters = clamp(u_iterations, 1, 16);

  for (int i = -iters; i <= iters; i++) {
    vec2  sUV  = v_uv + stepUV * float(i) * absCenter;
    vec4  samp = texture(u_colorTexture, clamp(sUV, 0.0, 1.0));
    float sCoC = samp.a * 2.0 - 1.0; // unpack
    float absSCoC = abs(sCoC) * u_bokehRadius;

    // Use max CoC spread so near-field blur bleeds outward correctly
    float radius = max(absCenter, absSCoC);
    float w = float(abs(i)) <= radius ? 1.0 : 0.0;

    result += samp * w;
    totalW += w;
  }

  if (totalW > 0.0) result /= totalW;
  fragColor = result;
}

// ── COMBINE PASS ──────────────────────────────────────────────────────────────
#elif defined(COMBINE_PASS)
// u_colorTexture = blurred result, u_depthTexture = original sharp scene
void main() {
  vec4  blurred = texture(u_colorTexture, v_uv);
  vec3  sharp   = texture(u_depthTexture, v_uv).rgb; // depth sampler reused as sharp color
  float coc     = blurred.a * 2.0 - 1.0;
  float blend   = clamp(abs(coc), 0.0, 1.0);
  fragColor     = vec4(mix(sharp, blurred.rgb, blend), 1.0);
}

#else
// Fallback: pass through
void main() {
  fragColor = texture(u_colorTexture, v_uv);
}
#endif
`
