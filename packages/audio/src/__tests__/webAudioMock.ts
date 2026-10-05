import { vi } from 'vitest'
import { getAudioState } from '../audioContext'

/** Minimal Web Audio mock that records every node so tests can look for leaks. */
export function installWebAudioMock(opts: { initialState?: 'running' | 'suspended' } = {}) {
  const contexts: any[] = []
  const gains: any[] = []
  const sources: any[] = []

  let userActivated = false
  const gesture = () => {
    userActivated = true
    for (const c of contexts) if (c.pending.length && c.state !== 'running' && c.state !== 'closed') c.activate()
  }
  const GESTURES = ['pointerdown', 'keydown', 'touchend']
  // Capture phase and installed first, so it runs before the engine's unlock listener.
  for (const e of GESTURES) window.addEventListener(e, gesture, true)

  class MockAudioContext {
    state: string = opts.initialState ?? 'suspended'
    currentTime = 0
    destination = { kind: 'destination' }
    listener = {}
    closed = false
    private listeners = new Set<() => void>()
    // Like browsers: resume() stays pending until a user gesture has happened.
    pending: Array<() => void> = []
    resume = vi.fn(() => {
      if (this.state === 'running') return Promise.resolve()
      if (userActivated) {
        this.setState('running')
        return Promise.resolve()
      }
      return new Promise<void>((res) => this.pending.push(res))
    })
    activate() {
      this.setState('running')
      for (const r of this.pending.splice(0)) r()
    }
    close = vi.fn(async () => {
      this.closed = true
      this.setState('closed')
    })
    constructor() {
      contexts.push(this)
    }
    setState(s: string) {
      this.state = s
      for (const l of [...this.listeners]) l()
    }
    addEventListener(type: string, l: () => void) {
      if (type === 'statechange') this.listeners.add(l)
    }
    removeEventListener(type: string, l: () => void) {
      if (type === 'statechange') this.listeners.delete(l)
    }
    createGain() {
      const g: any = {
        gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
        disconnected: false,
        connect: vi.fn(),
        disconnect: vi.fn(() => {
          g.disconnected = true
        }),
      }
      gains.push(g)
      return g
    }
    createBufferSource() {
      const s: any = {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        started: false,
        stopped: false,
        onended: null,
        connect: vi.fn(),
        start: vi.fn(() => {
          s.started = true
        }),
        stop: vi.fn(() => {
          s.stopped = true
        }),
      }
      sources.push(s)
      return s
    }
    decodeAudioData = vi.fn(async () => ({ duration: 1 }))
  }

  vi.stubGlobal('AudioContext', MockAudioContext)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
  )

  return {
    /** Remove the mock's own gesture listeners. */
    uninstall() {
      for (const e of GESTURES) window.removeEventListener(e, gesture, true)
    },
    contexts,
    gains,
    sources,
    /** Voice gains (not the group/master mixer nodes) that are still wired up. */
    liveVoiceGains() {
      const mixer = new Set(getAudioState().groupGainNodes.values())
      return gains.filter((g) => !mixer.has(g) && !g.disconnected)
    },
    liveSources() {
      return sources.filter((s) => s.started && !s.stopped)
    },
  }
}
