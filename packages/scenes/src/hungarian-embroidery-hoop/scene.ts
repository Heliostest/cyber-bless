import * as THREE from 'three'
import { createQuietEnding } from '../quiet-ending'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'
import { createSpoolThreadSim, TAIL_RADIUS, writeFlossTubeInPlace } from './thread-sim'

const COPY = {
  title: '花绣寄语', decorateAction: '添一朵线花', hangAction: '把绣圈安放在展托', quietAction: '轻点绣圈静看',
  decorate: '拿起桌前线轴，送到亚麻布留白处，添上一朵线花。',
  hang: '握住绣圈上方的小铜扣，把整幅线花送到右侧展托。',
  quiet: '轻点绣圈静看，或写一句心意后点「写好了」。',
  returning: '轻点绣圈，回看这份手作心意。', moving: '彩线慢慢铺开，手作稳稳落下…',
  done: '线花留下一点春意。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HOME = new THREE.Vector3(-.72, 1.535, .015), REST = new THREE.Vector3(.82, 1.615, .015), SPOOL_HOME = new THREE.Vector3(-.98, .99, .64)
const ease = (t: number) => t * t * (3 - 2 * t)

/** Fine procedural natural woven linen map (subtle warp/weft slub + hoop-edge tension shadow). */
function createLinenWeaveTexture(): THREE.DataTexture {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    const ny = (y + .5) / size * 2 - 1
    const weftPhase = Math.sin(y * Math.PI * .75)
    const weftSlub = Math.sin(y * .43 + 1.3) * .5 + Math.sin(y * 1.17) * .5
    for (let x = 0; x < size; x++) {
      const nx = (x + .5) / size * 2 - 1
      const warpPhase = Math.sin(x * Math.PI * .75)
      const warpSlub = Math.sin(x * .39 + .7) * .5 + Math.sin(x * 1.09) * .5
      const checker = ((x + y) & 1) ? 1 : -1
      const weave = (warpPhase + weftPhase) * 3.4 + checker * 2.2 + (warpSlub + weftSlub) * 1.8
      const r = Math.hypot(nx, ny)
      const edgeShade = THREE.MathUtils.smoothstep(r, .78, 1.0) * 14
      const i = (y * size + x) * 4
      data[i] = THREE.MathUtils.clamp(Math.round(240 + weave - edgeShade), 185, 252)
      data[i + 1] = THREE.MathUtils.clamp(Math.round(229 + weave * .94 - edgeShade * 1.05), 172, 245)
      data[i + 2] = THREE.MathUtils.clamp(Math.round(207 + weave * .88 - edgeShade * 1.12), 152, 228)
      data[i + 3] = 255
    }
  }
  const map = new THREE.DataTexture(data, size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping
  map.magFilter = map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  return map
}

function buildSpoolHelixPoints(
  turns: number,
  yMin: number,
  yMax: number,
  radius: number,
  samples: number,
  phaseOffset = 0,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const angle = u * turns * Math.PI * 2 + phaseOffset
    const y = THREE.MathUtils.lerp(yMin, yMax, u)
    const r = radius + Math.sin(u * Math.PI) * .0035
    pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r))
  }
  return pts
}

