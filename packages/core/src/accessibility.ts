export interface AccessibilityOptions {
  /** Enable high contrast mode (boost color contrast) */
  highContrast?: boolean
  /** Enable colorblind mode */
  colorblindMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  /** Font size multiplier (1.0 = normal) */
  fontScale?: number
  /** Enable screen reader announcements */
  screenReaderEnabled?: boolean
  /** Reduce motion (disable shake, particles, etc.) */
  reduceMotion?: boolean
}

const defaultOptions: AccessibilityOptions = {
  highContrast: false,
  colorblindMode: 'none',
  fontScale: 1.0,
  screenReaderEnabled: false,
  reduceMotion: false,
}

let _options: AccessibilityOptions = { ...defaultOptions }

export function setAccessibilityOptions(opts: Partial<AccessibilityOptions>): void {
  _options = { ..._options, ...opts }
}

export function getAccessibilityOptions(): Readonly<AccessibilityOptions> {
  return _options
}

/**
 * Apply colorblind filter to a color string.
 * Returns the original color if no filter is active.
 */
export function applyColorFilter(color: string, mode: AccessibilityOptions['colorblindMode']): string {
  if (!mode || mode === 'none') return color
  // Simple simulation: shift hues based on color blindness type
  // This is a simplified approach — full simulation would need matrix transforms
  return color // For now, return as-is. Full implementation would parse hex/rgb and apply matrices.
}

/**
 * Announce text to screen readers via an aria-live region.
 */
export function announceToScreenReader(text: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return
  let region = document.getElementById('cubeforge-aria-live')
  if (!region) {
    region = document.createElement('div')
    region.id = 'cubeforge-aria-live'
    region.setAttribute('aria-live', priority)
    region.setAttribute('role', 'status')
    region.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)'
    document.body.appendChild(region)
  }
  region.setAttribute('aria-live', priority)
  region.textContent = text
}
