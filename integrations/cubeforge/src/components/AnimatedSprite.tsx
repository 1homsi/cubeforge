import type { ReactElement } from 'react'
import { Sprite } from './Sprite'
import { Animation } from './Animation'
import type { SpriteAtlas } from './spriteAtlas'
import type { Sampling } from '@cubeforge/renderer'

interface AnimatedSpriteProps {
  // Sprite props
  width: number
  height: number
  src: string
  color?: string
  offsetX?: number
  offsetY?: number
  zIndex?: number
  visible?: boolean
  flipX?: boolean
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

  // Animation props
  frames: number[]
  fps?: number
  loop?: boolean
  playing?: boolean
  onComplete?: () => void
  frameEvents?: Record<number, () => void>
}

/**
 * Convenience wrapper that combines `<Sprite>` and `<Animation>` into a
 * single component. Must be placed inside an `<Entity>`.
 *
 * @example
 * <Entity>
 *   <Transform x={100} y={200} />
 *   <AnimatedSprite
 *     src="/hero.png"
 *     width={32} height={32}
 *     frameWidth={32} frameHeight={32} frameColumns={8}
 *     frames={[0, 1, 2, 3]}
 *     fps={10}
 *   />
 * </Entity>
 */
export function AnimatedSprite({
  // Sprite props
  width,
  height,
  src,
  color,
  offsetX,
  offsetY,
  zIndex,
  visible,
  flipX,
  anchorX,
  anchorY,
  frameWidth,
  frameHeight,
  frameColumns,
  atlas,
  frame,
  tileX,
  tileY,
  tileSizeX,
  tileSizeY,
  sampling,
  // Animation props
  frames,
  fps,
  loop,
  playing,
  onComplete,
  frameEvents,
}: AnimatedSpriteProps): ReactElement {
  return (
    <>
      <Sprite
        width={width}
        height={height}
        src={src}
        color={color}
        offsetX={offsetX}
        offsetY={offsetY}
        zIndex={zIndex}
        visible={visible}
        flipX={flipX}
        anchorX={anchorX}
        anchorY={anchorY}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        frameColumns={frameColumns}
        atlas={atlas}
        frame={frame}
        tileX={tileX}
        tileY={tileY}
        tileSizeX={tileSizeX}
        tileSizeY={tileSizeY}
        sampling={sampling}
      />
      <Animation
        frames={frames}
        fps={fps}
        loop={loop}
        playing={playing}
        onComplete={onComplete}
        frameEvents={frameEvents}
      />
    </>
  )
}
