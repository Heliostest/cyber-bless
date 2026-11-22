import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { getLocale, subscribeLocale } from '@wbr/i18n'
import { bindSceneText, sceneCopy, sceneTemplate } from '../scene-localization'
import { wrapCanvasText } from '../canvas-text'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import { createPathSweep } from '../path-sweep'
import { createTouchTarget } from '../touch-target'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, claimObjectTouches, createPointerRay,
  createSceneFeedback, createStepOverlay, createWarmStage, disposeTree,
  observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '水引结愿',
  steps: '步骤',
  loop: '为赠礼纸封系一份祝愿。拖住绳端光圈，依次经过金色提示点绕环。',
  thread: '拖住绳端，沿另一侧的金色提示点穿过交会处，向左轻拉收结。',
  wish: '想着收礼的人，静静放好这份赠礼心意。',
  done: '水引结饰已系好，纸封上留着送给对方的祝愿。',
  loopAction: '绕出一个环',
  threadAction: '穿环并收紧',
  wishAction: '静放赠礼心意',
  movingLoop: '纸绳沿环轻轻弯起…',
  movingThread: '两侧相接，慢慢收拢…',
} as const

type Checkpoint = 0 | 1 | 2 | 3
type Coord = readonly [number, number, number]

const CORD_RADIUS = 0.0086
const STRAND_SPACING = 0.0205
const BAND_RADIUS = 0.0084
const BAND_Y = 0.115

// Deliberate paths round each lobe, then through the crossing. This is a
// decorative, source-informed knot, with no named-knot claim.
const ROUTES: readonly (readonly Coord[])[] = [
  [[-0.62, 0.31, 0.48], [-0.70, 0.31, 0.15], [-0.57, 0.31, -0.20], [-0.32, 0.31, -0.38], [-0.05, 0.31, -0.27], [0.12, 0.31, 0]],
  [[0.25, 0.31, 0.40], [0.55, 0.31, 0.25], [0.66, 0.31, -0.05], [0.52, 0.31, -0.35], [0.22, 0.31, -0.39], [0.03, 0.31, -0.10], [-0.30, 0.31, 0.19]],
]

// Seated paper-cord centerline forms resting cleanly on the washi envelope (y ≈ 0.115–0.125)
// and lifting strictly where strands cross over the horizontal binding band (y ≈ 0.139) or
// weave cleanly over/under one another in distinct non-colliding vertical layers.
const CORD_FORMS: readonly (readonly Coord[])[] = [
  // Stage 0: Open 5-strand paper ribbon seated on the envelope, gently arching over the horizontal band.
  [
    [0.50, 0.117, 0.43],
    [0.24, 0.122, 0.27],
    [0.04, 0.141, 0.04],
    [-0.12, 0.141, 0.05],
    [-0.34, 0.122, 0.28],
    [-0.62, 0.117, 0.48],
  ],
  // Stage 1: Left bow loop formed, arching over the horizontal band at the left lobe and over Pass 1 at center.
  [
    [0.26, 0.118, 0.40],
    [0.14, 0.124, 0.23],
    [0.01, 0.141, 0.04],
    [-0.34, 0.125, 0.26],
    [-0.64, 0.140, 0.05],
    [-0.60, 0.128, -0.25],
    [-0.32, 0.122, -0.39],
    [-0.06, 0.138, -0.22],
    [0.13, 0.165, 0.01],
  ],
  // Stage 2/3: Completed 3-lobe interwoven mizuhiki knot with verified over-under vertical stacking:
  // Horizontal band = 0.115; Pass 3 (center low) = 0.138; Pass 1 (SW->NE) = 0.161;
  // Pass 2 (SE->NW) = 0.184; Pass 4 (lower lobe -> Tail B) weaves smoothly OVER Pass 3 & Pass 1.
  [
    [-0.31, 0.118, 0.22],   // Tail A (seated on paper)
    [-0.10, 0.148, 0.08],   // Approach center (rising to Layer 2)
    [0.08, 0.161, -0.05],   // Pass 1 center (Layer 2 = 0.161)
    [0.34, 0.130, -0.28],   // Out to upper-right lobe
    [0.57, 0.126, -0.34],   // Right lobe top-right
    [0.67, 0.141, -0.04],   // Right lobe outer bend (clears horizontal band 0.115!)
    [0.54, 0.124, 0.20],    // Right lobe lower return
    [0.24, 0.148, 0.17],    // Approach center (rising to Layer 3)
    [-0.02, 0.184, -0.01],  // Pass 2 center (Layer 3 = 0.184, OVER Pass 1 = 0.161!)
    [-0.29, 0.134, -0.28],  // Out to upper-left lobe
    [-0.56, 0.126, -0.34],  // Left lobe top-left
    [-0.67, 0.141, -0.03],  // Left lobe outer bend (clears horizontal band 0.115!)
    [-0.52, 0.124, 0.22],   // Left lobe lower return
    [-0.22, 0.126, 0.24],   // Sweep inward at Layer 1
    [-0.04, 0.138, 0.12],   // Pass 3 center-low (Layer 1 = 0.138, OVER band, UNDER Pass 1/2!)
    [0.16, 0.124, 0.34],    // Descend into right leg of lower lobe
    [0.22, 0.120, 0.56],    // Lower lobe bottom-right
    [-0.01, 0.119, 0.63],   // Lower lobe bottom crest (generous radius, no kink)
    [-0.20, 0.120, 0.50],   // Lower lobe bottom-left
    [-0.14, 0.136, 0.30],   // Rise out of lower lobe
    [-0.01, 0.164, 0.14],   // Pass 4 front-weave lock (OVER Pass 3 = 0.138!)
    [0.23, 0.150, 0.26],    // Exit OVER lower-lobe right leg (0.124 -> +0.026 clearance!)
    [0.49, 0.118, 0.47],    // Tail B (seated on paper)
  ],
]

