/**
 * FXAA 3.11 — Timothy Lottes / NVIDIA
 *
 * GLSL ES 300 port.  Renders anti-aliased output straight to the current
 * framebuffer.  Pass the LDR (tone-mapped) scene texture as u_inputTexture.
 */
export const FXAA_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_inputTexture;
uniform vec2      u_texelSize; // vec2(1.0/width, 1.0/height)

out vec4 fragColor;

// ── Luma helper ──────────────────────────────────────────────────────────────
// Converts linear-ish RGB to perceived luma.  Using the green-channel short
// path is common in real-time FXAA; a full dot-product is more accurate.
float luma(vec3 rgb) {
  return dot(rgb, vec3(0.299, 0.587, 0.114));
}

// ── FXAA parameters (tuning constants) ───────────────────────────────────────
const float FXAA_EDGE_THRESHOLD_MIN = 0.0833; // ignore dark region edges
const float FXAA_EDGE_THRESHOLD     = 0.125;  // local contrast required
const float FXAA_SUBPIX_TRIM        = 0.25;   // sub-pixel aliasing removal cap
const float FXAA_SUBPIX_CAP         = 0.75;   // maximum sub-pixel blur
const float FXAA_SEARCH_STEPS       = 8.0;    // edge-walk iterations
const float FXAA_SEARCH_THRESHOLD   = 0.25;   // edge-end detection threshold
const float FXAA_SUBPIX_TRIM_SCALE  = 1.0 / (1.0 - FXAA_SUBPIX_TRIM);

void main() {
  vec2 uv = v_uv;
  vec2 ts = u_texelSize;

  // ── Neighbourhood lumas ───────────────────────────────────────────────────
  float lumaN  = luma(texture(u_inputTexture, uv + vec2( 0.0, -ts.y)).rgb);
  float lumaW  = luma(texture(u_inputTexture, uv + vec2(-ts.x,  0.0)).rgb);
  float lumaM  = luma(texture(u_inputTexture, uv).rgb);
  float lumaE  = luma(texture(u_inputTexture, uv + vec2( ts.x,  0.0)).rgb);
  float lumaS  = luma(texture(u_inputTexture, uv + vec2( 0.0,  ts.y)).rgb);

  float rangeMin = min(lumaM, min(min(lumaN, lumaW), min(lumaS, lumaE)));
  float rangeMax = max(lumaM, max(max(lumaN, lumaW), max(lumaS, lumaE)));
  float range    = rangeMax - rangeMin;

  // Early exit — pixel is not on a visible edge.
  if (range < max(FXAA_EDGE_THRESHOLD_MIN, rangeMax * FXAA_EDGE_THRESHOLD)) {
    fragColor = texture(u_inputTexture, uv);
    return;
  }

  // ── Sub-pixel aliasing ────────────────────────────────────────────────────
  float lumaNW = luma(texture(u_inputTexture, uv + vec2(-ts.x, -ts.y)).rgb);
  float lumaNE = luma(texture(u_inputTexture, uv + vec2( ts.x, -ts.y)).rgb);
  float lumaSW = luma(texture(u_inputTexture, uv + vec2(-ts.x,  ts.y)).rgb);
  float lumaSE = luma(texture(u_inputTexture, uv + vec2( ts.x,  ts.y)).rgb);

  float lumaL = (lumaN + lumaW + lumaE + lumaS) * 0.25;
  float rangeL = abs(lumaL - lumaM);

  float blendL = max(
    0.0,
    (rangeL / range) - FXAA_SUBPIX_TRIM
  ) * FXAA_SUBPIX_TRIM_SCALE;
  blendL = min(FXAA_SUBPIX_CAP, blendL);

  // ── Edge direction ────────────────────────────────────────────────────────
  float edgeVert = abs(lumaN  + lumaS  - 2.0 * lumaM) * 2.0
                 + abs(lumaNE + lumaSE - 2.0 * lumaE)
                 + abs(lumaNW + lumaSW - 2.0 * lumaW);

  float edgeHorz = abs(lumaW  + lumaE  - 2.0 * lumaM) * 2.0
                 + abs(lumaNW + lumaNE - 2.0 * lumaN)
                 + abs(lumaSW + lumaSE - 2.0 * lumaS);

  bool isHorz = edgeHorz >= edgeVert;

  // Perpendicular step along the edge
  vec2 step = isHorz ? vec2(0.0, ts.y) : vec2(ts.x, 0.0);

  // Which side is the high-luma neighbour?
  float luma1 = isHorz ? lumaN : lumaW;
  float luma2 = isHorz ? lumaS : lumaE;
  float grad1 = abs(luma1 - lumaM);
  float grad2 = abs(luma2 - lumaM);

  bool  pairN   = grad1 >= grad2;
  float gradMax = max(grad1, grad2) * FXAA_SEARCH_THRESHOLD;

  // Offset by half a pixel toward the chosen neighbour
  vec2 posEdge = uv;
  if (pairN) {
    posEdge -= step * 0.5;
  } else {
    posEdge += step * 0.5;
  }

  // ── Edge search (walk along the edge to find its endpoints) ──────────────
  vec2 searchStep = isHorz ? vec2(ts.x, 0.0) : vec2(0.0, ts.y);

  vec2 posP = posEdge + searchStep;
  vec2 posN = posEdge - searchStep;

  float lumaPairCenter = (pairN ? luma1 : luma2 + lumaM) * 0.5;

  bool doneP = false;
  bool doneN = false;
  float lumaEndP = 0.0;
  float lumaEndN = 0.0;

  for (float i = 0.0; i < FXAA_SEARCH_STEPS; i++) {
    if (!doneP) {
      lumaEndP = luma(texture(u_inputTexture, posP).rgb);
      doneP    = abs(lumaEndP - lumaPairCenter) >= gradMax;
    }
    if (!doneN) {
      lumaEndN = luma(texture(u_inputTexture, posN).rgb);
      doneN    = abs(lumaEndN - lumaPairCenter) >= gradMax;
    }
    if (doneP && doneN) break;
    if (!doneP) posP += searchStep;
    if (!doneN) posN -= searchStep;
  }

  // ── Pixel offset along the edge gradient ─────────────────────────────────
  float distP = isHorz ? abs(posP.x - uv.x) : abs(posP.y - uv.y);
  float distN = isHorz ? abs(posN.x - uv.x) : abs(posN.y - uv.y);
  bool  useN  = distN < distP;

  float spanLen    = distP + distN;
  float pixOffset  = -min(distP, distN) / spanLen + 0.5;

  bool  lumaMLtCen = lumaM < lumaPairCenter;
  bool  goodSpan   = useN
    ? ((lumaEndN < 0.0) != lumaMLtCen)
    : ((lumaEndP < 0.0) != lumaMLtCen);

  float finalOffset = goodSpan ? pixOffset : 0.0;
  finalOffset = max(finalOffset, blendL);

  // ── Final sample ──────────────────────────────────────────────────────────
  vec2 finalUV = uv;
  if (isHorz) {
    finalUV.y += finalOffset * (pairN ? -ts.y : ts.y);
  } else {
    finalUV.x += finalOffset * (pairN ? -ts.x : ts.x);
  }

  fragColor = texture(u_inputTexture, finalUV);
}
`
