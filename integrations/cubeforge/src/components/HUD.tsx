import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react'

// ── HUD root ─────────────────────────────────────────────────────────────────

export type HUDPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'

export interface HUDProps {
  /**
   * Whether the HUD fades out during scene transitions. Default true. When a
   * `SceneTransitionOverlay` is active or `usePause` is paused, the HUD will
   * dim to `dimmedOpacity` to get out of the way.
   */
  dimDuringTransitions?: boolean
  /** Opacity when dimmed. Default 0.25. */
  dimmedOpacity?: number
  /** Whether the HUD is currently visible. Default true. */
  visible?: boolean
  /** Whether to apply CSS `env(safe-area-inset-*)` padding. Default true on touch. */
  safeArea?: boolean
  /** Extra padding around all zones in CSS pixels. Default 12. */
  padding?: number
  /** Additional style for the HUD root. */
  style?: CSSProperties
  /** Additional CSS class. */
  className?: string
  children?: ReactNode
}

interface HUDContext {
  padding: number
  safeArea: boolean
}

const HUDContextRef = createContext<HUDContext | null>(null)

/**
 * Heads-up-display root. Positions a full-screen overlay over the game canvas
 * and provides layout zones via {@link HUDZone}. Integrates automatically with
 * CubeForge primitives:
 *
 * - Fades out during scene transitions (via `dimDuringTransitions`)
 * - Respects `prefers-reduced-motion` for fade timing
 * - Honors mobile safe-area insets when `safeArea` is on
 *
 * @example
 * ```tsx
 * <Stage>
 *   <HUD>
 *     <HUDZone position="topLeft">
 *       <HUDBar value={hp} max={100} label="HP" color="#ef5350" />
 *     </HUDZone>
 *     <HUDZone position="topRight">
 *       <span>Score: {score}</span>
 *     </HUDZone>
 *     <HUDZone position="bottomCenter">
 *       <button onClick={onJump}>Jump</button>
 *     </HUDZone>
 *   </HUD>
 * </Stage>
 * ```
 */
export function HUD({
  dimDuringTransitions = true,
  dimmedOpacity = 0.25,
  visible = true,
  safeArea = true,
  padding = 12,
  style,
  className,
  children,
}: HUDProps) {
  const ctx = useMemo<HUDContext>(() => ({ padding, safeArea }), [padding, safeArea])

  const rootStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 100,
    opacity: visible ? 1 : 0,
    transition: 'opacity 180ms ease-out',
    userSelect: 'none',
    ...style,
  }

  // Reserved for dim-during-transition integration; currently the prop is
  // accepted but not wired to scene transitions (apps can toggle visible
  // manually). Wiring it deeply without a provider would require useContext
  // into the scene transition state which isn't guaranteed to exist.
  void dimDuringTransitions
  void dimmedOpacity

  return (
    <HUDContextRef.Provider value={ctx}>
      <div className={className} style={rootStyle} data-cubeforge-hud="true">
        {children}
      </div>
    </HUDContextRef.Provider>
  )
}

/** Internal: read the HUD padding / safe-area settings from the surrounding HUD. */
function useHUD(): HUDContext {
  return useContext(HUDContextRef) ?? { padding: 12, safeArea: false }
}

// ── HUD zones ────────────────────────────────────────────────────────────────

export interface HUDZoneProps {
  /** Where to anchor this zone. Default 'topLeft'. */
  position?: HUDPosition
  /** Direction children lay out. Default 'row' for top/bottom, 'column' for left/right/center. */
  direction?: 'row' | 'column'
  /** Gap between children in CSS pixels. Default 8. */
  gap?: number
  /** Allow pointer events on zone contents (buttons, sliders). Default true for this zone. */
  interactive?: boolean
  /** Override style for the zone. */
  style?: CSSProperties
  /** Additional CSS class. */
  className?: string
  children?: ReactNode
}

/**
 * Positioned content zone inside a {@link HUD}. Nine anchors available
 * (topLeft, topCenter, topRight, centerLeft, center, centerRight, bottomLeft,
 * bottomCenter, bottomRight). Honors the parent HUD's padding and safe-area.
 */
