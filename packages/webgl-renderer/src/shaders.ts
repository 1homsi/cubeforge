// Vertex shader — instanced quad renderer
// Each instance represents one sprite or particle.
//
// Layout (per-vertex, location 0–1):
//   a_quadPos  vec2  (-0.5..0.5, -0.5..0.5) unit quad corners
//   a_uv       vec2  (0..1, 0..1) corresponding UVs
//
// Layout (per-instance, location 2–9):
//   i_pos      vec2  world-space position
//   i_size     vec2  draw width / height (already includes scaleX/Y and squash)
//   i_rot      float rotation in radians
//   i_anchor   vec2  (anchorX, anchorY) 0=left/top .. 1=right/bottom
//   i_offset   vec2  draw offset in local space
//   i_flipX    float 1.0 = flip horizontally, 0.0 = normal
//   i_color    vec4  RGBA (0..1 each)
//   i_uvRect   vec4  (u, v, uw, vh) normalised UV sub-rect for sprite sheets
export const VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_quadPos;
layout(location = 1) in vec2 a_uv;

layout(location = 2) in vec2  i_pos;
layout(location = 3) in vec2  i_size;
layout(location = 4) in float i_rot;
layout(location = 5) in vec2  i_anchor;
layout(location = 6) in vec2  i_offset;
layout(location = 7) in float i_flipX;
layout(location = 8) in vec4  i_color;
layout(location = 9) in vec4  i_uvRect;

uniform vec2  u_camPos;
uniform float u_zoom;
uniform vec2  u_canvasSize;
uniform vec2  u_shake;

out vec2 v_uv;
out vec4 v_color;

void main() {
  // Local position: map quad corner (-0.5..0.5) to draw rect, applying anchor
  vec2 local = (a_quadPos - vec2(i_anchor.x - 0.5, i_anchor.y - 0.5)) * i_size + i_offset;

  // Horizontal flip
  if (i_flipX > 0.5) local.x = -local.x;

  // Rotate around local origin
  float c = cos(i_rot);
  float s = sin(i_rot);
  local = vec2(c * local.x - s * local.y, s * local.x + c * local.y);

  // World position
  vec2 world = i_pos + local;

  // Camera → NDC clip space (Y is flipped: canvas Y down, WebGL Y up)
  // Equivalent to Canvas2D: translate(W/2 - camX*zoom + shakeX, H/2 - camY*zoom + shakeY); scale(zoom,zoom)
  float cx = 2.0 * u_zoom / u_canvasSize.x * (world.x - u_camPos.x) + 2.0 * u_shake.x / u_canvasSize.x;
  float cy = -2.0 * u_zoom / u_canvasSize.y * (world.y - u_camPos.y) - 2.0 * u_shake.y / u_canvasSize.y;

  gl_Position = vec4(cx, cy, 0.0, 1.0);

  // Remap UV [0,1] to the sub-rect defined by i_uvRect
  v_uv    = i_uvRect.xy + a_uv * i_uvRect.zw;
  v_color = i_color;
}
`

export const FRAG_SRC = `#version 300 es
precision mediump float;

in vec2 v_uv;
in vec4 v_color;

uniform sampler2D u_texture;
uniform int       u_useTexture;

out vec4 fragColor;

void main() {
  if (u_useTexture == 1) {
    fragColor = texture(u_texture, v_uv) * v_color;
  } else {
    fragColor = v_color;
  }
}
`
