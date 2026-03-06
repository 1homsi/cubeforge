import React, { useEffect, useState, useContext } from 'react'
import { createTransform } from '@cubeforge/core'
import type { EntityId } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { createRigidBody, createBoxCollider } from '@cubeforge/physics'
import { EngineContext } from '../context'

// ─── Tiled types ──────────────────────────────────────────────────────────────

interface TiledProperty { name: string; type: string; value: string | number | boolean }

interface TiledTileset {
  firstgid: number
  tilewidth: number
  tileheight: number
  spacing: number
  margin: number
  columns: number
  image: string
  imagewidth: number
  imageheight: number
}

export interface TiledObject {
  id: number
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  properties?: TiledProperty[]
}

export interface TiledLayer {
  type: 'tilelayer' | 'objectgroup'
  name: string
  visible: boolean
  opacity: number
  data?: number[]
  objects?: TiledObject[]
  properties?: TiledProperty[]
}

interface TiledMap {
  width: number
  height: number
  tilewidth: number
  tileheight: number
  tilesets: TiledTileset[]
  layers: TiledLayer[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProperty(
  props: TiledProperty[] | undefined,
  name: string,
): string | number | boolean | undefined {
  return props?.find(p => p.name === name)?.value
}

function isCollisionLayer(layer: TiledLayer): boolean {
  return (
    layer.name.toLowerCase() === 'collision' ||
    getProperty(layer.properties, 'collision') === true
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TilemapProps {
  /** URL to the Tiled JSON file */
  src: string
  /**
   * Object layer spawner: called for each object in object layers.
   * Return a React element or null.
   */
  onSpawnObject?: (obj: TiledObject, layer: TiledLayer) => React.ReactNode
  /**
   * Layer filter: return false to skip rendering/processing a layer.
   * Default: all layers rendered.
   */
  layerFilter?: (layer: TiledLayer) => boolean
  /** Z-index for tile sprites (default 0) */
  zIndex?: number
}

export function Tilemap({
  src,
  onSpawnObject,
  layerFilter,
  zIndex = 0,
}: TilemapProps): React.ReactElement | null {
  const engine = useContext(EngineContext)!
  const [spawnedNodes, setSpawnedNodes] = useState<React.ReactNode[]>([])

  useEffect(() => {
    if (!engine) return
    const createdEntities: EntityId[] = []

    async function load() {
      let mapData: TiledMap
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        mapData = await res.json() as TiledMap
      } catch (err) {
        console.warn(`[Cubeforge] Tilemap: failed to load "${src}":`, err)
        return
      }

      const { tilewidth, tileheight, tilesets } = mapData

      // Build tileset image map: GID → { imageSrc, sx, sy, sw, sh }
      function getTileFrame(
        gid: number,
      ): { imageSrc: string; sx: number; sy: number; sw: number; sh: number } | null {
        let tileset: TiledTileset | null = null
        for (let i = tilesets.length - 1; i >= 0; i--) {
          if (gid >= tilesets[i].firstgid) { tileset = tilesets[i]; break }
        }
        if (!tileset) return null
        const localId = gid - tileset.firstgid
        const col = localId % tileset.columns
        const row = Math.floor(localId / tileset.columns)
        const sx = tileset.margin + col * (tileset.tilewidth + tileset.spacing)
        const sy = tileset.margin + row * (tileset.tileheight + tileset.spacing)
        // Resolve image path relative to the map src
        const base = src.substring(0, src.lastIndexOf('/') + 1)
        const imageSrc = tileset.image.startsWith('/') ? tileset.image : base + tileset.image
        return { imageSrc, sx, sy, sw: tileset.tilewidth, sh: tileset.tileheight }
      }

      const objectNodes: React.ReactNode[] = []

      for (const layer of mapData.layers) {
        if (layerFilter && !layerFilter(layer)) continue
        if (!layer.visible) continue

        if (layer.type === 'tilelayer' && layer.data) {
          const collision = isCollisionLayer(layer)

          for (let i = 0; i < layer.data.length; i++) {
            const gid = layer.data[i]
            if (gid === 0) continue

            const col = i % mapData.width
            const row = Math.floor(i / mapData.width)
            // Tile center position
            const x = col * tilewidth + tilewidth / 2
            const y = row * tileheight + tileheight / 2

            const eid = engine.ecs.createEntity()
            createdEntities.push(eid)
            engine.ecs.addComponent(eid, createTransform(x, y))

            if (collision) {
              // Invisible solid collider
              engine.ecs.addComponent(eid, createRigidBody({ isStatic: true }))
              engine.ecs.addComponent(eid, createBoxCollider(tilewidth, tileheight))
            } else {
              // Visual tile — load image and set frame
              const frame = getTileFrame(gid)
              const sprite = createSprite({ width: tilewidth, height: tileheight, color: '#888', zIndex })
              if (frame) {
                sprite.frame = { sx: frame.sx, sy: frame.sy, sw: frame.sw, sh: frame.sh }
                engine.assets.loadImage(frame.imageSrc)
                  .then((img) => {
                    const s = engine.ecs.getComponent<typeof sprite>(eid, 'Sprite')
                    if (s) s.image = img
                  })
                  .catch(() => {})
              }
              engine.ecs.addComponent(eid, sprite)
            }
          }
        } else if (layer.type === 'objectgroup' && layer.objects) {
          if (onSpawnObject) {
            for (const obj of layer.objects) {
              const node = onSpawnObject(obj, layer)
              if (node) objectNodes.push(node)
            }
          }
        }
      }

      setSpawnedNodes(objectNodes)
    }

    load()

    return () => {
      for (const eid of createdEntities) {
        if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (spawnedNodes.length === 0) return null
  return <>{spawnedNodes}</>
}