function curve(points: readonly Coord[]) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal')
}

function ease(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** Fine washi fibers, generated locally and shared by all paper layers. */
function paperTexture() {
  const size = 96, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fiber = ((x * 19 + y * 31) % 17) + (y % 7 === 0 ? -8 : 0)
    const i = (y * size + x) * 4
    data[i] = 246 + Math.floor(fiber / 4)
    data[i + 1] = 239 + Math.floor(fiber / 4)
    data[i + 2] = 218 + Math.floor(fiber / 3)
    data[i + 3] = 255
  }
  const map = new THREE.DataTexture(data, size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(3, 4)
  map.magFilter = map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  return map
}

function paperPolygon(points: readonly (readonly [number, number])[], y: number, material: THREE.Material) {
  const shape = new THREE.Shape()
  points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z))
  shape.closePath()
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  return mesh
}

/**
 * Allocates a closed-end (flush-capped) paper-cord tube BufferGeometry whose vertex
 * positions and normals can be rewritten in-place with zero allocations.
 */
function createCappedCordGeometry(tubeSegments: number, radialSegments: number, dynamic: boolean): THREE.BufferGeometry {
  const ringStride = radialSegments + 1
  const bodyVerts = (tubeSegments + 1) * ringStride
  // Add start cap (1 center + radialSegments rim) and end cap (1 center + radialSegments rim).
  const capVerts = (1 + radialSegments) * 2
  const totalVerts = bodyVerts + capVerts
  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const bodyIndices = tubeSegments * radialSegments * 6
  const capIndices = radialSegments * 6
  const indices = new Uint32Array(bodyIndices + capIndices)

  for (let i = 0; i <= tubeSegments; i++) {
    const u = i / tubeSegments
    for (let j = 0; j <= radialSegments; j++) {
      const idx = i * ringStride + j
      uvs[idx * 2] = u
      uvs[idx * 2 + 1] = j / radialSegments
    }
  }

  let cursor = 0
  for (let i = 0; i < tubeSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j
      const b = (i + 1) * ringStride + j
      const c = (i + 1) * ringStride + j + 1
      const d = i * ringStride + j + 1
      // Outward winding: (b - a) x (d - a) = (+T) x (+up) = +lat (outward radial normal).
      indices[cursor++] = a
      indices[cursor++] = b
      indices[cursor++] = d
      indices[cursor++] = b
      indices[cursor++] = c
      indices[cursor++] = d
    }
  }

  // Start cap (faces -tangent)
  const startCenter = bodyVerts
  const startRim = startCenter + 1
  for (let j = 0; j < radialSegments; j++) {
    const next = (j + 1) % radialSegments
    indices[cursor++] = startCenter
    indices[cursor++] = startRim + j
    indices[cursor++] = startRim + next
  }

  // End cap (faces +tangent)
  const endCenter = startRim + radialSegments
  const endRim = endCenter + 1
  for (let j = 0; j < radialSegments; j++) {
    const next = (j + 1) % radialSegments
    indices[cursor++] = endCenter
    indices[cursor++] = endRim + next
    indices[cursor++] = endRim + j
  }

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  const normAttr = new THREE.BufferAttribute(normals, 3)
  if (dynamic) {
    posAttr.setUsage(THREE.DynamicDrawUsage)
    normAttr.setUsage(THREE.DynamicDrawUsage)
  }
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('normal', normAttr)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  return geometry
}

const _tan = new THREE.Vector3()
const _lat = new THREE.Vector3()
const _up = new THREE.Vector3()
const _cPt = new THREE.Vector3()

/**
 * Rewrites a capped mizuhiki paper-cord strand in-place along `centres`, applying:
 * - Parallel ribbon-band offset (with slight pinch tightening inside the central knot)
 * - Subtle spiral silk/washi-wrap cord micro-relief
 * - Flush solid paper end-caps at both cut tips (no hollow pipe ends!)
 */