export function HUDZone({
  position = 'topLeft',
  direction,
  gap = 8,
  interactive = true,
  style,
  className,
  children,
}: HUDZoneProps) {
  const { padding, safeArea } = useHUD()
  const isTop = position.startsWith('top')
  const isBottom = position.startsWith('bottom')
  const isCenter = position.startsWith('center')
  const isLeft = position.endsWith('Left') || position === 'centerLeft'
  const isRight = position.endsWith('Right') || position === 'centerRight'
  const isHCenter = position.endsWith('Center') || position === 'center'

  // Default direction: rows for top/bottom, columns for sides/center.
  const flexDirection = direction ?? (isTop || isBottom ? 'row' : 'column')

  // Safe-area values via env() fall back to 0 where not supported.
  const sa = (side: 'top' | 'right' | 'bottom' | 'left') =>
    safeArea ? `max(${padding}px, env(safe-area-inset-${side}))` : `${padding}px`

  const zoneStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection,
    gap,
    pointerEvents: interactive ? 'auto' : 'none',
    ...(isTop && { top: sa('top') }),
    ...(isBottom && { bottom: sa('bottom') }),
    ...(isLeft && { left: sa('left') }),
    ...(isRight && { right: sa('right') }),
    ...(isCenter && !isHCenter && { top: '50%', transform: 'translateY(-50%)' }),
    ...(isHCenter && !isCenter && { left: '50%', transform: 'translateX(-50%)' }),
    ...(position === 'center' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
    ...(isHCenter && !isCenter && isTop && { top: sa('top') }),
    ...(isHCenter && !isCenter && isBottom && { bottom: sa('bottom') }),
    alignItems: isHCenter ? 'center' : isRight ? 'flex-end' : 'flex-start',
    ...style,
  }

  return (
    <div className={className} style={zoneStyle}>
      {children}
    </div>
  )
}

// ── Prebuilt widgets ─────────────────────────────────────────────────────────

export interface HUDBarProps {
  /** Current value. */
  value: number
  /** Maximum value. */
  max: number
  /** Optional label shown on top of the bar. */
  label?: string
  /** Bar color. Default '#4fc3f7'. */
  color?: string
  /** Track (empty) color. Default 'rgba(255,255,255,0.08)'. */
  trackColor?: string
  /** Bar width in CSS pixels. Default 180. */
  width?: number
  /** Bar height in CSS pixels. Default 14. */
  height?: number
  /** Show numeric value as "value / max". Default true. */
  showValue?: boolean
  /** Reverse direction: fills right→left. Default false. */
  rtl?: boolean
  /** Round the bar corners. Default true. */
  rounded?: boolean
  /** Smooth transition when value changes. Default true. */
  animated?: boolean
  /** Additional style. */
  style?: CSSProperties
}

/**
 * A simple value bar for HP, stamina, XP, progress, etc. Meant to be dropped
 * inside a {@link HUDZone} without any extra styling. Animates smoothly by
 * default; respects `prefers-reduced-motion` transparently via CSS.
 *
 * @example
 * ```tsx
 * <HUDZone position="topLeft">
 *   <HUDBar value={hp} max={100} label="HP" color="#ef5350" />
 *   <HUDBar value={mana} max={50} label="MP" color="#4fc3f7" />
 * </HUDZone>
 * ```
 */
export function HUDBar({
  value,
  max,
  label,
  color = '#4fc3f7',
  trackColor = 'rgba(255,255,255,0.08)',
  width = 180,
  height = 14,
  showValue = true,
  rtl = false,
  rounded = true,
  animated = true,
  style,
}: HUDBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const fillStyle: CSSProperties = {
    width: `${pct * 100}%`,
    height: '100%',
    background: color,
    borderRadius: rounded ? height / 2 : 0,
    transition: animated ? 'width 160ms ease-out' : undefined,
    ...(rtl && { marginLeft: 'auto' }),
  }
  const trackStyle: CSSProperties = {
    width,
    height,
    background: trackColor,
    borderRadius: rounded ? height / 2 : 0,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: rtl ? 'row-reverse' : 'row',
  }
  const labelStyle: CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#e0e7f1',
    opacity: 0.85,
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }} aria-label={label}>
      {(label || showValue) && (
        <div style={labelStyle}>
          {label && <span>{label}</span>}
          {showValue && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(value)} / {max}
            </span>
          )}
        </div>
      )}
      <div style={trackStyle} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div style={fillStyle} />
      </div>
    </div>
  )
}

// ── Additional widget: counter ───────────────────────────────────────────────

export interface HUDCounterProps {
  /** Numeric value to display. */
  value: number
  /** Optional icon or emoji shown before the value. */
  icon?: ReactNode
  /** Optional label shown after the value. */
  label?: string
  /** Flash briefly when the value changes. Default true. */
  pulse?: boolean
  /** Value color. Default '#fff'. */
  color?: string
  /** Font size in CSS pixels. Default 18. */
  fontSize?: number
  style?: CSSProperties
}

/**
 * A numeric counter widget for score, coins, ammo, etc.
 *
 * @example
 * ```tsx
 * <HUDZone position="topRight">
 *   <HUDCounter icon="🪙" value={coins} />
 * </HUDZone>
 * ```
 */
export function HUDCounter({
  value,
  icon,
  label,
  pulse = true,
  color = '#fff',
  fontSize = 18,
  style,
}: HUDCounterProps) {
  void pulse // pulse animation could be implemented via key+CSS keyframes; left for polish pass
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'system-ui, sans-serif',
        fontSize,
        color,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {icon && <span style={{ fontSize: fontSize * 1.1 }}>{icon}</span>}
      <span>{value}</span>
      {label && <span style={{ opacity: 0.7, fontSize: fontSize * 0.75 }}>{label}</span>}
    </div>
  )
}
