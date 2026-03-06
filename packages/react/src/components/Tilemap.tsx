import React, { useEffect, useState, useContext } from 'react'
import { createTransform, createScript } from '@cubeforge/core'
import type { EntityId } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import type { SpriteComponent } from '@cubeforge/renderer'
import { createRigidBody, createBoxCollider } from '@cubeforge/physics'
import { EngineContext } from '../context'

// ─── Tiled types ──────────────────────────────────────────────────────────────

interface TiledProperty { name: string; type: string; value: string | number | boolean }

interface TiledTileAnimation {
  tileid: number
  duration: number
}

interface TiledTileData {
  id: number
  animation?: TiledTileAnimation[]
  properties?: TiledProperty[]
}

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
  /** Per-tile data (animations, properties, etc.) */
  tiles?: TiledTileData[]
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

// ─── Animated tile state (module-level, shared across instances) ───────────────

interface AnimatedTileState {
  frames: number[]
  durations: number[]
  timer: number
  currentFrame: number
}

const animatedTiles = new Map<EntityId, AnimatedTileState>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProperty(
  props: TiledProperty[] | undefined,
  name: string,
): string | number | boolean | undefined {
  return props?.find(p => p.name === name)?.value
}

function matchesLayerName(layer: TiledLayer, name: string): boolean {
  return (
    layer.name === name ||
    layer.name.toLowerCase() === name.toLowerCase()
  )
}

function isCollisionLayer(layer: TiledLayer, collisionLayer: string): boolean {
  return (
    matchesLayerName(layer, collisionLayer) ||
    getProperty(layer.properties, 'collision') === true
  )
}

