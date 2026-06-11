export const MOTION_BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_colorTexture;
uniform sampler2D u_depthTexture;

// Previous and current inverse-VP matrices for velocity computation
uniform mat4 u_invCurrentVP;
uniform mat4 u_prevVP;

uniform int   u_samples;          // samples along velocity vector
uniform float u_shutterAngle;     // 0-360 degrees
uniform float u_maxBlurPixels;    // pixel clamp for velocity
uniform vec2  u_texelSize;        // 1/width, 1/height

// Reconstruct world position from NDC depth
vec3 reconstructWorldPos(vec2 uv, float depth) {
  // Remap depth from [0,1] to [-1,1] (NDC)
  float ndcDepth = depth * 2.0 - 1.0;
  vec4 ndcPos = vec4(uv * 2.0 - 1.0, ndcDepth, 1.0);
  vec4 worldPos = u_invCurrentVP * ndcPos;
  return worldPos.xyz / worldPos.w;
}

void main() {
  float depth = texture(u_depthTexture, v_uv).r;

  // Skip sky / background (depth == 1.0 in most GL setups)
  if (depth >= 0.9999) {
    fragColor = texture(u_colorTexture, v_uv);
    return;
  }

  // Reconstruct world-space position for this fragment
  vec3 worldPos = reconstructWorldPos(v_uv, depth);

  // Project with previous VP to get previous screen position
  vec4 prevClip = u_prevVP * vec4(worldPos, 1.0);
  vec2 prevUV   = (prevClip.xy / prevClip.w) * 0.5 + 0.5;

  // Velocity in UV space
  vec2 velocity = v_uv - prevUV;

  // Convert to pixel space, clamp, then back to UV space
  vec2 velocityPx = velocity / u_texelSize;
  float speed = length(velocityPx);
  if (speed > u_maxBlurPixels) {
    velocityPx *= u_maxBlurPixels / speed;
  }

  // Scale by shutter angle (180° = full frame exposure, 360° = 2x, etc.)
  velocityPx *= u_shutterAngle / 360.0;
  velocity = velocityPx * u_texelSize;

  // Sample along velocity vector and average
  vec4 color = vec4(0.0);
  int samples = max(u_samples, 1);
  float stepScale = 1.0 / float(samples);

  for (int i = 0; i < 32; i++) {
    if (i >= samples) break;
    // Distribute samples symmetrically around the current pixel
    float t = (float(i) + 0.5) * stepScale - 0.5;
    vec2 sampleUV = clamp(v_uv + velocity * t, vec2(0.0), vec2(1.0));
    color += texture(u_colorTexture, sampleUV);
  }

  fragColor = color * stepScale;
}
`
