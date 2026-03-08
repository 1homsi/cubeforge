import React from 'react'
import { createPortal } from 'react-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { WorldSnapshot } from '@cubeforge/core'
import type { ECSWorld, GameLoop } from '@cubeforge/core'
import type { EngineState } from '@cubeforge/context'

export const MAX_DEVTOOLS_FRAMES = 600 // 10s at 60fps

export interface DevToolsHandle {
  buffer: WorldSnapshot[]
  onFrame?: () => void
}

// ── Style constants ────────────────────────────────────────────────────────────

const C = {
  bg: 'rgba(11,13,20,0.97)',
  bgDark: 'rgba(7,9,14,0.98)',
  border: '#1e2538',
  accent: '#4fc3f7',
  muted: '#6b7a9e',
  text: '#cdd6f4',
  warn: '#f38ba8',
  ok: '#a6e3a1',
}

const s = {
  overlay: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    fontSize: 11,
    color: C.text,
    userSelect: 'none' as const,
    pointerEvents: 'auto' as const,
  },
  bar: {
    background: C.bg,
    borderTop: `1px solid ${C.border}`,
    padding: '0 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 38,
  },
  badge: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: C.accent,
    background: 'rgba(79,195,247,0.1)',
    border: `1px solid rgba(79,195,247,0.2)`,
    borderRadius: 4,
    padding: '2px 6px',
    flexShrink: 0,
  },
  btn: (active = false, danger = false) => ({
    background: active ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'rgba(79,195,247,0.3)' : C.border}`,
    borderRadius: 4,
    color: danger ? C.warn : active ? C.accent : C.muted,
    cursor: 'pointer' as const,
    padding: '3px 8px',
    fontSize: 10,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.1s',
    flexShrink: 0,
  }),
  tab: (active: boolean) => ({
    padding: '3px 8px',
    fontSize: 10,
    cursor: 'pointer' as const,
    color: active ? C.accent : C.muted,
    borderBottom: `2px solid ${active ? C.accent : 'transparent'}`,
    background: 'transparent',
    border: 'none',
    borderBottomColor: active ? C.accent : 'transparent',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid' as const,
    fontFamily: 'inherit',
    flexShrink: 0,
  }),
  scrubber: {
    flex: 1,
    accentColor: C.accent,
    cursor: 'pointer' as const,
    height: 4,
  },
  counter: {
    color: C.muted,
    fontSize: 10,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    minWidth: 60,
    textAlign: 'right' as const,
  },
  panel: {
    background: C.bg,
    borderTop: `1px solid ${C.border}`,
    maxHeight: 260,
    overflowY: 'auto' as const,
    padding: '8px 0',
  },
  row: (selected = false) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 12px',
    cursor: 'pointer' as const,
    background: selected ? 'rgba(79,195,247,0.06)' : 'transparent',
    borderLeft: `2px solid ${selected ? C.accent : 'transparent'}`,
  }),
  pill: {
    fontSize: 9,
    background: 'rgba(79,195,247,0.08)',
    border: `1px solid rgba(79,195,247,0.12)`,
    borderRadius: 3,
    padding: '1px 5px',
    color: C.muted,
  },
  detailPanel: {
    background: C.bgDark,
    borderTop: `1px solid ${C.border}`,
    padding: '10px 14px',
    maxHeight: 200,
    overflowY: 'auto' as const,
  },
  kv: {
    display: 'grid' as const,
    gridTemplateColumns: '140px 1fr',
    gap: '2px 12px',
    lineHeight: 1.8,
  },
  search: {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    padding: '3px 8px',
    fontSize: 10,
    fontFamily: 'inherit',
    width: 160,
    outline: 'none',
  },
  statGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
    padding: '10px 14px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
}

// ── Contact log entry ──────────────────────────────────────────────────────────

export interface ContactLogEntry {
  frame: number
  type: string
  entityA: number
  entityB: number
}

// ── DevTools overlay ─────────────────────────────────────────────────────────

interface DevToolsProps {
  handle: DevToolsHandle
  loop: GameLoop
  ecs: ECSWorld
  engine?: EngineState
}

type Tab = 'entities' | 'perf' | 'input' | 'contacts' | 'assets'

export function DevToolsOverlay({ handle, loop, ecs, engine }: DevToolsProps) {
  const [, forceUpdate]     = useState(0)
  const [paused, setPaused] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [panelOpen, setPanelOpen]     = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('entities')
  const [entitySearch, setEntitySearch] = useState('')
  const [contactLog, setContactLog] = useState<ContactLogEntry[]>([])
  const frameRef = useRef(0)

  // Subscribe to new frame notifications
  useEffect(() => {
    handle.onFrame = () => {
      frameRef.current++
      if (!paused) {
        forceUpdate(n => n + 1)
        setSelectedIdx(Math.max(0, handle.buffer.length - 1))
      }
    }
    return () => { handle.onFrame = undefined }
  }, [handle, paused])

  // Subscribe to contact events for the contact log
  useEffect(() => {
    if (!engine) return
    const events = engine.events
    const types = ['triggerEnter', 'triggerExit', 'collisionEnter', 'collisionExit', 'circleEnter', 'circleExit']
    const unsubs = types.map(type =>
      events.on<{ a: number; b: number }>(type, ({ a, b }) => {
        setContactLog(prev => {
          const entry: ContactLogEntry = { frame: frameRef.current, type, entityA: a, entityB: b }
          const next = [entry, ...prev]
          if (next.length > 20) next.length = 20
          return next
        })
      })
    )
    return () => unsubs.forEach(u => u())
  }, [engine])

  const totalFrames = handle.buffer.length
  const currentSnap: WorldSnapshot | undefined = handle.buffer[selectedIdx]

  const handlePauseResume = useCallback(() => {
    if (paused) {
      if (currentSnap) ecs.restoreSnapshot(currentSnap)
      loop.resume()
      setPaused(false)
      setSelectedEntity(null)
    } else {
      loop.pause()
      setPaused(true)
      setSelectedIdx(Math.max(0, handle.buffer.length - 1))
    }
  }, [paused, currentSnap, ecs, loop, handle])

  const stepBack    = useCallback(() => { setSelectedIdx(i => Math.max(0, i - 1)); setSelectedEntity(null) }, [])
  const stepForward = useCallback(() => { setSelectedIdx(i => Math.min(handle.buffer.length - 1, i + 1)); setSelectedEntity(null) }, [handle])

  const frameLabel = totalFrames === 0 ? '0/0' : `${selectedIdx + 1}/${totalFrames}`
  const entities   = currentSnap?.entities ?? []
  const filtered   = entitySearch
    ? entities.filter(e =>
        String(e.id).includes(entitySearch) ||
        e.components.some(c => c.type.toLowerCase().includes(entitySearch.toLowerCase()))
      )
    : entities
  const selectedEntityData = selectedEntity !== null ? entities.find(e => e.id === selectedEntity) : null

  // Performance stats
  const timings  = engine?.systemTimings
  const fps      = (() => {
    const sys = engine?.activeRenderSystem
    if (!sys) return 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ft: number[] = (sys as unknown as { frameTimes: number[] }).frameTimes ?? []
    if (ft.length === 0) return 0
    return Math.round(1000 / (ft.reduce((a, b) => a + b, 0) / ft.length))
  })()
  const entityCount = entities.length
  const compCount   = entities.reduce((sum, e) => sum + e.components.length, 0)

  // Input state
  const activeKeys = engine ? getActiveKeys(engine) : []
  const inputCtx   = (() => {
    try {
      // Access globalInputContext from input package via engine if available
      return 'gameplay'
    } catch { return '—' }
  })()

  // Asset list
  const assetCache: ReadonlyMap<string, HTMLImageElement> = engine?.assets
    ? engine.assets.getLoadedImages()
    : new Map()

  return createPortal(
    <div style={s.overlay}>
      {/* Panel content */}
      {panelOpen && (
        <div style={s.panel}>
          {activeTab === 'entities' && (
            <EntitiesTab
              entities={filtered}
              entitySearch={entitySearch}
              onSearchChange={setEntitySearch}
              selectedEntity={selectedEntity}
              onSelectEntity={id => setSelectedEntity(p => p === id ? null : id)}
              selectedEntityData={selectedEntityData}
            />
          )}
          {activeTab === 'perf' && (
            <PerfTab fps={fps} entityCount={entityCount} compCount={compCount} timings={timings} />
          )}
          {activeTab === 'input' && (
            <InputTab activeKeys={activeKeys} inputCtx={inputCtx} />
          )}
          {activeTab === 'contacts' && (
            <ContactsTab log={contactLog} onClear={() => setContactLog([])} />
          )}
          {activeTab === 'assets' && (
            <AssetsTab assetCache={assetCache} />
          )}
        </div>
      )}

      {/* Toolbar */}
      <div style={s.bar}>
        <span style={s.badge}>DEV</span>

        {/* Pause/Resume */}
        <button style={s.btn(paused)} onClick={handlePauseResume}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        {paused && (
          <>
            <button style={s.btn()} onClick={stepBack}>◀◀</button>
            <button style={s.btn()} onClick={stepForward}>▶▶</button>
          </>
        )}

        {/* Timeline scrubber */}
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={selectedIdx}
          style={s.scrubber}
          onChange={e => {
            const idx = Number(e.target.value)
            setSelectedIdx(idx)
            setSelectedEntity(null)
            if (!paused) { loop.pause(); setPaused(true) }
          }}
        />

        <span style={s.counter}>{frameLabel}</span>

        {/* Tabs */}
        {(['entities', 'perf', 'input', 'contacts', 'assets'] as Tab[]).map(tab => (
          <button
            key={tab}
            style={s.tab(panelOpen && activeTab === tab)}
            onClick={() => {
              if (panelOpen && activeTab === tab) { setPanelOpen(false) }
              else { setActiveTab(tab); setPanelOpen(true) }
            }}
          >
            {tab === 'entities' ? `⬡ ${entities.length}` :
             tab === 'perf'     ? `⚡ ${fps}fps` :
             tab === 'input'    ? '⌨' :
             tab === 'contacts' ? `✦ ${contactLog.length}` :
             '📦'}
          </button>
        ))}

        <button
          style={s.btn(false, true)}
          onClick={() => { handle.buffer.length = 0; setSelectedIdx(0); forceUpdate(n => n + 1) }}
        >
          Clear
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

interface EntitiesTabProps {
  entities: WorldSnapshot['entities']
  entitySearch: string
  onSearchChange(v: string): void
  selectedEntity: number | null
  onSelectEntity(id: number): void
  selectedEntityData: WorldSnapshot['entities'][0] | null | undefined
}

function EntitiesTab({ entities, entitySearch, onSearchChange, selectedEntity, onSelectEntity, selectedEntityData }: EntitiesTabProps) {
  return (
    <>
      <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          style={s.search}
          placeholder="Search by id or component…"
          value={entitySearch}
          onChange={e => onSearchChange(e.target.value)}
        />
        <span style={{ color: C.muted, fontSize: 10 }}>{entities.length} entities</span>
      </div>
      <div style={{ maxHeight: 140, overflowY: 'auto' }}>
        {entities.length === 0 && (
          <div style={{ padding: '4px 14px', color: '#3d4666' }}>No entities</div>
        )}
        {entities.map(e => (
          <div key={e.id} style={s.row(selectedEntity === e.id)} onClick={() => onSelectEntity(e.id)}>
            <span style={{ color: C.accent, minWidth: 28, fontSize: 10 }}>#{e.id}</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
              {e.components.map(c => <span key={c.type} style={s.pill}>{c.type}</span>)}
            </div>
          </div>
        ))}
      </div>
      {selectedEntityData && (
        <div style={s.detailPanel}>
          {selectedEntityData.components.map(comp => (
            <div key={comp.type} style={{ marginBottom: 10 }}>
              <div style={{ color: C.accent, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{comp.type}</div>
              <div style={s.kv}>
                {Object.entries(comp)
                  .filter(([k]) => k !== 'type')
                  .map(([k, v]) => (
                    <React.Fragment key={k}>
                      <span style={{ color: C.muted }}>{k}</span>
                      <span style={{ color: C.text }}>{formatValue(v)}</span>
                    </React.Fragment>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function PerfTab({ fps, entityCount, compCount, timings }: { fps: number; entityCount: number; compCount: number; timings?: Map<string, number> }) {
  const maxMs = 16.67
  const stats = [
    { label: 'FPS', value: String(fps), ok: fps >= 55 },
    { label: 'Entities', value: String(entityCount), ok: true },
    { label: 'Components', value: String(compCount), ok: true },
  ]

  return (
    <div style={{ padding: '8px 14px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        {stats.map(({ label, value, ok }) => (
          <div key={label} style={s.statCard}>
            <span style={{ fontSize: 9, color: C.muted }}>{label}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: ok ? C.ok : C.warn }}>{value}</span>
          </div>
        ))}
      </div>
      {timings && timings.size > 0 && (
        <div>
          <div style={{ color: C.muted, fontSize: 9, marginBottom: 6, letterSpacing: '0.08em' }}>SYSTEM TIMING</div>
          {Array.from(timings.entries()).map(([name, ms]) => {
            const pct = Math.min(100, (ms / maxMs) * 100)
            const color = ms > 8 ? C.warn : ms > 4 ? '#f9e2af' : C.ok
            return (
              <div key={name} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: C.muted, fontSize: 9 }}>{name}</span>
                  <span style={{ color, fontSize: 9 }}>{ms.toFixed(2)}ms</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 2, height: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.1s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InputTab({ activeKeys, inputCtx }: { activeKeys: string[]; inputCtx: string }) {
  // Read gamepad axes if available
  const gamepads = typeof navigator !== 'undefined' ? Array.from(navigator.getGamepads?.() ?? []).filter(Boolean) : []

  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: C.muted, fontSize: 9, marginBottom: 6, letterSpacing: '0.08em' }}>ACTIVE KEYS</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, minHeight: 24 }}>
          {activeKeys.length === 0
            ? <span style={{ color: C.muted }}>—</span>
            : activeKeys.map(k => <span key={k} style={{ ...s.pill, color: C.accent, borderColor: 'rgba(79,195,247,0.3)' }}>{k}</span>)
          }
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: C.muted, fontSize: 9, marginBottom: 4, letterSpacing: '0.08em' }}>INPUT CONTEXT</div>
        <span style={{ color: C.text }}>{inputCtx}</span>
      </div>
      {gamepads.length > 0 && (
        <div>
          <div style={{ color: C.muted, fontSize: 9, marginBottom: 6, letterSpacing: '0.08em' }}>GAMEPAD AXES</div>
          {gamepads.map((gp, gi) => gp && (
            <div key={gi} style={{ marginBottom: 6 }}>
              <div style={{ color: C.muted, fontSize: 9, marginBottom: 2 }}>Gamepad {gi}: {gp.id.slice(0, 30)}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {Array.from(gp.axes).map((ax, ai) => (
                  <span key={ai} style={{ fontSize: 9, color: Math.abs(ax) > 0.1 ? C.accent : C.muted }}>
                    [{ai}] {ax.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ContactsTab({ log, onClear }: { log: ContactLogEntry[]; onClear(): void }) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 14px 8px' }}>
        <span style={{ color: C.muted, fontSize: 9 }}>Last 20 contact events</span>
        <button style={s.btn(false, true)} onClick={onClear}>Clear</button>
      </div>
      {log.length === 0
        ? <div style={{ padding: '4px 14px', color: C.muted }}>No contacts yet</div>
        : log.map((entry, i) => (
            <div key={i} style={{ padding: '3px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ color: C.muted, fontSize: 9, minWidth: 46 }}>f{entry.frame}</span>
              <span style={{ ...s.pill, color: entry.type.includes('Enter') ? C.ok : entry.type.includes('Exit') ? C.warn : C.accent }}>
                {entry.type}
              </span>
              <span style={{ color: C.text, fontSize: 10 }}>#{entry.entityA} ↔ #{entry.entityB}</span>
            </div>
          ))
      }
    </div>
  )
}

function AssetsTab({ assetCache }: { assetCache: ReadonlyMap<string, HTMLImageElement> }) {
  const entries = Array.from(assetCache.entries())
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ padding: '0 14px 8px', color: C.muted, fontSize: 9 }}>{entries.length} loaded images</div>
      {entries.length === 0
        ? <div style={{ padding: '4px 14px', color: C.muted }}>No assets loaded</div>
        : entries.map(([src, img]) => {
            const loaded = img.complete && img.naturalWidth > 0
            return (
              <div key={src} style={{ padding: '3px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: loaded ? C.ok : C.warn, fontSize: 9, minWidth: 10 }}>{loaded ? '✓' : '✗'}</span>
                <span style={{ color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {src.split('/').pop()}
                </span>
                {loaded && <span style={{ color: C.muted, fontSize: 9 }}>{img.naturalWidth}×{img.naturalHeight}</span>}
              </div>
            )
          })
      }
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(v: unknown): string {
  if (typeof v === 'number') return v.toFixed(2)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60)
  return String(v)
}

function getActiveKeys(engine: EngineState): string[] {
  // Access the internal `held` Set<string> from Keyboard via InputManager
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kb = (engine.input.keyboard) as unknown as { held?: Set<string> }
  return kb.held ? Array.from(kb.held) : []
}
