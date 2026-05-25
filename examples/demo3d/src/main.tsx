/**
 * CubeForge 3D — Village demo
 *
 * A walkable small-town scene demonstrating:
 *   - Procedural terrain (gentle rolling hills)
 *   - ProceduralBuilding3D town layout
 *   - Directional sun + soft ambient fill
 *   - Sky3D with auto-rotating time of day
 *   - FlyCamera3D for ground-level exploration
 */

import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Game3D,
  Terrain3D,
  ProceduralBuilding3D,
  DirectionalLight3D,
  AmbientLight3D,
  Camera3D,
  FlyCamera3D,
  Sky3D,
  Weather3D,
  DebugOverlay3D,
} from 'cubeforge'

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

interface HUDProps {
  timeOfDay: number
  pos: { x: number; y: number; z: number }
  debug: boolean
  onDebugChange: (v: boolean) => void
}

function HUD({ timeOfDay, pos, debug, onDebugChange }: HUDProps) {
  const hour = Math.floor(timeOfDay * 24)
  const minute = Math.floor((timeOfDay * 24 - hour) * 60)
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`

  const phase =
    timeOfDay < 0.2 ? '🌙 Night'
    : timeOfDay < 0.28 ? '🌅 Dawn'
    : timeOfDay < 0.72 ? '☀️ Day'
    : timeOfDay < 0.8 ? '🌇 Dusk'
    : '🌙 Night'

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 10,
        fontSize: 13,
        lineHeight: 1.9,
        userSelect: 'none',
        minWidth: 210,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>CubeForge Village</div>
      <div style={{ color: '#bbb', fontSize: 11, marginBottom: 6 }}>
        Click to capture mouse · ESC to release
      </div>
      <div style={{ color: '#bbb', fontSize: 11, marginBottom: 6 }}>
        WASD to move · Ctrl for speed · Space/Shift up/down
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6 }}>
        <span style={{ fontSize: 12 }}>
          {phase} &nbsp;·&nbsp; {timeStr}
        </span>
        <br />
        <span style={{ color: '#999', fontSize: 11 }}>
          {pos.x.toFixed(1)}, {pos.y.toFixed(1)}, {pos.z.toFixed(1)}
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => onDebugChange(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Debug Overlay
        </label>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Crosshair
// ---------------------------------------------------------------------------

function Crosshair() {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 5,
        opacity: 0.7,
      }}
    >
      <svg width={20} height={20} viewBox="0 0 20 20">
        <line x1={10} y1={2} x2={10} y2={8} stroke="white" strokeWidth={1.5} />
        <line x1={10} y1={12} x2={10} y2={18} stroke="white" strokeWidth={1.5} />
        <line x1={2} y1={10} x2={8} y2={10} stroke="white" strokeWidth={1.5} />
        <line x1={12} y1={10} x2={18} y2={10} stroke="white" strokeWidth={1.5} />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

function DemoScene() {
  const [debug, setDebug] = useState(false)
  const [timeOfDay, setTimeOfDay] = useState(0.28)
  const [pos, setPos] = useState({ x: 0, y: 6, z: 50 })

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      <HUD timeOfDay={timeOfDay} pos={pos} debug={debug} onDebugChange={setDebug} />
      <Crosshair />

      <Game3D
        width={window.innerWidth}
        height={window.innerHeight}
        fov={70}
        near={0.3}
        far={2000}
        background={[0.35, 0.5, 0.65]}
        shadows={false}
        postProcess={false}
      >
        {/* Camera3D active=true replaces engine.camera (runs before FlyCamera3D  */}
        {/* captures the reference) so we start at this exact position.          */}
        <Camera3D
          active
          position={[0, 6, 50]}
          lookAt={[0, 2, 0]}
          fov={70}
          near={0.3}
          far={2000}
        />
        <FlyCamera3D
          speed={12}
          fastSpeed={50}
          lookSensitivity={0.1}
          minY={2}
          onPositionChange={(x, y, z) => setPos({ x, y, z })}
        />

        {/* ── Sky ─────────────────────────────────────────────────────────────── */}
        <Sky3D
          autoRotate
          rotateSpeed={0.0025}
          turbidity={4}
          rayleigh={1.5}
          moonEnabled
          starsEnabled
          onTimeChange={setTimeOfDay}
        />
        <Weather3D type="clear" />

        {/* ── Lighting ────────────────────────────────────────────────────────── */}
        {/* Sun — warm directional light */}
        <DirectionalLight3D
          color={[1.0, 0.92, 0.78]}
          intensity={2.4}
          position={[120, 160, 80]}
          castShadow={false}
        />
        {/* Ambient fill — prevents pitch-black shadows, gives sky-bounce feel */}
        <AmbientLight3D color={[0.38, 0.43, 0.58]} intensity={0.9} />

        {/* ── Ground ──────────────────────────────────────────────────────────── */}
        {/* Low maxElevation keeps terrain gentle so buildings don't clip below  */}
        {/* the surface, and the camera (minY=2) stays above the ground.         */}
        <Terrain3D
          procedural
          proceduralOpts={{ octaves: 4, lacunarity: 2.0, persistence: 0.4, seed: 17 }}
          width={600}
          height={600}
          widthSegments={180}
          heightSegments={180}
          maxElevation={3}
          receiveShadow={false}
        />

        {/* ── Town layout ──────────────────────────────────────────────────────── */}
        {/* Buildings placed at y=0. Terrain maxElevation=3 means the worst-case  */}
        {/* ground clip is subtle and hidden by the building base.                 */}
        {/*                                                                         */}
        {/*  Main street runs along Z. Camera starts at z=50 looking toward z=0.   */}
        {/*                                                                         */}
        {/* LEFT SIDE                                                               */}
        <ProceduralBuilding3D position={[-16, 0, -32]} numFloors={8}  width={11} depth={11} castShadow receiveShadow />
        <ProceduralBuilding3D position={[-14, 0, -12]} numFloors={5}  width={9}  depth={10} castShadow receiveShadow />
        <ProceduralBuilding3D position={[-18, 0,   6]} numFloors={4}  width={10} depth={9}  castShadow receiveShadow />
        <ProceduralBuilding3D position={[-15, 0,  24]} numFloors={6}  width={8}  depth={11} castShadow receiveShadow />
        <ProceduralBuilding3D position={[-14, 0,  40]} numFloors={3}  width={9}  depth={8}  castShadow receiveShadow />

        {/* RIGHT SIDE                                                              */}
        <ProceduralBuilding3D position={[ 18, 0, -30]} numFloors={6}  width={10} depth={12} castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 16, 0, -10]} numFloors={9}  width={12} depth={10} castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 18, 0,   8]} numFloors={4}  width={9}  depth={9}  castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 15, 0,  26]} numFloors={7}  width={11} depth={10} castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 17, 0,  42]} numFloors={3}  width={8}  depth={9}  castShadow receiveShadow />

        {/* BACK ROW — closes the street at the far end                            */}
        <ProceduralBuilding3D position={[ -6, 0, -52]} numFloors={12} width={10} depth={10} castShadow receiveShadow />
        <ProceduralBuilding3D position={[  6, 0, -56]} numFloors={10} width={11} depth={11} castShadow receiveShadow />
        <ProceduralBuilding3D position={[  0, 0, -48]} numFloors={7}  width={8}  depth={8}  castShadow receiveShadow />

        {/* SIDE STREETS                                                            */}
        <ProceduralBuilding3D position={[-38, 0, -18]} numFloors={4}  width={10} depth={9}  castShadow receiveShadow />
        <ProceduralBuilding3D position={[-36, 0,   2]} numFloors={3}  width={8}  depth={8}  castShadow receiveShadow />
        <ProceduralBuilding3D position={[-40, 0,  20]} numFloors={5}  width={9}  depth={10} castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 38, 0, -15]} numFloors={6}  width={11} depth={9}  castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 40, 0,   5]} numFloors={4}  width={9}  depth={11} castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 36, 0,  22]} numFloors={3}  width={8}  depth={8}  castShadow receiveShadow />

        {/* DISTANT SKYLINE                                                         */}
        <ProceduralBuilding3D position={[-22, 0, -72]} numFloors={16} width={9}  depth={9}  castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 14, 0, -80]} numFloors={20} width={10} depth={10} castShadow receiveShadow />
        <ProceduralBuilding3D position={[ -4, 0, -68]} numFloors={14} width={8}  depth={8}  castShadow receiveShadow />
        <ProceduralBuilding3D position={[ 30, 0, -65]} numFloors={11} width={9}  depth={9}  castShadow receiveShadow />
        <ProceduralBuilding3D position={[-35, 0, -60]} numFloors={13} width={10} depth={10} castShadow receiveShadow />

        {/* ── Debug ───────────────────────────────────────────────────────────── */}
        <DebugOverlay3D enabled={debug} axes grid boundingBoxes={false} />
      </Game3D>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const root = createRoot(document.getElementById('root')!)
root.render(<DemoScene />)
