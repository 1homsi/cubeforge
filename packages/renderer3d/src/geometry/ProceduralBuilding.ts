import { Mat4 } from '../math/Mat4'
import { BufferAttribute, BufferGeometry } from './BufferGeometry'
import { BoxGeometry } from './BoxGeometry'
import { CylinderGeometry } from './CylinderGeometry'
import { SphereGeometry } from './SphereGeometry'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RoofStyle = 'flat' | 'gabled' | 'hipped' | 'dome' | 'pyramid'
export type BuildingStyle = 'residential' | 'commercial' | 'industrial' | 'tower' | 'castle' | 'temple'

export interface BuildingFloor {
  width: number
  depth: number
  height: number
  /** Horizontal offset from the building centerline */
  offset?: { x: number; z: number }
}

export interface ProceduralBuildingOptions {
  style?: BuildingStyle
  /** Explicit per-floor stack — overrides simple mode dimensions */
  floors?: BuildingFloor[]
  // Simple mode
  width?: number
  depth?: number
  floorHeight?: number
  numFloors?: number
  roofStyle?: RoofStyle
  roofHeight?: number
  // Decoration
  addWindows?: boolean
  addDoor?: boolean
  windowRows?: number
  windowCols?: number
  /** Seed for deterministic variation */
  seed?: number
}

// ---------------------------------------------------------------------------
// Group material indices
// ---------------------------------------------------------------------------
// 0 = walls
// 1 = roof
// 2 = windows
// 3 = door

const MAT_WALLS = 0
const MAT_ROOF = 1
const MAT_WINDOWS = 2
const MAT_DOOR = 3

// ---------------------------------------------------------------------------
// Seeded PRNG (xorshift32)
// ---------------------------------------------------------------------------

class RNG {
  private _s: number
  constructor(seed = 1) {
    this._s = seed >>> 0 || 1
  }
  next(): number {
    let x = this._s
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    this._s = x >>> 0
    return this._s / 0x100000000
  }
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo)
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
}

// ---------------------------------------------------------------------------
// Geometry merge helper
// ---------------------------------------------------------------------------

/**
 * Merge all `parts` into a single BufferGeometry, accumulating draw groups.
 *
 * Each part carries:
 *   - geo: the source geometry (already transformed via applyMatrix4)
 *   - materialIndex: which material slot this part belongs to
 */
interface Part {
  geo: BufferGeometry
  materialIndex: number
}

function mergeParts(parts: Part[]): BufferGeometry {
  if (parts.length === 0) {
    return new BufferGeometry()
  }

  // Collect flat arrays
  const allPositions: number[] = []
  const allNormals: number[] = []
  const allUVs: number[] = []
  const allIndices: number[] = []

  // Groups map: materialIndex → {start, count}
  // We'll create one group per materialIndex, accumulating index ranges.
  const groupRanges = new Map<number, { start: number; count: number }>()

  // We'll do two passes:
  // Pass 1: for each materialIndex, sort parts so that the same material
  //         is contiguous in the index buffer.
  // Pass 2: concatenate.

  // Gather unique material indices in order of first appearance
  const matOrder: number[] = []
  for (const part of parts) {
    if (!matOrder.includes(part.materialIndex)) {
      matOrder.push(part.materialIndex)
    }
  }

  let vertexOffset = 0

  for (const matIdx of matOrder) {
    const partsForMat = parts.filter((p) => p.materialIndex === matIdx)

    const groupStart = allIndices.length

    for (const part of partsForMat) {
      const posAttr = part.geo.getAttribute('position')
      const normAttr = part.geo.getAttribute('normal')
      const uvAttr = part.geo.getAttribute('uv')
      const idx = part.geo.index

      if (!posAttr) continue

      const vCount = posAttr.count

      // Positions
      for (let i = 0; i < vCount; i++) {
        allPositions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
      }
      // Normals
      if (normAttr) {
        for (let i = 0; i < vCount; i++) {
          allNormals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i))
        }
      } else {
        for (let i = 0; i < vCount; i++) allNormals.push(0, 1, 0)
      }
      // UVs
      if (uvAttr) {
        for (let i = 0; i < uvAttr.count; i++) {
          allUVs.push(uvAttr.getX(i), uvAttr.getY(i))
        }
      } else {
        for (let i = 0; i < vCount; i++) allUVs.push(0, 0)
      }

      // Indices
      if (idx) {
        for (let i = 0; i < idx.count; i++) {
          allIndices.push(vertexOffset + idx.getX(i))
        }
      } else {
        for (let i = 0; i < vCount; i++) allIndices.push(vertexOffset + i)
      }

      vertexOffset += vCount
    }

    const groupCount = allIndices.length - groupStart
    if (groupCount > 0) {
      groupRanges.set(matIdx, { start: groupStart, count: groupCount })
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(allPositions), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(allNormals), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(allUVs), 2))

  const maxIndex = vertexOffset - 1
  const indexData = maxIndex > 65535 ? new Uint32Array(allIndices) : new Uint16Array(allIndices)
  geo.index = new BufferAttribute(indexData, 1)

  for (const matIdx of matOrder) {
    const range = groupRanges.get(matIdx)
    if (range) {
      geo.addGroup(range.start, range.count, matIdx)
    }
  }

  return geo
}

