export const BRDF_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

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
  return float(bits) * 2.3283064365386963e-10;
}

vec2 hammersley(uint i, uint N) {
  return vec2(float(i) / float(N), radicalInverseVdC(i));
}

// GGX importance sampling
vec3 importanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
  float a = roughness * roughness;

  float phi      = 2.0 * PI * Xi.x;
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

  vec3 H = vec3(cos(phi) * sinTheta,
                sin(phi) * sinTheta,
                cosTheta);

  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 T  = normalize(cross(up, N));
  vec3 B  = cross(N, T);

  return normalize(T * H.x + B * H.y + N * H.z);
}

// Smith's geometry function term
float geometrySchlickGGX(float NdotV, float roughness) {
  float a = roughness;
  float k = (a * a) / 2.0; // IBL re-parameterisation
  return NdotV / (NdotV * (1.0 - k) + k);
}

float geometrySmith(float NdotV, float NdotL, float roughness) {
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

// Integrates F0 scale (r) and F0 bias (g) for the split-sum approximation.
// NdotV == v_uv.x, roughness == v_uv.y
vec2 integrateBRDF(float NdotV, float roughness) {
  vec3 V = vec3(sqrt(1.0 - NdotV * NdotV), 0.0, NdotV);
  vec3 N = vec3(0.0, 0.0, 1.0);

  float A = 0.0;
  float B = 0.0;

  for (uint i = 0u; i < SAMPLE_COUNT; i++) {
    vec2 Xi = hammersley(i, SAMPLE_COUNT);
    vec3 H  = importanceSampleGGX(Xi, N, roughness);
    vec3 L  = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(L.z,         0.0);
    float NdotH = max(H.z,         0.0);
    float VdotH = max(dot(V, H),   0.0);

    if (NdotL > 0.0) {
      float G     = geometrySmith(NdotV, NdotL, roughness);
      float G_Vis = (G * VdotH) / (NdotH * NdotV + 0.0001);
      float Fc    = pow(1.0 - VdotH, 5.0);
      A += (1.0 - Fc) * G_Vis;
      B += Fc          * G_Vis;
    }
  }

  return vec2(A, B) / float(SAMPLE_COUNT);
}

void main() {
  vec2 integratedBRDF = integrateBRDF(v_uv.x, v_uv.y);
  fragColor = vec4(integratedBRDF, 0.0, 1.0);
}
`
