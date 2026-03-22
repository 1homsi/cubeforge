import React from 'react'
import type { SceneTransitionControls, TransitionEffect } from '../hooks/useSceneTransition'

interface SceneTransitionOverlayProps {
  controls: SceneTransitionControls
}

function getOverlayStyle(effect: TransitionEffect, progress: number): React.CSSProperties {
  const color = (effect as { color?: string }).color ?? '#000'

  switch (effect.type) {
    case 'fade':
      return {
        position: 'absolute',
        inset: 0,
        backgroundColor: color,
        opacity: progress,
        pointerEvents: 'none',
        zIndex: 9999,
      }

    case 'wipe': {
      const dir = (effect as { direction?: string }).direction ?? 'left'
      let clipPath: string
      switch (dir) {
        case 'left':
          clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`
          break
        case 'right':
          clipPath = `inset(0 0 0 ${(1 - progress) * 100}%)`
          break
        case 'up':
          clipPath = `inset(0 0 ${(1 - progress) * 100}% 0)`
          break
        case 'down':
          clipPath = `inset(${(1 - progress) * 100}% 0 0 0)`
          break
        default:
          clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`
      }
      return {
        position: 'absolute',
        inset: 0,
        backgroundColor: color,
        clipPath,
        pointerEvents: 'none',
        zIndex: 9999,
      }
    }

    case 'circle-close': {
      // Circle grows from 0% to cover the full screen (diagonal radius ~71%)
      const radius = (1 - progress) * 72
      return {
        position: 'absolute',
        inset: 0,
        backgroundColor: color,
        clipPath: `circle(${radius}% at 50% 50%)`,
        pointerEvents: 'none',
        zIndex: 9999,
      }
    }

    default:
      return { display: 'none' }
  }
}

/**
 * Renders the visual overlay during scene transitions.
 * Place this as a sibling after your scene content, inside the Game wrapper.
 *
 * @example
 * const scenes = useSceneTransition('gameplay')
 *
 * <div style={{ position: 'relative' }}>
 *   {scenes.current === 'gameplay' && <GameplayScene />}
 *   {scenes.current === 'pause' && <PauseMenu />}
 *   <SceneTransitionOverlay controls={scenes} />
 * </div>
 */
export function SceneTransitionOverlay({ controls }: SceneTransitionOverlayProps) {
  if (controls.phase === 'idle' || !controls.activeTransition || controls.activeTransition.type === 'instant') {
    return null
  }

  // For circle-close, invert: the overlay covers EVERYTHING except the circle hole.
  // We need a mask that is the inverse of a circle.
  if (controls.activeTransition.type === 'circle-close') {
    const color = (controls.activeTransition as { color?: string }).color ?? '#000'
    const radius = (1 - controls.progress) * 72
    return React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        backgroundColor: color,
        WebkitMaskImage: `radial-gradient(circle ${radius}vmax at 50% 50%, transparent 100%, black 100%)`,
        maskImage: `radial-gradient(circle ${radius}vmax at 50% 50%, transparent 100%, black 100%)`,
        pointerEvents: 'none',
        zIndex: 9999,
      },
    })
  }

  return React.createElement('div', {
    style: getOverlayStyle(controls.activeTransition, controls.progress),
  })
}
