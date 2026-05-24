// Standard Blinn-Phong fragment shader
// Supports up to 4 point lights + 1 directional light + ambient
// Optional maps via #define: USE_ALBEDO_MAP, USE_NORMAL_MAP, USE_METALLIC_ROUGHNESS_MAP,
//                            USE_AO_MAP, USE_EMISSIVE_MAP
// Optional features: USE_FOG, USE_SHADOW_MAP, USE_FLAT_SHADING, USE_IBL
export const STANDARD_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DShadow;

// ── Varyings ─────────────────────────────────────────────────────────────────
in vec3 v_worldPos;
in vec3 v_normal;
in vec2 v_uv;
in mat3 v_TBN;
in vec4 v_lightSpacePos;

out vec4 fragColor;

// ── Material uniforms ────────────────────────────────────────────────────────
uniform vec3  u_color;             // base color / albedo tint
uniform float u_metalness;
uniform float u_roughness;
uniform float u_aoMapIntensity;
uniform vec3  u_emissive;
uniform float u_emissiveIntensity;
uniform vec2  u_normalScale;       // xy scale for normal map
uniform float u_opacity;

// ── Texture samplers ─────────────────────────────────────────────────────────
#ifdef USE_ALBEDO_MAP
uniform sampler2D u_albedoMap;
#endif
#ifdef USE_NORMAL_MAP
uniform sampler2D u_normalMap;
#endif
#ifdef USE_METALLIC_ROUGHNESS_MAP
// R = unused, G = roughness, B = metalness  (glTF convention)
uniform sampler2D u_metallicRoughnessMap;
#endif
#ifdef USE_AO_MAP
uniform sampler2D u_aoMap;
#endif
#ifdef USE_EMISSIVE_MAP
uniform sampler2D u_emissiveMap;
#endif

// ── IBL uniforms ─────────────────────────────────────────────────────────────
#ifdef USE_IBL
uniform samplerCube u_irradianceMap;      // diffuse IBL
uniform samplerCube u_prefilteredEnvMap;  // specular IBL (prefiltered mip chain)
uniform sampler2D   u_brdfLUT;            // BRDF split-sum LUT
uniform float       u_envMapIntensity;
#define MAX_MIP_LEVELS 5.0
#endif

// ── Lighting uniforms ────────────────────────────────────────────────────────
uniform vec3  u_ambientColor;
uniform vec3  u_cameraPos;

// Directional light
uniform vec3  u_dirLightDir;       // world-space direction (points FROM light)
uniform vec3  u_dirLightColor;
uniform float u_dirLightIntensity;

// Point lights (up to 4)
uniform int   u_pointLightCount;
uniform vec3  u_pointLightPos[4];
uniform vec3  u_pointLightColor[4];
uniform float u_pointLightIntensity[4];
uniform float u_pointLightRange[4];  // 0 = infinite

// ── Shadow map ───────────────────────────────────────────────────────────────
#ifdef USE_SHADOW_MAP
uniform sampler2DShadow u_shadowMap;
uniform float           u_shadowBias;

// PCF 3×3 shadow lookup
float sampleShadow(vec4 lsPos) {
  vec3 proj = lsPos.xyz / lsPos.w;
  proj = proj * 0.5 + 0.5;
  if (proj.z > 1.0 || proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0)
    return 1.0; // outside shadow map → fully lit

  float shadow = 0.0;
  vec2 texelSize = vec2(1.0) / vec2(textureSize(u_shadowMap, 0));
  for (int x = -1; x <= 1; ++x) {
    for (int y = -1; y <= 1; ++y) {
      vec3 uvz = vec3(proj.xy + vec2(float(x), float(y)) * texelSize,
                      proj.z - u_shadowBias);
      shadow += texture(u_shadowMap, uvz);
    }
  }
  return shadow / 9.0;
}
#endif

// ── Fog ──────────────────────────────────────────────────────────────────────
#ifdef USE_FOG
uniform vec3  u_fogColor;
uniform float u_fogNear;
uniform float u_fogFar;
#endif

