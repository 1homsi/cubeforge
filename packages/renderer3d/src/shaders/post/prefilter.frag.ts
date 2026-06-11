export const PREFILTER_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_localPos;

uniform samplerCube u_envMap;
uniform float u_roughness;
uniform float u_envResolution; // face size of the source env map

out vec4 fragColor;

const float PI = 3.14159265359;
const uint  SAMPLE_COUNT = 1024u;

// Van der Corput radical inverse (base 2)
float radicalInverseVdC(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return float(bits) * 2.3283064365386963e-10; // 1 / 0x100000000
}

// Hammersley low-discrepancy sequence
vec2 hammersley(uint i, uint N) {
  return vec2(float(i) / float(N), radicalInverseVdC(i));
}

// GGX importance sampling — generates a half-vector
vec3 importanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
  float a = roughness * roughness;

  float phi      = 2.0 * PI * Xi.x;
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

  // Spherical → cartesian (tangent space H)
  vec3 H = vec3(cos(phi) * sinTheta,
                sin(phi) * sinTheta,
                cosTheta);

  // Tangent space → world space
  vec3 up    = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 T     = normalize(cross(up, N));
  vec3 B     = cross(N, T);

  return normalize(T * H.x + B * H.y + N * H.z);
}

// GGX normal-distribution function (used for PDF)
float distributionGGX(float NdotH, float roughness) {
  float a  = roughness * roughness;
  float a2 = a * a;
  float d  = (NdotH * NdotH * (a2 - 1.0) + 1.0);
  return a2 / (PI * d * d);
}

void main() {
  vec3 N = normalize(v_localPos);
  // Assume view == reflection == normal (split-sum approximation)
  vec3 R = N;
  vec3 V = N;

  float totalWeight   = 0.0;
  vec3  prefilteredColor = vec3(0.0);

  for (uint i = 0u; i < SAMPLE_COUNT; i++) {
    vec2 Xi = hammersley(i, SAMPLE_COUNT);
    vec3 H  = importanceSampleGGX(Xi, N, u_roughness);
    vec3 L  = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(dot(N, L), 0.0);
    if (NdotL > 0.0) {
      // Mip level bias for the sample — reduces aliasing on rough surfaces
      float NdotH = max(dot(N, H), 0.0);
      float HdotV = max(dot(H, V), 0.0);
      float D     = distributionGGX(NdotH, u_roughness);
      float pdf   = (D * NdotH / (4.0 * HdotV)) + 0.0001;

      float saTexel  = 4.0 * PI / (6.0 * u_envResolution * u_envResolution);
      float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);
      float mipLevel = u_roughness == 0.0
                     ? 0.0
                     : 0.5 * log2(saSample / saTexel);

      prefilteredColor += textureLod(u_envMap, L, mipLevel).rgb * NdotL;
      totalWeight      += NdotL;
    }
  }

  prefilteredColor /= totalWeight;
  fragColor = vec4(prefilteredColor, 1.0);
}
`
