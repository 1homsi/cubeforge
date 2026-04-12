import type { CSSProperties } from 'react'
import type { EntityId } from '@cubeforge/core'
import type { EntityInfo } from '../hooks/useEditorState'

const panelStyle: CSSProperties = {
  background: '#0d1520',
  borderRight: '1px solid #1a2a3a',
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

const listStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '4px 0',
}

function entityRowStyle(selected: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    cursor: 'pointer',
    background: selected ? '#1a3050' : 'transparent',
    borderLeft: selected ? '2px solid #4fc3f7' : '2px solid transparent',
    color: selected ? '#e0f0ff' : '#a0b4c8',
    transition: 'background 80ms',
  }
}

const componentBadgeStyle: CSSProperties = {
  fontSize: 9,
  background: '#1a2a3a',
  color: '#607080',
  borderRadius: 3,
  padding: '1px 4px',
  maxWidth: 60,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export interface SceneHierarchyProps {
  entities: EntityInfo[]
  selectedId: EntityId | null
  onSelect(id: EntityId | null): void
  /** Width of the panel. Default '220px'. */
  width?: number | string
  style?: CSSProperties
}

/**
 * Renders a scrollable list of all entities in the scene. Click to select an
 * entity and inspect its components in the {@link EntityInspector}.
 *
 * @example
 * ```tsx
 * const state = useEditorState()
 * <SceneHierarchy
 *   entities={state.entities}
 *   selectedId={state.selectedId}
 *   onSelect={state.select}
 * />
 * ```
 */
export function SceneHierarchy({ entities, selectedId, onSelect, width = 220, style }: SceneHierarchyProps) {
  return (
    <div style={{ ...panelStyle, width, ...style }}>
      <div style={headerStyle}>Scene Hierarchy</div>
      <div style={{ padding: '4px 10px', borderBottom: '1px solid #1a2a3a', color: '#4a5a6a', fontSize: 10 }}>
        {entities.length} {entities.length === 1 ? 'entity' : 'entities'}
      </div>
      <div style={listStyle}>
        {entities.map((e) => (
          <div
            key={e.id}
            style={entityRowStyle(e.id === selectedId)}
            onClick={() => onSelect(e.id === selectedId ? null : e.id)}
          >
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
              <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                {e.componentTypes.slice(0, 3).map((t) => (
                  <span key={t} style={componentBadgeStyle}>
                    {t}
                  </span>
                ))}
                {e.componentTypes.length > 3 && <span style={componentBadgeStyle}>+{e.componentTypes.length - 3}</span>}
              </div>
            </div>
          </div>
        ))}
        {entities.length === 0 && (
          <div style={{ padding: '10px', color: '#3a5060', fontSize: 11, textAlign: 'center' }}>No entities</div>
        )}
      </div>
    </div>
  )
}
