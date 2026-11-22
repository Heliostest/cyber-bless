import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { addCraftTable } from '../cozy-furniture'
import { createQuietEnding } from '../quiet-ending'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '织毯寄暖', weaveAction: '收好最后一行纬线', displayAction: '把织毯安放在展架', quietAction: '轻点织毯静看',
  weave: '拿起桌前木梭，送到织毯下缘的留白，收好最后一行纬线。',
  display: '握住织毯上方的木夹杆，把整幅织毯移到右侧展架。',
  quiet: '轻点织毯静看，或写一句心意后点「写好了」。', returning: '轻点织毯，回看这一份暖意。',
  moving: '纬线收拢，织毯缓缓安放…', done: '留一份手作的暖意。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const HOME = new THREE.Vector3(-.75, 1.63, .10), REST = new THREE.Vector3(.75, 1.63, .10)
const SHUTTLE_HOME = new THREE.Vector3(-.73, .78, .62)
const WARP_COUNT = 18
const WARP_MIN_X = -.476
const WARP_STEP = .952 / (WARP_COUNT - 1)
const warpX = (i: number) => WARP_MIN_X + i * WARP_STEP
const ease = (t: number) => t * t * (3 - 2 * t)

const _pt = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _prevTan = new THREE.Vector3()
const _norm = new THREE.Vector3()
const _binorm = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _refZ = new THREE.Vector3(0, 0, 1)
const _refY = new THREE.Vector3(0, 1, 0)
const _seamN = new THREE.Vector3()

/**
 * Rewrites a TubeGeometry in-place with Bishop parallel-transport frames and a soft
 * 2-ply twisted wool profile (gentle plyDepth so closeups remain plush, never pointy).
 */
function writeWoolTube(
  geometry: THREE.TubeGeometry,
  curve: THREE.CatmullRomCurve3,
  options: { turns?: number; plyDepth?: number; phase?: number; taperEnd?: boolean } = {},
) {
  const { tubularSegments, radius, radialSegments } = geometry.parameters
  const turns = options.turns ?? 5
  const plyDepth = options.plyDepth ?? .068
  const phase = options.phase ?? 0
  const taperEnd = options.taperEnd ?? false
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
  const ringStride = radialSegments + 1

  curve.updateArcLengths()
  curve.getTangentAt(0, _prevTan).normalize()
  const ref = Math.abs(_prevTan.dot(_refZ)) < .92 ? _refZ : _refY
  _norm.crossVectors(ref, _prevTan).normalize()
  _binorm.crossVectors(_prevTan, _norm).normalize()

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    curve.getPointAt(u, _pt)
    if (i > 0) {
      curve.getTangentAt(u, _tan).normalize()
      const dot = THREE.MathUtils.clamp(_prevTan.dot(_tan), -1, 1)
      if (dot < .999999) {
        if (dot > -.999999) {
          _quat.setFromUnitVectors(_prevTan, _tan)
          _norm.applyQuaternion(_quat)
        }
        _norm.addScaledVector(_tan, -_norm.dot(_tan))
        if (_norm.lengthSq() > 1e-10) _norm.normalize()
      }
      _binorm.crossVectors(_tan, _norm).normalize()
      _prevTan.copy(_tan)
    }

    const twistAngle = u * turns * Math.PI * 2 + phase
    let endScale = 1
    if (taperEnd && i === tubularSegments) endScale = .72
    else if (taperEnd && i === tubularSegments - 1) endScale = .90

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const r = radius * (1 + plyDepth * Math.cos(2 * (theta - twistAngle))) * endScale
      const cx = -Math.cos(theta)
      const sy = Math.sin(theta)
      const nx = _norm.x * cx + _binorm.x * sy
      const ny = _norm.y * cx + _binorm.y * sy
      const nz = _norm.z * cx + _binorm.z * sy
      posAttr.setXYZ(i * ringStride + j, _pt.x + nx * r, _pt.y + ny * r, _pt.z + nz * r)
    }
  }

  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
  for (let i = 0; i <= tubularSegments; i++) {
    const a = i * ringStride
    const b = a + radialSegments
    _seamN.set(
      normAttr.getX(a) + normAttr.getX(b),
      normAttr.getY(a) + normAttr.getY(b),
      normAttr.getZ(a) + normAttr.getZ(b),
    )
    if (_seamN.lengthSq() > 1e-10) {
      _seamN.normalize()
      normAttr.setXYZ(a, _seamN.x, _seamN.y, _seamN.z)
      normAttr.setXYZ(b, _seamN.x, _seamN.y, _seamN.z)
    }
  }
  normAttr.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

