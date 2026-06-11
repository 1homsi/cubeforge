export const SSAO_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

// G-buffer inputs
uniform sampler2D u_depthTexture;
uniform sampler2D u_normalTexture;

// Noise & kernel
uniform sampler2D u_noiseTexture;
uniform vec3      u_kernel[64];       // up to 64 samples
uniform int       u_kernelSize;       // actual count (≤64)

// Camera
uniform mat4  u_projection;
uniform mat4  u_projectionInverse;

// SSAO parameters
uniform float u_radius;
uniform float u_bias;
uniform float u_power;
uniform vec2  u_resolution;
uniform vec2  u_noiseScale; // resolution / 4.0

out vec4 fragColor;

// Reconstruct view-space position from depth texture.
vec3 viewPosFromDepth(vec2 uv) {
  float depth = texture(u_depthTexture, uv).r;
  // NDC position
  vec4 ndcPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  // View space
  vec4 viewPos = u_projectionInverse * ndcPos;
  return viewPos.xyz / viewPos.w;
}

void main() {
  vec3 fragPos = viewPosFromDepth(v_uv);

  // Decode view-space normal from the G-buffer (stored as [0,1], decode to [-1,1])
  vec3 normal = normalize(texture(u_normalTexture, v_uv).rgb * 2.0 - 1.0);

  // Tiled noise rotation vector
  vec3 randomVec = normalize(texture(u_noiseTexture, v_uv * u_noiseScale).xyz * 2.0 - 1.0);

  // Build TBN to rotate kernel into view space
  vec3 tangent   = normalize(randomVec - normal * dot(randomVec, normal));
  vec3 bitangent = cross(normal, tangent);
  mat3 TBN       = mat3(tangent, bitangent, normal);

  float occlusion = 0.0;

  for (int i = 0; i < u_kernelSize; i++) {
    // Transform sample to view space
    vec3 samplePos = TBN * u_kernel[i];
    samplePos = fragPos + samplePos * u_radius;

    // Project sample to get its screen-space UV
    vec4 offset = u_projection * vec4(samplePos, 1.0);
    offset.xyz /= offset.w;
    offset.xyz  = offset.xyz * 0.5 + 0.5;

    // Sample depth at the projected UV
    vec3 sampleViewPos = viewPosFromDepth(offset.xy);

    // Range check: only count nearby samples
    float rangeCheck = smoothstep(0.0, 1.0, u_radius / abs(fragPos.z - sampleViewPos.z));
    // Occlude if the scene geometry at that UV is closer to the camera than our sample
    occlusion += (sampleViewPos.z >= samplePos.z + u_bias ? 1.0 : 0.0) * rangeCheck;
  }

  occlusion = 1.0 - (occlusion / float(u_kernelSize));
  occlusion = pow(occlusion, u_power);

  fragColor = vec4(occlusion, occlusion, occlusion, 1.0);
}
`
