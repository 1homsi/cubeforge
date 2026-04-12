import { type CSSProperties, type ReactNode } from 'react'
import { SceneHierarchy } from './SceneHierarchy'
import { EntityInspector } from './EntityInspector'
import { useEditorState } from '../hooks/useEditorState'

export interface EditorShellProps {
  /**
   * The game content — your `<Game>` tree (or whatever renders the canvas).
   * Rendered in the center viewport column.
   */
  children: ReactNode
  /**
   * Whether the editor panels are visible. Default true.
   * Set to false to show the game fullscreen without editor UI.
   */
  active?: boolean
  /** Width of the hierarchy panel. Default 220. */
  hierarchyWidth?: number
  /** Width of the inspector panel. Default 260. */
  inspectorWidth?: number
  /** Additional style for the outer shell container. */
  style?: CSSProperties
}

/**
 * An all-in-one editor layout that wraps a CubeForge `<Game>` with a scene
 * hierarchy panel on the left and a component inspector on the right.
 *
 * Must be placed **inside** `<Game>` so it can read from `EngineContext`.
 * In practice, put it as the first child of your `<Game>`:
 *
 * ```tsx
 * <Game width={800} height={600}>
 *   <EditorShell>
 *     {null} {/* children rendered as a sibling to the Game canvas *\/}
 *   </EditorShell>
 *   <Player />
 *   <Level />
 * </Game>
 * ```
 *
 * Or use it as a full-page wrapper (place Game inside EditorShell — but note
 * this requires EditorShell to be inside a Game context):
 *
 * @example
 * ```tsx
 * // Full page editor with Game and EditorShell both rendering inside a Game context:
 * function App() {
 *   return (
 *     <Game width={800} height={600} style={{ position: 'relative' }}>
 *       <EditorShell active={process.env.NODE_ENV === 'development'}>
 *         {null}
 *       </EditorShell>
 *       <Player />
 *       <Camera2D followEntity="player" />
 *     </Game>
 *   )
 * }
 * ```
 */
export function EditorShell({
  children,
  active = true,
  hierarchyWidth = 220,
  inspectorWidth = 260,
  style,
}: EditorShellProps) {
  const state = useEditorState()
  const selectedEntity = state.entities.find((e) => e.id === state.selectedId) ?? null

  if (!active) {
    return <>{children}</>
  }

  const shellStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'row',
    pointerEvents: 'none',
    zIndex: 200,
    ...style,
  }

  const sideStyle: CSSProperties = {
    pointerEvents: 'auto',
    flexShrink: 0,
    height: '100%',
    overflow: 'hidden',
  }

  return (
    <div style={shellStyle}>
      {/* Left: Hierarchy */}
      <div style={sideStyle}>
        <SceneHierarchy
          entities={state.entities}
          selectedId={state.selectedId}
          onSelect={state.select}
          width={hierarchyWidth}
          style={{ height: '100%' }}
        />
      </div>

      {/* Center: viewport spacer (the canvas is behind this overlay) */}
      <div style={{ flex: 1, pointerEvents: 'none' }}>{children}</div>

      {/* Right: Inspector */}
      <div style={sideStyle}>
        <EntityInspector
          entity={selectedEntity}
          components={state.selectedComponents}
          width={inspectorWidth}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}
