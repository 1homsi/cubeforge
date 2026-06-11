export const IRRADIANCE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_localPos;

uniform samplerCube u_envMap;

out vec4 fragColor;

const float PI = 3.14159265359;

void main() {
  // The normal for each cubemap texel is just the normalised local position.
  vec3 N = normalize(v_localPos);

  // Build a TBN so we can loop over the hemisphere.
  vec3 up    = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(up, N));
  up         = normalize(cross(N, right));

  vec3  irradiance   = vec3(0.0);
  float sampleDelta  = 0.025;
  float nrSamples    = 0.0;

  for (float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
    for (float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
      // Spherical to cartesian in tangent space
      vec3 tangentSample = vec3(sin(theta) * cos(phi),
                                sin(theta) * sin(phi),
                                cos(theta));
      // Tangent space → world space
      vec3 sampleVec = tangentSample.x * right
                     + tangentSample.y * up
                     + tangentSample.z * N;

      irradiance += texture(u_envMap, sampleVec).rgb * cos(theta) * sin(theta);
      nrSamples++;
    }
  }

  irradiance = PI * irradiance * (1.0 / nrSamples);
  fragColor  = vec4(irradiance, 1.0);
}
`
