import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { completesDirectionalDrag } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '毛线织暖', insert: '拿住右侧木针，向左上方短拖，让针尖穿入左针末端的线圈。',
  pull: '向右下方短拖右针，把绕好的毛线带出旧圈；松手，旧圈滑下。',
  quiet: '轻点奶白与灰色的织片，静看这一针留下的柔软。',
  done: '留一针暖意在日常。',
  inserting: '木针穿入旧圈，工作线轻轻绕过针尖…', pulling: '新圈穿过旧圈，旧圈从左针尖滑下…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const HOME = new THREE.Vector3(.90, 0, .235), INSERTED = new THREE.Vector3(.64, .20, .235), DRAWN = new THREE.Vector3(.93, -.15, .235)
const BALL_EXIT: XYZ = [.98, -.58, .42]
const NEEDLE_ANGLE = .70
const NEEDLE_AXIS_X = -Math.sin(NEEDLE_ANGLE)
const NEEDLE_AXIS_Y = Math.cos(NEEDLE_ANGLE)
const NEEDLE_SIDE_X = Math.cos(NEEDLE_ANGLE)
const NEEDLE_SIDE_Y = Math.sin(NEEDLE_ANGLE)
const ease = (t: number) => t * t * (3 - 2 * t)
const vectors = (points: XYZ[]) => points.map(p => new THREE.Vector3(...p))

type PliedOptions = { turns: number; plyDepth?: number; phase?: number; capEnds?: boolean }

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
 * Rewrites an existing TubeGeometry in-place with Bishop parallel-transport frames
 * and a stylized 2-ply helical wool cross-section, preserving `geometry.type === 'TubeGeometry'`
 * and `geometry.parameters.path` without per-frame allocation.
 */
