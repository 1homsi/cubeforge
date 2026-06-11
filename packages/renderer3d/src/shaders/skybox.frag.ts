// Skybox fragment shader — samples a cubemap using the interpolated local position
export const SKYBOX_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_localPos;

uniform samplerCube u_skybox;
uniform float       u_exposure; // HDR exposure (1.0 = no change)

out vec4 fragColor;

// Reinhard tonemapping
vec3 toneMap(vec3 color) {
  return color / (color + vec3(1.0));
}

// Gamma correction
vec3 linearToSRGB(vec3 c) {
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

void main() {
  vec3 dir   = normalize(v_localPos);
  vec3 color = texture(u_skybox, dir).rgb;

  // Apply exposure and tonemapping for HDR skyboxes
  color = toneMap(color * u_exposure);
  color = linearToSRGB(color);

  fragColor = vec4(color, 1.0);
}
`