function writeMizuhikiStrandInPlace(
  geometry: THREE.BufferGeometry,
  centres: readonly THREE.Vector3[],
  tubeSegments: number,
  radialSegments: number,
  radius: number,
  lateralOffset: number,
  options: { turns?: number; plyDepth?: number; phase?: number; pinchCenter?: boolean; fixedLateralZ?: boolean } = {},
) {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
  const ringStride = radialSegments + 1
  const turns = options.turns ?? 38
  const plyDepth = options.plyDepth ?? 0.042
  const phase = options.phase ?? 0
  const pinchCenter = options.pinchCenter ?? false
  const fixedLateralZ = options.fixedLateralZ ?? false

  for (let i = 0; i <= tubeSegments; i++) {
    const u = i / tubeSegments
    const prev = centres[Math.max(0, i - 1)]!
    const next = centres[Math.min(tubeSegments, i + 1)]!
    _tan.subVectors(next, prev)
    if (_tan.lengthSq() < 1e-12) _tan.set(1, 0, 0)
    else _tan.normalize()

    if (fixedLateralZ) {
      // Exact continuous XY-plane ribbon frame: lateral = +Z, outward normal = +Z x T.
      // Never flips sign around the vertical side walls of the beveled envelope.
      _lat.set(0, 0, 1)
      _up.crossVectors(_lat, _tan).normalize()
      _lat.crossVectors(_tan, _up).normalize()
    } else {
      // Planar-stabilized horizontal ribbon frame: keeps all 5 strands lying neatly flat
      // side-by-side on the envelope while tilting cleanly across vertical over-under ramps.
      const horizLen = Math.hypot(_tan.x, _tan.z)
      if (horizLen > 1e-4) {
        _lat.set(-_tan.z / horizLen, 0, _tan.x / horizLen)
      } else {
        _lat.set(0, 0, 1)
      }
      _up.crossVectors(_lat, _tan).normalize()
      if (_up.y < 0) _up.negate()
      // Re-orthogonalize lateral vector against 3D tangent so the cross-section stays circular.
      _lat.crossVectors(_tan, _up).normalize()
    }

    const c = centres[i]!
    // Subtle bundle compression right in the tight central gathering zone prevents inner-bend crowding.
    let effOffset = lateralOffset
    if (pinchCenter) {
      const distCenter = Math.hypot(c.x, c.z - 0.02)
      const pinch = 1 - 0.14 * Math.exp(-distCenter * distCenter * 22)
      effOffset *= pinch
    }

    _cPt.set(
      c.x + _lat.x * effOffset,
      c.y + _lat.y * effOffset,
      c.z + _lat.z * effOffset,
    )

    const twist = u * turns * Math.PI * 2 + phase
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      const r = radius * (1 + plyDepth * Math.cos(2 * (a - twist)))
      const nx = _lat.x * cos + _up.x * sin
      const ny = _lat.y * cos + _up.y * sin
      const nz = _lat.z * cos + _up.z * sin
      const n = i * ringStride + j
      positions.setXYZ(n, _cPt.x + nx * r, _cPt.y + ny * r, _cPt.z + nz * r)
      normals.setXYZ(n, nx, ny, nz)
    }

    if (i === 0) {
      const startCenter = (tubeSegments + 1) * ringStride
      const startRim = startCenter + 1
      positions.setXYZ(startCenter, _cPt.x, _cPt.y, _cPt.z)
      normals.setXYZ(startCenter, -_tan.x, -_tan.y, -_tan.z)
      for (let j = 0; j < radialSegments; j++) {
        const src = j
        positions.setXYZ(startRim + j, positions.getX(src), positions.getY(src), positions.getZ(src))
        normals.setXYZ(startRim + j, -_tan.x, -_tan.y, -_tan.z)
      }
    } else if (i === tubeSegments) {
      const endCenter = (tubeSegments + 1) * ringStride + 1 + radialSegments
      const endRim = endCenter + 1
      positions.setXYZ(endCenter, _cPt.x, _cPt.y, _cPt.z)
      normals.setXYZ(endCenter, _tan.x, _tan.y, _tan.z)
      const baseRing = tubeSegments * ringStride
      for (let j = 0; j < radialSegments; j++) {
        const src = baseRing + j
        positions.setXYZ(endRim + j, positions.getX(src), positions.getY(src), positions.getZ(src))
        normals.setXYZ(endRim + j, _tan.x, _tan.y, _tan.z)
      }
    }
  }

  positions.needsUpdate = true
  normals.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