// ---------------------------------------------------------------------------
// Roof builders – return a Part[]
// ---------------------------------------------------------------------------

function buildFlatRoof(cx: number, baseY: number, w: number, d: number): Part[] {
  const geo = new BoxGeometry(w, 0.2, d)
  geo.applyMatrix4(new Mat4().makeTranslation(cx, baseY + 0.1, 0))
  return [{ geo, materialIndex: MAT_ROOF }]
}

function buildGabledRoof(cx: number, baseY: number, roofH: number, w: number, d: number): Part[] {
  // A gabled roof has two sloping rectangular faces (ridge runs along X axis)
  // and two triangular gable faces on the Z ends.
  // We approximate the body with a CylinderGeometry prism (3 segments, openEnded=false)
  // aligned along the X axis. But CylinderGeometry is a vertical cylinder, so we
  // rotate it 90° around Z and scale. For simplicity, build faces manually.

  const parts: Part[] = []

  // We'll build the 4 faces of the gabled roof as thin boxes.
  // Ridge = top edge at (cx, baseY + roofH, 0), length = w along X.
  // Each slope face: from eave to ridge.

  const slopeLen = Math.sqrt((d / 2) * (d / 2) + roofH * roofH)
  const slopeAngle = Math.atan2(roofH, d / 2) // tilt around X

  // Front slope (toward +Z)
  {
    const geo = new BoxGeometry(w, 0.12, slopeLen)
    const m = new Mat4()
    m.makeRotationX(-slopeAngle)
    const t = new Mat4().makeTranslation(cx, baseY + roofH * 0.5, d * 0.25)
    t.multiply(m)
    geo.applyMatrix4(t)
    parts.push({ geo, materialIndex: MAT_ROOF })
  }
  // Back slope (toward -Z)
  {
    const geo = new BoxGeometry(w, 0.12, slopeLen)
    const m = new Mat4()
    m.makeRotationX(slopeAngle)
    const t = new Mat4().makeTranslation(cx, baseY + roofH * 0.5, -d * 0.25)
    t.multiply(m)
    geo.applyMatrix4(t)
    parts.push({ geo, materialIndex: MAT_ROOF })
  }
  // Gable faces (triangular – approximated as thin boxes at the ends)
  // Left end
  {
    const geo = new BoxGeometry(0.12, roofH, d)
    geo.applyMatrix4(new Mat4().makeTranslation(cx - w * 0.5, baseY + roofH * 0.5, 0))
    parts.push({ geo, materialIndex: MAT_ROOF })
  }
  // Right end
  {
    const geo = new BoxGeometry(0.12, roofH, d)
    geo.applyMatrix4(new Mat4().makeTranslation(cx + w * 0.5, baseY + roofH * 0.5, 0))
    parts.push({ geo, materialIndex: MAT_ROOF })
  }

  return parts
}

