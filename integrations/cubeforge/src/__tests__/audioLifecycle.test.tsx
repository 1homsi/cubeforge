// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode, useContext, useEffect, type ReactNode } from 'react'
import { render, act } from '@testing-library/react'

vi.mock('@cubeforge/renderer', async (orig) => {
  const actual = await orig<typeof import('@cubeforge/renderer')>()
  class RenderSystem {
    update() {}
    setDefaultSampling() {}
    dispose() {}
  }
  return { ...actual, RenderSystem }
})

import { installWebAudioMock } from '../../../../packages/audio/src/__tests__/webAudioMock'
import { Game } from '../components/Game'
import { EngineContext } from '../context'
import { getAudioManager, useMusic, useSound, setMasterVolume, getMasterVolume } from '../index'

// A tree that keeps an app-level soundtrack outside <Game> and lets the test
// unmount / remount the Game (e.g. a new save, a scene change, HMR).
function App({ gameKey, children, strict }: { gameKey: number | null; children?: ReactNode; strict?: boolean }) {
  const tree = (
    <>
      {gameKey !== null && (
        <Game key={gameKey} asyncAssets>
          {children}
        </Game>
      )}
    </>
  )
  return strict ? <StrictMode>{tree}</StrictMode> : tree
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('audio lifecycle across <Game> remounts', () => {
  let mock: ReturnType<typeof installWebAudioMock>
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    mock = installWebAudioMock()
  })
  afterEach(() => {
    mock.uninstall()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('(a) a module-level soundtrack keeps playing across Game unmount and remount', async () => {
    const audio = getAudioManager()
    await audio.playMusic('/theme.ogg', { fade: 0 })
    const track = mock.sources[0]
    expect(track.started).toBe(true)

    let r!: ReturnType<typeof render>
    await act(async () => {
      r = render(<App gameKey={1} />)
    })
    r.rerender(<App gameKey={null} />) // Game unmounted
    await flush()
    expect(track.stopped).toBe(false)
    expect(audio.currentMusic).toBe('/theme.ogg')

    await act(async () => {
      r.rerender(<App gameKey={2} />) // new Game
    })
    r.rerender(<App gameKey={3} />) // and another remount via key change
    await flush()
    expect(track.stopped).toBe(false)
    expect(mock.liveSources()).toEqual([track])
    expect(mock.sources).toHaveLength(1) // never restarted
  })

  it('(a) an app-level useMusic keeps playing, even when a component inside Game also uses useMusic', async () => {
    function AppSoundtrack() {
      const music = useMusic('/theme.ogg', { volume: 0.5 })
      useEffect(() => {
        music.play(0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    }
    // Used only for its volume control: unmounting it must not stop the app's track.
    function InGameHook() {
      useMusic('/theme.ogg')
      return null
    }
    let r!: ReturnType<typeof render>
    await act(async () => {
      r = render(
        <>
          <AppSoundtrack />
          <App gameKey={1}>
            <InGameHook />
          </App>
        </>,
      )
    })
    await flush()
    const track = mock.sources[0]
    expect(track.started).toBe(true)

    r.rerender(
      <>
        <AppSoundtrack />
        <App gameKey={null} />
      </>,
    )
    await vi.advanceTimersByTimeAsync(1200)
    expect(track.stopped).toBe(false)
    expect(getAudioManager().currentMusic).toBe('/theme.ogg')

    // The hook's own component unmounting does stop what it started.
    r.unmount()
    await vi.advanceTimersByTimeAsync(1200)
    expect(track.stopped).toBe(true)
    expect(mock.liveVoiceGains()).toHaveLength(0)
  })

  it('(a) music started inside Game stops with its component, `persistent` keeps it', async () => {
    function Inside({ persistent }: { persistent: boolean }) {
      const m = useMusic('/level.ogg', { persistent })
      useEffect(() => {
        m.play(0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    }
    let r!: ReturnType<typeof render>
    await act(async () => {
      r = render(
        <App gameKey={1}>
          <Inside persistent={false} />
        </App>,
      )
    })
    await flush()
    expect(mock.liveSources()).toHaveLength(1)
    r.rerender(<App gameKey={null} />)
    await vi.advanceTimersByTimeAsync(1200)
    expect(mock.liveSources()).toHaveLength(0)

    await act(async () => {
      r.rerender(
        <App gameKey={2}>
          <Inside persistent />
        </App>,
      )
    })
    await flush()
    expect(mock.liveSources()).toHaveLength(1)
    r.rerender(<App gameKey={null} />)
    await vi.advanceTimersByTimeAsync(1200)
    expect(mock.liveSources()).toHaveLength(1)
    expect(getAudioManager().currentMusic).toBe('/level.ogg')
  })

  it('(a) useSound persistent: a looping sound outlives its component; default stops it', async () => {
    let controls!: ReturnType<typeof useSound>
    function Loop({ persistent }: { persistent: boolean }) {
      controls = useSound('/wind.ogg', { loop: true, persistent })
      return null
    }
    for (const persistent of [false, true]) {
      let r!: ReturnType<typeof render>
      await act(async () => {
        r = render(<Loop persistent={persistent} />)
      })
      await flush() // buffer decoded
      act(() => controls.play())
      expect(mock.liveSources()).toHaveLength(1)
      r.unmount()
      expect(mock.liveSources()).toHaveLength(persistent ? 1 : 0)
      getAudioManager().stopAll()
      expect(mock.liveSources()).toHaveLength(0)
    }
  })

  it('(b) one shared AudioContext across every Game mount, resumed on first gesture', async () => {
    // A Game that also preloads audio gets the engine AssetManager's own context.
    function Preloader() {
      const e = useContext(EngineContext)!
      useEffect(() => {
        void e.assets.loadAudio('/x.wav')
      }, [e])
      return null
    }
    const audio = getAudioManager()
    const shared = audio.context
    let r!: ReturnType<typeof render>
    for (let i = 1; i <= 3; i++) {
      await act(async () => {
        if (i === 1)
          r = render(
            <App gameKey={i} strict>
              <Preloader />
            </App>,
          )
        else
          r.rerender(
            <App gameKey={i} strict>
              <Preloader />
            </App>,
          )
      })
      await flush()
      expect(audio.context).toBe(shared)
    }
    // Game owns (and closes) only the context of its own AssetManager.
    expect(shared.close).not.toHaveBeenCalled()
    expect(mock.contexts.filter((c) => !c.closed)).toContain(shared)
    const engineContexts = mock.contexts.filter((c) => c !== shared)
    for (const c of engineContexts.slice(0, -1)) expect(c.closed).toBe(true)
    r.unmount()
    expect(engineContexts.every((c) => c.closed)).toBe(true)
    expect((shared as unknown as { closed: boolean }).closed).toBe(false)

    expect(shared.state).toBe('suspended')
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    expect(shared.state).toBe('running')
  })

  it('(c) master volume, mute and group volumes persist across Game remounts (StrictMode too)', async () => {
    const audio = getAudioManager()
    audio.setVolume(0.35)
    setMasterVolume(0.35)
    audio.setGroupVolume('music', 0.6)
    audio.setGroupMuted('sfx', true)
    let r!: ReturnType<typeof render>
    for (let i = 1; i <= 3; i++) {
      await act(async () => {
        if (i === 1) r = render(<App gameKey={i} strict />)
        else r.rerender(<App gameKey={i} strict />)
      })
    }
    r.rerender(<App gameKey={null} />)
    await flush()
    expect(getMasterVolume()).toBe(0.35)
    expect(audio.getGroupVolume('music')).toBe(0.6)
    expect(audio.isGroupMuted('sfx')).toBe(true)

    audio.setMuted(true)
    await act(async () => {
      r.rerender(<App gameKey={9} />)
    })
    expect(audio.muted).toBe(true)
    expect(audio.getVolume()).toBe(0.35)
    audio.setMuted(false)
    expect(audio.muted).toBe(false)
  })

  it('(d) no leaked nodes or listeners after Game unmounts', async () => {
    const audio = getAudioManager()
    let voice!: ReturnType<typeof useSound>
    function Voice() {
      voice = useSound('/blip.ogg')
      return null
    }
    const winAdd = vi.spyOn(window, 'addEventListener')
    const winRemove = vi.spyOn(window, 'removeEventListener')
    const docAdd = vi.spyOn(document, 'addEventListener')
    const docRemove = vi.spyOn(document, 'removeEventListener')
    audio.setVolume(1) // touch audio before the Game mounts
    const baseline = {
      win: winAdd.mock.calls.length - winRemove.mock.calls.length,
      doc: docAdd.mock.calls.length - docRemove.mock.calls.length,
    }

    let r!: ReturnType<typeof render>
    for (let i = 1; i <= 3; i++) {
      await act(async () => {
        if (i === 1)
          r = render(
            <App gameKey={i} strict>
              <Voice />
            </App>,
          )
        else
          r.rerender(
            <App gameKey={i} strict>
              <Voice />
            </App>,
          )
      })
      await flush() // buffer decoded
      act(() => voice.play())
      expect(mock.liveSources()).toHaveLength(1)
    }
    r.unmount()
    await vi.advanceTimersByTimeAsync(1200)

    expect(mock.sources.length).toBeGreaterThanOrEqual(3)
    expect(mock.liveVoiceGains()).toHaveLength(0)
    expect(mock.liveSources()).toHaveLength(0)
    // Listener balance is back to what it was before any Game existed.
    expect({
      win: winAdd.mock.calls.length - winRemove.mock.calls.length,
      doc: docAdd.mock.calls.length - docRemove.mock.calls.length,
    }).toEqual(baseline)
    // Only the shared context's single pending-unlock set remains.
    const unlock = winAdd.mock.calls.filter(([t]) => t === 'pointerdown')
    expect(unlock.length - winRemove.mock.calls.filter(([t]) => t === 'pointerdown').length).toBeLessThanOrEqual(1)
  })
})