/** Original raised thread flowers for contemporary craft appreciation; no traced traditional pattern. */
export function createHungarianEmbroideryHoop(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false
  let dragging = false, travel = 0, stopResize = () => {}, writer: GestureHandle | null = null
  const returning = ctx.returning === true
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  // Host callbacks may synchronously dispatch input or call update again.
  let notifying = false
  function notifyHost(callback: () => void) {
    const previous = notifying; notifying = true
    try { callback() } finally { notifying = previous }
  }
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.decorateAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)

  const projectedGuide = (goal: THREE.Vector3, grip: THREE.Vector3, contact: THREE.Vector3) => {
    camera.updateMatrixWorld(true)
    const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera)
    g.x+=a.x-b.x;g.y+=a.y-b.y
    return g.unproject(camera)
  }
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'hungarian-embroidery-hoop', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3e9d4, ground: 0xaba596, key: 0xffefdc, rim: 0xd4e7eb,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'embroidery-workbench'; scene.add(world)
  const material = (color: number, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness })
  const oak = material(0xc4a57b), walnut = material(0x87674f), wood = material(0xba854e, .6)
  const linenMap = createLinenWeaveTexture()
  const linen = createRitualMaterial({ color: 0xffffff, map: linenMap, roughness: .84 }, { kind: 'cloth', strength: .14, fiber: 'linen' })
  const weaveTrim = material(0xd7c8ad, .92)
  const pad = applyCraftSurface(material(0xadbdb1, .9), { kind: 'fabric', scale: 1.8, strength: .28 })
  const rose = applyCraftSurface(material(0xbc4562, .58), { kind: 'cord', scale: 2.8, strength: .36 })
  const roseDeep = applyCraftSurface(material(0xaa3b58, .61), { kind: 'cord', scale: 2.8, strength: .36 })
  const pink = applyCraftSurface(material(0xde8090, .60), { kind: 'cord', scale: 2.8, strength: .34 })
  const pinkDeep = applyCraftSurface(material(0xd27084, .63), { kind: 'cord', scale: 2.8, strength: .34 })
  const teal = applyCraftSurface(material(0x428a83, .62), { kind: 'cord', scale: 2.8, strength: .36 })
  const tealDeep = applyCraftSurface(material(0x326f69, .66), { kind: 'cord', scale: 2.8, strength: .36 })
  const gold = applyCraftSurface(material(0xd1a655, .52), { kind: 'cord', scale: 3.0, strength: .34 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xc4a16b, roughness: .45, metalness: .48 })
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const flossThread = (
    name: string,
    points: [number, number, number][],
    radius: number,
    mat: THREE.Material,
    parent: THREE.Object3D,
    options: { tubular?: number; radial?: number; turns?: number; plyDepth?: number; phase?: number; dynamic?: boolean } = {},
  ) => {
    const vecs = points.map(p => new THREE.Vector3(...p))
    const curve = new THREE.CatmullRomCurve3(vecs)
    const geometry = new THREE.TubeGeometry(curve, options.tubular ?? 14, radius, options.radial ?? 8, false)
    if (options.dynamic) {
      ;(geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
      ;(geometry.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    }
    writeFlossTubeInPlace(geometry, vecs, { turns: options.turns ?? 4, plyDepth: options.plyDepth ?? .072, phase: options.phase ?? 0 })
    const mesh = add(name, geometry, mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }
    return mesh as THREE.Mesh<THREE.TubeGeometry>
  }
  addCraftTable(world, { name: 'hoop-table', topName: 'hoop-table-top', width: 3.48, depth: 1.70, surfaceY: .76, thickness: .12, center: [0,.04], support: 'joined', finish: 'birch' })
  const ground = add('hoop-contact-shadow', new THREE.PlaneGeometry(3.9, 2.1), new THREE.ShadowMaterial({ opacity: .13 }), [0, .002, .1]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false
  box('hoop-home-pad', [1.06, .04, .43], [-.72, .78, .015], pad)
  box('hoop-home-back-rest', [.22, .50, .08], [-.72, 1.05, -.08], walnut)
  const cradle = new THREE.Group(); cradle.name = 'hoop-display-cradle'; world.add(cradle)
  box('hoop-cradle-base', [1.12, .08, .60], [.82, .80, .015], walnut, cradle)
  const seat = box('hoop-cradle-seat', [.98, .04, .44], [.82, .86, .015], pad, cradle)
  box('hoop-cradle-back-rest', [.22, .50, .08], [.82, 1.09, -.08], walnut, cradle)
  const hoop = new THREE.Group(); hoop.name = 'hoop-body'; world.add(hoop)
  add('hoop-wooden-ring', new THREE.TorusGeometry(.68, .055, 12, 96), wood, [0, 0, 0], hoop)
  add('hoop-front-bead', new THREE.TorusGeometry(.681, .014, 8, 96), oak, [0, 0, .048], hoop)
  const cloth = add('hoop-linen', new THREE.CylinderGeometry(.668, .668, .034, 96), linen, [0, 0, 0], hoop); cloth.rotation.x = Math.PI / 2
  cloth.userData.toonSurface = { outline: false }
  // Inner tension crease where the stretched linen tucks cleanly inside the wooden hoop rim.
  const clothWeave = new THREE.Group(); clothWeave.name = 'hoop-linen-weave'; hoop.add(clothWeave)
  const tensionCrease = add('hoop-linen-rim-crease', new THREE.TorusGeometry(.623, .004, 6, 72), weaveTrim, [0, 0, .017], clothWeave)
  tensionCrease.userData.toonSurface = { outline: false }
  box('hoop-clamp-left', [.08, .16, .10], [-.095, .70, .005], wood, hoop)
  box('hoop-clamp-right', [.08, .16, .10], [.095, .70, .005], wood, hoop)
  const grip = add('hoop-clamp-bridge', new THREE.CylinderGeometry(.025, .025, .25, 16), brass, [0, .748, .026], hoop); grip.rotation.z = Math.PI / 2
  add('hoop-clamp-knob', new THREE.SphereGeometry(.044, 16, 12), brass, [.157, .748, .026], hoop)
  const stitches = new THREE.Group(); stitches.name = 'hoop-floral-stitches'; hoop.add(stitches)

  // Dense satin-stitched five-petal flowers: 11 closely-packed transverse embroidery floss arches
  // per petal (anchored cleanly into the linen at z=.017) plus coiled French-knot centers.
  type FlourishRevealItem = { mesh: THREE.Mesh; totalIndices: number; startT: number; endT: number; anchorLocal: THREE.Vector3; isKnot?: boolean }
  const flower = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    size: number,
    mat: THREE.Material,
    innerMat: THREE.Material,
    revealList?: FlourishRevealItem[],
  ) => {
    const rows = 11
    const stitchRadius = THREE.MathUtils.clamp(size * .044, .0068, .0098)
    for (let petal = 0; petal < 5; petal++) {
      const a = Math.PI / 2 + petal * Math.PI * 2 / 5, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux
      const petalStart = .34 + petal * .058
      const petalSpan = .056
      for (let row = 0; row < rows; row++) {
        const t = (row + .5) / rows
        const r = size * (.21 + t * .79)
        const w = size * .31 * Math.pow(Math.sin(Math.PI * Math.pow(t, .84)), .82)
        const peakZ = .0385 + .0042 * Math.sin(Math.PI * t)
        const shoulderZ = .017 + (peakZ - .017) * .68
        const px = x + ux * r, py = y + uy * r
        const stitchMat = row < 2 ? innerMat : mat
        const mesh = flossThread(
          'hoop-petal-stitch',
          [
            [px - vx * w, py - vy * w, .017],
            [px - vx * w * .52, py - vy * w * .52, shoulderZ],
            [px, py, peakZ],
            [px + vx * w * .52, py + vy * w * .52, shoulderZ],
            [px + vx * w, py + vy * w, .017],
          ],
          stitchRadius,
          stitchMat,
          parent,
          { tubular: 14, radial: 8, turns: 2.5, plyDepth: .062, phase: row * .55 },
        )
        if (revealList) {
          const sT = petalStart + (row / rows) * petalSpan
          const eT = Math.min(.65, sT + .018)
          const idxCount = mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count
          revealList.push({ mesh, totalIndices: idxCount, startT: sT, endT: eT, anchorLocal: new THREE.Vector3(px, py, peakZ + .008) })
        }
      }
    }
    const knotRingGeo = (r: number, tube: number) => new THREE.TorusGeometry(r, tube, 8, 16)
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7, r = size * .14
      const kx = x + r * Math.cos(a), ky = y + r * Math.sin(a)
      const knot = add('hoop-flower-knot', knotRingGeo(.0095, .0054), gold, [kx, ky, .024], parent)
      knot.userData.toonSurface = { outline: false }
      if (revealList) {
        const sT = .63 + (i / 7) * .055
        revealList.push({ mesh: knot, totalIndices: 0, startT: sT, endT: sT + .015, anchorLocal: new THREE.Vector3(kx, ky, .03), isKnot: true })
      }
    }
    const centerKnot = add('hoop-flower-knot', knotRingGeo(.0085, .0052), gold, [x, y, .026], parent)
    centerKnot.userData.toonSurface = { outline: false }
    if (revealList) {
      revealList.push({ mesh: centerKnot, totalIndices: 0, startT: .675, endT: .695, anchorLocal: new THREE.Vector3(x, y, .032), isKnot: true })
    }
  }

  // Herringbone / fishbone satin-stitched embroidered leaves with central teal vein.
  const leaf = (x: number, y: number, dx: number, dy: number) => {
    const len = Math.hypot(dx, dy)
    const ux = dx / len, uy = dy / len
    const vx = -uy, vy = ux
    flossThread(
      'hoop-leaf-vein',
      [[x, y, .017], [x + dx * .5, y + dy * .5, .026], [x + dx, y + dy, .017]],
      .0068,
      tealDeep,
      stitches,
      { tubular: 16, radial: 8, turns: 5, plyDepth: .065 },
    )
    const pairs = 9
    for (let i = 0; i < pairs; i++) {
      const t = (i + .6) / (pairs + .6)
      const w = .056 * Math.pow(Math.sin(Math.PI * Math.pow(t, .82)), .85)
      const tipShift = Math.min(len * .16, w * .68)
      const bx = x + dx * t, by = y + dy * t
      for (const side of [-1, 1] as const) {
        const ex = bx + vx * w * side + ux * tipShift
        const ey = by + vy * w * side + uy * tipShift
        const mx = (bx + ex) * .5, my = (by + ey) * .5
        const peakZ = .031 + .0045 * Math.sin(Math.PI * t)
        flossThread(
          'hoop-leaf-stitch',
          [[bx, by, .017], [mx, my, peakZ], [ex, ey, .017]],
          .0068,
          i % 3 === 0 ? tealDeep : teal,
          stitches,
          { tubular: 12, radial: 7, turns: 2, plyDepth: .058, phase: i * .4 + side },
        )
      }
    }
  }

  flossThread('hoop-stem', [[-.12, -.38, .017], [-.17, -.17, .028], [-.12, .17, .017]], .0115, teal, stitches, { tubular: 28, radial: 8, turns: 9, plyDepth: .075 })
  flossThread('hoop-branch', [[-.16, -.13, .017], [.04, .04, .027], [.18, .31, .017]], .0088, teal, stitches, { tubular: 24, radial: 8, turns: 8, plyDepth: .072 })
  leaf(-.16, -.18, -.22, .13); leaf(-.15, -.30, .20, .11)
  flower(stitches, -.12, .17, .22, rose, roseDeep); flower(stitches, .19, .32, .105, pink, pinkDeep)

  const flourish = new THREE.Group(); flourish.name = 'hoop-completed-flourish'; hoop.add(flourish)
  const flourishReveal: FlourishRevealItem[] = []
  const flourishStem = flossThread('hoop-flourish-stem', [[-.12, -.37, .017], [.09, -.36, .027], [.25, -.24, .017]], .0088, teal, flourish, { tubular: 24, radial: 8, turns: 7, plyDepth: .072 })
  flourishReveal.push({
    mesh: flourishStem,
    totalIndices: flourishStem.geometry.index ? flourishStem.geometry.index.count : flourishStem.geometry.attributes.position.count,
    startT: .20,
    endT: .34,
    anchorLocal: new THREE.Vector3(.10, -.35, .034),
  })
  flower(flourish, .25, -.22, .14, rose, roseDeep, flourishReveal)

  const spool = new THREE.Group(); spool.name = 'hoop-thread-spool'; world.add(spool)
  add('hoop-spool-bottom', new THREE.CylinderGeometry(.18, .18, .04, 32), wood, [0, -.21, 0], spool)
  add('hoop-spool-core', new THREE.CylinderGeometry(.09, .09, .40, 24), wood, [0, 0, 0], spool)
  add('hoop-wound-thread', new THREE.CylinderGeometry(.138, .138, .35, 40), roseDeep, [0, 0, 0], spool)
  // Continuous non-overlapping double-helix wound embroidery thread replacing disconnected torus rings.
  // Matched pitch (10.5 turns across 0.336 -> pitch 0.032, half-pitch 0.016) with π phase shift keeps
  // the rose and soft-pink accent strands cleanly nested side-by-side with zero crossing z-fighting.
  const mainHelixPts = buildSpoolHelixPoints(10.5, -.168, .168, .1415, 224, 0)
  const mainHelixCurve = new THREE.CatmullRomCurve3(mainHelixPts)
  const mainHelixGeo = new THREE.TubeGeometry(mainHelixCurve, 224, .0092, 8, false)
  writeFlossTubeInPlace(mainHelixGeo, mainHelixPts, { turns: 36, plyDepth: .052 })
  const mainCoil = add('hoop-thread-coil', mainHelixGeo, rose, [0, 0, 0], spool)
  mainCoil.userData.toonSurface = { outline: false }
  const sheenHelixPts = buildSpoolHelixPoints(10.5, -.168, .168, .1402, 224, Math.PI)
  const sheenHelixCurve = new THREE.CatmullRomCurve3(sheenHelixPts)
  const sheenHelixGeo = new THREE.TubeGeometry(sheenHelixCurve, 224, .0076, 8, false)
  writeFlossTubeInPlace(sheenHelixGeo, sheenHelixPts, { turns: 36, plyDepth: .048, phase: .8 })
  const sheenCoil = add('hoop-thread-coil-sheen', sheenHelixGeo, pink, [0, 0, 0], spool)
  sheenCoil.userData.toonSurface = { outline: false }

  const spoolGrip = add('hoop-spool-cap', new THREE.CylinderGeometry(.18, .18, .04, 32), wood, [0, .21, 0], spool)
  const tailGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(.136, -.088, .054), new THREE.Vector3(.26, -.22, .10), new THREE.Vector3(.43, -.22, .12)]),
    36,
    TAIL_RADIUS,
    8,
    false,
  )
  ;(tailGeo.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
  ;(tailGeo.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
  const spoolTail = add('hoop-spool-tail', tailGeo, rose, [0, 0, 0], spool) as THREE.Mesh<THREE.TubeGeometry>
  spoolTail.userData.toonSurface = { outline: false }

  const threadSim = createSpoolThreadSim({
    spoolPos: SPOOL_HOME,
    isActive: active,
    isReducedMotion: reduced,
  })
  const localTailPts = Array.from({ length: 18 }, () => new THREE.Vector3())
  const stitchWorldTarget = new THREE.Vector3()
  const writeTailFromWorldPoints = (worldPts: readonly THREE.Vector3[]) => {
    for (let i = 0; i < worldPts.length; i++) {
      localTailPts[i]!.copy(worldPts[i]!).sub(spool.position)
    }
    writeFlossTubeInPlace(spoolTail.geometry, localTailPts, { turns: 7, plyDepth: .075, taperEnd: true })
  }

  const setFlourishProgress = (progress: number | null) => {
    if (progress === null) {
      for (const item of flourishReveal) {
        item.mesh.visible = true
        if (item.isKnot) item.mesh.scale.setScalar(1)
        else item.mesh.geometry.setDrawRange(0, Infinity)
      }
      return null
    }
    let activeAnchor: THREE.Vector3 | null = null
    for (const item of flourishReveal) {
      const f = THREE.MathUtils.clamp((progress - item.startT) / Math.max(1e-4, item.endT - item.startT), 0, 1)
      if (f <= 0) {
        item.mesh.visible = false
        if (!item.isKnot) item.mesh.geometry.setDrawRange(0, 0)
      } else {
        item.mesh.visible = true
        if (item.isKnot) {
          item.mesh.scale.setScalar(ease(f))
        } else {
          const triCount = Math.floor((item.totalIndices / 3) * f) * 3
          item.mesh.geometry.setDrawRange(0, Math.max(3, triCount))
        }
        if (f < 1 || !activeAnchor) activeAnchor = item.anchorLocal
      }
    }
    return activeAnchor
  }

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    hoop.position.copy(at >= 2 ? REST : HOME)
    spool.position.copy(SPOOL_HOME)
    flourish.visible = at >= 1
    setFlourishProgress(null)
    writeTailFromWorldPoints(threadSim.resetToCalm(spool.position, null))
    matrices()
  }
  const enabled = (step: number) => () => active() && !motion && at === step
  const stitchPoint = () => hoop.localToWorld(new THREE.Vector3(.25, -.22, .017))
  addInteractionCue(spoolGrip, { kind: 'drag', label: '拿起线轴', priority: 3, enabled: enabled(0), destination: stitchPoint, targetLabel: '亚麻布留白' })
  addInteractionCue(grip, { kind: 'drag', label: '握住绣圈铜扣', priority: 3, enabled: enabled(1), destination: () => projectedGuide(seat.getWorldPosition(new THREE.Vector3()),grip.getWorldPosition(new THREE.Vector3()),hoop.localToWorld(new THREE.Vector3(0,-.735,0))), targetLabel: '绣圈展托' })
  addInteractionCue(grip, { kind: 'tap', label: '轻点绣圈静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? spool : hoop
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const visibleHit = (x: number, y: number, targets: THREE.Object3D | THREE.Object3D[], held?: THREE.Object3D) => touch.hit(x, y, targets, { ignore: held })
  let arrivalRadius=22
  const arrivalPoint = () => {
    const q=(at===0?stitchPoint():seat.getWorldPosition(new THREE.Vector3())).project(camera),r=canvas.getBoundingClientRect()
    return {x:r.left+(q.x+1)*r.width/2,y:r.top+(1-q.y)*r.height/2}
  }
  const measureArrival = () => {
    const a=projectTouchPoint(canvas,camera,at===0?spoolGrip:hoop,at===0?[0,0,0]:[0,-.735,0]),b=arrivalPoint()
    arrivalRadius=a?Math.min(22,Math.hypot(a.x-b.x,a.y-b.y)*.42):0
  }
  const automaticReady = (x: number, y: number) => {
    if (at >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, at === 0 ? spoolGrip : hoop, at === 0 ? [0,0,0] : [0,-.735,0])
    const goal=arrivalPoint()
    return !!contact && !touch.occluded(x,y,at===0?cloth:seat,{ignore:moving()}) && Math.hypot(contact.x-goal.x,contact.y-goal.y)<=arrivalRadius && touch.hit(contact.x, contact.y, at === 0 ? cloth : seat, { ignore: moving() })
  }
  const reset = () => { dropFeedback.clear(); dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (notifying || motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? spool : hoop) },
    onStart(x, y) { dropFeedback.clear(); notifyHost(() => feedback.prepare()); down.set(x, y); travel = 0; dragging = at < 2; if(at<2)measureArrival(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point) },
    onMove(x, y) {
      if (notifying) return
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.5, 1.5); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .80, 2.3); matrices()
      if (at === 0) threadSim.wakeUp()
      dropFeedback.setReady(dragging && automaticReady(x, y))
    if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; dropFeedback.clear(); begin(true) }
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && automaticReady(x, y)
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, hoop)
      dropFeedback.clear(); dragging = false
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => active() && !notifying, duration: 3, motion: 'glow', targets: () => [hoop], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    dropFeedback.clear()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(active() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.decorateAction : at === 1 ? COPY.hangAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : at === 0 ? COPY.decorate : at === 1 ? COPY.hang : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(at === 2 && !motion)
  }
  function settle() {
    if (!active() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync()
    notifyHost(() => ctx.onProgress?.(at))
    if (!active()) return
    notifyHost(() => feedback.impact({ freqs: [392, 523.25], duration: .19, gain: .012, type: 'triangle' }))
  }
  function begin(placed = false) { if (notifying || !active() || (pointer.isBusy() && !placed) || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; threadSim.wakeUp(); sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (notifying || !active() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
    if (text.trim() && !returning) notifyHost(() => ctx.saveWish?.(text.trim()))
    if (disposed) return
    notifyHost(() => ctx.onProgress?.(3))
    if (!active()) return
    notifyHost(() => feedback.impact({ freqs: [392, 587.33], duration: .24, gain: .012 }))
    if (!active()) return
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (notifying || !active() || pointer.isBusy() || motion || at === 3) return; notifyHost(() => feedback.prepare()); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.15, 6.15 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.35, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (notifying || !active() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; notifyHost(() => feedback.prepare()); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
      threadSim.start()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true }; return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      let liveStitchTarget: THREE.Vector3 | null = null
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .8); const t = ease(motion.time)
        if (motion.step === 0) {
          // Hover slightly beside the blank linen patch so the live working thread and
          // progressively embroidering third blossom stay clearly unobstructed.
          const target = stitchPoint().add(new THREE.Vector3(-.22, -.02, .24))
          if (t < .68) {
            spool.position.lerpVectors(motion.from, target, Math.min(1, t / .26))
            const hoverPhase = Math.max(0, (t - .26) / .42)
            spool.position.x += Math.sin(hoverPhase * Math.PI * 3) * .026
            spool.position.y += Math.sin(t / .68 * Math.PI) * .042
          } else {
            spool.position.lerpVectors(target, SPOOL_HOME, (t - .68) / .32)
          }
          if (t >= .18) {
            flourish.visible = true
            const activeLocal = setFlourishProgress(t)
            if (activeLocal && t <= .70) {
              hoop.updateMatrixWorld(true)
              stitchWorldTarget.copy(activeLocal).applyMatrix4(hoop.matrixWorld)
              liveStitchTarget = stitchWorldTarget
            }
          } else {
            flourish.visible = false
          }
        } else {
          hoop.position.lerpVectors(motion.from, REST, t)
          if (!reduced()) hoop.position.y += .14 * Math.sin(Math.PI * t)
        }
        if (motion.time === 1) settle()
      }
      if (!disposed && active()) {
        const tailPts = threadSim.step(delta, spool.position, liveStitchTarget, dragging && at === 0)
        writeTailFromWorldPoints(tailPts)
      }
      ending.update(dt)
      if (!disposed && active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true; threadSim.dispose(); pointer.dispose(); dropFeedback.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); linenMap.dispose(); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
