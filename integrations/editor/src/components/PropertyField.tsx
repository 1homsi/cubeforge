import type { CSSProperties } from 'react'

// ── Shared styles ─────────────────────────────────────────────────────────────

const fieldRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 4,
  minHeight: 24,
}

const labelStyle: CSSProperties = {
  flex: '0 0 90px',
  fontSize: 11,
  color: '#8899aa',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'system-ui, sans-serif',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const inputBase: CSSProperties = {
  flex: 1,
  background: '#1a2030',
  border: '1px solid #2a3a50',
  borderRadius: 3,
  color: '#d0e0f0',
  padding: '2px 6px',
  fontSize: 11,
  fontFamily: 'monospace',
  outline: 'none',
  minWidth: 0,
}

// ── Number field ─────────────────────────────────────────────────────────────

interface NumberFieldProps {
  label: string
  value: number
  onChange(value: number): void
  step?: number
}

export function NumberField({ label, value, onChange, step = 1 }: NumberFieldProps) {
  return (
    <div style={fieldRow}>
      <span style={labelStyle} title={label}>
        {label}
      </span>
      <input
        type="number"
        style={inputBase}
        value={isNaN(value) ? '' : value}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(v)
        }}
      />
    </div>
  )
}

// ── Text field ────────────────────────────────────────────────────────────────

interface TextFieldProps {
  label: string
  value: string
  onChange(value: string): void
}

export function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <div style={fieldRow}>
      <span style={labelStyle} title={label}>
        {label}
      </span>
      <input type="text" style={inputBase} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ── Bool field ────────────────────────────────────────────────────────────────

interface BoolFieldProps {
  label: string
  value: boolean
  onChange(value: boolean): void
}

export function BoolField({ label, value, onChange }: BoolFieldProps) {
  return (
    <div style={fieldRow}>
      <span style={labelStyle} title={label}>
        {label}
      </span>
      <input
        type="checkbox"
        checked={value}
        style={{ accentColor: '#4fc3f7', cursor: 'pointer' }}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}

// ── Color field ───────────────────────────────────────────────────────────────

interface ColorFieldProps {
  label: string
  value: string
  onChange(value: string): void
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div style={fieldRow}>
      <span style={labelStyle} title={label}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        <input
          type="color"
          value={value.startsWith('#') ? value.slice(0, 7) : '#ffffff'}
          style={{ width: 28, height: 22, padding: 1, border: '1px solid #2a3a50', borderRadius: 3, cursor: 'pointer' }}
          onChange={(e) => onChange(e.target.value)}
        />
        <input type="text" style={{ ...inputBase, flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

// ── Vector2 field (x/y pair) ──────────────────────────────────────────────────

interface Vec2FieldProps {
  label: string
  x: number
  y: number
  onChangeX(v: number): void
  onChangeY(v: number): void
  step?: number
}

export function Vec2Field({ label, x, y, onChangeX, onChangeY, step = 1 }: Vec2FieldProps) {
  return (
    <div style={fieldRow}>
      <span style={labelStyle} title={label}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        <input
          type="number"
          style={{ ...inputBase, flex: 1 }}
          value={isNaN(x) ? '' : x}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChangeX(v)
          }}
        />
        <input
          type="number"
          style={{ ...inputBase, flex: 1 }}
          value={isNaN(y) ? '' : y}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChangeY(v)
          }}
        />
      </div>
    </div>
  )
}