function createWoolTubeGeometry(
  points: XYZ[],
  segments: number,
  radius: number,
  radialSegments: number,
  options: { turns?: number; plyDepth?: number; phase?: number; taperEnd?: boolean } = {},
  dynamic = false,
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false)
  if (dynamic) {
    ;(geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    ;(geometry.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
  }
  writeWoolTube(geometry, curve, options)
  return geometry
}

function updateWoolTubeInPlace(
  mesh: THREE.Mesh<THREE.TubeGeometry>,
  points: XYZ[],
  options: { turns?: number; plyDepth?: number; phase?: number; taperEnd?: boolean } = {},
) {
  const geometry = mesh.geometry
  const curve = geometry.parameters.path as THREE.CatmullRomCurve3
  if (curve.points.length !== points.length) {
    curve.points = points.map(p => new THREE.Vector3(...p))
  } else {
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      curve.points[i]!.set(p[0], p[1], p[2])
    }
  }
  writeWoolTube(geometry, curve, options)
}

/** Builds an over-under tabby interlaced weft path spanning [x0, x1] at height y. */
function buildInterlacedWeftPoints(
  x0: number,
  x1: number,
  y: number,
  baseZ: number,
  waveAmp: number,
  rowIndex: number,
  reverse = false,
): XYZ[] {
  const span = Math.abs(x1 - x0)
  const samples = Math.max(10, Math.round(span / (WARP_STEP * .45)))
  const pts: XYZ[] = []
  const phaseSign = rowIndex % 2 === 0 ? 1 : -1
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const x = reverse ? THREE.MathUtils.lerp(x1, x0, u) : THREE.MathUtils.lerp(x0, x1, u)
    // Edge turn tuck strictly clamped to [0, 1] so interior weft never dips into the wool core.
    const edgeT = Math.min(1, Math.min(u, 1 - u) / .07)
    const tuckFactor = Math.sin(edgeT * Math.PI * .5)
    const warpPhase = ((x - WARP_MIN_X) / WARP_STEP) * Math.PI
    const overUnder = Math.cos(warpPhase) * phaseSign * waveAmp * tuckFactor
    const arch = Math.sin(u * Math.PI) * .0018
    const z = baseZ - (1 - tuckFactor) * .0036 + overUnder + arch
    pts.push([x, y + Math.sin(warpPhase) * .0009 * phaseSign, z])
  }
  return pts
}

