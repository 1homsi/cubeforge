import type { ECSWorld, EntityId } from './world'

interface TagComponent {
  type: 'Tag'
  tags: string[]
}

/**
 * Returns all entity IDs that have the given tag.
 *
 * @example
 * ```ts
 * const enemies = findByTag(world, 'enemy')
 * ```
 */
export function findByTag(world: ECSWorld, tag: string): EntityId[] {
  const results: EntityId[] = []
  for (const id of world.query('Tag')) {
    const t = world.getComponent<TagComponent>(id, 'Tag')
    if (t?.tags.includes(tag)) results.push(id)
  }
  return results
}
