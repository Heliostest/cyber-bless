import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import {
  applyStylizedHumanSurfaceHint,
  buildStylizedHandRig,
  createStylizedGarmentMaterial,
  createStylizedHairGeometry,
  createStylizedHeadGeometry,
  createStylizedLimbGeometry,
  createStylizedSkinMaterial,
  createStylizedSleeveCuffGeometry,
  createStylizedTorsoGeometry,
  subdivideClosedCage,
} from '@wbr/scene-runtime/stylized-human'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '巨偶待游', assemble: '把桌前的小花章别在衣襟上，为节庆巨偶添一枚自己的装饰。',
  suspend: '握住底座前的木把，将完整巨偶移到右侧圆台，站稳后静静欣赏。',
  rest: '轻点底座静看。把街头节庆的热闹，收进一件安静的小手作。',
  moving: '小花章与巨偶缓缓就位…', done: '准备妥当，留一刻欣赏手作的耐心。',
} as const
const HOME = new THREE.Vector3(-.73, .72, 0), REST = new THREE.Vector3(.79, .86, 0)
const ROSETTE_HOME = new THREE.Vector3(-1.27, .87, .65), JOIN = new THREE.Vector3(-.14, 1.29, .284)
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original dressed festival miniature; a contemporary workshop pause. */
export function createCatalanFestivalGiant(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '别上小花章' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'catalan-festival-giant', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xffefd8, ground: 0xb3b7a2, key: 0xffe7c0, rim: 0xd8e7d8, keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 4, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .022
  const world = new THREE.Group(); world.name = 'giant-workbench'; scene.add(world)
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .85 })
  const clay = createStylizedGarmentMaterial({ color: 0xbc7057, roughness: .91, fabricStrength: .30, name: 'giant-skirt-cloth' })
  const ochre = createStylizedGarmentMaterial({ color: 0xd6ac60, roughness: .90, fabricStrength: .26, name: 'giant-ochre-cloth' })
  const oak = material(0xb9976a), walnut = material(0x785740)
  const cream = createStylizedGarmentMaterial({ color: 0xf0dfb3, roughness: .92, fabricStrength: .20, name: 'giant-cream-cloth' })
  const sage = createStylizedGarmentMaterial({ color: 0x608e89, roughness: .91, fabricStrength: .28, name: 'giant-bodice-cloth' })
  const skin = createStylizedSkinMaterial({ color: 0xe7bd99, roughness: .84, scatterStrength: .11, name: 'giant-papier-mache-skin' })
  const hair = new THREE.MeshStandardMaterial({ color: 0x855840, roughness: .84, vertexColors: true })
  const hatFelt = createStylizedGarmentMaterial({ color: 0xd6ac60, roughness: .90, fabricStrength: .22, name: 'giant-hat-felt' })
  const ink = material(0x4b392b)
  const rosetteCream = material(0xf0dfb3), rosetteOchre = material(0xd6ac60), rosetteClay = material(0xbc7057)
  const padSage = material(0x608e89)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.025, h / 3, d / 3)), mat, xyz, name, parent)
  const ball = (r: number, xyz: [number, number, number], mat: THREE.Material, parent: THREE.Object3D, name = '') => add(new THREE.SphereGeometry(r, 24, 18), mat, xyz, name, parent)
  const disc = (r: number, h: number, xyz: [number, number, number], mat: THREE.Material, name = '', parent: THREE.Object3D = world) => add(new THREE.CylinderGeometry(r, r, h, 48), mat, xyz, name, parent)
  addCraftTable(world, { name: 'giant-table', topName: 'giant-table', width: 3.5, depth: 1.85, surfaceY: .72, thickness: .12, center: [0,0], support: 'trestle', finish: 'honey' })
  const shadow = add(new THREE.PlaneGeometry(4, 2.6), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  disc(.59, .12, [.79, .78, 0], walnut, 'giant-plinth')
  const peg = disc(.53, .02, [.79, .85, 0], rosetteCream, 'giant-display-seat')
  const figure = new THREE.Group(); figure.name = 'giant-figure'; world.add(figure)
  disc(.49, .12, [0, .06, 0], oak, 'giant-base', figure)
  const lift = box(.28, .115, .09, walnut, [0, .074, .485], 'giant-base-grip', figure)

  // Closed 2-manifold Loop-subdivided fluted textile skirt concealing the miniature timber carrier frame.
  const buildLoftedClosedCage = (rings: THREE.Vector3[][], startPole: THREE.Vector3, endPole: THREE.Vector3) => {
    const segs = rings[0]!.length, positions: number[] = [], indices: number[] = []
    for (const ring of rings) for (const p of ring) positions.push(p.x, p.y, p.z)
    for (let r = 0; r < rings.length - 1; r++) {
      const row0 = r * segs, row1 = (r + 1) * segs
      for (let s = 0; s < segs; s++) {
        const sNext = (s + 1) % segs
        indices.push(row0 + s, row0 + sNext, row1 + sNext, row0 + s, row1 + sNext, row1 + s)
      }
    }
    const startIdx = positions.length / 3
    positions.push(startPole.x, startPole.y, startPole.z)
    for (let s = 0; s < segs; s++) indices.push(startIdx, (s + 1) % segs, s)
    const endIdx = positions.length / 3
    positions.push(endPole.x, endPole.y, endPole.z)
    const lastRow = (rings.length - 1) * segs
    for (let s = 0; s < segs; s++) indices.push(endIdx, lastRow + s, lastRow + ((s + 1) % segs))
    const cage = new THREE.BufferGeometry()
    cage.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    cage.setIndex(indices)
    return cage
  }

  const skirtRadiusAt = (t: number, angle: number) =>
    (.455 * (1 - t) + .208 * t + .018 * Math.sin(t * Math.PI) * (1 - t * .4)) +
    (.022 * Math.cos(angle * 12) + .005 * Math.cos(angle * 6)) * (1 - t * .82)
  const skirtRings: THREE.Vector3[][] = []
  const skirtLevels = [0, .14, .36, .62, .84, 1]
  const skirtSegs = 24
  for (const t of skirtLevels) {
    const ring: THREE.Vector3[] = []
    const y = .125 + t * 1.015
    for (let s = 0; s < skirtSegs; s++) {
      const a = (s / skirtSegs) * Math.PI * 2
      const r = skirtRadiusAt(t, a)
      ring.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r))
    }
    skirtRings.push(ring)
  }
  const skirtCage = buildLoftedClosedCage(skirtRings, new THREE.Vector3(0, .12, 0), new THREE.Vector3(0, 1.15, 0))
  const skirtGeo = subdivideClosedCage(skirtCage, {
    iterations: 1,
    colorGenerator: (p, _n, box) => {
      const yNorm = THREE.MathUtils.clamp((p.y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4), 0, 1)
      const angle = Math.atan2(p.x, p.z)
      const valley = (1 - Math.cos(angle * 12)) * .5 * (1 - yNorm * .75) * .15
      const hemShade = (1 - THREE.MathUtils.smoothstep(yNorm, 0, .16)) * .12
      const waistShade = THREE.MathUtils.smoothstep(yNorm, .86, 1) * .12
      const s = THREE.MathUtils.clamp(1 - valley - hemShade - waistShade, .72, 1.02)
      return [s * 1.01, s * .985, s * .95]
    },
  })
  skirtCage.dispose()
  applyStylizedHumanSurfaceHint(add(skirtGeo, clay, [0, 0, 0], 'giant-fluted-skirt', figure), 'garment')

  const hemPoints = Array.from({ length: 128 }, (_, i) => {
    const angle = i / 128 * Math.PI * 2, t = (.21 - .125) / 1.015
    const r = skirtRadiusAt(t, angle) + .013
    return new THREE.Vector3(Math.sin(angle) * r, .21, Math.cos(angle) * r)
  })
  applyStylizedHumanSurfaceHint(
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPoints, true), 192, .0135, 8, true), rosetteCream, [0, 0, 0], 'giant-hem', figure),
    'garment',
  )

  // Sculpted Loop-subdivided laced bodice & gathered festival sash waistband.
  const bodiceGeo = createStylizedTorsoGeometry({
    shoulderWidth: .53,
    waistWidth: .40,
    hemWidth: .43,
    depth: .43,
    height: .43,
    collarStyle: 'crossed',
    foldDepth: .009,
    radialSegments: 12,
    iterations: 1,
  })
  applyStylizedHumanSurfaceHint(add(bodiceGeo, sage, [0, 1.12, 0], 'giant-bodice', figure), 'garment')

  const sashGeo = createStylizedTorsoGeometry({
    shoulderWidth: .44,
    waistWidth: .45,
    hemWidth: .46,
    depth: .44,
    height: .092,
    collarStyle: 'round',
    foldDepth: .008,
    radialSegments: 12,
    iterations: 1,
  })
  applyStylizedHumanSurfaceHint(add(sashGeo, ochre, [0, 1.092, 0], 'giant-waistband', figure), 'garment')

  // Draped festival sleeves, ruffled thick-walled cuffs, and sculpted welcoming hands.
  for (const [idx, x] of ([-1, 1] as const).entries()) {
    const shoulder = new THREE.Vector3(x * .24, 1.41, 0)
    const wrist = new THREE.Vector3(x * .395, 1.045, .105)
    const dir = shoulder.clone().sub(wrist)
    const sleeveLen = dir.length()
    const sleeveGeo = createStylizedLimbGeometry({
      length: sleeveLen,
      topRadius: .102,
      bottomRadius: .076,
      bend: .06,
      foldDepth: .007,
      radialSegments: 10,
      iterations: 1,
    })
    sleeveGeo.translate(0, sleeveLen * .5, 0)
    const sleeveMesh = add(sleeveGeo, sage, [0, 0, 0], `giant-sleeve-${idx}`, figure)
    sleeveMesh.position.copy(shoulder).add(wrist).multiplyScalar(.5)
    sleeveMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    applyStylizedHumanSurfaceHint(sleeveMesh, 'garment')

    const cuffGeo = createStylizedSleeveCuffGeometry({
      length: .105,
      cuffRadiusX: .086,
      cuffRadiusY: .082,
      sleeveRadiusX: .078,
      sleeveRadiusY: .076,
      wallThickness: .011,
      rolledLip: .013,
      foldDepth: .008,
      radialSegments: 10,
      iterations: 1,
    })
    const cuffMesh = add(cuffGeo, cream, [wrist.x, wrist.y, wrist.z], `giant-cuff-${idx}`, figure)
    cuffMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), shoulder.clone().sub(wrist).normalize())
    applyStylizedHumanSurfaceHint(cuffMesh, 'garment')

    // Facing +Z: right hand is on -X (x = -1), left hand is on +X (x = +1).
    const handRig = buildStylizedHandRig({
      namePrefix: `giant-hand-${idx}`,
      handedness: x < 0 ? 'right' : 'left',
      scale: .42,
      palmUp: false,
      pose: 'gentle-rest',
      skinMaterial: skin,
      includeForearm: false,
      includeSleeve: false,
      includeCuff: false,
      iterations: 1,
    })
    handRig.root.position.set(x * .408, .962, .124)
    // Angle fingers gently downward and forward in a warm welcoming festival stance.
    handRig.root.rotation.set(Math.PI * .62, x * .22, x * -.14)
    figure.add(handRig.root)
  }

  // Handcrafted papier-mâché / painted-wood neck, head, rosy cheeks, warm smile, wavy hair, and festive hat.
  const neckGeo = createStylizedLimbGeometry({ length: .19, topRadius: .086, bottomRadius: .104, bend: 0, foldDepth: .001, radialSegments: 10, iterations: 1 })
  applyStylizedHumanSurfaceHint(add(neckGeo, skin, [0, 1.66, 0], 'giant-neck', figure), 'skin')

  const headGeo = createStylizedHeadGeometry({
    width: .45,
    height: .56,
    depth: .43,
    cheekFullness: .22,
    noseProminence: .58,
    chinTaper: .16,
    radialSegments: 12,
    iterations: 2,
  })
  applyStylizedHumanSurfaceHint(add(headGeo, skin, [0, 1.82, 0], 'giant-face', figure), 'skin')

  // Sculpted hair mass framing the cheeks and crown while keeping the center forehead at y = 1.90 cleanly exposed.
  const hairGeo = createStylizedHairGeometry({
    style: 'bob',
    headWidth: .46,
    headHeight: .55,
    headDepth: .44,
    volume: .034,
    radialSegments: 12,
    iterations: 1,
  })
  {
    const pos = hairGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i)
      // Lift the front brow hairline smoothly above local y = +0.11 (world y >= 1.945) so giant-face forehead is clear.
      if (pz > .04) {
        const frontW = THREE.MathUtils.smoothstep(pz, .04, .18) * Math.exp(-Math.pow(px / .16, 2))
        const targetMinY = .125
        if (py < targetMinY) {
          pos.setY(i, THREE.MathUtils.lerp(py, targetMinY, frontW))
        }
      }
    }
    pos.needsUpdate = true
    hairGeo.computeVertexNormals()
    hairGeo.computeBoundingBox()
    hairGeo.computeBoundingSphere()
  }
  applyStylizedHumanSurfaceHint(add(hairGeo, hair, [0, 1.84, -.016], 'giant-hair', figure), 'hair')

  const earCage = new THREE.IcosahedronGeometry(1, 0)
  const earGeo = subdivideClosedCage(earCage, { iterations: 1 })
  earCage.dispose()
  earGeo.scale(.036, .062, .042)
  const curlCage = new THREE.IcosahedronGeometry(1, 0)
  const curlGeo = subdivideClosedCage(curlCage, { iterations: 1 })
  curlCage.dispose()
  curlGeo.scale(.066, .125, .078)

  for (const [idx, x] of ([-1, 1] as const).entries()) {
    applyStylizedHumanSurfaceHint(add(idx === 0 ? earGeo : earGeo.clone(), skin, [x * .224, 1.815, -.008], `giant-ear-${idx}`, figure), 'skin')
    applyStylizedHumanSurfaceHint(add(idx === 0 ? curlGeo : curlGeo.clone(), hair, [x * .222, 1.745, -.028], `giant-hair-curl-${idx}`, figure), 'hair')
    // Warm storybook painted-wood oval eyes & gentle cheerful brows (no bulging white eyeballs).
    const eye = ball(.020, [x * .086, 1.848, .204], ink, figure, `giant-eye-${idx}`)
    eye.scale.set(.95, 1.25, .45)
    applyStylizedHumanSurfaceHint(eye, 'hair')
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x * .052, 1.894, .204),
      new THREE.Vector3(x * .086, 1.907, .205),
      new THREE.Vector3(x * .120, 1.895, .192),
    ])
    applyStylizedHumanSurfaceHint(add(new THREE.TubeGeometry(browCurve, 10, .0068, 6, false), hair, [0, 0, 0], `giant-brow-${idx}`, figure), 'hair')
  }
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.056, 1.748, .196),
    new THREE.Vector3(-.024, 1.732, .208),
    new THREE.Vector3(0, 1.728, .211),
    new THREE.Vector3(.024, 1.732, .208),
    new THREE.Vector3(.056, 1.748, .196),
  ])
  applyStylizedHumanSurfaceHint(add(new THREE.TubeGeometry(smileCurve, 18, .0075, 8, false), walnut, [0, 0, 0], 'giant-smile', figure), 'hair')

  // Sculpted softly waving festival hat brim, domed crown, and sage ribbon band.
  const brimRings: THREE.Vector3[][] = []
  const brimStations = [
    { r: .19, y: -.018 },
    { r: .315, y: -.012 },
    { r: .335, y: .004 },
    { r: .315, y: .018 },
    { r: .19, y: .022 },
  ]
  for (const st of brimStations) {
    const ring: THREE.Vector3[] = []
    for (let s = 0; s < 16; s++) {
      const a = (s / 16) * Math.PI * 2
      const wave = .012 * Math.cos(a * 2) * ((st.r - .18) / .16)
      ring.push(new THREE.Vector3(Math.sin(a) * st.r, st.y + wave, Math.cos(a) * st.r))
    }
    brimRings.push(ring)
  }
  const brimCage = buildLoftedClosedCage(brimRings, new THREE.Vector3(0, -.016, 0), new THREE.Vector3(0, .024, 0))
  const brimGeo = subdivideClosedCage(brimCage, { iterations: 1 })
  brimCage.dispose()
  applyStylizedHumanSurfaceHint(add(brimGeo, hatFelt, [0, 2.068, -.005], 'giant-hat-brim', figure), 'garment')

  const hatRings: THREE.Vector3[][] = [
    { y: 0, r: .242 },
    { y: .05, r: .228 },
    { y: .11, r: .202 },
    { y: .148, r: .145 },
  ].map((st) =>
    Array.from({ length: 14 }, (_, s) => {
      const a = (s / 14) * Math.PI * 2
      return new THREE.Vector3(Math.sin(a) * st.r, st.y, Math.cos(a) * st.r)
    }),
  )
  const hatCage = buildLoftedClosedCage(hatRings, new THREE.Vector3(0, -.005, 0), new THREE.Vector3(0, .162, 0))
  const hatGeo = subdivideClosedCage(hatCage, { iterations: 1 })
  hatCage.dispose()
  applyStylizedHumanSurfaceHint(add(hatGeo, hatFelt, [0, 2.075, -.005], 'giant-hat', figure), 'garment')
  disc(.236, .034, [0, 2.098, -.005], padSage, 'giant-hat-band', figure)

  const join = ball(.075, [-.14, 1.29, .284], rosetteCream, figure, 'giant-lapel')
  for (const [idx, y] of [1.22, 1.36, 1.46].entries()) ball(.018, [.07, y, .232], rosetteOchre, figure, `giant-button-${idx}`)
  const rosette = new THREE.Group(); rosette.name = 'giant-rosette'; world.add(rosette)
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, p = ball(.044, [Math.sin(a) * .078, Math.cos(a) * .078, 0], i % 2 ? rosetteCream : rosetteOchre, rosette)
    p.scale.set(.65, 1.05, .45); p.rotation.z = -a
  }
  const grip = disc(.064, .046, [0, 0, .018], rosetteClay, 'giant-rosette-grip', rosette); grip.rotation.x = Math.PI / 2
  const pad = box(.46, .03, .43, padSage, [-1.27, .735, .65], 'giant-rosette-pad')
  // A few actual workshop supplies support the context without competing for taps.
  disc(.115, .09, [.12, .765, .57], rosetteCream)
  box(.24, .008, .18, rosetteClay, [.24, .725, .25])
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    figure.position.copy(checkpoint >= 2 ? REST : HOME); figure.rotation.set(0, 0, 0)
    if (checkpoint >= 1) { figure.add(rosette); rosette.position.copy(JOIN) } else { world.add(rosette); rosette.position.copy(ROSETTE_HOME) }
    pad.visible = true; matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(grip, { kind: 'drag', label: '别上小花章', priority: 3, enabled: enabled(0), destination: join, targetLabel: '衣襟上的小扣' })
  addInteractionCue(lift, { kind: 'drag', label: '移到圆形展台', priority: 3, enabled: enabled(1), destination: peg, targetLabel: '右侧圆台' })
  addInteractionCue(lift, { kind: 'tap', label: '轻点底座静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? rosette : figure
  const touchTarget = createTouchTarget(canvas, camera, scene)
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => touchTarget.hit(x, y, target, { ignore: held })
  const automaticReady = (x: number, y: number) => {
    if (checkpoint >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, checkpoint === 0 ? grip : lift, [0,0,0])
    return !!contact && !touchTarget.occluded(x,y,checkpoint === 0 ? join : peg,{ignore:moving()}) && touchTarget.hit(contact.x, contact.y, checkpoint === 0 ? join : peg, { ignore: moving() })
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return hitsVisible(x, y, checkpoint === 0 ? grip : lift) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare(); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), object.position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) { maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices(); if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && automaticReady(x, y) : maxTravel < 12 && hitsVisible(x, y, lift)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => active(), duration: 3, motion: 'glow',
    targets: () => [figure], cancelInput: () => pointer.cancel(), complete: () => advance(),
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '别上小花章' : checkpoint === 1 ? '移到圆形展台' : '轻点底座静看', safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.assemble : checkpoint === 1 ? COPY.suspend : checkpoint === 2 ? COPY.rest : COPY.done, safe)
    ending.sync(checkpoint === 2 && !transition)
  }
  function settle() { if (!active() || !transition) return; checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync(); ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .013 }) }
  function advance(placed = false) {
    if (checkpoint === 2 && !ending.completing) return
    if (!active() || (pointer.isBusy() && !placed) || transition || checkpoint === 3) return
    if (checkpoint === 2) { checkpoint = 3; restore(); sync(); ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .013 }); if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.8 + boost * .4, 6.1 + boost); camera.lookAt(0, 1.58, 0); matrices() }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        const dest = transition.step === 0 ? figure.localToWorld(JOIN.clone()) : REST
        moving().position.lerpVectors(transition.from, dest, t)
        if (!ctx.isReducedMotion?.()) moving().position.y += Math.sin(t * Math.PI) * .15
        if (transition.time === 1) settle()
      }
      if (!active()) return
      ending.update(dt)
      if (!active()) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose() { if (disposed) return; ending.dispose(); disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
