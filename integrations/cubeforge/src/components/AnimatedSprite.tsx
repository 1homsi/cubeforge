import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { Sprite } from './Sprite'
import { Animation } from './Animation'
import type { AnimationClip } from '@cubeforge/gameplay'
import type { SpriteAtlas } from './spriteAtlas'
import type { Sampling, BlendMode } from '@cubeforge/renderer'

/** Shared sprite props used by both API forms */
interface SpriteOptions {
  width: number
  height: number
  src: string
  color?: string
  offsetX?: number
  offsetY?: number
  zIndex?: number
  visible?: boolean
  flipX?: boolean
  flipY?: boolean
  anchorX?: number
  anchorY?: number
  frameWidth?: number
  frameHeight?: number
  frameColumns?: number
  atlas?: SpriteAtlas
  frame?: string
  tileX?: boolean
  tileY?: boolean
  tileSizeX?: number
  tileSizeY?: number
  sampling?: Sampling
  blendMode?: BlendMode
}

/** Simple form — single animation clip (like Sprite + Animation) */
interface SimpleAnimatedSpriteProps extends SpriteOptions {
  frames: number[]
  fps?: number
  loop?: boolean
  playing?: boolean
  onComplete?: () => void
  frameEvents?: Record<number, () => void>
  animations?: never
  current?: never
}

/** Multi-clip form — named animation states with typed clip names */
interface MultiAnimatedSpriteProps<S extends string = string> extends SpriteOptions {
  /** Map of named animation clips (use `defineAnimations()` for type-safe names) */
  animations: AnimationSet<S>
  /** Which animation clip is currently playing — typed to the clip names */
  current: S
  frames?: never
  fps?: never
  loop?: never
  playing?: never
  onComplete?: never
  frameEvents?: never
}

export type AnimatedSpriteProps<S extends string = string> =
  | SimpleAnimatedSpriteProps
  | MultiAnimatedSpriteProps<S>

/** A typed set of animation clips. Created by `defineAnimations()`. */
export type AnimationSet<S extends string = string> = Record<S, AnimationClip>

/**
 * Define a reusable, type-safe set of animation clips.
 *
 * The returned object can be shared across components and provides
 * autocomplete on `current` when used with `<AnimatedSprite>`.
 *
 * @example
 * ```tsx
 * const playerAnims = defineAnimations({
 *   idle:   { frames: [0],          fps: 1  },
 *   walk:   { frames: [1, 2, 3, 4], fps: 10 },
 *   run:    { frames: [5, 6, 7, 8], fps: 14 },
 *   jump:   { frames: [9],          fps: 1, loop: false },
 *   attack: { frames: [10, 11, 12], fps: 16, loop: false, next: 'idle' },
 * })
 *
 * // `current` is typed as 'idle' | 'walk' | 'run' | 'jump' | 'attack'
 * <AnimatedSprite animations={playerAnims} current={state} ... />
 * ```
 */
export function defineAnimations<S extends string>(clips: Record<S, AnimationClip>): AnimationSet<S> {
  return clips
}

/**
 * Convenience wrapper that combines `<Sprite>` and `<Animation>` into a
 * single component. Must be placed inside an `<Entity>`.
 *
 * Supports two API forms:
 *
 * **Simple** — single clip:
 * ```tsx
 * <AnimatedSprite src="/hero.png" width={32} height={32}
 *   frameWidth={32} frameHeight={32} frameColumns={8}
 *   frames={[0, 1, 2, 3]} fps={10} />
 * ```
 *
 * **Multi-clip** — named animation states, switch via `current`:
 * ```tsx
 * const anims = defineAnimations({
 *   idle: { frames: [0], fps: 1 },
 *   walk: { frames: [1, 2, 3, 4], fps: 10 },
 * })
 *
 * <AnimatedSprite src="/hero.png" width={32} height={48}
 *   frameWidth={32} frameHeight={48} frameColumns={8}
 *   animations={anims} current={state} />
 * ```
 */
export function AnimatedSprite<S extends string>(props: AnimatedSpriteProps<S>): ReactElement {
  const {
    width, height, src, color, offsetX, offsetY, zIndex, visible, flipX, flipY,
    anchorX, anchorY, frameWidth, frameHeight, frameColumns, atlas, frame,
    tileX, tileY, tileSizeX, tileSizeY, sampling, blendMode,
  } = props

  // Resolve animation props from either simple or multi-clip form
  const animProps = useResolvedAnimation(props)

  return (
    <>
      <Sprite
        width={width} height={height} src={src} color={color}
        offsetX={offsetX} offsetY={offsetY} zIndex={zIndex} visible={visible}
        flipX={flipX} flipY={flipY} anchorX={anchorX} anchorY={anchorY}
        frameWidth={frameWidth} frameHeight={frameHeight} frameColumns={frameColumns}
        atlas={atlas} frame={frame}
        tileX={tileX} tileY={tileY} tileSizeX={tileSizeX} tileSizeY={tileSizeY}
        sampling={sampling} blendMode={blendMode}
      />
      <Animation {...animProps} />
    </>
  )
}

function useResolvedAnimation<S extends string>(props: AnimatedSpriteProps<S>) {
  // Multi-clip mode: resolve the current clip from the animations map
  const clip = props.animations
    ? (props.animations as Record<string, AnimationClip>)[props.current as string] ?? Object.values(props.animations as Record<string, AnimationClip>)[0]
    : null

  // Memoize frames array reference to avoid unnecessary animation resets
  // (Animation resets currentIndex when frames reference changes)
  const frames = useMemo(
    () => clip ? clip.frames : props.frames!,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clip ? props.current : props.frames],
  )

  if (clip) {
    return {
      frames,
      fps: clip.fps,
      loop: clip.loop,
      playing: true as const,
      onComplete: clip.onComplete,
      frameEvents: undefined as Record<number, () => void> | undefined,
    }
  }

  return {
    frames,
    fps: props.fps,
    loop: props.loop,
    playing: props.playing,
    onComplete: props.onComplete,
    frameEvents: props.frameEvents,
  }
}
