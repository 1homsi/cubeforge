import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installWebAudioMock } from './webAudioMock'
import { getAudioManager } from '../audioManager'
import { getAudioState, getGroupGainNode } from '../audioContext'

async function flush() {
  await vi.advanceTimersByTimeAsync(0)
}

describe('AudioManager (app-level audio, independent of <Game>)', () => {
  let mock: ReturnType<typeof installWebAudioMock>
  beforeEach(() => {
    vi.useFakeTimers()
    mock = installWebAudioMock()
  })
  afterEach(() => {
    mock.uninstall()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('creates the shared AudioContext once and resumes it on the first gesture', async () => {
    const audio = getAudioManager()
    expect(audio.state).toBe('none')
    expect(mock.contexts).toHaveLength(0) // lazy: nothing created by importing

    const ctx = audio.context
    expect(audio.context).toBe(ctx)
    await audio.playMusic('/a.ogg')
    audio.setVolume(0.5)
    expect(mock.contexts).toHaveLength(1)
    expect(ctx.state).toBe('suspended')

    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(ctx.state).toBe('running')
    expect(ctx.resume).toHaveBeenCalled()
    const calls = (ctx.resume as any).mock.calls.length

    // unlock listeners are gone once running
    window.dispatchEvent(new Event('keydown'))
    await flush()
    expect((ctx.resume as any).mock.calls.length).toBe(calls)
  })

  it('re-arms the unlock when the browser suspends or interrupts the context later', async () => {
    const audio = getAudioManager()
    const ctx = audio.context as any
    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(ctx.state).toBe('running')
    ctx.resume.mockClear()

    ctx.setState('interrupted') // iOS Safari after a phone call / tab switch
    window.dispatchEvent(new Event('touchend'))
    await flush()
    expect(ctx.resume).toHaveBeenCalledTimes(1)
    expect(ctx.state).toBe('running')
  })

  it('keeps one AudioContext when the module is re-evaluated (HMR) and finds the live soundtrack', async () => {
    await getAudioManager().playMusic('/theme.ogg')
    const first = mock.contexts[0]

    vi.resetModules()
    const reloaded = await import('../audioManager')
    const again = reloaded.getAudioManager()
    expect(again.context).toBe(first)
    expect(again.currentMusic).toBe('/theme.ogg')
    expect(mock.contexts).toHaveLength(1)
    expect(first.close).not.toHaveBeenCalled()
  })

  it('master volume, mute and group volumes survive stopping music and are honoured by new nodes', async () => {
    const audio = getAudioManager()
    audio.setVolume(0.4)
    audio.setGroupVolume('music', 0.7)
    audio.setMuted(true)
    expect(audio.muted).toBe(true)
    expect(getGroupGainNode('master').gain.value).toBe(0)

    await audio.playMusic('/t.ogg', { fade: 0 })
    audio.stopMusic(0)
    audio.setGroupMuted('sfx', true)
    expect(getGroupGainNode('sfx').gain.value).toBe(0)

    audio.setMuted(false)
    expect(getGroupGainNode('master').gain.value).toBe(0.4)
    expect(audio.getVolume()).toBe(0.4)
    expect(audio.getGroupVolume('music')).toBe(0.7)
  })

  it('playMusic crossfades: one track at a time, old one is released after its fade', async () => {
    const audio = getAudioManager()
    await audio.playMusic('/a.ogg')
    await audio.playMusic('/b.ogg')
    expect(audio.currentMusic).toBe('/b.ogg')
    expect(mock.liveVoiceGains()).toHaveLength(2) // old still fading

    await vi.advanceTimersByTimeAsync(1100)
    expect(mock.liveVoiceGains()).toHaveLength(1)
    expect(mock.liveSources()).toHaveLength(1)

    audio.stopMusic(0)
    expect(audio.currentMusic).toBeNull()
    expect(mock.liveVoiceGains()).toHaveLength(0)
    expect(mock.liveSources()).toHaveLength(0)
    expect(getAudioState().groupSources.get('music')?.size ?? 0).toBe(0)
  })

  it('playSound is routed through its group, stoppable, and cleans up when stopped', async () => {
    const audio = getAudioManager()
    const s = await audio.playSound('/click.ogg', { group: 'ui' })
    expect(mock.liveSources()).toHaveLength(1)
    audio.stopAll()
    expect(mock.liveSources()).toHaveLength(0)
    s.stop() // idempotent
    expect(mock.liveVoiceGains()).toHaveLength(0)
    expect(getAudioState().groupSources.get('ui')?.size ?? 0).toBe(0)
  })

  it('dispose closes the context and removes listeners, keeps preferences, and audio can start again', async () => {
    const audio = getAudioManager()
    audio.setVolume(0.3)
    await audio.playMusic('/t.ogg')
    const ctx = audio.context as any
    const remove = vi.spyOn(window, 'removeEventListener')

    audio.dispose()
    expect(ctx.close).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function), true)
    expect(audio.state).toBe('none')
    expect(audio.currentMusic).toBeNull()
    expect(mock.liveSources()).toHaveLength(0)

    expect(audio.getVolume()).toBe(0.3)
    await audio.playMusic('/t.ogg', { fade: 0 })
    expect(mock.contexts).toHaveLength(2)
    expect(getGroupGainNode('master').gain.value).toBe(0.3)
  })

  it('recreates the graph if the browser closed the context behind our back', async () => {
    const audio = getAudioManager()
    audio.setVolume(0.6)
    const dead = audio.context as any
    getGroupGainNode('music')
    dead.setState('closed')
    const fresh = audio.context
    expect(fresh).not.toBe(dead)
    expect(getGroupGainNode('master').gain.value).toBe(0.6)
  })
})