/** Original wool stripes and offset blocks; no borrowed ritual motifs or symbolic claims. */
export function createAmazighWovenRug(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, at: Checkpoint = 0, inactiveRendered = false, callbackLocked = false
  let dragging = false, travel = 0, stopResize = () => {}, writer: GestureHandle | null = null
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  // Responsive damped-pendulum wool fringe state (analytical, zero WASM).
  let fringeAngle = 0, fringeVel = 0, fringePhase = 0
  let prevRugX = HOME.x, prevRugVx = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !callbackLocked
  const reduced = () => ctx.isReducedMotion?.() ?? false
  // A feedback callback can deactivate its host; audio must observe that immediately.
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.weaveAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'amazigh-woven-rug', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3e9d4, ground: 0xaba596, key: 0xffefdc, rim: 0xd4e7eb,
    keyPosition: [-3, 5, 4], keyIntensity: 1.25, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'rug-workbench'; scene.add(world)
  const material = (color: number, roughness = .94) => new THREE.MeshStandardMaterial({ color, roughness })
  const fabricMat = (color: number, roughness = .95, scale = 2.0, strength = .24) =>
    applyCraftSurface(material(color, roughness), { kind: 'fabric', scale, strength })
  const yarnMat = (color: number, roughness = .95, scale = 2.1, strength = .26) =>
    applyCraftSurface(material(color, roughness), { kind: 'cord', scale, strength })
  const woodMat = (color: number, roughness = .80) =>
    applyCraftSurface(material(color, roughness), { kind: 'wood', scale: 1.25, strength: .30 })

  // Preserve original warm ivory / ochre / rust / muted indigo / flax / oak palette.
  const ivory = fabricMat(0xe6d9bd, .95, 2.2, .22)
  const gapBacking = fabricMat(0xd6c7a9, .97, 2.4, .28)
  const ivoryWeft = yarnMat(0xede1c7, .96, 2.2, .22)
  const ivoryWeftAlt = yarnMat(0xdfd0b2, .96, 2.2, .24)
  const warpFlax = yarnMat(0xcbbca0, .96, 2.5, .26)
  const ochre = yarnMat(0xb78343, .95)
  const ochreLight = yarnMat(0xc79453, .95)
  const rust = yarnMat(0xa95f4c, .95)
  const rustShade = yarnMat(0x985341, .95)
  const indigo = yarnMat(0x566e83, .95)
  const indigoShade = yarnMat(0x4b6276, .95)
  const flax = yarnMat(0xd2c4a7, .96)
  const fringeIvory = yarnMat(0xeae0c8, .96, 2.3, .22)
  const oak = woodMat(0xc4aa83, .80), wood = woodMat(0xa08463, .80)

  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const woolThread = (
    name: string,
    points: XYZ[],
    radius: number,
    mat: THREE.Material,
    parent: THREE.Object3D,
    segments: number,
    radial = 6,
    opts: { turns?: number; plyDepth?: number; phase?: number; taperEnd?: boolean } = {},
    dynamic = false,
  ) => {
    const mesh = add(name, createWoolTubeGeometry(points, segments, radius, radial, opts, dynamic), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false, roughness: .95 }
    return mesh as THREE.Mesh<THREE.TubeGeometry>
  }

  addCraftTable(world, { name: 'rug-table', topName: 'rug-table-top', width: 3.26, depth: 1.52, surfaceY: .74, thickness: .12, center: [0,.02], support: 'trestle', finish: 'chestnut' })
  const ground = add('rug-contact-shadow', new THREE.PlaneGeometry(3.7, 1.95), new THREE.ShadowMaterial({ opacity: .13 }), [0, .002, .02]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false
  const stand = (prefix: string, x: number) => {
    const group = new THREE.Group(); group.name = `${prefix}-stand`; world.add(group)
    box(`${prefix}-base`, [1.42, .08, .48], [x, .78, -.04], wood, group)
    for (const dx of [-.64, .64]) box(`${prefix}-upright`, [.065, 1.36, .09], [x + dx, 1.50, .035], oak, group)
    // Rear lip catches the clamp; its front stops behind the wool surface.
    return box(`${prefix}-seat`, [1.42, .10, .06], [x, 2.23, .035], oak, group)
  }
  stand('rug-home', -.75); const seat = stand('rug-display', .75)
  const rug = new THREE.Group(); rug.name = 'rug-body'; world.add(rug)
  const wool = box('rug-wool', [1.08, 1.34, .068], [0, 0, 0], ivory, rug); wool.userData.toonSurface = { outline: false, roughness: .95 }
  const grip = box('rug-top-grip', [1.34, .10, .17], [0, .70, -.01], wood, rug)
  for (const x of [-.46, .46]) {
    const peg = add('rug-clamp-peg', new THREE.CylinderGeometry(.026, .026, .016, 16), oak, [x, .70, .082], rug); peg.rotation.x = Math.PI / 2
  }

  // Overcast whip-stitched selvedges along left and right edges, binding all weft turns.
  for (const side of [-1, 1]) {
    const xBase = side * .526
    woolThread('rug-bound-edge', [[xBase, -.65, 0], [xBase, 0, .005], [xBase, .65, 0]], .0145, ochre, rug, 14, 6, { turns: 7, plyDepth: .06 })
    const whipPts: XYZ[] = []
    const turns = 28
    const samples = turns * 4
    for (let i = 0; i <= samples; i++) {
      const u = i / samples
      const a = u * turns * Math.PI * 2
      whipPts.push([
        xBase + side * (.004 + .0135 * Math.cos(a)),
        -.645 + u * 1.29,
        .0385 * Math.sin(a),
      ])
    }
    woolThread('rug-selvedge-whip', whipPts, .0076, ochreLight, rug, 120, 6, { turns: 18, plyDepth: .05 })
  }

  // Woven back weft and flush-integrated front ivory ground courses with over-under warp relief.
  for (let i = 0; i < 24; i++) {
    const y = -.635 + i * .055
    woolThread('rug-back-weft', buildInterlacedWeftPoints(-.505, .505, y, -.0355, .0022, i), .0052, flax, rug, 22, 5, { turns: 4, plyDepth: .05 })
  }
  // Helper: carve out rectangular zones occupied by colored tapestry blocks so ivory ground sits flush beside them.
  const blockZones: ReadonlyArray<readonly [number, number, number, number]> = [
    [-.51, .51, .455, .565],    // top ochre band
    [-.51, .51, .372, .422],    // top indigo band
    [-.475, -.025, .045, .248], // left rust offset block
    [.025, .455, -.12, .083],   // right indigo offset block
    [-.435, -.025, -.315, -.188], // lower-left ochre block
    [-.51, .51, -.44, -.372],   // lower rust band
  ]
  for (let row = 0; row < 44; row++) {
    const y = -.462 + row * .0255
    if (y > .636) break
    let spans: Array<[number, number]> = [[-.505, .505]]
    for (const [bx0, bx1, by0, by1] of blockZones) {
      if (y < by0 || y > by1) continue
      const next: Array<[number, number]> = []
      for (const [sx0, sx1] of spans) {
        if (bx1 <= sx0 || bx0 >= sx1) { next.push([sx0, sx1]); continue }
        if (bx0 > sx0 + .04) next.push([sx0, bx0])
        if (bx1 < sx1 - .04) next.push([bx1, sx1])
      }
      spans = next
    }
    const rowMat = row % 2 === 0 ? ivoryWeft : ivoryWeftAlt
    for (const [sx0, sx1] of spans) {
      const segs = Math.max(14, Math.round((sx1 - sx0) * 38))
      woolThread(
        'rug-ivory-weft',
        buildInterlacedWeftPoints(sx0, sx1, y, .0345, .0022, row),
        .0098,
        rowMat,
        rug,
        segs,
        6,
        { turns: Math.max(2, Math.round((sx1 - sx0) * 8)), plyDepth: .058, phase: row * .7 },
      )
    }
  }

  // Non-symbolic bands and offset blocks built from interlaced 2-ply wool courses.
  const band = (
    x: number,
    y: number,
    width: number,
    rows: number,
    matA: THREE.Material,
    matB: THREE.Material,
    parent: THREE.Object3D = rug,
    alternateDir = false,
  ) => {
    const meshes: THREE.Mesh<THREE.TubeGeometry>[] = []
    for (let i = 0; i < rows; i++) {
      const dy = y + i * .0195
      const segs = Math.max(20, Math.round(width * 42))
      const rev = alternateDir && i % 2 === 1
      const pts = buildInterlacedWeftPoints(x - width / 2, x + width / 2, dy, .0392, .0028, i, rev)
      const m = woolThread(
        'rug-colored-weft',
        pts,
        .0108,
        i % 2 === 0 ? matA : matB,
        parent,
        segs,
        7,
        { turns: Math.max(3, Math.round(width * 10)), plyDepth: .065, phase: i * .9 },
      )
      meshes.push(m)
    }
    return meshes
  }
  band(0, .47, .99, 5, ochre, ochreLight)
  band(0, .385, .99, 2, indigo, indigoShade)
  band(-.25, .06, .43, 10, rust, rustShade)
  band(.24, -.105, .41, 10, indigo, indigoShade)
  band(-.23, -.30, .39, 6, ochre, ochreLight)
  band(0, -.425, .99, 3, rust, rustShade)

  // Recessed loom shed for the unfinished lower weft gap, spanned by 18 taut vertical warp threads.
  // Warp columns are symmetric about x=0 (warp 8 at -0.028, warp 9 at +0.028) so the raycast
  // cue center at x=0 hits `rug-weft-gap` cleanly as first visible opaque surface.
  // Warp z = 0.0368 sits proud of the recessed gap backing (0.0355) yet tucks neatly behind
  // the finished ochre weft courses (front z = 0.047..0.053) once woven!
  const gap = box('rug-weft-gap', [1.00, .13, .013], [0, -.55, .029], gapBacking, rug)
  gap.userData.toonSurface = { outline: false, roughness: .97 }
  const warpGeo = new THREE.CylinderGeometry(.0042, .0042, .185, 6)
  for (let i = 0; i < WARP_COUNT; i++) {
    const wx = warpX(i)
    const warp = add('rug-warp-thread', warpGeo, warpFlax, [wx, -.556, .0368], rug)
    warp.userData.toonSurface = { outline: false, roughness: .96 }
  }
  // Subtle top warp header ticks peeking cleanly beneath the wooden clamp bar.
  const topWarpGeo = new THREE.CylinderGeometry(.0042, .0042, .038, 6)
  for (let i = 0; i < WARP_COUNT; i++) {
    const tw = add('rug-top-warp', topWarpGeo, warpFlax, [warpX(i), .642, .035], rug)
    tw.userData.toonSurface = { outline: false, roughness: .96 }
  }

  // Finishing ochre weft band: progressively drawn across the exposed warps during step 0 weaving.
  const finishing = new THREE.Group(); finishing.name = 'rug-finished-row'; rug.add(finishing)
  const finishingRows = band(0, -.593, .99, 5, ochre, ochreLight, finishing, true)
  const finishingFullCounts = finishingRows.map(m => m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count)

  // Live trailing ochre weft thread linking the active finishing row to the shuttle during step 0.
  const liveWeft = woolThread(
    'rug-live-weft',
    [[-.75, 1.04, .14], [-.75, 1.00, .20], [-.75, .92, .28], [-.75, .86, .42]],
    .0085,
    ochre,
    world,
    24,
    6,
    { turns: 6, plyDepth: .065 },
    true,
  )
  liveWeft.visible = false

  // Warp-aligned knotted wool fringe pairs along the lower hem (18 pairs × 2 strands = 36 fringes).
  // Pre-allocated dynamic TubeGeometries allow calm analytical carry-sway with zero allocation.
  const knotGeo = new THREE.TorusGeometry(.0125, .0072, 7, 12)
  type FringeSpec = {
    mesh: THREE.Mesh<THREE.TubeGeometry>
    x: number
    side: -1 | 1
    length: number
    naturalCurlX: number
    naturalZ: number
    phaseOffset: number
    swayScale: number
  }
  const fringeSpecs: FringeSpec[] = []
  const fringeControlPoints = (spec: FringeSpec, swayX: number, swayZ: number): XYZ[] => {
    const len = spec.length
    const s = swayX * spec.swayScale
    const sx1 = Math.sin(s * .52) * len * .48 + spec.naturalCurlX * .45
    const sy1 = -Math.cos(s * .52) * len * .48
    const sx2 = Math.sin(s) * len + spec.naturalCurlX
    const sy2 = -Math.cos(s) * len
    const zMid = .013 + spec.naturalZ * .45 + swayZ * .35
    const zTip = .020 + spec.naturalZ + swayZ
    return [
      [spec.x, -.656, .011],
      [spec.x + sx1 * .55, -.656 + sy1 * .55, zMid * .75],
      [spec.x + sx1, -.656 + sy1, zMid],
      [spec.x + sx2, -.656 + sy2, zTip],
    ]
  }
  for (let i = 0; i < WARP_COUNT; i++) {
    const wx = warpX(i)
    const knot = add('rug-fringe-knot', knotGeo, fringeIvory, [wx, -.666, .013], rug)
    knot.rotation.x = Math.PI / 2 * .32
    knot.scale.set(1.06, .88, .96)
    knot.userData.toonSurface = { outline: false, roughness: .96 }
    for (const side of [-1, 1] as const) {
      const idx = i * 2 + (side === 1 ? 1 : 0)
      const x = wx + side * .0055
      const length = .118 + ((i * 5 + (side === 1 ? 2 : 0)) % 4) * .0075
      const naturalCurlX = side * (.007 + (i % 3) * .0025) + Math.sin(idx * 1.9) * .004
      const naturalZ = ((idx % 3) - 1) * .0045
      const spec: FringeSpec = {
        mesh: null as unknown as THREE.Mesh<THREE.TubeGeometry>,
        x,
        side,
        length,
        naturalCurlX,
        naturalZ,
        phaseOffset: i * .24 + (side === 1 ? .18 : 0),
        swayScale: .88 + (length - .118) * 4.5,
      }
      spec.mesh = woolThread(
        'rug-fringe',
        fringeControlPoints(spec, 0, 0),
        .0064,
        fringeIvory,
        rug,
        8,
        6,
        { turns: 2.2, plyDepth: .065, phase: idx * .7, taperEnd: true },
        true,
      )
      fringeSpecs.push(spec)
    }
  }
  const updateFringes = (angle: number, liftZ = 0) => {
    for (const spec of fringeSpecs) {
      const localAngle = angle === 0 ? 0 : angle * (1 + .10 * Math.sin(fringePhase + spec.phaseOffset))
      const localZ = liftZ === 0 ? 0 : liftZ * (.85 + .25 * Math.cos(spec.phaseOffset))
      updateWoolTubeInPlace(spec.mesh, fringeControlPoints(spec, localAngle, localZ), {
        turns: 2.2,
        plyDepth: .065,
        phase: spec.phaseOffset,
        taperEnd: true,
      })
    }
  }

  // Wooden boat shuttle wound with continuous cross-laid helical ochre wool matching the finishing weft.
  const shuttle = new THREE.Group(); shuttle.name = 'rug-shuttle'; world.add(shuttle)
  const hullShape = new THREE.Shape().moveTo(-.35, 0).lineTo(-.23, -.10).lineTo(.23, -.10).lineTo(.35, 0).lineTo(.23, .10).lineTo(-.23, .10).closePath()
  const hull = add('rug-shuttle-hull', new THREE.ExtrudeGeometry(hullShape, { depth: .08, bevelEnabled: false }), wood, [0, .04, 0], shuttle); hull.rotation.x = Math.PI / 2
  const yarn = add('rug-shuttle-yarn', new THREE.CylinderGeometry(.044, .044, .31, 20), ochre, [-.045, .049, 0], shuttle); yarn.rotation.z = Math.PI / 2
  yarn.userData.toonSurface = { outline: false, roughness: .95 }
  // Continuous helical cross-wound ochre wool layers (kept as `rug-shuttle-coil` children of `shuttle`).
  for (let pass = 0; pass < 2; pass++) {
    const pts: XYZ[] = []
    const turns = 11
    const samples = turns * 10
    const rad = .0485 + pass * .0055
    for (let i = 0; i <= samples; i++) {
      const u = i / samples
      const dir = pass === 0 ? u : 1 - u
      const a = u * turns * Math.PI * 2 + pass * 1.4
      const bulge = Math.sin(dir * Math.PI) * .0085
      pts.push([
        -.188 + dir * .288,
        .049 + (rad + bulge) * Math.cos(a),
        (rad + bulge) * Math.sin(a),
      ])
    }
    woolThread(
      'rug-shuttle-coil',
      pts,
      .0072,
      pass === 0 ? ochre : ochreLight,
      shuttle,
      110,
      6,
      { turns: 22, plyDepth: .055, phase: pass * 1.1 },
    )
  }
  const shuttleGrip = box('rug-shuttle-grip', [.12, .035, .15], [.25, .048, 0], oak, shuttle)
  const shuttleTail = woolThread(
    'rug-shuttle-tail',
    [[-.135, .056, .046], [-.185, .014, .105], [-.235, -.024, .132], [-.295, -.031, .148]],
    .0068,
    ochre,
    shuttle,
    18,
    6,
    { turns: 4.5, plyDepth: .065, taperEnd: true },
  )

  const setFinishingProgress = (progress: number) => {
    const p = THREE.MathUtils.clamp(progress, 0, 1)
    finishing.visible = p > 0
    for (let i = 0; i < finishingRows.length; i++) {
      const rowMesh = finishingRows[i]!
      const full = finishingFullCounts[i]!
      const rowFrac = THREE.MathUtils.clamp(p * finishingRows.length - i, 0, 1)
      if (rowFrac <= .01) {
        rowMesh.visible = false
      } else {
        rowMesh.visible = true
        const tris = Math.floor((full * rowFrac) / 3) * 3
        rowMesh.geometry.setDrawRange(0, Math.max(3, Math.min(full, tris)))
      }
    }
  }

  const resetFringes = () => {
    if (fringeAngle !== 0 || fringeVel !== 0) {
      fringeAngle = 0
      fringeVel = 0
      fringePhase = 0
      updateFringes(0, 0)
    }
  }

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    rug.position.copy(at >= 2 ? REST : HOME)
    prevRugX = rug.position.x
    prevRugVx = 0
    shuttle.position.copy(SHUTTLE_HOME)
    shuttle.rotation.set(0, 0, 0)
    shuttleTail.visible = true
    liveWeft.visible = false
    setFinishingProgress(at >= 1 ? 1 : 0)
    resetFringes()
    matrices()
  }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(shuttleGrip, { kind: 'drag', label: '拿起木梭', priority: 3, enabled: enabled(0), destination: gap, targetLabel: '下缘留白' }),
    addInteractionCue(grip, { kind: 'drag', label: '握住木夹杆', priority: 3, enabled: enabled(1), destination: seat, targetLabel: '织毯展架' }),
    addInteractionCue(grip, { kind: 'tap', label: '轻点织毯静看', priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? shuttle : rug
  const touchTarget = createTouchTarget(canvas, camera, scene)
  const visibleHit = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => touchTarget.hit(x, y, target, { ignore: held })
  const automaticReady = (x: number, y: number) => {
    if (at >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, at === 0 ? shuttleGrip : grip, [0,0,0])
    return !!contact && !touchTarget.occluded(x,y,at === 0 ? gap : seat,{ignore:moving()}) && touchTarget.hit(contact.x, contact.y, at === 0 ? gap : seat, { ignore: moving() })
  }
  const reset = () => { dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? shuttle : rug) },
    onStart(x, y) {
      callbackBoundary(() => feedback.prepare()); if (!active()) { pointer.cancel(); return }
      down.set(x, y); travel = 0; dragging = at < 2
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), moving().position)
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point)
    },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || !ray.aim(x, y).ray.intersectPlane(plane, point)) return
      moving().position.copy(point).add(offset); moving().position.x = THREE.MathUtils.clamp(moving().position.x, -1.25, 1.25); moving().position.y = THREE.MathUtils.clamp(moving().position.y, .80, 2.3); matrices()
      if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; begin(true) }
    },
    onRelease(x, y) {
      matrices()
      const valid = at < 2 ? dragging && automaticReady(x, y)
        : at === 2 && travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, rug)
      dragging = false
      if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: inputActive, duration: 3, motion: 'glow',
    targets: () => [rug], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.weaveAction : at === 1 ? COPY.displayAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : at === 0 ? COPY.weave : at === 1 ? COPY.display : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(at === 2 && !motion)
  }
  // Host callbacks may synchronously dispatch input or update the scene. Keep this
  // entire acceptance boundary closed until the original action has returned.
  function callbackBoundary(work: () => void) {
    callbackLocked = true; sync()
    try { work() } finally { callbackLocked = false; if (!disposed) sync() }
  }
  function settle() {
    if (!inputActive() || !motion) return
    const next = (motion.step + 1) as Checkpoint
    const keepCarrySwing = motion.step === 1 && !reduced()
    const carryAngle = fringeAngle, carryVel = fringeVel
    callbackBoundary(() => {
      at = next; motion = null; restore()
      if (keepCarrySwing && (Math.abs(carryAngle) > 1e-4 || Math.abs(carryVel) > 1e-4)) {
        fringeAngle = carryAngle; fringeVel = carryVel
        updateFringes(fringeAngle, Math.abs(fringeAngle) * .018)
        matrices()
      }
      sync(); ctx.onProgress?.(at)
      if (!active()) return
      feedback.impact({ freqs: [349.23, 523.25], duration: .17, gain: .011, type: 'triangle' })
    })
  }
  function begin(placed = false) { if (!inputActive() || (pointer.isBusy() && !placed) || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    callbackBoundary(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      // Saving and the accepted checkpoint commit together through a pause, but never after disposal.
      if (disposed) return
      ctx.onProgress?.(3); if (!active()) return
      feedback.impact({ freqs: [349.23, 523.25], duration: .22, gain: .011 }); if (!active()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3) return; callbackBoundary(() => feedback.prepare()); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 3.1, 6.3 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.34, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (!inputActive() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; callbackBoundary(() => feedback.prepare()); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed || callbackLocked) return
      if (!active()) { pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (cueLayer) cueLayer.hidden = true; if (!inactiveRendered) { style.render(); inactiveRendered = true }; return }
      if (inactiveRendered || cueLayer?.hidden) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      const quiet = reduced()
      if (motion) {
        motion.time = quiet ? 1 : Math.min(1, motion.time + delta / .8)
        const t = ease(motion.time)
        if (motion.step === 0) {
          const gapCenter = gap.getWorldPosition(new THREE.Vector3())
          const leftEntry = new THREE.Vector3(gapCenter.x - .54, gapCenter.y - .015, gapCenter.z + .14)
          const rightExit = new THREE.Vector3(gapCenter.x + .54, gapCenter.y + .025, gapCenter.z + .14)
          if (t < .20) {
            const u = ease(t / .20)
            shuttle.position.lerpVectors(motion.from, leftEntry, u)
            shuttle.rotation.z = .08 * Math.sin(u * Math.PI)
            setFinishingProgress(0)
            liveWeft.visible = false
          } else if (t < .78) {
            const weaveT = (t - .20) / .58
            setFinishingProgress(weaveT)
            // Back-and-forth shuttle passes aligned with the 5 finishing weft courses.
            const passFloat = weaveT * 5
            const rowIdx = Math.min(4, Math.floor(passFloat))
            const rowFrac = passFloat - rowIdx
            const leftToRight = rowIdx % 2 === 0
            const rowX = leftToRight
              ? THREE.MathUtils.lerp(leftEntry.x, rightExit.x, rowFrac)
              : THREE.MathUtils.lerp(rightExit.x, leftEntry.x, rowFrac)
            const rowY = gapCenter.y - .043 + rowIdx * .0195
            const leadDir = leftToRight ? 1 : -1
            shuttle.position.set(rowX + leadDir * .16, rowY - .01, gapCenter.z + .155)
            shuttle.rotation.z = -leadDir * .06
            // Continuous ochre weft thread linking the freshly laid weft frontier to the shuttle bobbin.
            const laidX = THREE.MathUtils.clamp(rowX, gapCenter.x - .495, gapCenter.x + .495)
            const bobbinX = shuttle.position.x - .045
            const bobbinY = shuttle.position.y + .049
            const bobbinZ = shuttle.position.z + .035
            updateWoolTubeInPlace(
              liveWeft,
              [
                [laidX, rowY, gapCenter.z + .012],
                [THREE.MathUtils.lerp(laidX, bobbinX, .36), rowY - .008, THREE.MathUtils.lerp(gapCenter.z + .025, bobbinZ, .42)],
                [THREE.MathUtils.lerp(laidX, bobbinX, .72), THREE.MathUtils.lerp(rowY, bobbinY, .72) - .006, THREE.MathUtils.lerp(gapCenter.z + .03, bobbinZ, .78)],
                [bobbinX, bobbinY, bobbinZ],
              ],
              { turns: 5, plyDepth: .062 },
            )
            liveWeft.visible = !quiet
            shuttleTail.visible = false
          } else {
            const u = ease((t - .78) / .22)
            shuttle.position.lerpVectors(rightExit, SHUTTLE_HOME, u)
            shuttle.rotation.z = 0
            setFinishingProgress(1)
            liveWeft.visible = false
            shuttleTail.visible = true
          }
        } else {
          rug.position.lerpVectors(motion.from, REST, t)
          if (!quiet) rug.position.y += .15 * Math.sin(Math.PI * t)
        }
        if (motion.time === 1) settle()
      }

      // Responsive wool fringe inertia during carry drag/transfer and brief settle.
      if (quiet) {
        resetFringes()
      } else if (delta > 0) {
        const vx = (rug.position.x - prevRugX) / delta
        const ax = THREE.MathUtils.clamp((vx - prevRugVx) / delta, -18, 18)
        prevRugX = rug.position.x
        prevRugVx = vx
        const movingCarry = (motion?.step === 1) || (dragging && at === 1)
        const dragForce = movingCarry ? (-vx * 7.8 - ax * .46) : 0
        if (movingCarry || Math.abs(fringeAngle) > 1e-4 || Math.abs(fringeVel) > 1e-4) {
          // Damped angular pendulum: natural wool drape lag + soft post-landing settle.
          const omega = 7.4, zeta = .38
          const acc = -omega * omega * fringeAngle - 2 * zeta * omega * fringeVel + dragForce
          fringeVel += acc * delta
          fringeAngle = THREE.MathUtils.clamp(fringeAngle + fringeVel * delta, -.44, .44)
          fringePhase += delta * 6.5
          if (!movingCarry && Math.abs(fringeAngle) < 8e-4 && Math.abs(fringeVel) < 3e-3) {
            fringeAngle = 0; fringeVel = 0
            updateFringes(0, 0)
          } else {
            const liftZ = movingCarry ? .012 + Math.abs(fringeAngle) * .022 : Math.abs(fringeAngle) * .016
            updateFringes(fringeAngle, liftZ)
          }
        }
      }

      ending.update(dt)
      if (disposed || !active()) return
      matrices(); style.render()
    },
    dispose() { if (disposed) return; ending.dispose(); disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