function writePliedTube(geometry: THREE.TubeGeometry, curve: THREE.CatmullRomCurve3, options: PliedOptions) {
  const { tubularSegments, radius, radialSegments } = geometry.parameters
  const turns = options.turns
  const plyDepth = options.plyDepth ?? 0.145
  const phase = options.phase ?? 0
  const capEnds = options.capEnds ?? false
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
  const ringStride = radialSegments + 1

  curve.updateArcLengths()
  curve.getTangentAt(0, _prevTan).normalize()
  const ref = Math.abs(_prevTan.dot(_refZ)) < 0.92 ? _refZ : _refY
  _norm.crossVectors(ref, _prevTan).normalize()
  _binorm.crossVectors(_prevTan, _norm).normalize()

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    curve.getPointAt(u, _pt)
    if (i > 0) {
      curve.getTangentAt(u, _tan).normalize()
      const dot = THREE.MathUtils.clamp(_prevTan.dot(_tan), -1, 1)
      if (dot < 0.999999) {
        if (dot > -0.999999) {
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
    // Optional gentle rounded taper only at the outermost ring of open ends.
    let endScale = 1
    if (capEnds && (i === 0 || i === tubularSegments)) endScale = 0.62

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const plyMod = 1 + plyDepth * Math.cos(2 * (theta - twistAngle))
      const r = radius * plyMod * endScale
      const cx = -Math.cos(theta)
      const sy = Math.sin(theta)
      const nx = _norm.x * cx + _binorm.x * sy
      const ny = _norm.y * cx + _binorm.y * sy
      const nz = _norm.z * cx + _binorm.z * sy
      const idx = i * ringStride + j
      posAttr.setXYZ(idx, _pt.x + nx * r, _pt.y + ny * r, _pt.z + nz * r)
    }
  }

  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
  // Weld lighting normals across the radial seam (j = 0 and j = radialSegments).
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

function createPliedTubeGeometry(
  points: XYZ[],
  segments: number,
  radius: number,
  radialSegments: number,
  options: PliedOptions,
  dynamic = false,
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(vectors(points))
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false)
  if (dynamic) {
    ;(geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    ;(geometry.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
  }
  writePliedTube(geometry, curve, options)
  return geometry
}

function updatePliedTubeInPlace(mesh: THREE.Mesh<THREE.TubeGeometry>, points: XYZ[], options: PliedOptions) {
  const geometry = mesh.geometry
  const curve = geometry.parameters.path as THREE.CatmullRomCurve3
  if (curve.points.length !== points.length) {
    curve.points = vectors(points)
  } else {
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      curve.points[i]!.set(p[0], p[1], p[2])
    }
  }
  writePliedTube(geometry, curve, options)
}

/** An original swatch and one ordinary knit stitch, not an exclusive regional technique. */
export function createFaroeseWoolKnit(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, stopResize = () => {}, insertAmount = 0, pullAmount = 0
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let dragging = false, moved = false, maxTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向左上穿入线圈' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'faroese-wool-knit', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeff2e9, ground: 0xada58d, key: 0xfff0d9, rim: 0xd6e6e4, keyPosition: [-3, 5, 4], keyIntensity: 1.7, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .015
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 12 })
  const world = new THREE.Group(); world.name = 'wool-workbench'; scene.add(world)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness })
  const wood = mat(0xba956c), darkWood = mat(0x8d7053), needleWood = mat(0xc39254, .68), needleEnd = mat(0x956b40, .72)
  const woolMat = (color: number) => applyCraftSurface(mat(color, .96), { kind: 'cord', scale: 1.65, strength: .24 })
  const cream = woolMat(0xeee3cc), grey = woolMat(0x7b8982), ballShade = woolMat(0xd8cbb4)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent: THREE.Object3D = world) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(n => n / 3))), material, p, parent)
  const pliedTube = (
    name: string,
    points: XYZ[],
    radius: number,
    material: THREE.Material,
    parent: THREE.Object3D,
    segments: number,
    options: PliedOptions,
    radialSegments = 10,
    dynamic = false,
  ) => {
    const geometry = createPliedTubeGeometry(points, segments, radius, radialSegments, options, dynamic)
    const mesh = add(name, geometry, material, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false, roughness: .96 }
    return mesh as THREE.Mesh<THREE.TubeGeometry>
  }

  // The ordinary tabletop continues beyond the crop. The yarn itself is the
  // subject; there is no separate display board or miniature furniture below it.
  box('wool-table', [9, .18, 7], [0, .625, 0], wood)
  const board = new THREE.Group(); board.name = 'wool-work-surface'; board.position.set(0, .688, 0); board.rotation.x = -Math.PI / 2; world.add(board)

  // Real interlocking stockinette stitch topology: sinker loops meet smoothly at
  // x = ±0.0925 behind the previous course, V-shaped front legs rise forward over
  // the lower stitch crown, and crowns dip back to cradle the emerging next course.
  // All 90 stitches share one 2-ply twisted TubeGeometry and two wool materials.
  const stitchPoints: XYZ[] = [
    [-.0925, -.064, .084],
    [-.062, -.086, .082],
    [-.024, -.072, .122],
    [-.025, -.028, .164],
    [-.046, .025, .172],
    [-.060, .086, .156],
    [-.040, .136, .096],
    [0, .150, .088],
    [.040, .136, .096],
    [.060, .086, .156],
    [.046, .025, .172],
    [.025, -.028, .164],
    [.024, -.072, .122],
    [.062, -.086, .082],
    [.0925, -.064, .084],
  ]
  const stitchGeometry = createPliedTubeGeometry(stitchPoints, 60, .0315, 10, { turns: 3.5, plyDepth: .118 })
  const swatch = new THREE.Group(); swatch.name = 'wool-swatch'; swatch.position.z = -.018; board.add(swatch)
  for (let row = 0; row < 10; row++) for (let column = 0; column < 9; column++) {
    const m = add(`wool-stitch-${row}-${column}`, stitchGeometry, row === 2 || row === 3 || row === 7 ? grey : cream, [-1.19 + column * .185, -.80 + row * .132, 0], swatch)
    m.userData.toonSurface = { outline: false, roughness: .96 }
  }

  // Scalloped long-tail cast-on edge threading snugly through the base of row 0.
  const castOnPoints: XYZ[] = [[-1.29, -.864, .092]]
  for (let col = 0; col < 9; col++) {
    const cx = -1.19 + col * .185
    castOnPoints.push([cx - .052, -.876, .106], [cx, -.870, .136], [cx + .052, -.876, .106])
    if (col < 8) castOnPoints.push([cx + .0925, -.866, .092])
  }
  castOnPoints.push([.392, -.864, .092])
  pliedTube('wool-cast-on-edge', castOnPoints, .029, cream, swatch, 108, { turns: 12, plyDepth: .115, capEnds: true }, 9)

  // Smooth tucked selvedge course joins matching the exact sinker endpoints at alternating edges.
  for (let row = 0; row < 9; row++) {
    const leftEdge = row % 2 === 1
    const side = leftEdge ? -1 : 1
    const x = leftEdge ? -1.2825 : .3825
    const y0 = -.80 + row * .132 - .064
    const y1 = y0 + .132
    pliedTube(
      `wool-course-join-${row}`,
      [
        [x, y0, .084],
        [x + side * .026, y0 + .032, .102],
        [x + side * .032, y0 + .066, .110],
        [x + side * .026, y0 + .100, .102],
        [x, y1, .084],
      ],
      .029,
      row === 2 || row === 3 || row === 7 ? grey : cream,
      swatch,
      20,
      { turns: 1.5, plyDepth: .11 },
      8,
    )
  }

  // Live loops emerge cleanly from row 9's stitch crowns (y ≈ 0.445) and hug
  // snugly over the left wooden needle (y = 0.66, z = 0.215, radius = 0.037).
  const livePoints = (x: number, insert = 0, slip = 0): XYZ[] => {
    const s = THREE.MathUtils.clamp(slip, 0, 1)
    // Carry the crown smoothly beyond the left needle tip (x = 0.44) before lowering it.
    const overTip = Math.sin(s * Math.PI) * .33
    const liftZ = Math.sin(s * Math.PI) * .038
    const openFront = insert * (1 - s) * .022
    const settleY = s * .175
    const settleX = s * .018
    return [
      [x - .046, .435, .124],
      [x - .036 + overTip * .22, .520 - settleY * .25, .162 + openFront * .3],
      [x - .030 + overTip * .68 + settleX * .4, .630 - settleY * .72, .268 + openFront + liftZ - s * .085],
      [x + overTip + settleX, .726 - settleY, .222 + liftZ - s * .055],
      [x + .030 + overTip * .72 + settleX * .5, .635 - settleY * .72, .156 + liftZ * .5 + s * .015],
      [x + .038 + overTip * .24, .520 - settleY * .25, .148],
      [x + .046, .435, .122],
    ]
  }
  for (let i = 0; i < 8; i++) {
    pliedTube(`wool-live-loop-${i}`, livePoints(-1.19 + i * .185), .031, cream, swatch, 40, { turns: 3.0, plyDepth: .115 }, 10)
  }
  const ACTIVE_LOOP_X = .275
  const ACTIVE_LOOP_PLY: PliedOptions = { turns: 3.0, plyDepth: .115 }
  const oldLoop = pliedTube('wool-active-old-loop', livePoints(ACTIVE_LOOP_X), .030, cream, swatch, 44, ACTIVE_LOOP_PLY, 10, true)

  // Small needle rests keep the tapered shafts above the knitted loops.
  const leftNeedle = new THREE.Group(); leftNeedle.name = 'wool-left-needle'; leftNeedle.position.set(-.62, .66, .215); leftNeedle.rotation.z = -Math.PI / 2; board.add(leftNeedle)
  add('wool-left-needle-shaft', new THREE.CylinderGeometry(.037, .037, 1.74, 14), needleWood, [0, 0, 0], leftNeedle)
  add('wool-left-needle-tip', new THREE.ConeGeometry(.037, .19, 14), needleWood, [0, .965, 0], leftNeedle)
  add('wool-left-needle-stop', new THREE.SphereGeometry(.068, 14, 10), needleEnd, [0, -.91, 0], leftNeedle)
  box('wool-left-needle-rest', [.15, .15, .15], [-1.45, .66, .102], darkWood, board)
  const needle = new THREE.Group(); needle.name = 'wool-right-needle'; needle.rotation.z = NEEDLE_ANGLE; board.add(needle)
  const grip = add('wool-right-needle-grip', new THREE.CylinderGeometry(.047, .047, .52, 16), needleWood, [0, -.32, 0], needle)
  add('wool-right-needle-shaft', new THREE.CylinderGeometry(.038, .047, .58, 16), needleWood, [0, .23, 0], needle)
  add('wool-right-needle-tip', new THREE.ConeGeometry(.038, .18, 16), needleWood, [0, .61, 0], needle)
  add('wool-right-needle-stop', new THREE.SphereGeometry(.063, 14, 10), needleEnd, [0, -.61, 0], needle)
  const rightRest = box('wool-right-needle-rest', [.19, .13, .16], [1.17, -.33, .107], darkWood, board); rightRest.rotation.z = NEEDLE_ANGLE
  for (const n of [leftNeedle, needle]) n.traverse(o => { if ((o as THREE.Mesh).isMesh) o.userData.toonSurface = { outline: false, roughness: .68 } })

  // Plush layered wool yarn ball: 5 overlapping plied winding bands hugging an inner wool core.
  const ball = new THREE.Group(); ball.name = 'wool-yarnball'; ball.position.set(1.02, -.70, 0); board.add(ball)
  const core = add('wool-yarnball-core', new THREE.SphereGeometry(.278, 28, 18), ballShade, [0, 0, 0], ball); core.userData.toonSurface = { outline: false, roughness: .96 }
  const bandSpecs: Array<{ euler: XYZ; radius: number; turns: number; yarnR: number; shade: boolean }> = [
    { euler: [0.00, 0.00, 0.00], radius: .283, turns: 13, yarnR: .0185, shade: false },
    { euler: [0.76, 0.58, 0.84], radius: .288, turns: 13, yarnR: .0185, shade: true },
    { euler: [1.52, 1.18, 1.64], radius: .293, turns: 14, yarnR: .0190, shade: false },
    { euler: [2.22, 0.42, 1.18], radius: .297, turns: 13, yarnR: .0190, shade: true },
    { euler: [0.44, 1.72, 2.35], radius: .300, turns: 14, yarnR: .0192, shade: false },
  ]
  for (let band = 0; band < bandSpecs.length; band++) {
    const spec = bandSpecs[band]!
    const points: XYZ[] = []
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.euler))
    for (let i = 0; i <= 260; i++) {
      const t = i / 260
      const latitude = -.82 + t * 1.64
      const angle = t * Math.PI * 2 * spec.turns
      const p = new THREE.Vector3(
        Math.cos(latitude) * Math.cos(angle),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(angle),
      ).multiplyScalar(spec.radius).applyQuaternion(q)
      points.push([p.x, p.y, p.z])
    }
    pliedTube(
      `wool-yarnball-winding-${band}`,
      points,
      spec.yarnR,
      spec.shade ? ballShade : cream,
      ball,
      360,
      { turns: 42, plyDepth: .11, phase: band * .6 },
      7,
    )
  }
  // Seat the actual lowest winding on the tabletop, without a hidden pedestal.
  // In this horizontal work frame the tabletop is at local z = .027.
  const ballBounds = new THREE.Box3()
  for (const child of ball.children) {
    const geometry = (child as THREE.Mesh).geometry; geometry.computeBoundingBox(); ballBounds.union(geometry.boundingBox!)
  }
  ball.position.z = .027 - ballBounds.min.z

  const WORKING_PLY: PliedOptions = { turns: 8.5, plyDepth: .105 }
  const DRAWN_PLY: PliedOptions = { turns: 4.5, plyDepth: .115 }
  const working = pliedTube('wool-working-yarn', [BALL_EXIT, [.86, -.34, .18], [.66, -.02, .11], [.49, .26, .12], [.35, .43, .13], [.30, .46, .12]], .024, cream, board, 112, WORKING_PLY, 10, true)
  const drawnLoop = pliedTube('wool-drawn-loop', [[.255, .47, .14], [.36, .45, .19], [.54, .31, .24], [.58, .26, .20], [.315, .45, .135]], .027, cream, board, 64, DRAWN_PLY, 10, true)

  const needlePoint = (alongDist: number, side = 0, up = 0): XYZ => [
    needle.position.x + NEEDLE_AXIS_X * alongDist + NEEDLE_SIDE_X * side,
    needle.position.y + NEEDLE_AXIS_Y * alongDist + NEEDLE_SIDE_Y * side,
    needle.position.z + up,
  ]
  const lerpXYZ = (a: XYZ, b: XYZ, t: number): XYZ => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (insert: number, pull: number, wrap: number, slip: number) => {
    insertAmount = insert; pullAmount = pull
    needle.position.lerpVectors(HOME, INSERTED, insert).lerp(DRAWN, pull)
    // The small right rest follows the shaft across the work surface.
    rightRest.position.set(needle.position.x + .27, needle.position.y - .33, .107)

    // Continuous working yarn:
    // - At p=0 (wrap=0, pull=0): relaxed 2-ply strand curving softly across tabletop into column 8.
    // - At p=1 (wrap=1, pull=0): lifts under smooth tension and makes one clean helical wrap
    //   around the right needle shaft just behind the tapered tip.
    // - At p=2/3 (wrap=1, pull=1): the wrap releases seamlessly into `wool-drawn-loop`, leaving
    //   a single continuous strand feeding from the yarnball into the new loop on the right needle.
    const w = ease(wrap)
    const p = ease(pull)
    const wrapRadius = .052
    const wrapBaseAlong = .535

    // Fixed 12-point spline so interpolation across rest -> wrap -> drawn has zero collapsed kinks.
    const restPath: XYZ[] = [
      BALL_EXIT,
      [.89, -.36, .165],
      [.79, -.15, .105],
      [.72, .05, .092],
      [.64, .21, .098],
      [.54, .33, .108],
      [.45, .40, .118],
      [.39, .44, .124],
      [.345, .46, .126],
      [.32, .46, .124],
      [.305, .45, .120],
      [.295, .435, .118],
    ]
    const wrappedPath: XYZ[] = [
      BALL_EXIT,
      [.85, -.28, .19],
      [.71, .06, .16],
      [.55, .36, .175],
      needlePoint(wrapBaseAlong - .032, .072, -.018),
      needlePoint(wrapBaseAlong - .010, .048, -.042),
      needlePoint(wrapBaseAlong + .004, -.012, -.054),
      needlePoint(wrapBaseAlong + .016, -.054, -.004),
      needlePoint(wrapBaseAlong + .024, -.024, .052),
      needlePoint(wrapBaseAlong + .016, .038, .040),
      [.345, .495, .148],
      [.295, .440, .122],
    ]
    const drawnFeedExit = needlePoint(wrapBaseAlong - .022, .042, -.032)
    const drawnPath: XYZ[] = [
      BALL_EXIT,
      [.88, -.39, .170],
      [.79, -.21, .115],
      [.72, -.08, .105],
      [.67, .02, .112],
      [.64, .10, .126],
      [.625, .155, .142],
      [.615, .192, .158],
      [.605, .214, .172],
      [.596, .226, .184],
      lerpXYZ([.596, .226, .184], drawnFeedExit, .55),
      drawnFeedExit,
    ]
    const yarn: XYZ[] = []
    for (let i = 0; i < restPath.length; i++) {
      const stage01 = lerpXYZ(restPath[i]!, wrappedPath[i]!, w)
      yarn.push(lerpXYZ(stage01, drawnPath[i]!, p))
    }
    updatePliedTubeInPlace(working, yarn, WORKING_PLY)

    // Newly drawn stitch loop: emerges smoothly through the slipped old loop collar
    // with an open teardrop loop body and hugs snugly around the right needle shaft.
    drawnLoop.visible = pull > 0
    if (pull > 0) {
      const seatAlong = .535
      const arcLift = .024 * Math.sin(p * Math.PI)
      const rootL: XYZ = [.252, .472, .138]
      const rootR: XYZ = [.308, .452, .136]
      const shoulderL = lerpXYZ([.265, .525, .185], [.395, .460, .202 + arcLift], p)
      const shoulderR = lerpXYZ([.315, .505, .170], [.425, .348, .172 + arcLift], p)
      const drawnPts: XYZ[] = [
        rootL,
        shoulderL,
        needlePoint(seatAlong + .018, -.048, .026),
        needlePoint(seatAlong + .028, -.006, wrapRadius),
        needlePoint(seatAlong + .014, .048, .020),
        needlePoint(seatAlong - .014, .044, -.032),
        shoulderR,
        rootR,
      ]
      updatePliedTubeInPlace(drawnLoop, drawnPts, DRAWN_PLY)
    }

    updatePliedTubeInPlace(oldLoop, livePoints(ACTIVE_LOOP_X, insert, slip), ACTIVE_LOOP_PLY)
    matrices()
  }
  const restore = () => pose(at > 0 ? 1 : 0, at >= 2 ? 1 : 0, at > 0 ? 1 : 0, at >= 2 ? 1 : 0)
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const quietStitch = swatch.getObjectByName('wool-stitch-3-3')!
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', direction: [-1, -1], label: '拿住木针，向左上穿入', anchor: [0, 0, .047], priority: 3, enabled: enabled(0) }),
    addInteractionCue(grip, { kind: 'drag', direction: [1, 1], label: '向右下抽出新线圈', anchor: [0, 0, .047], priority: 3, enabled: enabled(1) }),
    addInteractionCue(quietStitch, { kind: 'tap', label: '轻点织片静看', anchor: [.046, .025, .202], priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const belongs = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const direction = () => at === 0 ? new THREE.Vector2(-.8, -.6) : new THREE.Vector2(42, 46).normalize()
  const reset = () => { dragging = moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore() }
  // Stop callback-dispatched input before the pointer controller can cancel its owner.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); const hit = nearestHit(x, y); return at < 2 ? belongs(hit?.object, needle) : belongs(hit?.object, swatch) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y, dir = direction()
      along = dx * dir.x + dy * dir.y; maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along)
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(dx * dir.y - dy * dir.x)); moved ||= maxTravel > 0
      if (dragging) { const amount = THREE.MathUtils.clamp(along / (at === 0 ? 60 : 62.29), 0, 1); at === 0 ? pose(amount, 0, 0, 0) : pose(1, amount, 1, 0) }
    },
    onRelease(x, y) {
      const dx = x - down.x, dy = y - down.y, dir = direction(), end = dx * dir.x + dy * dir.y
      const valid = at < 2 ? dragging && moved && completesDirectionalDrag({ along, end, maxAlong, minAlong, backtrack, maxCross, cross: dx * dir.y - dy * dir.x, travel: maxTravel }, 42, at === 0 ? 60 : 62.29)
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && belongs(nearestHit(x, y)?.object, swatch)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => inputActive(), duration: 3, motion: 'glow',
    targets: () => [swatch], cancelInput: () => pointer.cancel(), complete: () => advance(),
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, at === 0 ? '向左上穿入线圈' : at === 1 ? '向右下抽出新线圈' : '轻点织片静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.inserting : COPY.pulling : at === 0 ? COPY.insert : at === 1 ? COPY.pull : at === 2 ? COPY.quiet : COPY.done, safe)
    ending.sync(at === 2 && !motion)
  }
  function withHostCallbacks(work: () => void) { notifying = true; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (active()) feedback.impact({ freqs: [220, 330], duration: .12, gain: .007, type: 'sine' }) })
  }
  function advance() {
    if (at === 2 && !ending.completing) return
    if (!inputActive() || pointer.isBusy() || motion || at === 3) return
    if (at === 2) {
      at = 3; restore(); withHostCallbacks(() => { ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [220, 293.66], duration: .18, gain: .006 }); if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) }); return
    }
    motion = { step: at, time: 0, from: at === 0 ? insertAmount : pullAmount }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), distance = Math.max(4.35, 4.95 / aspect)
    camera.position.set(0, .80 + distance * .93, distance * .37); camera.lookAt(0, .80, 0); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      if (motion) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .82); const t = ease(motion.time)
        if (motion.step === 0) pose(THREE.MathUtils.lerp(motion.from, 1, Math.min(t * 2, 1)), 0, ease(THREE.MathUtils.clamp((t - .35) / .65, 0, 1)), 0)
        else pose(1, THREE.MathUtils.lerp(motion.from, 1, Math.min(t * 1.7, 1)), 1, ease(THREE.MathUtils.clamp((t - .4) / .6, 0, 1)))
        if (motion.time === 1) settle()
      }
      if (!active()) return
      ending.update(dt)
      if (!active()) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
