import React, { memo, type ReactElement } from 'react'

/**
 * Define a reusable entity prefab with default props.
 *
 * Returns a memoized React component that merges caller-supplied props
 * over the provided defaults, so every prop becomes optional at the call site.
 *
 * @example
 * ```tsx
 * const Crate = definePrefab('Crate', {
 *   width: 32, height: 32, color: '#8B4513', mass: 1,
 * }, (props) => (
 *   <Entity tags={['crate']}>
 *     <Transform x={0} y={0} />
 *     <Sprite width={props.width} height={props.height} color={props.color} />
 *     <RigidBody mass={props.mass} />
 *     <BoxCollider width={props.width} height={props.height} />
 *   </Entity>
 * ))
 *
 * // Usage — all defaults applied, override only what you need:
 * <Crate width={64} />
 * ```
 */
export function definePrefab<D extends Record<string, unknown>>(
  name: string,
  defaults: D,
  render: (props: D) => ReactElement,
): React.FC<Partial<D>> {
  const component = memo((props: Partial<D>) => {
    const merged = { ...defaults, ...props } as D
    return render(merged)
  })
  component.displayName = name
  return component as unknown as React.FC<Partial<D>>
}
