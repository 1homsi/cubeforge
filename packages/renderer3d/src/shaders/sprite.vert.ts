// Billboard sprite vertex shader
// Renders a camera-facing quad. The quad vertices are unit-square offsets in [-0.5, 0.5].
// The billboard matrix is constructed from camera right/up so the quad always faces the camera.
// sizeAttenuation=1 → normal perspective scaling; sizeAttenuation=0 → fixed screen size.
export const SPRITE_VERT = /* glsl */ `#version 300 es
precision highp float;

// Quad corner offset in local space ([-0.5..0.5] on X and Y)
layout(location = 0) in vec2 a_position;

uniform mat4  u_viewMatrix;
uniform mat4  u_projectionMatrix;
// World-space center of the sprite
uniform vec3  u_center;
// World-space scale (width, height)
uniform vec2  u_scale;
// Pivot offset [0..1] — (0.5, 0.5) centers the sprite on u_center
uniform vec2  u_center_pivot;
// 2D rotation (radians) applied to the quad in billboard space
uniform float u_rotation;
// 1.0 = perspective size attenuation (normal), 0.0 = fixed screen size
uniform float u_sizeAttenuation;

out vec2 v_uv;

void main() {
  // Build billboard axes from the view matrix columns (already in world space).
  // Column 0 of the inverse-view = right vector; column 1 = up vector.
  // view[0][0..2] is the right vector (row 0 of view = camera right in world)
  vec3 right = vec3(u_viewMatrix[0][0], u_viewMatrix[1][0], u_viewMatrix[2][0]);
  vec3 up    = vec3(u_viewMatrix[0][1], u_viewMatrix[1][1], u_viewMatrix[2][1]);

  // Apply 2D rotation in billboard plane
  float c = cos(u_rotation);
  float s = sin(u_rotation);
  vec2 rotated = vec2(
    c * a_position.x - s * a_position.y,
    s * a_position.x + c * a_position.y
  );

  // Pivot offset: shift quad so pivot aligns with u_center
  vec2 pivotOffset = rotated - (u_center_pivot - vec2(0.5));

  // View-space center for sizeAttenuation
  vec4 viewCenter = u_viewMatrix * vec4(u_center, 1.0);

  // Scale: with attenuation = world-space scale; without = screen-space constant
  float dist = -viewCenter.z; // positive in front of camera
  float attenuationFactor = mix(1.0 / max(dist, 0.001), 1.0, u_sizeAttenuation);

  // Final world-space offset
  vec3 worldOffset = (right * pivotOffset.x * u_scale.x + up * pivotOffset.y * u_scale.y) * attenuationFactor;

  vec3 worldPos = u_center + worldOffset;

  // UV: map [-0.5, 0.5] → [0, 1] with Y flipped for typical texture convention
  v_uv = vec2(a_position.x + 0.5, 0.5 - a_position.y);

  gl_Position = u_projectionMatrix * u_viewMatrix * vec4(worldPos, 1.0);
}
`