// ── Gamma correction ─────────────────────────────────────────────────────────
vec3 linearToSRGB(vec3 c) {
  // Approximate sRGB transfer function
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

// ── Blinn-Phong BRDF helpers ─────────────────────────────────────────────────
float distributionBlinnPhong(float NdotH, float roughness) {
  // Map roughness to shininess: higher roughness → lower shininess
  float shininess = max(2.0 / (roughness * roughness + 0.001) - 2.0, 1.0);
  return (shininess + 2.0) / (2.0 * 3.14159265) * pow(max(NdotH, 0.0), shininess);
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 calcPointLight(vec3 lightPos, vec3 lightColor, float intensity, float range,
                    vec3 N, vec3 V, vec3 worldPos, vec3 albedo, float metalness, float roughness) {
  vec3 L = lightPos - worldPos;
  float dist = length(L);
  L = L / dist;

  // Attenuation: smooth range falloff
  float atten = 1.0;
  if (range > 0.0) {
    float t = clamp(1.0 - (dist / range), 0.0, 1.0);
    atten = t * t;
  } else {
    atten = 1.0 / (1.0 + dist * dist);
  }

  float NdotL = max(dot(N, L), 0.0);
  vec3 H      = normalize(V + L);
  float NdotH = max(dot(N, H), 0.0);
  float NdotV = max(dot(N, V), 0.001);

  vec3 F0     = mix(vec3(0.04), albedo, metalness);
  vec3 F      = fresnelSchlick(max(dot(H, V), 0.0), F0);

  // Specular (Blinn-Phong)
  float D     = distributionBlinnPhong(NdotH, roughness);
  vec3 spec   = F * D / (4.0 * NdotV * max(NdotL, 0.001));

  // Diffuse: metals have no diffuse
  vec3 kD     = (1.0 - F) * (1.0 - metalness);
  vec3 diffuse = kD * albedo / 3.14159265;

  return (diffuse + spec) * lightColor * intensity * NdotL * atten;
}

vec3 calcDirLight(vec3 lightDir, vec3 lightColor, float intensity,
                  vec3 N, vec3 V, vec3 albedo, float metalness, float roughness) {
  vec3 L      = normalize(-lightDir);
  float NdotL = max(dot(N, L), 0.0);
  vec3 H      = normalize(V + L);
  float NdotH = max(dot(N, H), 0.0);
  float NdotV = max(dot(N, V), 0.001);

  vec3 F0     = mix(vec3(0.04), albedo, metalness);
  vec3 F      = fresnelSchlick(max(dot(H, V), 0.0), F0);

  float D     = distributionBlinnPhong(NdotH, roughness);
  vec3 spec   = F * D / (4.0 * NdotV * max(NdotL, 0.001));
  vec3 kD     = (1.0 - F) * (1.0 - metalness);
  vec3 diffuse = kD * albedo / 3.14159265;

  return (diffuse + spec) * lightColor * intensity * NdotL;
}

// ── Main ──────────────────────────────────────────────────────────────────────
void main() {
  // ── Albedo ──
  vec4 albedo4 = vec4(u_color, u_opacity);
#ifdef USE_ALBEDO_MAP
  vec4 mapSample = texture(u_albedoMap, v_uv);
  // sRGB to linear (textures uploaded as sRGB)
  mapSample.rgb = pow(mapSample.rgb, vec3(2.2));
  albedo4 *= mapSample;
#endif
  vec3 albedo = albedo4.rgb;

  // ── Normal ──
#ifdef USE_FLAT_SHADING
  // Use geometry normal (no normal map)
  vec3 N = normalize(v_normal);
#else
  vec3 N;
  #ifdef USE_NORMAL_MAP
    vec3 nSample = texture(u_normalMap, v_uv).rgb * 2.0 - 1.0;
    nSample.xy  *= u_normalScale;
    N = normalize(v_TBN * nSample);
  #else
    N = normalize(v_normal);
  #endif
#endif

  // ── Metalness / Roughness ──
  float metalness = u_metalness;
  float roughness = u_roughness;
#ifdef USE_METALLIC_ROUGHNESS_MAP
  vec4 mrSample = texture(u_metallicRoughnessMap, v_uv);
  roughness *= mrSample.g;
  metalness *= mrSample.b;
#endif
  roughness = clamp(roughness, 0.04, 1.0);
  metalness = clamp(metalness, 0.0,  1.0);

  // ── AO ──
  float ao = 1.0;
#ifdef USE_AO_MAP
  ao = mix(1.0, texture(u_aoMap, v_uv).r, u_aoMapIntensity);
#endif

  // ── Camera direction ──
  vec3 V = normalize(u_cameraPos - v_worldPos);

  // ── Shadow factor ──
  float shadowFactor = 1.0;
#ifdef USE_SHADOW_MAP
  shadowFactor = sampleShadow(v_lightSpacePos);
#endif

  // ── Lighting accumulation ──
  vec3 Lo = vec3(0.0);

  // Directional light
  Lo += calcDirLight(u_dirLightDir, u_dirLightColor, u_dirLightIntensity,
                     N, V, albedo, metalness, roughness) * shadowFactor;

  // Point lights
  for (int i = 0; i < 4; i++) {
    if (i >= u_pointLightCount) break;
    Lo += calcPointLight(u_pointLightPos[i], u_pointLightColor[i],
                         u_pointLightIntensity[i], u_pointLightRange[i],
                         N, V, v_worldPos, albedo, metalness, roughness);
  }

  // Ambient
  vec3 ambient = u_ambientColor * albedo * ao;

  vec3 color = ambient + Lo;

#ifdef USE_IBL
  // ── Diffuse IBL ──
  vec3 irradiance = texture(u_irradianceMap, N).rgb;
  vec3 iblDiffuse = irradiance * albedo * (1.0 - metalness) * ao;

  // ── Specular IBL ──
  float NdotV_ibl = max(dot(N, V), 0.001);
  vec3 R = reflect(-V, N);
  vec3 prefilteredColor = textureLod(u_prefilteredEnvMap, R, roughness * MAX_MIP_LEVELS).rgb;
  vec2 brdf = texture(u_brdfLUT, vec2(NdotV_ibl, roughness)).rg;
  vec3 F0_ibl = mix(vec3(0.04), albedo, metalness);
  vec3 iblSpecular = prefilteredColor * (F0_ibl * brdf.r + brdf.g);

  color += (iblDiffuse + iblSpecular) * u_envMapIntensity;
#endif

  // ── Emissive ──
  vec3 emissive = u_emissive * u_emissiveIntensity;
#ifdef USE_EMISSIVE_MAP
  emissive *= texture(u_emissiveMap, v_uv).rgb;
#endif
  color += emissive;

  // ── Fog (linear) ──
#ifdef USE_FOG
  float depth   = gl_FragCoord.z / gl_FragCoord.w;
  float fogFact = clamp((u_fogFar - depth) / (u_fogFar - u_fogNear), 0.0, 1.0);
  color = mix(u_fogColor, color, fogFact);
#endif

  // ── Gamma correction (linear → sRGB) ──
  color = linearToSRGB(color);

  fragColor = vec4(color, albedo4.a);
}
`
