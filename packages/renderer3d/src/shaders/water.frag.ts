// Water fragment shader
// Features: dual UV-scrolling normal maps, Fresnel, depth-based shore transparency
export const WATER_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_worldPos;
in vec2 v_uv;
in vec4 v_clipPos;
in float v_viewDepth;

out vec4 fragColor;

// ── Time & scroll ─────────────────────────────────────────────────────────────
uniform float u_time;
uniform vec2  u_flowDir1;   // e.g. (1.0, 0.0)
uniform vec2  u_flowDir2;   // e.g. (0.7, 0.7)
uniform float u_flowSpeed;  // e.g. 0.05
uniform vec2  u_uvScale;    // e.g. (4.0, 4.0)

// ── Normal maps (two layers for detail) ──────────────────────────────────────
uniform sampler2D u_normalMap1;
uniform sampler2D u_normalMap2;

// ── Depth fade ───────────────────────────────────────────────────────────────
// Renderer binds the opaque scene depth texture here to compute water depth
uniform sampler2D u_depthTexture;
uniform float     u_depthFadeDistance; // e.g. 2.0 world units
uniform float     u_near;
uniform float     u_far;

// ── Water appearance ─────────────────────────────────────────────────────────
uniform vec3  u_shallowColor;   // e.g. (0.2, 0.7, 0.8)
uniform vec3  u_deepColor;      // e.g. (0.05, 0.2, 0.4)
uniform float u_opacity;        // base opacity (deep water) e.g. 0.85
uniform float u_fresnelStrength;// e.g. 1.0

// ── Lighting ─────────────────────────────────────────────────────────────────
uniform vec3  u_cameraPos;
uniform vec3  u_dirLightDir;
uniform vec3  u_dirLightColor;
uniform float u_dirLightIntensity;
uniform float u_specularPower;   // e.g. 128.0

// ── Helpers ───────────────────────────────────────────────────────────────────
float linearizeDepth(float depth) {
  // Convert NDC depth [0,1] back to linear view-space depth
  float z = depth * 2.0 - 1.0;
  return (2.0 * u_near * u_far) / (u_far + u_near - z * (u_far - u_near));
}

float fresnelFactor(vec3 N, vec3 V, float strength) {
  float cosTheta = clamp(dot(N, V), 0.0, 1.0);
  float F0       = 0.02; // water at normal incidence
  float fresnel  = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
  return clamp(fresnel * strength, 0.0, 1.0);
}

void main() {
  // ── Scrolling UV ──
  vec2 scaledUV = v_uv * u_uvScale;
  vec2 uv1 = scaledUV + u_flowDir1 * u_flowSpeed * u_time;
  vec2 uv2 = scaledUV + u_flowDir2 * u_flowSpeed * u_time * 0.8;

  // ── Normal from two blended normal maps ──
  vec3 n1 = texture(u_normalMap1, uv1).rgb * 2.0 - 1.0;
  vec3 n2 = texture(u_normalMap2, uv2).rgb * 2.0 - 1.0;
  vec3 N  = normalize(n1 + n2); // blend: add and renormalize
  // Surface normal is mostly up; apply tangent-space blend in world space
  N = normalize(vec3(N.xy, N.z * 2.0)); // de-emphasize horizontal distortion

  // ── Depth-based transparency ──
  // Convert clip-pos to screen UV for depth texture lookup
  vec2 screenUV = (v_clipPos.xy / v_clipPos.w) * 0.5 + 0.5;
  float sceneDepth = linearizeDepth(texture(u_depthTexture, screenUV).r);
  float waterDepth = v_viewDepth;
  float depthDiff  = clamp((sceneDepth - waterDepth) / u_depthFadeDistance, 0.0, 1.0);

  // Shore is transparent, deep water is opaque
  float alpha = mix(0.1, u_opacity, depthDiff);

  // ── Water color (depth blend) ──
  vec3 waterColor = mix(u_shallowColor, u_deepColor, depthDiff);

  // ── Fresnel reflection ──
  vec3 V = normalize(u_cameraPos - v_worldPos);
  float fresnel = fresnelFactor(N, V, u_fresnelStrength);

  // ── Blinn-Phong specular for sun glint ──
  vec3 L   = normalize(-u_dirLightDir);
  vec3 H   = normalize(V + L);
  float NdotL  = max(dot(N, L), 0.0);
  float NdotH  = max(dot(N, H), 0.0);
  float spec   = pow(NdotH, u_specularPower) * NdotL;
  vec3 specular = u_dirLightColor * u_dirLightIntensity * spec;

  // ── Fresnel reflection color (simple sky approximation) ──
  vec3 reflectColor = vec3(0.8, 0.9, 1.0); // sky tint
  vec3 color = mix(waterColor, reflectColor, fresnel * 0.4) + specular;

  fragColor = vec4(color, alpha);
}
`