function isTriggerLayer(layer: TiledLayer, triggerLayer: string): boolean {
  return (
    matchesLayerName(layer, triggerLayer) ||
    getProperty(layer.properties, 'trigger') === true
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
  /**
   * Name of the layer (or layers with property `collision: true`) that
   * should create invisible solid colliders. Default: "collision".
   */
  collisionLayer?: string
  /**
   * Name of the layer (or layers with property `trigger: true`) that
   * should create trigger BoxColliders (no sprite). Default: "triggers".
   */
  triggerLayer?: string
  /**
   * Called for every tile that has custom properties defined in the tileset.
   * Receives the global tile ID, the property map, and the tile's world position.
   */
  onTileProperty?: (tileId: number, properties: Record<string, unknown>, x: number, y: number) => void
}

export function Tilemap({
  src,
  onSpawnObject,
  layerFilter,
  zIndex = 0,
  collisionLayer = 'collision',
  triggerLayer: triggerLayerName = 'triggers',
  onTileProperty,
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

      // Resolve the tileset for a given GID, plus the local tile id within it
      function resolveTileset(gid: number): { tileset: TiledTileset; localId: number } | null {
        let tileset: TiledTileset | null = null
        for (let i = tilesets.length - 1; i >= 0; i--) {
          if (gid >= tilesets[i].firstgid) { tileset = tilesets[i]; break }
        }
        if (!tileset) return null
        return { tileset, localId: gid - tileset.firstgid }
      }

      // Build tileset image map: GID → { imageSrc, sx, sy, sw, sh }
      function getTileFrame(
        gid: number,
      ): { imageSrc: string; sx: number; sy: number; sw: number; sh: number } | null {
        const resolved = resolveTileset(gid)
        if (!resolved) return null
        const { tileset, localId } = resolved
        const col = localId % tileset.columns
        const row = Math.floor(localId / tileset.columns)
        const sx = tileset.margin + col * (tileset.tilewidth + tileset.spacing)
        const sy = tileset.margin + row * (tileset.tileheight + tileset.spacing)
        // Resolve image path relative to the map src
        const base = src.substring(0, src.lastIndexOf('/') + 1)
        const imageSrc = tileset.image.startsWith('/') ? tileset.image : base + tileset.image
        return { imageSrc, sx, sy, sw: tileset.tilewidth, sh: tileset.tileheight }
      }

      // Look up per-tile data (animation, properties) from the tileset
      function getTileData(gid: number): TiledTileData | null {
        const resolved = resolveTileset(gid)
        if (!resolved) return null
        const { tileset, localId } = resolved
        return tileset.tiles?.find(t => t.id === localId) ?? null
      }

      // Compute the frame region for a local tile id within a tileset
      function getFrameForLocalId(
        tileset: TiledTileset,
        localId: number,
      ): { imageSrc: string; sx: number; sy: number; sw: number; sh: number } {
        const col = localId % tileset.columns
        const row = Math.floor(localId / tileset.columns)
        const sx = tileset.margin + col * (tileset.tilewidth + tileset.spacing)
        const sy = tileset.margin + row * (tileset.tileheight + tileset.spacing)
        const base = src.substring(0, src.lastIndexOf('/') + 1)
        const imageSrc = tileset.image.startsWith('/') ? tileset.image : base + tileset.image
        return { imageSrc, sx, sy, sw: tileset.tilewidth, sh: tileset.tileheight }
      }

      const objectNodes: React.ReactNode[] = []

      for (const layer of mapData.layers) {
        if (layerFilter && !layerFilter(layer)) continue
        if (!layer.visible) continue

        if (layer.type === 'tilelayer' && layer.data) {
          const collision = isCollisionLayer(layer, collisionLayer)
          const trigger = !collision && isTriggerLayer(layer, triggerLayerName)

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
            } else if (trigger) {
              // Invisible trigger collider — no sprite, no rigid body blocking movement
              engine.ecs.addComponent(eid, createBoxCollider(tilewidth, tileheight, { isTrigger: true }))
            } else {
              // Visual tile — load image and set frame
              const frame = getTileFrame(gid)
              const sprite = createSprite({ width: tilewidth, height: tileheight, color: '#888', zIndex })
              if (frame) {
                sprite.frame = { sx: frame.sx, sy: frame.sy, sw: frame.sw, sh: frame.sh }
                engine.assets.loadImage(frame.imageSrc)
                  .then((img) => {
                    const s = engine.ecs.getComponent<SpriteComponent>(eid, 'Sprite')
                    if (s) s.image = img
                  })
                  .catch(() => {})
              }
              engine.ecs.addComponent(eid, sprite)

              // Check for animated tile
              const tileData = getTileData(gid)
              if (tileData?.animation && tileData.animation.length > 0) {
                const resolved = resolveTileset(gid)!
                const frames = tileData.animation.map(a => a.tileid)
                const durations = tileData.animation.map(a => a.duration / 1000) // ms → seconds
                const state: AnimatedTileState = { frames, durations, timer: 0, currentFrame: 0 }
                animatedTiles.set(eid, state)

                // Pre-load first frame image (tileset image already loading above)
                // Set initial frame region from the first animation frame
                const firstFrameRegion = getFrameForLocalId(resolved.tileset, frames[0])
                engine.assets.loadImage(firstFrameRegion.imageSrc)
                  .then((img) => {
                    const s = engine.ecs.getComponent<SpriteComponent>(eid, 'Sprite')
                    if (s) {
                      s.image = img
                      s.frame = {
                        sx: firstFrameRegion.sx,
                        sy: firstFrameRegion.sy,
                        sw: firstFrameRegion.sw,
                        sh: firstFrameRegion.sh,
                      }
                    }
                  })
                  .catch(() => {})

                engine.ecs.addComponent(eid, createScript((_eid, world, _input, dt) => {
                  const animState = animatedTiles.get(_eid)
                  if (!animState) return
                  animState.timer += dt
                  const currentDuration = animState.durations[animState.currentFrame]
                  if (animState.timer >= currentDuration) {
                    animState.timer -= currentDuration
                    animState.currentFrame = (animState.currentFrame + 1) % animState.frames.length
                    const nextLocalId = animState.frames[animState.currentFrame]
                    const resolvedTs = resolveTileset(gid)
                    if (!resolvedTs) return
                    const region = getFrameForLocalId(resolvedTs.tileset, nextLocalId)
                    const s = world.getComponent<SpriteComponent>(_eid, 'Sprite')
                    if (s) {
                      s.frame = { sx: region.sx, sy: region.sy, sw: region.sw, sh: region.sh }
                    }
                  }
                }))
              }

              // Fire onTileProperty callback if tile has custom properties
              if (onTileProperty && tileData?.properties && tileData.properties.length > 0) {
                const propsMap: Record<string, unknown> = {}
                for (const p of tileData.properties) {
                  propsMap[p.name] = p.value
                }
                onTileProperty(gid, propsMap, x, y)
              }
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
        animatedTiles.delete(eid)
        if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (spawnedNodes.length === 0) return null
  return <>{spawnedNodes}</>
}
