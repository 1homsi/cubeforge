import { describe, it, expect, beforeEach } from 'vitest'
import { setAccessibilityOptions, getAccessibilityOptions, announceToScreenReader } from '../accessibility'

describe('Accessibility', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    setAccessibilityOptions({
      highContrast: false,
      colorblindMode: 'none',
      fontScale: 1.0,
      screenReaderEnabled: false,
      reduceMotion: false,
    })
    // Clean up aria-live region if present
    const region = document.getElementById('cubeforge-aria-live')
    if (region) region.remove()
  })

  describe('setAccessibilityOptions / getAccessibilityOptions', () => {
    it('returns default options initially', () => {
      const opts = getAccessibilityOptions()
      expect(opts.highContrast).toBe(false)
      expect(opts.colorblindMode).toBe('none')
      expect(opts.fontScale).toBe(1.0)
      expect(opts.screenReaderEnabled).toBe(false)
      expect(opts.reduceMotion).toBe(false)
    })

    it('updates options with partial input', () => {
      setAccessibilityOptions({ highContrast: true, fontScale: 1.5 })
      const opts = getAccessibilityOptions()
      expect(opts.highContrast).toBe(true)
      expect(opts.fontScale).toBe(1.5)
      // Other options unchanged
      expect(opts.colorblindMode).toBe('none')
      expect(opts.reduceMotion).toBe(false)
    })

    it('merges multiple updates', () => {
      setAccessibilityOptions({ reduceMotion: true })
      setAccessibilityOptions({ colorblindMode: 'protanopia' })
      const opts = getAccessibilityOptions()
      expect(opts.reduceMotion).toBe(true)
      expect(opts.colorblindMode).toBe('protanopia')
    })
  })

  describe('announceToScreenReader', () => {
    it('creates an aria-live region in the document', () => {
      announceToScreenReader('Game started')
      const region = document.getElementById('cubeforge-aria-live')
      expect(region).not.toBeNull()
      expect(region!.getAttribute('aria-live')).toBe('polite')
      expect(region!.getAttribute('role')).toBe('status')
      expect(region!.textContent).toBe('Game started')
    })

    it('reuses existing aria-live region', () => {
      announceToScreenReader('First')
      announceToScreenReader('Second')
      const regions = document.querySelectorAll('#cubeforge-aria-live')
      expect(regions).toHaveLength(1)
      expect(regions[0].textContent).toBe('Second')
    })

    it('respects assertive priority', () => {
      announceToScreenReader('Alert!', 'assertive')
      const region = document.getElementById('cubeforge-aria-live')
      expect(region!.getAttribute('aria-live')).toBe('assertive')
    })
  })
})
