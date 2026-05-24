// Shader string constants — import and pass to ShaderProgram or ShaderMaterial

// ── Standard (Blinn-Phong PBR) ────────────────────────────────────────────────
export { STANDARD_VERT } from './standard.vert'
export { STANDARD_FRAG } from './standard.frag'

// ── Skinned (standard + joint/weight skinning) ────────────────────────────────
export { SKINNED_VERT } from './skinned.vert'
// Fragment: reuse STANDARD_FRAG — skinned geometry shares the same lighting model

// ── Shadow map (depth-only, light's POV) ─────────────────────────────────────
export { SHADOW_VERT } from './shadow.vert'
export { SHADOW_FRAG } from './shadow.frag'

// ── Depth pre-pass (camera's POV, populates depth buffer) ────────────────────
export { DEPTH_VERT } from './depth.vert'
export { DEPTH_FRAG } from './depth.frag'

// ── Skybox (cubemap) ─────────────────────────────────────────────────────────
export { SKYBOX_VERT } from './skybox.vert'
export { SKYBOX_FRAG } from './skybox.frag'

// ── Water ────────────────────────────────────────────────────────────────────
export { WATER_VERT } from './water.vert'
export { WATER_FRAG } from './water.frag'

// ── Particles (point sprites) ─────────────────────────────────────────────────
export { PARTICLE_VERT } from './particle.vert'
export { PARTICLE_FRAG } from './particle.frag'

// ── Post-processing ───────────────────────────────────────────────────────────
export { BLOOM_VERT }      from './post/bloom.vert'
export { BLOOM_FRAG }      from './post/bloom.frag'
export { COMPOSITE_VERT }  from './post/composite.vert'
export { COMPOSITE_FRAG }  from './post/composite.frag'
