import React from 'react'
import { createPortal } from 'react-dom'
import { useState, useEffect, useCallback } from 'react'
import type { WorldSnapshot } from '@cubeforge/core'
import type { ECSWorld, GameLoop } from '@cubeforge/core'

export const MAX_DEVTOOLS_FRAMES = 600 // 10s at 60fps

export interface DevToolsHandle {
  buffer: WorldSnapshot[]
  onFrame?: () => void
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const css = {
  overlay: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    fontSize: 11,
    color: '#cdd6f4',
    userSelect: 'none' as const,
    pointerEvents: 'auto' as const,
  },
  bar: {
    background: 'rgba(11,13,20,0.97)',
    borderTop: '1px solid #2a3048',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 40,
  },
  badge: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#4fc3f7',
    background: 'rgba(79,195,247,0.1)',
    border: '1px solid rgba(79,195,247,0.2)',
    borderRadius: 4,
    padding: '2px 6px',
    flexShrink: 0,
  },
  btn: (active = false, danger = false) => ({
    background: active ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'rgba(79,195,247,0.3)' : '#2a3048'}`,
    borderRadius: 4,
    color: danger ? '#f38ba8' : active ? '#4fc3f7' : '#6b7a9e',
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
  scrubber: {
    flex: 1,
    accentColor: '#4fc3f7',
    cursor: 'pointer' as const,
    height: 4,
  },
  counter: {
    color: '#6b7a9e',
    fontSize: 10,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    minWidth: 80,
    textAlign: 'right' as const,
  },
  panel: {
    background: 'rgba(11,13,20,0.97)',
    borderTop: '1px solid #1f2435',
    maxHeight: 260,
    overflowY: 'auto' as const,
    padding: '8px 0',
  },
  entityRow: (selected: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 12px',
    cursor: 'pointer' as const,
    background: selected ? 'rgba(79,195,247,0.06)' : 'transparent',
    borderLeft: `2px solid ${selected ? '#4fc3f7' : 'transparent'}`,
  }),
  entityId: {
    color: '#4fc3f7',
    minWidth: 28,
    fontSize: 10,
  },
  compPill: {
    fontSize: 9,
    background: 'rgba(79,195,247,0.08)',
    border: '1px solid rgba(79,195,247,0.12)',
    borderRadius: 3,
    padding: '1px 5px',
    color: '#6b7a9e',
  },
  detailPanel: {
    background: 'rgba(18,21,31,0.98)',
    borderTop: '1px solid #1f2435',
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
  key: { color: '#6b7a9e' },
  val: { color: '#cdd6f4' },
}

// ── DevTools overlay ─────────────────────────────────────────────────────────

interface DevToolsProps {
  handle: DevToolsHandle
  loop: GameLoop
  ecs: ECSWorld
}

export function DevToolsOverlay({ handle, loop, ecs }: DevToolsProps) {
  const [, forceUpdate]     = useState(0)
  const [paused, setPaused] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [panelOpen, setPanelOpen]     = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null)

  // Subscribe to new frame notifications
  useEffect(() => {
    handle.onFrame = () => {
      if (!paused) {
        forceUpdate(n => n + 1)
        setSelectedIdx(Math.max(0, handle.buffer.length - 1))
      }
    }
    return () => { handle.onFrame = undefined }
  }, [handle, paused])

  const totalFrames = handle.buffer.length
  const currentSnap: WorldSnapshot | undefined = handle.buffer[selectedIdx]

  const handlePauseResume = useCallback(() => {
    if (paused) {
      // Restore the selected snapshot and resume from there
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

  const stepBack = useCallback(() => {
    setSelectedIdx(i => Math.max(0, i - 1))
    setSelectedEntity(null)
  }, [])

  const stepForward = useCallback(() => {
    setSelectedIdx(i => Math.min(handle.buffer.length - 1, i + 1))
    setSelectedEntity(null)
  }, [handle])

  const frameLabel = totalFrames === 0
    ? '0 / 0'
    : `${selectedIdx + 1} / ${totalFrames}`

  const entities = currentSnap?.entities ?? []
  const selectedEntityData = selectedEntity !== null
    ? entities.find(e => e.id === selectedEntity)
    : null

  return createPortal(
    <div style={css.overlay}>
      {/* Entity inspector panel */}
      {panelOpen && paused && (
        <>
          {/* Entity list */}
          <div style={css.panel}>
            {entities.length === 0 && (
              <div style={{ padding: '4px 14px', color: '#3d4666' }}>No entities</div>
            )}
            {entities.map(e => (
              <div
                key={e.id}
                style={css.entityRow(selectedEntity === e.id)}
                onClick={() => setSelectedEntity(s => s === e.id ? null : e.id)}
              >
                <span style={css.entityId}>#{e.id}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                  {e.components.map(c => (
                    <span key={c.type} style={css.compPill}>{c.type}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Component detail */}
          {selectedEntityData && (
            <div style={css.detailPanel}>
              {selectedEntityData.components.map(comp => (
                <div key={comp.type} style={{ marginBottom: 10 }}>
                  <div style={{ color: '#4fc3f7', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                    {comp.type}
                  </div>
                  <div style={css.kv}>
                    {Object.entries(comp)
                      .filter(([k]) => k !== 'type')
                      .map(([k, v]) => (
                        <React.Fragment key={k}>
                          <span style={css.key}>{k}</span>
                          <span style={css.val}>{formatValue(v)}</span>
                        </React.Fragment>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Main toolbar bar */}
      <div style={css.bar}>
        <span style={css.badge}>DEVTOOLS</span>

        {/* Pause/Resume */}
        <button style={css.btn(paused)} onClick={handlePauseResume}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        {/* Step buttons — only when paused */}
        {paused && (
          <>
            <button style={css.btn()} onClick={stepBack}>◀◀</button>
            <button style={css.btn()} onClick={stepForward}>▶▶</button>
          </>
        )}

        {/* Timeline scrubber */}
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={selectedIdx}
          style={css.scrubber}
          onChange={e => {
            const idx = Number(e.target.value)
            setSelectedIdx(idx)
            setSelectedEntity(null)
            if (!paused) {
              loop.pause()
              setPaused(true)
            }
          }}
        />

        {/* Frame counter */}
        <span style={css.counter}>{frameLabel}</span>

        {/* Entity inspector toggle */}
        {paused && (
          <button
            style={css.btn(panelOpen)}
            onClick={() => setPanelOpen(o => !o)}
          >
            {panelOpen ? '▾' : '▸'} Entities ({entities.length})
          </button>
        )}

        {/* Clear buffer */}
        <button
          style={css.btn(false, true)}
          onClick={() => { handle.buffer.length = 0; setSelectedIdx(0); forceUpdate(n => n + 1) }}
        >
          Clear
        </button>
      </div>
    </div>,
    document.body
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