function buildHippedRoof(cx: number, baseY: number, roofH: number, w: number, d: number): Part[] {
  // Hipped roof: four sloping faces, no vertical gable ends.
  // Approximated with four thin boxes angled toward the ridge point at centre top.
  const parts: Part[] = []

  // Front/back slopes (along X, shorter)
  const slopeD = Math.sqrt((d / 2) * (d / 2) + roofH * roofH)
  const angD = Math.atan2(roofH, d / 2)
  // Front
  {
    const geo = new BoxGeometry(w * 0.6, 0.12, slopeD)
    const m = new Mat4().makeRotationX(-angD)
    const t = new Mat4().makeTranslation(cx, baseY + roofH * 0.5, d * 0.25)
    t.multiply(m)
    geo.applyMatrix4(t)
    parts.push({ geo, materialIndex: MAT_ROOF })
  }
  // Back
  {
    const geo = new BoxGeometry(w * 0.6, 0.12, slopeD)
    const m = new Mat4().makeRotationX(angD)
    const t = new Mat4().makeTranslation(cx, baseY + roofH * 0.5, -d * 0.25)
    t.multiply(m)
    geo.applyMatrix4(t)
    parts.push({ geo, materialIndex: MAT_ROOF })
  }

  // Left/right slopes (along Z, shorter)
  const slopeW = Math.sqrt((w / 2) * (w / 2) + roofH * roofH)
  const angW = Math.atan2(roofH, w / 2)
  // Left
  {
    const geo = new BoxGeometry(slopeW, 0.12, d * 0.6)
    const m = new Mat4().makeRotationZ(angW)
    const t = new Mat4().makeTranslation(cx - w * 0.25, baseY + roofH * 0.5, 0)
    t.multiply(m)
    geo.applyMatrix4(t)
    parts.push({ geo, materialIndex: MAT_ROOF })
  }
  // Right
  {
    const geo = new BoxGeometry(slopeW, 0.12, d * 0.6)
    const m = new Mat4().makeRotationZ(-angW)
    const t = new Mat4().makeTranslation(cx + w * 0.25, baseY + roofH * 0.5, 0)
    t.multiply(m)
    geo.applyMatrix4(t)
    parts.push({ geo, materialIndex: MAT_ROOF })
  }

  return parts
}

function buildPyramidRoof(cx: number, baseY: number, roofH: number, w: number, d: number): Part[] {
  // CylinderGeometry with 4 radialSegments and radiusTop=0 gives a square pyramid.
  // The base radius maps to the circumscribed circle of the square base.
  const radius = Math.sqrt((w / 2) * (w / 2) + (d / 2) * (d / 2))
  const geo = new CylinderGeometry(0, radius, roofH, 4, 1, false)
  // Rotate 45° so corners align with box faces
  geo.applyMatrix4(new Mat4().makeRotationY(Math.PI / 4))
  geo.applyMatrix4(new Mat4().makeTranslation(cx, baseY + roofH / 2, 0))
  return [{ geo, materialIndex: MAT_ROOF }]
}

function buildDomeRoof(cx: number, baseY: number, _roofH: number, w: number, _d: number): Part[] {
  const radius = Math.max(w, _d) / 2
  // SphereGeometry hemisphere: thetaStart=0, thetaLength=π/2
  const geo = new SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  geo.applyMatrix4(new Mat4().makeTranslation(cx, baseY, 0))
  return [{ geo, materialIndex: MAT_ROOF }]
}

// ---------------------------------------------------------------------------
// Window panel builder
// ---------------------------------------------------------------------------

