// Stars vertex shader — point sprites positioned on a unit sphere.
// Each star instance supplies a random direction (a_position) and a size.
// Faded by sun elevation so stars disappear during daytime.
export const STARS_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position; // unit-sphere direction to the star

uniform mat4  u_viewMatrix;
uniform mat4  u_projectionMatrix;
uniform vec3  u_cameraPosition;
// 0 = midnight, 1 = noon (linear map from sun elevation)
uniform float u_sunElevation;
uniform float u_starSize;  // base point size in pixels

out float v_brightness;

void main() {
  // Stars live on a large sphere centred on the camera.
  float radius = 400.0;
  vec3 worldPos = a_position * radius + u_cameraPosition;

  vec4 clipPos = u_projectionMatrix * u_viewMatrix * vec4(worldPos, 1.0);
  // Push to far plane.
  gl_Position = clipPos.xyww;

  // Fade stars out when sun is above horizon.
  float fade = 1.0 - clamp(u_sunElevation * 3.0, 0.0, 1.0);
  v_brightness = fade;

  gl_PointSize = u_starSize * fade;
}
`
