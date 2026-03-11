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

/** Per-group volume memory — what volume was set before muting. */
const groupVolumes = new Map<AudioGroup | 'master', number>()

/** Per-group mute state. */
const groupMuted = new Map<AudioGroup | 'master', boolean>()

/** Global registry of stop functions per group, so stopGroup() can halt sources. */
const groupSources = new Map<AudioGroup | 'master', Set<() => void>>()

/**
 * Register a stop function for a source playing in a group.
 * Returns an unregister function to call when the source ends naturally.
 * @internal
 */
export function registerGroupSource(group: AudioGroup | 'master', stopFn: () => void): () => void {
  let set = groupSources.get(group)
  if (!set) {
    set = new Set()
    groupSources.set(group, set)
  }
  set.add(stopFn)
  return () => set!.delete(stopFn)
}

export function getGroupGainNode(group: AudioGroup | 'master'): GainNode {
  const existing = groupGainNodes.get(group)
  if (existing) return existing

  const ctx = getAudioCtx()
  const gain = ctx.createGain()
  gain.gain.value = groupVolumes.get(group) ?? 1

  if (group === 'master') {
    gain.connect(ctx.destination)
  } else {
    gain.connect(getGroupGainNode('master'))
  }

  groupGainNodes.set(group, gain)
  return gain
}

/**
 * Set the volume for a named group ('sfx', 'music', or any custom name). Range 0–1.
 *
 * @example
 * setGroupVolume('music', 0.4)
 * setGroupVolume('sfx',   0.8)
 */
export function setGroupVolume(group: AudioGroup, volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume))
  groupVolumes.set(group, clamped)
  if (groupMuted.get(group)) return // don't change the gain node while muted
  const node = groupGainNodes.get(group)
  if (node) node.gain.value = clamped
  else getGroupGainNode(group).gain.value = clamped
}

/**
 * Set the master volume (affects all groups). Range 0–1.
 *
 * @example
 * setMasterVolume(0)   // mute all
 * setMasterVolume(1)   // full volume
 */
export function setMasterVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume))
  groupVolumes.set('master', clamped)
  if (groupMuted.get('master')) return
  getGroupGainNode('master').gain.value = clamped
}

/** Read the current volume for a group or master (ignores mute state). */
export function getGroupVolume(group: AudioGroup | 'master'): number {
  return groupVolumes.get(group) ?? 1
}

/** Read the current master volume. */
export function getMasterVolume(): number {
  return getGroupVolume('master')
}

/**
 * Mute or unmute an audio group. Preserves the group's volume so unmuting
 * restores the exact level that was set before muting.
 *
 * @example
 * setGroupMute('music', true)  // mute music
 * setGroupMute('music', false) // restore to previous volume
 */
export function setGroupMute(group: AudioGroup, muted: boolean): void {
  groupMuted.set(group, muted)
  const node = getGroupGainNode(group)
  node.gain.value = muted ? 0 : (groupVolumes.get(group) ?? 1)
}

/**
 * Stop all currently playing sounds in a group immediately.
 * New sounds played in the group afterward will play normally.
 */
export function stopGroup(group: AudioGroup): void {
  const sources = groupSources.get(group)
  if (sources) {
    for (const stop of [...sources]) stop()
    sources.clear()
  }
}

/**
 * Smoothly transition a group's volume to `volume` over `duration` seconds.
 *
 * @example
 * setGroupVolumeFaded('music', 0, 2) // fade music out over 2s
 * setGroupVolumeFaded('sfx', 1, 0.5) // restore sfx over 0.5s
 */
export function setGroupVolumeFaded(group: AudioGroup | 'master', volume: number, duration: number): void {
  const clamped = Math.max(0, Math.min(1, volume))
  groupVolumes.set(group, clamped)
  const node = getGroupGainNode(group)
  const ctx = getAudioCtx()
  const now = ctx.currentTime
  node.gain.cancelScheduledValues(now)
  node.gain.setValueAtTime(node.gain.value, now)
  node.gain.linearRampToValueAtTime(clamped, now + Math.max(0, duration))
}

/**
 * Temporarily lower a group's volume to `amount` (0–1) for `duration` seconds,
 * then restore it. Useful for ducking music under SFX or dialogue.
 *
 * @example
 * duck('music', 0.3, 2) // lower music to 30% for 2 seconds then restore
 */
export function duck(group: AudioGroup, amount: number, duration: number): void {
  const node = getGroupGainNode(group)
  const ctx = getAudioCtx()
  const now = ctx.currentTime
  const prev = groupVolumes.get(group) ?? 1
  node.gain.cancelScheduledValues(now)
  node.gain.setValueAtTime(node.gain.value, now)
  node.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, amount)), now + 0.05)
  node.gain.setValueAtTime(Math.max(0, Math.min(1, amount)), now + duration)
  node.gain.linearRampToValueAtTime(prev, now + duration + 0.2)
}