function buildWindows(
  cx: number,
  baseY: number,
  totalHeight: number,
  w: number,
  d: number,
  rows: number,
  cols: number,
): Part[] {
  const parts: Part[] = []
  const winW = (w / cols) * 0.3
  const winH = (totalHeight / rows) * 0.4
  const winDepth = 0.08 // how much the panel protrudes

  // Front face (Z+)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = cx - w / 2 + (col + 0.5) * (w / cols)
      const y = baseY + (row + 0.5) * (totalHeight / rows)

      // Front (Z+)
      {
        const geo = new BoxGeometry(winW, winH, winDepth)
        geo.applyMatrix4(new Mat4().makeTranslation(x, y, d / 2 + winDepth / 2))
        parts.push({ geo, materialIndex: MAT_WINDOWS })
      }
      // Back (Z-)
      {
        const geo = new BoxGeometry(winW, winH, winDepth)
        geo.applyMatrix4(new Mat4().makeTranslation(x, y, -d / 2 - winDepth / 2))
        parts.push({ geo, materialIndex: MAT_WINDOWS })
      }
    }
  }

  // Side faces (X)
  const sideCols = Math.max(1, Math.round(cols * (d / w)))
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < sideCols; col++) {
      const z = -d / 2 + (col + 0.5) * (d / sideCols)
      const y = baseY + (row + 0.5) * (totalHeight / rows)

      // Right (X+)
      {
        const geo = new BoxGeometry(winDepth, winH, winW)
        geo.applyMatrix4(new Mat4().makeTranslation(cx + w / 2 + winDepth / 2, y, z))
        parts.push({ geo, materialIndex: MAT_WINDOWS })
      }
      // Left (X-)
      {
        const geo = new BoxGeometry(winDepth, winH, winW)
        geo.applyMatrix4(new Mat4().makeTranslation(cx - w / 2 - winDepth / 2, y, z))
        parts.push({ geo, materialIndex: MAT_WINDOWS })
      }
    }
  }

  return parts
}

// ---------------------------------------------------------------------------
// Door builder
// ---------------------------------------------------------------------------

