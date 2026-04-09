import { useContext, useEffect, useRef, type CSSProperties } from 'react'
import type { EntityId, TransformComponent } from '@cubeforge/core'
import type { Camera2DComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext, type EngineState } from '../context'

export interface EditableTextProps {
  /** Current text value. */
  value: string
  /** Called on every keystroke with the new value. */
  onChange: (next: string) => void
  /** Called when the user presses Enter (single-line mode) or Ctrl+Enter (multiline). */
  onSubmit?: (value: string) => void
  /** Called when the input loses focus. */
  onBlur?: (value: string) => void
  /** Width of the input in world units. Default 200. */
  width?: number
  /** Height of the input in world units. Default 40. */
  height?: number
  /** Font size in world units. Default 16. */
  fontSize?: number
  /** CSS font family. Default 'inherit'. */
  fontFamily?: string
  /** Text color. Default '#ffffff'. */
  color?: string
  /** Background color. Default 'transparent'. */
  background?: string
  /** Border. Default 'none'. */
  border?: string
  /** Padding in CSS pixels. Default 4. */
  padding?: number
  /** Text alignment. Default 'left'. */
  align?: 'left' | 'center' | 'right'
  /** Placeholder text when empty. */
  placeholder?: string
  /** Maximum number of characters. */
  maxLength?: number
  /** If true, renders a `<textarea>` instead of an `<input>`. */
  multiline?: boolean
  /** If true, the input auto-focuses when mounted. */
  autoFocus?: boolean
  /** Disable the input. */
  disabled?: boolean
}

/**
 * A canvas-positioned editable text field backed by a real HTML `<input>` or
 * `<textarea>` overlaid on the game canvas. Position follows the entity's
 * Transform and the active Camera2D every frame.
 *
 * Essential for word games, name entry, level editor labels, form-shaped UIs,
 * and anywhere you'd otherwise try to reinvent text input inside WebGL.
 *
 * @example
 * ```tsx
 * function NameCard({ name, setName }: { name: string; setName: (s: string) => void }) {
 *   return (
 *     <Entity>
 *       <Transform x={100} y={100} />
 *       <EditableText
 *         value={name}
 *         onChange={setName}
 *         width={220}
 *         height={40}
 *         background="#1e2a3a"
 *         color="#e0e7f1"
 *         placeholder="Your name"
 *         autoFocus
 *       />
 *     </Entity>
 *   )
 * }
 * ```
 */
export function EditableText({
  value,
  onChange,
  onSubmit,
  onBlur,
  width = 200,
  height = 40,
  fontSize = 16,
  fontFamily = 'inherit',
  color = '#ffffff',
  background = 'transparent',
  border = 'none',
  padding = 4,
  align = 'left',
  placeholder,
  maxLength,
  multiline = false,
  autoFocus = false,
  disabled = false,
}: EditableTextProps) {
  const engine = useContext(EngineContext)
  const entityId = useContext(EntityContext)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Keep the input positioned over the entity each frame (standalone rAF so we
  // don't wake the onDemand engine loop just for overlay position updates).
  useEffect(() => {
    if (!engine || entityId === null || entityId === undefined) return
    const container = containerRef.current
    if (!container) return
    let rafId = 0
    const tick = () => {
      const t = engine.ecs.getComponent<TransformComponent>(entityId as EntityId, 'Transform')
      if (t) {
        const screen = worldToScreenCss(engine, t.x, t.y)
        if (screen) {
          const zoom = screen.zoom
          const cssW = width * zoom
          const cssH = height * zoom
          container.style.display = 'block'
          container.style.left = `${screen.x - cssW / 2}px`
          container.style.top = `${screen.y - cssH / 2}px`
          container.style.width = `${cssW}px`
          container.style.height = `${cssH}px`
          container.style.transform = `rotate(${t.rotation}rad)`
          container.style.fontSize = `${fontSize * zoom}px`
        } else {
          container.style.display = 'none'
        }
      }
      // Also anchor the container to the canvas element's position
      const rect = engine.canvas.getBoundingClientRect()
      container.style.setProperty('--cubeforge-canvas-left', `${rect.left + window.scrollX}px`)
      container.style.setProperty('--cubeforge-canvas-top', `${rect.top + window.scrollY}px`)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [engine, entityId, width, height, fontSize])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  if (!engine) return null

  const commonStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    fontSize: 'inherit',
    fontFamily,
    color,
    background,
    border,
    padding,
    textAlign: align,
    outline: 'none',
    resize: 'none',
    boxSizing: 'border-box',
    margin: 0,
  }

  const containerStyle: CSSProperties = {
    position: 'fixed',
    transformOrigin: 'center center',
    zIndex: 9999,
    display: 'none',
    // Anchor at the canvas position, which is updated via CSS variable on every tick.
    // Using left/top directly keeps things simple; the rAF loop sets them.
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (multiline) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onSubmit?.(value)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit?.(value)
    }
  }

  return (
    <div ref={containerRef} style={containerStyle}>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={(e) => onBlur?.(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          style={commonStyle}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={(e) => onBlur?.(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          style={commonStyle}
        />
      )}
    </div>
  )
}

function worldToScreenCss(engine: EngineState, wx: number, wy: number): { x: number; y: number; zoom: number } | null {
  const canvas = engine.canvas
  const rect = canvas.getBoundingClientRect()
  const camId = engine.ecs.queryOne('Camera2D')
  if (camId === undefined) {
    return { x: rect.left + canvas.clientWidth / 2 + wx, y: rect.top + canvas.clientHeight / 2 + wy, zoom: 1 }
  }
  const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')
  if (!cam) return null
  const zoom = cam.zoom
  const x = rect.left + canvas.clientWidth / 2 + (wx - cam.x) * zoom
  const y = rect.top + canvas.clientHeight / 2 + (wy - cam.y) * zoom
  return { x, y, zoom }
}
