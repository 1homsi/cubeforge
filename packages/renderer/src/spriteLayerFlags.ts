/** Atlases per layer (the per-sprite `atlas` index is a byte). */
export const MAX_LAYER_ATLASES = 256
/**
 * Atlases bound at once. Atlases are drawn in groups of this many (`atlas >> 3`);
 * a run of sprites in the same group is one draw call.
 */
export const ATLASES_PER_DRAW = 8
export const SPRITE_FLIP_X = 1
export const SPRITE_FLIP_Y = 2
export const SPRITE_HIDDEN = 4
/** Draw as a solid rect in `color`, ignoring the atlas. */
export const SPRITE_UNTEXTURED = 8
/** Bend with the layer's `wind` on the GPU (top of the quad sways, base stays put). */
export const SPRITE_SWAY = 16
/** Draw this sprite with additive blending (glow, fire, light) inside a layer that blends normally. */
export const SPRITE_ADDITIVE = 32