function buildDoor(cx: number, baseY: number, w: number, d: number): Part[] {
  const doorW = Math.min(1.2, w * 0.2)
  const doorH = 2.2
  const doorDepth = 0.1
  const geo = new BoxGeometry(doorW, doorH, doorDepth)
  geo.applyMatrix4(new Mat4().makeTranslation(cx, baseY + doorH / 2, d / 2 + doorDepth / 2))
  return [{ geo, materialIndex: MAT_DOOR }]
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class ProceduralBuilding extends BufferGeometry {
  constructor(opts: ProceduralBuildingOptions = {}) {
    super()
    this._build(opts)
  }

  /** Regenerate with new options (disposes current buffers first) */
  rebuild(opts: ProceduralBuildingOptions): void {
    // Clear existing data
    this.attributes.clear()
    this.index = null
    this.groups = []
    this.boundingBox = null
    this.boundingSphere = null
    this._build(opts)
  }

  // ---------------------------------------------------------------------------
  // Static presets
  // ---------------------------------------------------------------------------

  static house(seed = 1): ProceduralBuilding {
    const rng = new RNG(seed)
    return new ProceduralBuilding({
      style: 'residential',
      width: rng.range(6, 10),
      depth: rng.range(5, 8),
      floorHeight: rng.range(2.4, 3.0),
      numFloors: rng.pick([1, 2]),
      roofStyle: rng.pick(['gabled', 'hipped'] as RoofStyle[]),
      roofHeight: rng.range(1.5, 3),
      addWindows: true,
      addDoor: true,
      windowRows: 1,
      windowCols: rng.pick([2, 3]),
      seed,
    })
  }

  static tower(height: number, seed = 1): ProceduralBuilding {
    const rng = new RNG(seed)
    const floorH = rng.range(3, 4)
    const nFloors = Math.max(3, Math.round(height / floorH))
    const baseW = rng.range(8, 14)
    return new ProceduralBuilding({
      style: 'tower',
      width: baseW,
      depth: baseW * rng.range(0.8, 1.2),
      floorHeight: floorH,
      numFloors: nFloors,
      roofStyle: rng.pick(['flat', 'pyramid'] as RoofStyle[]),
      roofHeight: rng.range(2, 5),
      addWindows: true,
      addDoor: true,
      windowRows: nFloors,
      windowCols: rng.pick([3, 4]),
      seed,
    })
  }

  static warehouse(w: number, d: number, seed = 1): ProceduralBuilding {
    return new ProceduralBuilding({
      style: 'industrial',
      width: w,
      depth: d,
      floorHeight: 5,
      numFloors: 1,
      roofStyle: 'gabled',
      roofHeight: 3,
      addWindows: false,
      addDoor: true,
      seed,
    })
  }

  // ---------------------------------------------------------------------------
  // Internal build
  // ---------------------------------------------------------------------------

  private _build(opts: ProceduralBuildingOptions): void {
    const rng = new RNG(opts.seed ?? 1)

    // Resolve floor stack
    let floors: BuildingFloor[]
    if (opts.floors && opts.floors.length > 0) {
      floors = opts.floors
    } else {
      const baseW = opts.width ?? 10
      const baseD = opts.depth ?? 10
      const floorH = opts.floorHeight ?? 3
      const nFloors = opts.numFloors ?? 2
      floors = []

      // Style-based setbacks: tower and castle taper slightly per floor
      const style = opts.style ?? 'residential'
      let curW = baseW
      let curD = baseD

      for (let f = 0; f < nFloors; f++) {
        floors.push({ width: curW, depth: curD, height: floorH })

        if (style === 'tower' && f < nFloors - 1) {
          const setback = rng.range(0.05, 0.15)
          curW = Math.max(4, curW * (1 - setback))
          curD = Math.max(4, curD * (1 - setback))
        } else if (style === 'castle' && f === 0) {
          curW = Math.max(6, curW * 0.7)
          curD = Math.max(6, curD * 0.7)
        }
      }
    }

    const parts: Part[] = []

    // Compute cumulative Y offsets for each floor
    let floorBaseY = 0
    for (const floor of floors) {
      const offX = floor.offset?.x ?? 0
      const offZ = floor.offset?.z ?? 0
      const cx = offX
      const cz = offZ

      // Floor slab (bottom face)
      {
        const geo = new BoxGeometry(floor.width, 0.15, floor.depth)
        geo.applyMatrix4(new Mat4().makeTranslation(cx, floorBaseY + 0.075, cz))
        parts.push({ geo, materialIndex: MAT_WALLS })
      }

      // Walls (four walls as a box, open-ended not supported directly so use full box)
      {
        const geo = new BoxGeometry(floor.width, floor.height, floor.depth)
        geo.applyMatrix4(new Mat4().makeTranslation(cx, floorBaseY + floor.height / 2, cz))
        parts.push({ geo, materialIndex: MAT_WALLS })
      }

      floorBaseY += floor.height
    }

    // Roof
    const lastFloor = floors[floors.length - 1]
    const roofW = lastFloor.width
    const roofD = lastFloor.depth
    const roofCX = lastFloor.offset?.x ?? 0
    const roofH = opts.roofHeight ?? 2
    const roofStyle = opts.roofStyle ?? 'flat'

    let roofParts: Part[]
    switch (roofStyle) {
      case 'gabled':
        roofParts = buildGabledRoof(roofCX, floorBaseY, roofH, roofW, roofD)
        break
      case 'hipped':
        roofParts = buildHippedRoof(roofCX, floorBaseY, roofH, roofW, roofD)
        break
      case 'pyramid':
        roofParts = buildPyramidRoof(roofCX, floorBaseY, roofH, roofW, roofD)
        break
      case 'dome':
        roofParts = buildDomeRoof(roofCX, floorBaseY, roofH, roofW, roofD)
        break
      case 'flat':
      default:
        roofParts = buildFlatRoof(roofCX, floorBaseY, roofW, roofD)
        break
    }
    parts.push(...roofParts)

    // Windows (on the tallest contiguous section)
    if (opts.addWindows !== false) {
      const totalH = floors.reduce((s, f) => s + f.height, 0)
      const winRows = opts.windowRows ?? Math.max(1, floors.length)
      const winCols = opts.windowCols ?? 3
      const mainFloor = floors[0]
      const mainCX = mainFloor.offset?.x ?? 0
      const mainCZ = mainFloor.offset?.z ?? 0
      const winParts = buildWindows(mainCX, 0, totalH, mainFloor.width, mainFloor.depth, winRows, winCols)
      parts.push(...winParts)
      // Suppress unused variable warning
      void mainCZ
    }

    // Door (on the front of the first floor)
    if (opts.addDoor !== false) {
      const groundFloor = floors[0]
      const doorCX = groundFloor.offset?.x ?? 0
      const doorParts = buildDoor(doorCX, 0, groundFloor.width, groundFloor.depth)
      parts.push(...doorParts)
    }

    // Merge everything
    const merged = mergeParts(parts)

    // Copy merged buffers into this geometry
    for (const [name, attr] of merged.attributes) {
      this.setAttribute(name, attr)
    }
    this.index = merged.index
    this.groups = merged.groups.slice()
  }
}
