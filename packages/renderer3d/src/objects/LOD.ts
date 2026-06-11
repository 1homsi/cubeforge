import { Vec3 } from '../math'
import { Object3D } from '../scene'
import { Camera } from '../scene'

const _camPos = new Vec3()
const _objPos = new Vec3()

export interface LODLevel {
  distance: number
  object: Object3D
}

export class LOD extends Object3D {
  readonly isLOD = true as const
  levels: LODLevel[]

  constructor() {
    super()
    this.levels = []
  }

  /**
   * Add a detail level. The object is visible when the camera is within
   * `distance` world units. Levels are sorted by distance ascending after
   * each addition so the cheapest query (iterate from closest to farthest)
   * works correctly in `getLevelForDistance`.
   */
  addLevel(object: Object3D, distance = 0): this {
    this.levels.push({ distance, object })
    // Keep sorted ascending by distance
    this.levels.sort((a, b) => a.distance - b.distance)

    // Add the object as a child so matrix updates propagate
    if (!this.children.includes(object)) {
      this.add(object)
    }

    return this
  }

  /** Return the currently visible level object (first level's object by convention), or null. */
  getCurrentLevel(): Object3D | null {
    for (const level of this.levels) {
      if (level.object.visible) return level.object
    }
    return null
  }

  /**
   * Given a distance from the camera, return the index of the level that
   * should be active. Returns the last level index if no closer level exists.
   */
  getLevelForDistance(distance: number): number {
    // Levels sorted ascending by distance threshold.
    // We want the highest-detail level whose threshold is <= distance.
    // The first level (index 0) is always the highest detail (distance=0).
    // Walk backwards to find the lowest threshold <= distance.
    let result = this.levels.length - 1
    for (let i = 0; i < this.levels.length; i++) {
      if (distance < this.levels[i].distance) {
        result = Math.max(0, i - 1)
        break
      }
    }
    return result
  }

  /**
   * Called by the renderer each frame. Reads the camera world position,
   * computes distance to this LOD node, and sets `.visible` on each level's
   * object accordingly so the RenderQueue only traverses the active one.
   */
  update(camera: Camera): void {
    if (this.levels.length === 0) return

    // Extract camera world position from its matrixWorld column 3
    const ce = camera.matrixWorld.elements
    _camPos.set(ce[12], ce[13], ce[14])

    // Extract this LOD node's world position
    const mw = this.matrixWorld.elements
    _objPos.set(mw[12], mw[13], mw[14])

    const dx = _objPos.x - _camPos.x
    const dy = _objPos.y - _camPos.y
    const dz = _objPos.z - _camPos.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    const activeIdx = this.getLevelForDistance(distance)

    for (let i = 0; i < this.levels.length; i++) {
      this.levels[i].object.visible = i === activeIdx
    }
  }
}
