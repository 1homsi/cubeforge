import { useCallback, useSyncExternalStore } from 'react'
import {
  type AccessibilityOptions,
  getAccessibilityOptions,
  setAccessibilityOptions,
  announceToScreenReader,
} from '@cubeforge/core'

export interface AccessibilityControls {
  options: Readonly<AccessibilityOptions>
  setOptions(opts: Partial<AccessibilityOptions>): void
  announce(text: string, priority?: 'polite' | 'assertive'): void
}

// Simple subscription model so useSyncExternalStore can re-render on changes
let _version = 0
const _listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  _listeners.add(cb)
  return () => _listeners.delete(cb)
}

function getSnapshot(): number {
  return _version
}

export function useAccessibility(): AccessibilityControls {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setOptions = useCallback((opts: Partial<AccessibilityOptions>) => {
    setAccessibilityOptions(opts)
    _version++
    for (const cb of _listeners) cb()
  }, [])

  const announce = useCallback((text: string, priority?: 'polite' | 'assertive') => {
    announceToScreenReader(text, priority)
  }, [])

  return {
    options: getAccessibilityOptions(),
    setOptions,
    announce,
  }
}
