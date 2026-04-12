import { type CSSProperties } from 'react'
import type { Component } from '@cubeforge/core'
import type { EntityInfo } from '../hooks/useEditorState'
import { NumberField, TextField, BoolField, ColorField, Vec2Field } from './PropertyField'

// ── Panel chrome ──────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: '#0d1520',
  borderLeft: '1px solid #1a2a3a',
  color: '#c0d0e0',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  userSelect: 'none',
}

const headerStyle: CSSProperties = {
  padding: '6px 10px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: '#4fc3f7',
  borderBottom: '1px solid #1a2a3a',
  flexShrink: 0,
}

const scrollStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '6px 0',
}

const componentSectionStyle: CSSProperties = {
  marginBottom: 2,
  borderBottom: '1px solid #131d2a',
}

const componentHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 10px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color: '#80a8c0',
  cursor: 'default',
  background: '#0f1a28',
}

const fieldsStyle: CSSProperties = {
  padding: '4px 10px 6px',
}

// ── Component renderer ────────────────────────────────────────────────────────

function isColorKey(key: string): boolean {
  const lower = key.toLowerCase()
  return (
    lower === 'color' || lower === 'background' || lower === 'fill' || lower === 'stroke' || lower.includes('color')
  )
}

/**
 * Renders a single ECS component's fields as editable property fields.
 * Supported field types: number, string (with color detection), boolean,
 * x/y vector pairs.
 */
function ComponentSection({ comp }: { comp: Component }) {
  const compRecord = comp as unknown as Record<string, unknown>
  const entries = Object.entries(comp).filter(([k]) => k !== 'type')

  // Track which keys we've already rendered (to skip y after x pair)
  const rendered = new Set<string>()

  return (
    <div style={componentSectionStyle}>
      <div style={componentHeaderStyle}>{comp.type}</div>
      <div style={fieldsStyle}>
        {entries.map(([key, val]) => {
          if (rendered.has(key)) return null

          // Numeric x/y pair → Vec2Field
          if (key === 'x' && typeof val === 'number' && typeof compRecord['y'] === 'number') {
            rendered.add('x')
            rendered.add('y')
            return (
              <Vec2Field
                key="xy"
                label="pos"
                x={val}
                y={compRecord['y'] as number}
                step={0.5}
                onChangeX={(v) => {
                  compRecord['x'] = v
                }}
                onChangeY={(v) => {
                  compRecord['y'] = v
                }}
              />
            )
          }

          if (key === 'followOffsetX' && typeof val === 'number') {
            const oy = compRecord['followOffsetY']
            if (typeof oy === 'number') {
              rendered.add('followOffsetX')
              rendered.add('followOffsetY')
              return (
                <Vec2Field
                  key="followOffset"
                  label="offset"
                  x={val}
                  y={oy}
                  step={1}
                  onChangeX={(v) => {
                    compRecord['followOffsetX'] = v
                  }}
                  onChangeY={(v) => {
                    compRecord['followOffsetY'] = v
                  }}
                />
              )
            }
          }

          if (typeof val === 'number') {
            rendered.add(key)
            return (
              <NumberField
                key={key}
                label={key}
                value={val}
                step={Math.abs(val) < 2 ? 0.01 : 1}
                onChange={(v) => {
                  compRecord[key] = v
                }}
              />
            )
          }

          if (typeof val === 'string' && isColorKey(key)) {
            rendered.add(key)
            return (
              <ColorField
                key={key}
                label={key}
                value={val}
                onChange={(v) => {
                  compRecord[key] = v
                }}
              />
            )
          }

          if (typeof val === 'string') {
            rendered.add(key)
            return (
              <TextField
                key={key}
                label={key}
                value={val}
                onChange={(v) => {
                  compRecord[key] = v
                }}
              />
            )
          }

          if (typeof val === 'boolean') {
            rendered.add(key)
            return (
              <BoolField
                key={key}
                label={key}
                value={val}
                onChange={(v) => {
                  compRecord[key] = v
                }}
              />
            )
          }

          // Arrays, objects, functions — show as read-only JSON preview
          if (val !== null && val !== undefined && typeof val !== 'function') {
            rendered.add(key)
            const preview = typeof val === 'object' ? JSON.stringify(val).slice(0, 60) : String(val)
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: 4,
                  fontSize: 11,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    flex: '0 0 90px',
                    color: '#6a7a8a',
                    textTransform: 'uppercase',
                    fontSize: 10,
                    letterSpacing: 0.5,
                    paddingTop: 2,
                  }}
                >
                  {key}
                </span>
                <span
                  style={{ flex: 1, color: '#506070', fontFamily: 'monospace', wordBreak: 'break-all', fontSize: 10 }}
                >
                  {preview}
                </span>
              </div>
            )
          }

          return null
        })}
        {entries.length === 0 && <div style={{ color: '#3a5060', fontSize: 10 }}>No fields</div>}
      </div>
    </div>
  )
}

// ── EntityInspector component ─────────────────────────────────────────────────

export interface EntityInspectorProps {
  entity: EntityInfo | null
  components: readonly Component[]
  /** Width of the panel. Default '260px'. */
  width?: number | string
  style?: CSSProperties
}

/**
 * Renders all components of the selected entity as editable property fields.
 * Changes are applied directly to the live ECS component — no save step needed.
 *
 * @example
 * ```tsx
 * const state = useEditorState()
 * const selected = state.entities.find(e => e.id === state.selectedId) ?? null
 * <EntityInspector entity={selected} components={state.selectedComponents} />
 * ```
 */
export function EntityInspector({ entity, components, width = 260, style }: EntityInspectorProps) {
  return (
    <div style={{ ...panelStyle, width, ...style }}>
      <div style={headerStyle}>Inspector</div>
      {entity ? (
        <>
          <div
            style={{
              padding: '6px 10px',
              borderBottom: '1px solid #1a2a3a',
              color: '#d0e0f0',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {entity.name}
            <span style={{ color: '#4a6070', fontSize: 10, marginLeft: 6 }}>#{entity.id}</span>
          </div>
          <div style={scrollStyle}>
            {components.map((comp) => (
              <ComponentSection key={comp.type} comp={comp} />
            ))}
            {components.length === 0 && (
              <div style={{ padding: '10px', color: '#3a5060', fontSize: 11, textAlign: 'center' }}>No components</div>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2a4050',
            fontSize: 11,
          }}
        >
          Select an entity
        </div>
      )}
    </div>
  )
}
