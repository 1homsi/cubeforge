// ─── Shared AudioContext ────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null

export function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}

// ─── Volume groups ──────────────────────────────────────────────────────────
// Graph: each sound → group gain → master gain → destination

/**
 * Audio group name. Built-in groups are `'sfx'` and `'music'`, but any
 * string can be used to create custom groups (e.g. `'ambient'`, `'ui'`, `'voice'`).
 */
export type AudioGroup = string

const groupGainNodes = new Map<AudioGroup | 'master', GainNode>()

export function getGroupGainNode(group: AudioGroup | 'master'): GainNode {
  const existing = groupGainNodes.get(group)
  if (existing) return existing

  const ctx = getAudioCtx()
  const gain = ctx.createGain()
  gain.gain.value = 1

  if (group === 'master') {
    gain.connect(ctx.destination)
  } else {
    gain.connect(getGroupGainNode('master'))
  }

  groupGainNodes.set(group, gain)
  return gain
}

/**
 * Set the volume for a named group ('sfx' or 'music'). Range 0–1.
 *
 * @example
 * setGroupVolume('music', 0.4)
 * setGroupVolume('sfx',   0.8)
 */
export function setGroupVolume(group: AudioGroup, volume: number): void {
  const node = groupGainNodes.get(group)
  if (node) node.gain.value = Math.max(0, Math.min(1, volume))
  else {
    // Node not yet created — create it so the value is applied when first used
    getGroupGainNode(group).gain.value = Math.max(0, Math.min(1, volume))
  }
}

/**
 * Set the master volume (affects all groups). Range 0–1.
 *
 * @example
 * setMasterVolume(0)   // mute all
 * setMasterVolume(1)   // full volume
 */
export function setMasterVolume(volume: number): void {
  getGroupGainNode('master').gain.value = Math.max(0, Math.min(1, volume))
}

/** Read the current volume for a group or master. */
export function getGroupVolume(group: AudioGroup | 'master'): number {
  return groupGainNodes.get(group)?.gain.value ?? 1
}

/**
 * Mute or unmute an audio group.
 *
 * @example
 * setGroupMute('music', true)  // mute music
 * setGroupMute('music', false) // restore music
 */
export function setGroupMute(group: AudioGroup, muted: boolean): void {
  const node = getGroupGainNode(group)
  node.gain.value = muted ? 0 : 1
}

/**
 * Stop all currently playing sounds in a group.
 * (Individual source nodes track is not possible via the group node alone,
 *  so this is handled by setting gain to 0 — sounds stop naturally.)
 */
export function stopGroup(group: AudioGroup): void {
  setGroupMute(group, true)
  // Re-enable after a tick so new sounds can play
  setTimeout(() => {
    const node = groupGainNodes.get(group)
    if (node) node.gain.value = 1
  }, 16)
}

/**
 * Temporarily lower a group's volume by `amount` (0–1) for `duration` seconds,
 * then restore it. Useful for ducking music under SFX.
 *
 * @example
 * duck('music', 0.3, 2) // lower music to 30% for 2 seconds
 */
export function duck(group: AudioGroup, amount: number, duration: number): void {
  const node = getGroupGainNode(group)
  const ctx = getAudioCtx()
  const now = ctx.currentTime
  const prev = node.gain.value
  node.gain.cancelScheduledValues(now)
  node.gain.setValueAtTime(prev, now)
  node.gain.linearRampToValueAtTime(amount, now + 0.05)
  node.gain.setValueAtTime(amount, now + duration)
  node.gain.linearRampToValueAtTime(prev, now + duration + 0.2)
}
