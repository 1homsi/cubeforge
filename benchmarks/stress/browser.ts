/** Browser stress page: same scenarios as the headless runner, on a real WebGL2 context. */
import { SCENARIOS, VIEWPORT, type ScenarioContext } from './scenarios'

const hud = document.getElementById('hud')!
const canvas = document.getElementById('c') as HTMLCanvasElement
const name = new URLSearchParams(location.search).get('scenario') ?? SCENARIOS[0].name
const def = SCENARIOS.find((s) => s.name === name) ?? SCENARIOS[0]

async function makeAtlas(): Promise<HTMLImageElement> {
  const c = document.createElement('canvas')
  c.width = c.height = VIEWPORT.atlasSize
  const g = c.getContext('2d')!
  for (let i = 0; i < 256; i++) {
    g.fillStyle = `hsl(${(i * 47) % 360} 70% 55%)`
    g.fillRect((i % 16) * 16 + 1, Math.floor(i / 16) * 16 + 1, 14, 14)
  }
  const img = new Image()
  img.src = c.toDataURL()
  await img.decode()
  return img
}

const ctx: ScenarioContext = {
  canvas,
  atlas: await makeAtlas(),
  createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
  now: () => performance.now(),
}
const sc = def.setup(ctx)
const links = SCENARIOS.map((s) => `<a href="?scenario=${s.name}">${s.name}</a>`).join('')

let frames = 0
let accUpdate = 0
let accSim = 0
let accRender = 0
let last = performance.now()
function tick(): void {
  sc.step()
  const s = sc.stats
  accUpdate += s.updateMs
  accSim += s.scriptMs
  accRender += s.renderMs
  frames++
  const now = performance.now()
  if (now - last >= 1000) {
    const r = s.render
    const f = frames
    hud.innerHTML =
      `${links}\n${sc.name}: ${sc.description}\n` +
      `fps ${((f * 1000) / (now - last)).toFixed(1)}  cpu/frame ${(accUpdate / f).toFixed(2)}ms ` +
      `(sim ${(accSim / f).toFixed(2)}, render ${(accRender / f).toFixed(2)})\n` +
      `entities ${s.entityCount}  draws ${r.drawCalls}  instances ${r.instances}  culled ${r.spritesCulled}\n` +
      `uploads ${(r.textureUploadBytes / 1048576).toFixed(1)}MB/frame  textures ${r.textureCount} (${(r.textureBytes / 1048576).toFixed(1)}MB)`
    frames = accUpdate = accSim = accRender = 0
    last = now
  }
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
