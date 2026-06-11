import { useContext, useEffect, useRef } from 'react'
import { Line3D, LineSegments, LineLoop, LineMaterial, Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface LineObjectProps {
  points: Array<[number, number, number]> | Vec3[]
  color?: [number, number, number]
  linewidth?: number
  dashed?: boolean
  dashSize?: number
  gapSize?: number
  /** If true, uses LineLoop (last vertex connects back to first). */
  loop?: boolean
  /** If true, uses LineSegments (each pair of vertices = one independent segment). */
  segments?: boolean
}

function toVec3Array(points: Array<[number, number, number]> | Vec3[]): Vec3[] {
  return points.map((p) =>
    p instanceof Vec3
      ? p
      : new Vec3(
          (p as [number, number, number])[0],
          (p as [number, number, number])[1],
          (p as [number, number, number])[2],
        ),
  )
}

export function LineObject({
  points,
  color,
  linewidth = 1,
  dashed = false,
  dashSize = 3,
  gapSize = 1,
  loop = false,
  segments = false,
}: LineObjectProps): null {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <LineObject> must be inside a <Game3D>.')
    }
  }

  const lineRef = useRef<Line3D | null>(null)

  useEffect(() => {
    if (!parent) return

    const mat = new LineMaterial()
    if (color) mat.color.set(color[0], color[1], color[2])
    mat.linewidth = linewidth
    mat.dashed = dashed
    mat.dashSize = dashSize
    mat.gapSize = gapSize

    let line: Line3D
    if (loop) {
      line = new LineLoop(undefined, mat)
    } else if (segments) {
      line = new LineSegments(undefined, mat)
    } else {
      line = new Line3D(undefined, mat)
    }

    line.setPoints(toVec3Array(points))
    parent.add(line)
    lineRef.current = line

    return () => {
      parent.remove(line)
      lineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync points when they change
  useEffect(() => {
    const line = lineRef.current
    if (!line) return
    line.setPoints(toVec3Array(points))
  }, [points])

  // Sync material properties when they change
  useEffect(() => {
    const line = lineRef.current
    if (!line) return
    const mat = line.material as LineMaterial
    if (color) mat.color.set(color[0], color[1], color[2])
    mat.linewidth = linewidth
    mat.dashed = dashed
    mat.dashSize = dashSize
    mat.gapSize = gapSize
  }, [color, linewidth, dashed, dashSize, gapSize])

  return null
}