export function createMizuhiki(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  Object.values(COPY).forEach(shared.assertSafeCopy)
  let started = false, disposed = false, focused = true, suspended = false
  let checkpoint: Checkpoint = 0
  let pose = 0, motionFrom = 0, motionTarget = 0, motionT = 1
  let settle = 0, sparkle = 0
  // Brief stiff-paper elastic settle oscillation upon locking a loop (zero in reduced motion).
  let springTimer = 1, springAmp = 0
  let stopResize = () => {}, stopClaim = () => {}
  let wishHandle: GestureHandle | null = null
  const feedback = createSceneFeedback(ctx)
  const canAct = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const moving = () => motionT < 1

  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.loopAction }, shared.assertSafeCopy)
  const { hitLayer, hintEl, actionBtn } = ui
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
  const cameraHome = new THREE.Vector3(0, 3.5, 3.8)
  const lookAt = new THREE.Vector3(0, 0.12, 0)
  camera.position.copy(cameraHome)
  camera.lookAt(lookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'mizuhiki', label: COPY.title })
  styleRenderer.setStyle(CEL_STYLE)
  addStageLights(scene, ctx.stage, { sky: 0xfff3df, ground: 0xcdbb9b, key: 0xffe1b2, rim: 0xe1d7f1, keyIntensity: 1.45, keyPosition: [-2, 4, 3] })

  const world = new THREE.Group()
  world.name = 'mizuhiki-craft'
  scene.add(world)
  const envelope = new THREE.Group()
  envelope.name = 'mizuhiki-envelope'
  world.add(envelope)
  const paperMap = paperTexture()
  const paper = new THREE.MeshStandardMaterial({ color: 0xfffcf0, map: paperMap, roughness: 0.96 })
  const foldedPaper = new THREE.MeshStandardMaterial({ color: 0xf3e6cb, map: paperMap, roughness: 0.98, side: THREE.DoubleSide })
  const topPaper = new THREE.MeshStandardMaterial({ color: 0xfff9e8, map: paperMap, roughness: 0.96, side: THREE.DoubleSide })
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89c45, roughness: 0.52, metalness: 0.32 })
  const red = new THREE.MeshStandardMaterial({ color: 0xb74743, roughness: 0.82 })

  const outline = new THREE.Shape()
  const w = 0.75, h = 1.06, r = 0.035
  outline.moveTo(-w + r, -h)
  outline.lineTo(w - r, -h)
  outline.quadraticCurveTo(w, -h, w, -h + r)
  outline.lineTo(w, h - r)
  outline.quadraticCurveTo(w, h, w - r, h)
  outline.lineTo(-w + r, h)
  outline.quadraticCurveTo(-w, h, -w, h - r)
  outline.lineTo(-w, -h + r)
  outline.quadraticCurveTo(-w, -h, -w + r, -h)
  const base = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.007, bevelSegments: 2, steps: 1 }), paper)
  base.rotation.x = -Math.PI / 2
  base.position.y = 0.035
  envelope.add(base)
  envelope.add(paperPolygon([[-0.742, -1.045], [0.11, -1.045], [-0.06, 1.045], [-0.742, 1.045]], 0.087, topPaper))
  envelope.add(paperPolygon([[0.18, -1.045], [0.742, -1.045], [0.742, 1.045], [-0.06, 1.045]], 0.101, topPaper))
  envelope.add(paperPolygon([[-0.725, -1.025], [0.725, -1.025], [0.105, -0.62]], 0.112, foldedPaper))
  envelope.add(paperPolygon([[-0.725, 1.025], [0.725, 1.025], [0.105, 0.67]], 0.113, topPaper))
  // The raised ivory slip and folded accent echo the photograph's layering
  // without reproducing an etiquette-specific inscription.
  envelope.add(paperPolygon([[-0.19, -0.97], [0.17, -0.97], [0.11, -0.47], [-0.14, -0.47]], 0.121, paper))
  envelope.add(paperPolygon([[0.53, -0.94], [0.66, -0.87], [0.50, -0.57], [0.46, -0.73]], 0.121, red))
  envelope.add(paperPolygon([[0.54, -0.94], [0.65, -0.87], [0.48, -0.75]], 0.128, gold))
  const seamMat = new THREE.LineBasicMaterial({ color: 0xd4c29f, transparent: true, opacity: 0.55 })
  envelope.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.13, 0.116, -0.57), new THREE.Vector3(-0.06, 0.116, 1.01)]), seamMat))

  const wishCanvas = document.createElement('canvas')
  wishCanvas.width = 768
  wishCanvas.height = 256
  const wishInk = wishCanvas.getContext('2d')
  const wishMap = new THREE.CanvasTexture(wishCanvas)
  wishMap.colorSpace = THREE.SRGBColorSpace
  const wishMark = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.32), new THREE.MeshBasicMaterial({ map: wishMap, transparent: true, depthWrite: false }))
  wishMark.name = 'mizuhiki-written-wish'
  wishMark.rotation.x = -Math.PI / 2
  wishMark.position.set(0, 0.126, 0.82)
  envelope.add(wishMark)
  const reading = document.createElement('details'); reading.className = 'scene-written-wish-reading scene-wish-slot'
  reading.style.gridArea = 'wish'; reading.style.gridColumn = '1 / -1'
  reading.style.maxBlockSize = '160px'; reading.style.overflowY = 'auto'
  const readingLabel = document.createElement('summary'), readingText = document.createElement('p')
  bindSceneText(readingLabel, '查看纸面文字'); reading.append(readingLabel, readingText); overlay.append(reading)
  let writtenText = '赠礼心意', productDefault = true
  const redrawWish = () => {
    if (!wishInk) return
    const text = productDefault ? sceneCopy(writtenText) : writtenText
    wishInk.clearRect(0, 0, 768, 256)
    wishInk.fillStyle = '#72583d'
    wishInk.textAlign = 'center'
    wishInk.textBaseline = 'middle'
    const locale = getLocale()
    const family = locale === 'ja' ? '"Hiragino Mincho ProN", "Yu Mincho", serif'
      : locale === 'ko' ? '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
      : locale === 'zh-Hant' ? '"Songti TC", "Noto Serif TC", serif'
      : locale === 'zh-Hans' ? '"Songti SC", "Noto Serif SC", serif' : 'Georgia, serif'
    let size = 40, lines: string[] = []
    do {
      wishInk.font = `${size}px ${family}`
      lines = wrapCanvasText(text, 680, value => wishInk.measureText(value).width, locale)
      if (lines.length * size * 1.3 <= 212 || size <= 14) break
      size -= 2
    } while (size >= 14)
    lines.forEach((line, i) => wishInk.fillText(line, 384, 128 + (i - (lines.length - 1) / 2) * size * 1.3))
    // The complete original remains readable in DOM even when the paper's physical space is small.
    readingText.textContent = text; reading.hidden = productDefault
    wishMap.needsUpdate = true
  }
  const paintWish = (text: string, isProductDefault = false) => {
    writtenText = text; productDefault = isProductDefault
    // Personal writing stays on the user's envelope but leaves no mark in shared photos.
    wishMark.userData.privateShare = !isProductDefault
    redrawWish()
  }
  paintWish('赠礼心意', true)
  const stopWishLocale = subscribeLocale(redrawWish)
  void document.fonts?.ready.then(() => { if (!disposed) redrawWish() })

  const knot = new THREE.Group()
  knot.name = 'mizuhiki-interwoven-cords'
  world.add(knot)
  const colors = [0xb74442, 0xd6ad52, 0xfff2d8, 0xb74442, 0xe6c572]
  const cordMaterials = colors.map((color, i) => new THREE.MeshStandardMaterial({
    color,
    roughness: i === 1 || i === 4 ? 0.48 : 0.78,
    metalness: i === 1 || i === 4 ? 0.30 : 0,
    emissive: 0xe7b264,
    emissiveIntensity: 0,
  }))
  cordMaterials.forEach((material, i) => applyCraftSurface(material, { kind: 'cord', scale: 2.0, strength: i === 1 || i === 4 ? 0.30 : 0.34 }))

  // Five tightly parallel washi paper-cord bands seated cleanly on the envelope
  // and wrapped smoothly around both left and right beveled edges.
  const bandSegments = 64, bandRadial = 8
  const bandCenterPath = curve([
    [-0.742, 0.034, 0],
    [-0.768, 0.056, 0],
    [-0.766, 0.098, 0],
    [-0.735, BAND_Y, 0],
    [-0.36, BAND_Y + 0.002, 0],
    [0, BAND_Y + 0.003, 0],
    [0.36, BAND_Y + 0.002, 0],
    [0.735, BAND_Y, 0],
    [0.766, 0.098, 0],
    [0.768, 0.056, 0],
    [0.742, 0.034, 0],
  ])
  const bandCentres = bandCenterPath.getSpacedPoints(bandSegments)
  colors.forEach((_color, i) => {
    const bandGeo = createCappedCordGeometry(bandSegments, bandRadial, false)
    writeMizuhikiStrandInPlace(bandGeo, bandCentres, bandSegments, bandRadial, BAND_RADIUS, (i - 2) * STRAND_SPACING, {
      turns: 26,
      plyDepth: 0.04,
      phase: i * 0.7,
      pinchCenter: false,
      fixedLateralZ: true,
    })
    const band = new THREE.Mesh(bandGeo, cordMaterials[i])
    band.name = `mizuhiki-binding-band-${i}`
    knot.add(band)
  })

  // Reuse fixed closed-end tube allocations as the stiff paper cords follow arc-length
  // parameterized curves; zero rope simulation or per-frame GPU allocation.
  const tubeSegments = 220, radialSegments = 10
  const forms = CORD_FORMS.map(curve)
  const sampled = forms.map((path) => path.getSpacedPoints(tubeSegments))
  const cordMeshes = cordMaterials.map((material, strand) => {
    const geometry = createCappedCordGeometry(tubeSegments, radialSegments, true)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `mizuhiki-loop-strand-${strand}`
    knot.add(mesh)
    return mesh
  })
  const centres = Array.from({ length: tubeSegments + 1 }, () => new THREE.Vector3())
  let lastPose = Number.NaN
  let lastSpringOffset = Number.NaN
  const poseCords = (springOffset = 0) => {
    if (pose === lastPose && springOffset === lastSpringOffset) return
    lastPose = pose
    lastSpringOffset = springOffset
    const from = Math.min(1, Math.floor(pose)), to = Math.min(2, from + 1), k = ease(pose - from)
    // Gentle vertical lift arc during active transition so the stiff ribbon clears lower passes smoothly.
    const transitLift = Math.sin(Math.PI * k) * 0.024
    for (let i = 0; i <= tubeSegments; i++) {
      const u = i / tubeSegments
      const p = centres[i]!
      p.lerpVectors(sampled[from]![i]!, sampled[to]![i]!, k)
      if (transitLift > 1e-5) {
        const edgeMask = Math.sin(Math.PI * u)
        p.y += transitLift * edgeMask
      }
      if (springOffset !== 0) {
        // Stiff-paper spring flexure localized to the arched bow lobes, keeping the central weave seated.
        const distCenter = Math.hypot(p.x, p.z - 0.02)
        const lobeWeight = THREE.MathUtils.smoothstep(distCenter, 0.16, 0.52)
        p.y = Math.max(0.114, p.y + springOffset * lobeWeight)
      }
    }
    cordMeshes.forEach((mesh, strand) => {
      const offset = (strand - 2) * STRAND_SPACING
      writeMizuhikiStrandInPlace(
        mesh.geometry,
        centres,
        tubeSegments,
        radialSegments,
        CORD_RADIUS,
        offset,
        {
          turns: 44,
          plyDepth: 0.044,
          phase: strand * 0.65,
          pinchCenter: true,
        },
      )
    })
  }

  const guide = new THREE.Group()
  guide.name = 'mizuhiki-path-guide'
  world.add(guide)
  const waypointGeometry = new THREE.SphereGeometry(0.026, 10, 6)
  const waypoints = Array.from({ length: 7 }, (_v, i) => {
    const marker = new THREE.Mesh(waypointGeometry, new THREE.MeshBasicMaterial({ color: 0xb58a3b, transparent: true, opacity: 0.58, depthWrite: false }))
    marker.name = `mizuhiki-waypoint-${i}`
    guide.add(marker)
    return marker
  })
  const guideLineGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 61 }, () => new THREE.Vector3()))
  const guideLine = new THREE.Line(guideLineGeometry, new THREE.LineDashedMaterial({ color: 0xc59e55, transparent: true, opacity: 0.38, dashSize: 0.055, gapSize: 0.065, depthWrite: false }))
  guide.add(guideLine)
  const tip = new THREE.Group()
  tip.name = 'mizuhiki-cord-end'
  world.add(tip)
  const tipRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.008, 6, 32), new THREE.MeshBasicMaterial({ color: 0xe1b75d, transparent: true, opacity: 0.75, depthWrite: false }))
  tipRing.rotation.x = -Math.PI / 2
  tip.add(tipRing)
  tip.add(new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 8), red))
  const tipTarget = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshBasicMaterial({ visible: false }))
  tipTarget.name = 'mizuhiki-cord-end-target'
  tip.add(tipTarget)
  const routeCurves = ROUTES.map(curve)
  const routeSweeps = ROUTES.map(points => createPathSweep(points.map(p => [p[0], p[2]] as const), .17))

  const pointer = createPointerRay(canvas, camera)
  const touch = createTouchTarget(canvas, camera, scene)
  const guidePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.31)
  const pointerPoint = new THREE.Vector3()
  const pressed = new Set<number>()
  let blockedMulti = false
  let drag: { id: number; step: number; next: number; t: number } | null = null
  let claimedPointer: number | null = null
  // Each destination is the next ordered gate, so the cue cannot suggest an
  // invalid shortcut from the cord end straight to the route's finish.
  for (const [index, label] of ['拖绳端绕环', '拖绳端穿环'].entries()) {
    addInteractionCue(tipTarget, {
      kind: 'drag', label, priority: 2,
      enabled: () => canAct() && checkpoint === index && !moving() && !blockedMulti,
      destination: () => waypoints[Math.min(drag?.next ?? 1, ROUTES[index].length - 1)].getWorldPosition(new THREE.Vector3()),
      targetLabel: '沿金点前进',
    })
  }
  const releaseCapture = () => {
    if (claimedPointer !== null) {
      try { hitLayer.releasePointerCapture?.(claimedPointer) } catch { /* Already released by the browser. */ }
      claimedPointer = null
    }
  }
  const showTip = (t = 0) => {
    if (checkpoint < 2) tip.position.copy(routeCurves[checkpoint].getPoint(t))
    tip.updateMatrixWorld(true)
  }
  const resetDrag = () => {
    delete hintEl.dataset.progress
    drag = null
    routeSweeps.forEach(path => path.reset())
    releaseCapture()
    if (!moving()) pose = Math.min(checkpoint, 2)
    showTip()
    if (!disposed && !moving()) setSafeText(hintEl, [COPY.loop, COPY.thread, COPY.wish, COPY.done][checkpoint]!, shared.assertSafeCopy)
  }
  const updateGuide = () => {
    guide.visible = tip.visible = checkpoint < 2 && !moving()
    if (checkpoint >= 2) return
    const points = ROUTES[checkpoint]
    waypoints.forEach((marker, i) => {
      marker.visible = i < points.length
      if (i < points.length) marker.position.set(...points[i])
    })
    const positions = guideLineGeometry.getAttribute('position') as THREE.BufferAttribute
    routeCurves[checkpoint].getPoints(60).forEach((p, i) => positions.setXYZ(i, p.x, p.y, p.z))
    positions.needsUpdate = true
    guideLineGeometry.computeBoundingSphere()
    guideLine.computeLineDistances()
    showTip()
    world.updateMatrixWorld(true)
  }
  const syncUI = () => {
    delete hintEl.dataset.progress
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = checkpoint === 3
    actionBtn.disabled = !canAct() || moving()
    actionBtn.setAttribute('aria-disabled', String(actionBtn.disabled))
    wishSlot.hidden = checkpoint !== 2
    hitLayer.style.pointerEvents = canAct() && checkpoint < 2 ? 'auto' : 'none'
    wishHandle?.setEnabled(canAct() && checkpoint === 2)
    const hints = [COPY.loop, COPY.thread, COPY.wish, COPY.done]
    const actions = [COPY.loopAction, COPY.threadAction, COPY.wishAction]
    setSafeText(hintEl, moving() ? checkpoint === 0 ? COPY.movingLoop : COPY.movingThread : hints[checkpoint], shared.assertSafeCopy)
    if (checkpoint < 3) setSafeText(actionBtn, actions[checkpoint], shared.assertSafeCopy)
    updateGuide()
  }

  const finishCord = () => {
    if (disposed || checkpoint >= 2 || motionT < 1) return
    checkpoint = motionTarget as Checkpoint
    pose = checkpoint
    sparkle = 0.65
    if (ctx.isReducedMotion?.()) {
      springTimer = 1
      springAmp = 0
    } else {
      springTimer = 0
      springAmp = 0.011
    }
    syncUI()
    poseCords(0)
    ctx.onProgress?.(checkpoint)
  }
  const workCord = () => {
    if (!canAct() || checkpoint >= 2 || moving() || blockedMulti) return
    motionFrom = pose
    motionTarget = checkpoint + 1
    motionT = (ctx.isReducedMotion?.() ?? false) ? 1 : 0
    springTimer = 1
    springAmp = 0
    resetDrag()
    feedback.impact({ freqs: checkpoint === 0 ? [784, 1176] : [659.25, 987.77], duration: 0.3, gain: 0.035, type: 'triangle' })
    if (motionT === 1) finishCord()
    else syncUI()
  }
  const complete = (text?: string) => {
    if (!canAct() || checkpoint !== 2) return
    // Lock before calling the host, including saveWish, to prevent re-entry.
    checkpoint = 3
    resetDrag()
    paintWish(text || '赠你祝愿', !text)
    syncUI()
    feedback.impact({ freqs: [523.25, 784, 1046.5], duration: 0.5, gain: 0.05 })
    if (text) ctx.saveWish?.(text)
    ctx.onProgress?.(3)
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const onObject = (x: number, y: number) => {
    if (!canAct() || checkpoint >= 2 || moving() || blockedMulti) return false
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    return touch.hit(x, y, tip)
  }
  // Track the whole pointer stream: a second finger on the page or action
  // button must cancel a cord drag just as a second finger on the canvas does.
  const onWindowDown = (e: PointerEvent) => {
    if (disposed || !started) return
    pressed.add(e.pointerId)
    if (pressed.size > 1) { blockedMulti = true; resetDrag() }
  }
  const onWindowEnd = (e: PointerEvent) => {
    pressed.delete(e.pointerId)
    if (blockedMulti && pressed.size === 0) blockedMulti = false
  }
  const onWindowCancel = (e: PointerEvent) => {
    onWindowEnd(e)
    if (drag?.id === e.pointerId) resetDrag()
  }
  const onDown = (e: PointerEvent) => {
    if (disposed || !started) return
    pressed.add(e.pointerId)
    if (pressed.size > 1) { blockedMulti = true; resetDrag(); return }
    if (e.button !== undefined && e.button !== 0) return
    if (!onObject(e.clientX, e.clientY)) return
    routeSweeps[checkpoint]!.reset()
    drag = { id: e.pointerId, step: checkpoint, next: 1, t: 0 }
    claimedPointer = e.pointerId
    try { hitLayer.setPointerCapture?.(e.pointerId) } catch { /* Optional on synthetic/unsupported pointers. */ }
    feedback.prepare()
  }
  const moveAlongGuide = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id || blockedMulti) return
    if (!canAct() || checkpoint !== drag.step || e.buttons === 0) { resetDrag(); return }
    sampleGuide(e.clientX, e.clientY)
  }
  const sampleGuide = (x: number, y: number) => {
    if (!drag || !pointer.aim(x, y).ray.intersectPlane(guidePlane, pointerPoint)) return
    const path = routeSweeps[checkpoint]!
    path.sample([pointerPoint.x, pointerPoint.z]); drag.next = path.next; drag.t = path.progress
    pose = checkpoint + drag.t * 0.76
    hintEl.dataset.progress = 'true'
    setSafeText(hintEl, path.complete([pointerPoint.x, pointerPoint.z], .19) ? '这一段已绕好，松手即可。' : sceneTemplate('已沿金点前进 {p0}%，继续到下一处提示。', { p0: Math.round(path.progress * 100) }), shared.assertSafeCopy)
    showTip(drag.t)
    poseCords(0)
  }
  const onUp = (e: PointerEvent) => {
    const current = drag
    pressed.delete(e.pointerId)
    if (blockedMulti) {
      resetDrag()
      if (pressed.size === 0) blockedMulti = false
      return
    }
    if (!current || e.pointerId !== current.id) return
    // A browser may deliver the final gate only in pointerup. Previous gates
    // must already have been followed, so release alone cannot skip the path.
    if (current.next > 1 && canAct() && checkpoint === current.step) sampleGuide(e.clientX, e.clientY)
    const point = pointer.aim(e.clientX, e.clientY).ray.intersectPlane(guidePlane, pointerPoint)
    const valid = canAct() && point !== null && routeSweeps[current.step]!.complete([pointerPoint.x, pointerPoint.z], .19)
    drag = null
    releaseCapture()
    if (valid) workCord()
    else resetDrag()
  }
  const onCancel = (e: PointerEvent) => {
    pressed.delete(e.pointerId)
    resetDrag()
    if (pressed.size === 0) blockedMulti = false
  }
  const onLostCapture = (e: PointerEvent) => {
    if (drag?.id === e.pointerId) resetDrag()
  }
  const onAction = () => {
    if (!canAct() || moving() || blockedMulti || drag) return
    feedback.prepare()
    if (checkpoint < 2) workCord()
    else complete()
  }
  const blur = () => { focused = false; resetDrag(); pressed.clear(); blockedMulti = false; poseCords(0); syncUI() }
  const focus = () => { focused = true; if (!disposed) syncUI() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 3.8 + portraitBoost(aspect, 4)
    camera.position.copy(cameraHome)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld(true)
  }

  syncUI()
  poseCords(0)
  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      stopClaim = claimObjectTouches(hitLayer, onObject)
      window.addEventListener('pointerdown', onWindowDown, true)
      window.addEventListener('pointerup', onWindowEnd, true)
      window.addEventListener('pointercancel', onWindowCancel, true)
      hitLayer.addEventListener('pointerdown', onDown)
      hitLayer.addEventListener('pointermove', moveAlongGuide)
      hitLayer.addEventListener('pointerup', onUp)
      hitLayer.addEventListener('pointercancel', onCancel)
      hitLayer.addEventListener('lostpointercapture', onLostCapture)
      actionBtn.addEventListener('click', onAction)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      wishHandle = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: (text) => {
        if (!canAct() || checkpoint !== 2) return
        feedback.prepare()
        complete(text)
      } })
      wishHandle.mount(wishSlot, {})
      // Reconstruct checkpoints directly: no transitions, feedback, save or
      // completion events are emitted during restoration.
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      pose = Math.min(checkpoint, 2)
      motionTarget = pose
      settle = checkpoint === 3 ? 1 : 0
      springTimer = 1
      springAmp = 0
      if (checkpoint === 3) paintWish('赠你祝愿', true)
      poseCords(0)
      syncUI()
    },
    update(dt) {
      if (disposed || !started) return
      if (!canAct()) {
        suspended = true
        resetDrag()
        poseCords(0)
        syncUI()
        styleRenderer.render()
        return
      }
      if (suspended) { suspended = false; syncUI() }
      wishHandle?.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const safeDt = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, 0.05) : 0
      if (moving()) {
        motionT = reduced ? 1 : Math.min(1, motionT + safeDt / (checkpoint === 0 ? 0.9 : 1.15))
        pose = THREE.MathUtils.lerp(motionFrom, motionTarget, ease(motionT))
        if (motionT === 1) finishCord()
      }
      let springOffset = 0
      if (reduced) {
        springTimer = 1
        springAmp = 0
      } else if (springTimer < 0.42 && springAmp > 0) {
        springTimer = Math.min(0.42, springTimer + safeDt)
        const env = Math.exp(-10.5 * springTimer)
        springOffset = springTimer >= 0.42 ? 0 : springAmp * env * Math.cos(24 * springTimer)
      }
      poseCords(springOffset)
      settle = checkpoint === 3 ? reduced ? 1 : Math.min(1, settle + safeDt / 0.75) : 0
      world.rotation.y = -0.065 * ease(settle)
      sparkle = Math.max(0, sparkle - safeDt)
      cordMaterials.forEach((mat) => { mat.emissiveIntensity = reduced ? 0 : sparkle * 0.16 })
      // A stable desk camera keeps both loops and every fold edge readable.
      tipRing.scale.setScalar(reduced ? 1 : 1 + Math.sin(performance.now() * 0.003) * 0.045)
      waypoints.forEach((marker, i) => { (marker.material as THREE.MeshBasicMaterial).opacity = drag && i < drag.next ? 0.22 : 0.58 })
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopWishLocale()
      resetDrag()
      pressed.clear()
      stopResize()
      stopClaim()
      window.removeEventListener('pointerdown', onWindowDown, true)
      window.removeEventListener('pointerup', onWindowEnd, true)
      window.removeEventListener('pointercancel', onWindowCancel, true)
      hitLayer.removeEventListener('pointerdown', onDown)
      hitLayer.removeEventListener('pointermove', moveAlongGuide)
      hitLayer.removeEventListener('pointerup', onUp)
      hitLayer.removeEventListener('pointercancel', onCancel)
      hitLayer.removeEventListener('lostpointercapture', onLostCapture)
      actionBtn.removeEventListener('click', onAction)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      wishHandle?.dispose()
      wishHandle = null
      feedback.dispose()
      styleRenderer.dispose()
      disposeTree(scene)
      paperMap.dispose()
      wishMap.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      scene.clear()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
