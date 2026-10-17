import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, claimObjectTouches, createPointerRay, createSceneFeedback,
  createStepOverlay, createWarmStage, disposeTree, observeCanvasResize,
  portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '达摩点睛',
  stepsAria: '步骤',
  paint: '点上一目',
  paintReturn: '补上另一目',
  hintPaint: '轻点空白眼圈，或把毛笔拖到眼圈。另一目留待日后回访。（民俗工艺的产品改编）',
  hintReturn: '这一目已经留下目标。轻点另一目，或把毛笔拖到空白眼圈。（产品改编）',
  wish: '暂留心意',
  hintWish: '写下一个短目标，或先把心意留在此刻。另一目仍然留白。',
  acknowledge: '静看片刻',
  hintAcknowledge: '两目相对，静看自己走过的这段路，再轻点达摩留住这一刻。',
  settle: '轻放在木座上',
  hintSettle: '把达摩轻轻向下拖到木座。',
  settling: '轻摆归位…',
  done: '达摩稳稳停在木座上，另一目留待日后。',
  doneReturn: '两目已点，达摩稳稳停在木座上。',
} as const

const HEIGHT = 1.72
const REST_Y = 0.135
const HELD_Y = REST_Y + 0.12

/** A bottom-heavy egg with a small flat base, rather than a sphere. */
function radiusAt(y: number) {
  const u = THREE.MathUtils.clamp((y - 0.82) / 0.9, -1, 1)
  return 0.72 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - u * 0.12)
}

/** Every painted feature follows the same red shell surface. */
function frontPoint(x: number, y: number, offset = 0) {
  const r = radiusAt(y)
  return new THREE.Vector3(x, y, Math.sqrt(Math.max(0, r * r - x * x)) * 0.82 + offset)
}

function disk(cx: number, cy: number, rx: number, ry: number, offset: number) {
  const centre = frontPoint(cx, cy, offset)
  const vertices: number[] = [0, 0, 0]
  const indices: number[] = []
  const rings = 6
  const sides = 48
  for (let ring = 1; ring <= rings; ring++) {
    for (let i = 0; i <= sides; i++) {
      const angle = i / sides * Math.PI * 2
      const p = frontPoint(cx + Math.cos(angle) * rx * ring / rings, cy + Math.sin(angle) * ry * ring / rings, offset)
      vertices.push(p.x - centre.x, p.y - centre.y, p.z - centre.z)
    }
  }
  for (let i = 0; i < sides; i++) indices.push(0, i + 1, i + 2)
  for (let ring = 1; ring < rings; ring++) {
    const a = 1 + (ring - 1) * (sides + 1)
    const b = a + sides + 1
    for (let i = 0; i < sides; i++) indices.push(a + i, b + i, b + i + 1, a + i, b + i + 1, a + i + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return { geometry, centre }
}

/** Low-relief brush marks, with no copied or invented religious lettering. */
function stroke(points: readonly (readonly [number, number])[], width: number, material: THREE.Material, offset = 0.025) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => frontPoint(x, y, offset)))
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 32, width, 5, false), material)
}

function makeShadow() {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x + 0.5 - size / 2) / (size / 2), (y + 0.5 - size / 2) / (size / 2))
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(Math.pow(Math.max(0, 1 - d), 1.7) * 255)
    }
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

export function createDarumaEyePainting(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared
  Object.values(COPY).forEach(assertSafeCopy)
  const returning = ctx.returning === true
  let step = 0
  let started = false
  let disposed = false
  let focused = true
  let settling = false
  let settleK = 0
  let saved = false
  let blockedMulti = false
  let wobble = 0
  let wobbleVelocity = 0
  let elapsed = 0
  let wishHandle: GestureHandle | null = null
  let stopResize = () => {}
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)
  const canAct = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false

  const ui = createStepOverlay(overlay, {
    title: COPY.title, stepsAria: COPY.stepsAria, action: returning ? COPY.paintReturn : COPY.paint,
  }, assertSafeCopy)
  const { hitLayer, hintEl, actionBtn } = ui
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const { scene, renderer } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const cameraHome = new THREE.Vector3(0, 1.45, 3.45)
  const cameraLookAt = new THREE.Vector3(0, 0.97, 0)
  camera.position.copy(cameraHome)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'daruma-eye-painting', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)
  addStageLights(scene, ctx.stage, {
    sky: 0xfff1df, ground: 0xcbad8b, key: 0xffe5be, rim: 0xd5e8e2,
    keyIntensity: 1.45, keyPosition: [-2.5, 4, 3],
  })
  const world = new THREE.Group()
  scene.add(world)

  const red = new THREE.MeshStandardMaterial({ color: 0xb82f29, roughness: 0.68, vertexColors: true })
  const cream = new THREE.MeshStandardMaterial({ color: 0xffebcf, roughness: 0.9, side: THREE.DoubleSide })
  const white = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.91, side: THREE.DoubleSide })
  const ink = new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 0.91, side: THREE.DoubleSide })
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9aa4c, roughness: 0.64, metalness: 0.12, side: THREE.DoubleSide })
  const redPaint = new THREE.MeshStandardMaterial({ color: 0xa42a25, roughness: 0.86 })
  const wood = new THREE.MeshStandardMaterial({ color: 0xa8794f, roughness: 0.9 })
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x78523b, roughness: 0.92 })

  const stand = new THREE.Mesh(new RoundedBoxGeometry(1.72, 0.13, 1.04, 3, 0.055), wood)
  stand.name = 'daruma-stand'
  stand.position.y = 0.065
  world.add(stand)
  for (const x of [-0.59, 0.59]) {
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.06, 0.64, 2, 0.02), darkWood)
    foot.position.set(x, 0.015, 0)
    world.add(foot)
  }
  // Sparse, shallow wood-grain lines remain legible on small screens.
  for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(new RoundedBoxGeometry(0.24 + i * 0.08, 0.003, 0.006, 2, 0.002), darkWood)
    line.position.set(-0.37 + i * 0.24, 0.132, 0.39 - i * 0.045)
    world.add(line)
  }
  const shadowMap = makeShadow()
  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.28, 1.52), new THREE.MeshBasicMaterial({
    map: shadowMap, color: 0x49362a, opacity: 0.25, transparent: true, depthWrite: false,
  }))
  groundShadow.rotation.x = -Math.PI / 2
  groundShadow.position.y = 0.002
  world.add(groundShadow)
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.91), new THREE.MeshBasicMaterial({
    map: shadowMap, color: 0x362820, opacity: 0.37, transparent: true, depthWrite: false,
  }))
  contactShadow.rotation.x = -Math.PI / 2
  contactShadow.position.y = 0.134
  world.add(contactShadow)

  const doll = new THREE.Group()
  doll.name = 'daruma-doll'
  doll.position.y = REST_Y
  world.add(doll)
  const profile = Array.from({ length: 65 }, (_, i) => {
    const y = i / 64 * HEIGHT
    return new THREE.Vector2(radiusAt(y), y)
  })
  const bodyGeometry = new THREE.LatheGeometry(profile, 80)
  bodyGeometry.scale(1, 1, 0.82)
  const position = bodyGeometry.getAttribute('position')
  const colors: number[] = []
  for (let i = 0; i < position.count; i++) {
    const shade = 0.97 + 0.018 * Math.sin(position.getX(i) * 71 + position.getY(i) * 53) * Math.sin(position.getZ(i) * 83)
    colors.push(shade, shade, shade)
  }
  bodyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const shell = new THREE.Mesh(bodyGeometry, red)
  shell.name = 'daruma-shell'
  doll.add(shell)

  // The face is tessellated onto the shell, not a flat plate stuck to a ball.
  const faceRows = 30
  const faceCols = 32
  const widths = [[0.52, 0.21], [0.56, 0.42], [0.67, 0.51], [1.1, 0.53], [1.25, 0.49], [1.35, 0.4], [1.39, 0.26]]
  const faceVertices: number[] = []
  const faceIndices: number[] = []
  for (let row = 0; row <= faceRows; row++) {
    const y = 0.52 + row / faceRows * 0.87
    let segment = 0
    while (segment < widths.length - 2 && y > widths[segment + 1][0]) segment++
    const [aY, aW] = widths[segment]
    const [bY, bW] = widths[segment + 1]
    const halfWidth = THREE.MathUtils.lerp(aW, bW, (y - aY) / (bY - aY))
    for (let col = 0; col <= faceCols; col++) {
      const p = frontPoint((col / faceCols * 2 - 1) * halfWidth, y, 0.009)
      faceVertices.push(p.x, p.y, p.z)
      if (row < faceRows && col < faceCols) {
        const a = row * (faceCols + 1) + col
        const b = a + faceCols + 1
        faceIndices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const faceGeometry = new THREE.BufferGeometry()
  faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(faceVertices, 3))
  faceGeometry.setIndex(faceIndices)
  faceGeometry.computeVertexNormals()
  doll.add(new THREE.Mesh(faceGeometry, cream))

  const pupils: THREE.Mesh[] = []
  const eyes: THREE.Mesh[] = []
  for (const [i, x] of [-0.255, 0.255].entries()) {
    const eyeName = i === 0 ? 'first' : 'second'
    const addDisk = (rx: number, ry: number, offset: number, material: THREE.Material) => {
      const { geometry, centre } = disk(x, 1.075, rx, ry, offset)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(centre)
      doll.add(mesh)
      return mesh
    }
    addDisk(0.173, 0.185, 0.018, gold)
    const eye = addDisk(0.15, 0.164, 0.022, white)
    eye.name = `daruma-eye-target-${eyeName}`
    eyes.push(eye)
    const pupil = addDisk(0.105, 0.119, 0.028, ink)
    pupil.name = `daruma-pupil-${eyeName}`
    pupil.visible = i === 0 && returning
    pupils.push(pupil)
  }
  for (const sign of [-1, 1]) {
    const mirror = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => [x * sign, y] as const)
    // Broad brow, sweeping temple/beard, and a few fine brush tails.
    doll.add(stroke(mirror([[0.07, 1.21], [0.19, 1.36], [0.34, 1.38], [0.47, 1.22]]), 0.034, ink))
    doll.add(stroke(mirror([[0.1, 1.19], [0.28, 1.31], [0.43, 1.27]]), 0.012, ink))
    doll.add(stroke(mirror([[0.45, 1.22], [0.51, 1.01], [0.5, 0.79], [0.4, 0.63]]), 0.024, ink))
    doll.add(stroke(mirror([[0.06, 0.6], [0.2, 0.65], [0.39, 0.6]]), 0.025, ink))
    doll.add(stroke(mirror([[0.035, 0.73], [0.12, 0.84], [0.2, 0.78]]), 0.014, redPaint))
    for (let i = 0; i < 4; i++) {
      doll.add(stroke(mirror([[0.44, 0.78 + i * 0.055], [0.37 - i * 0.012, 0.84 + i * 0.032]]), 0.0055, ink))
      doll.add(stroke(mirror([[0.03 + i * 0.04, 0.565], [0.13 + i * 0.045, 0.535 + i * 0.009]]), 0.0045, ink))
    }
    // Shoulder and skirt strokes echo hand-painted gilding without script.
    for (let i = 0; i < 3; i++) {
      doll.add(stroke(mirror([[0.29 + i * 0.08, 0.24], [0.34 + i * 0.07, 0.36], [0.34 + i * 0.07, 0.47]]), 0.014 - i * 0.002, gold, 0.017))
    }
    doll.add(stroke(mirror([[0.51, 1.36], [0.46, 1.48], [0.36, 1.52]]), 0.012, gold, 0.017))
  }
  doll.add(stroke([[-0.08, 0.595], [0, 0.586], [0.08, 0.595]], 0.005, redPaint))
  doll.add(stroke([[-0.21, 0.24], [0, 0.21], [0.21, 0.24]], 0.011, gold, 0.019))

  const brush = new THREE.Group()
  brush.name = 'daruma-brush'
  const brushHome = new THREE.Vector3(0.91, 0.63, 0.44)
  brush.position.copy(brushHome)
  brush.rotation.z = -0.38
  world.add(brush)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.039, 0.54, 14), wood)
  shaft.name = 'daruma-brush-shaft'
  brush.add(shaft)
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.035, 0.08, 14), darkWood)
  collar.position.y = 0.28
  brush.add(collar)
  const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.041, 0.17, 16), ink)
  bristles.position.y = 0.395
  brush.add(bristles)
  const brushTip = new THREE.Vector3(0, 0.48, 0).applyEuler(brush.rotation)
  const brushTarget = brushHome.clone()

  const pointer = createPointerRay(canvas, camera)
  const updateMatrices = () => { scene.updateMatrixWorld(); camera.updateMatrixWorld() }
  const hits = (x: number, y: number, objects: THREE.Object3D[]) => {
    updateMatrices()
    return pointer.hits(x, y, objects)
  }
  const onDoll = (x: number, y: number) => hits(x, y, [shell])
  const onObject = (x: number, y: number) => canAct() && !settling && !blockedMulti && (
    step === 0 ? hits(x, y, [shell, shaft, collar, bristles]) : (step === 2 || returning && step === 1) && onDoll(x, y)
  )
  const onEye = (x: number, y: number) => hits(x, y, [eyes[returning ? 1 : 0]])
  const onStand = (x: number, y: number) => hits(x, y, [stand])
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.66)
  const hitPoint = new THREE.Vector3()
  const pointers = new Set<number>()
  let dragId: number | null = null
  let downY = 0
  let dragLean = 0

  const paintTarget = eyes[returning ? 1 : 0]
  const canPaint = () => canAct() && !settling && !blockedMulti && step === 0
  addInteractionCue(paintTarget, {
    kind: 'tap', label: returning ? '轻点另一目' : '轻点空白眼圈', enabled: canPaint, priority: 2,
  })
  addInteractionCue(shaft, {
    kind: 'drag', label: '拖毛笔到眼圈', anchor: [0, -0.18, 0], enabled: canPaint,
    destination: paintTarget, targetLabel: '空白眼圈',
  })
  const settleAnchor = frontPoint(0, 0.78, 0.02)
  addInteractionCue(shell, {
    kind: 'drag', label: '拖达摩到木座',
    anchor: [settleAnchor.x, settleAnchor.y, settleAnchor.z],
    enabled: () => canAct() && !settling && !blockedMulti && step === 2,
    destination: () => stand.localToWorld(new THREE.Vector3(0, 0.066, 0.42)), targetLabel: '木座', priority: 2,
  })
  addInteractionCue(shell, {
    kind: 'tap', label: '轻点达摩静看', anchor: [settleAnchor.x, settleAnchor.y, settleAnchor.z], priority: 2,
    enabled: () => canAct() && !settling && !blockedMulti && returning && step === 1,
  })

  const syncOverlay = () => {
    ui.renderDots(step, 3)
    actionBtn.hidden = step === 3
    actionBtn.disabled = settling
    actionBtn.setAttribute('aria-disabled', String(settling))
    wishSlot.hidden = returning || step !== 1
    wishHandle?.setEnabled(step === 1 && !returning && canAct())
    hitLayer.style.pointerEvents = (step === 0 || step === 2 || returning && step === 1) && !settling ? 'auto' : 'none'
    let text: string
    let action: string
    if (step === 0) {
      text = returning ? COPY.hintReturn : COPY.hintPaint
      action = returning ? COPY.paintReturn : COPY.paint
    } else if (step === 1) {
      text = returning ? COPY.hintAcknowledge : COPY.hintWish
      action = returning ? COPY.acknowledge : COPY.wish
    } else if (step === 2) {
      text = settling ? COPY.settling : COPY.hintSettle
      action = COPY.settle
    } else {
      text = returning ? COPY.doneReturn : COPY.done
      action = COPY.settle
    }
    setSafeText(hintEl, text, assertSafeCopy)
    setSafeText(actionBtn, action, assertSafeCopy)
  }

  const cancelDrag = () => {
    const claimed = dragId
    // Releasing capture can emit lostpointercapture synchronously.
    dragId = null
    dragLean = 0
    brushTarget.copy(brushHome)
    if (claimed !== null) {
      try { hitLayer.releasePointerCapture(claimed) } catch { /* capture may have already ended */ }
    }
  }
  const paintEye = () => {
    if (!canAct() || step !== 0) return
    step = 1
    pupils[returning ? 1 : 0].visible = true
    brush.visible = false
    cancelDrag()
    wobbleVelocity = reduced() ? 0 : 0.42
    fx.impact({ freqs: [523.25, 783.99], duration: 0.23, gain: 0.025, type: 'triangle' })
    ctx.onProgress?.(1)
    syncOverlay()
  }
  const leaveWish = (text?: string) => {
    if (!canAct() || step !== 1) return
    // Change stage before calling the host, so reentrant/repeated submission is harmless.
    step = 2
    wishHandle?.setEnabled(false)
    if (text && !returning && !saved) {
      saved = true
      ctx.saveWish?.(text)
    }
    fx.impact({ freqs: [659.25], duration: 0.18, gain: 0.02 })
    ctx.onProgress?.(2)
    syncOverlay()
  }
  const complete = () => {
    if (!canAct() || step !== 2 || !settling) return
    step = 3
    settling = false
    wobble = wobbleVelocity = 0
    doll.position.y = REST_Y
    doll.rotation.z = 0
    ctx.onProgress?.(3)
    fx.impact({ freqs: [392, 587.33], duration: 0.3, gain: 0.025 })
    syncOverlay()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const settle = () => {
    if (!canAct() || step !== 2 || settling) return
    settling = true
    settleK = 0
    cancelDrag()
    wobbleVelocity = reduced() ? 0 : -0.55
    syncOverlay()
    if (reduced()) { settleK = 1; complete() }
  }
  const onAction = () => {
    if (!canAct() || settling || blockedMulti || dragId !== null || pointers.size > 0) return
    fx.prepare()
    if (step === 0) paintEye()
    else if (step === 1) leaveWish()
    else if (step === 2) settle()
  }
  const forgetPointer = (id: number) => {
    pointers.delete(id)
    if (pointers.size === 0) blockedMulti = false
  }
  // Observe the entire window in capture phase: another finger on the page
  // or overlay UI cancels the stroke just as another finger on the doll does.
  const onWindowDown = (e: PointerEvent) => {
    if (!started || disposed) return
    pointers.add(e.pointerId)
    if (pointers.size > 1) { blockedMulti = true; cancelDrag() }
  }
  const onWindowEnd = (e: PointerEvent) => {
    // A stage release is resolved by onUp/onCancel before removing ownership.
    if (e.target instanceof Node && hitLayer.contains(e.target)) return
    if (dragId === e.pointerId) cancelDrag()
    forgetPointer(e.pointerId)
  }
  const onWindowCancel = (e: PointerEvent) => {
    if (dragId === e.pointerId) cancelDrag()
    onWindowEnd(e)
  }
  const onDown = (e: PointerEvent) => {
    if (!canAct() || e.button > 0) return
    pointers.add(e.pointerId)
    if (pointers.size > 1 || blockedMulti) { blockedMulti = true; cancelDrag(); return }
    if (!onObject(e.clientX, e.clientY)) return
    dragId = e.pointerId
    downY = e.clientY
    fx.prepare()
    try { hitLayer.setPointerCapture(e.pointerId) } catch { /* optional on synthetic surfaces */ }
  }
  const onMove = (e: PointerEvent) => {
    if (!canAct()) { cancelDrag(); return }
    if (dragId !== e.pointerId || pointers.size !== 1 || blockedMulti) return
    if (e.buttons === 0) { cancelDrag(); return }
    if (step === 0) {
      if (pointer.aim(e.clientX, e.clientY).ray.intersectPlane(dragPlane, hitPoint)) {
        brushTarget.copy(hitPoint).sub(brushTip)
        brushTarget.x = THREE.MathUtils.clamp(brushTarget.x, -1, 1.15)
        brushTarget.y = THREE.MathUtils.clamp(brushTarget.y, 0.2, 1.7)
      }
    } else if (step === 2) dragLean = THREE.MathUtils.clamp((downY - e.clientY) * 0.0015, -0.1, 0.1)
  }
  const onUp = (e: PointerEvent) => {
    const valid = dragId === e.pointerId && pointers.size === 1 && !blockedMulti && canAct()
    forgetPointer(e.pointerId)
    if (!valid) {
      if (dragId === e.pointerId) cancelDrag()
      return
    }
    const currentStep = step
    cancelDrag()
    if (currentStep === 0 && onEye(e.clientX, e.clientY)) paintEye()
    else if (currentStep === 1 && returning && onDoll(e.clientX, e.clientY)) leaveWish()
    else if (currentStep === 2 && onStand(e.clientX, e.clientY)) settle()
  }
  const onCancel = (e: PointerEvent) => {
    forgetPointer(e.pointerId)
    cancelDrag()
  }
  const onLostCapture = (e: PointerEvent) => {
    if (dragId === e.pointerId) cancelDrag()
  }
  const onBlur = () => {
    focused = false
    pointers.clear()
    blockedMulti = false
    cancelDrag()
    wishHandle?.setEnabled(false)
  }
  const onFocus = () => {
    focused = true
    if (!disposed) syncOverlay()
  }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 3.45 + portraitBoost(aspect, 3.2)
    camera.position.copy(cameraHome)
    camera.lookAt(cameraLookAt)
  }

  syncOverlay()
  return {
    start() {
      if (disposed || started) return
      started = true
      step = THREE.MathUtils.clamp(Math.floor(ctx.initialProgress ?? 0), 0, 3)
      pupils[0].visible = returning || step >= 1
      pupils[1].visible = returning && step >= 1
      brush.visible = step === 0
      doll.position.y = step === 2 ? HELD_Y : REST_Y
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning) {
        wishHandle = gestures.createWishWrite({
          maxLen: 40, saves: ctx.saveWish !== undefined,
          onSubmit: (text) => leaveWish(text),
        })
        wishHandle.mount(wishSlot, {})
      }
      hitLayer.addEventListener('pointerdown', onDown)
      hitLayer.addEventListener('pointermove', onMove)
      hitLayer.addEventListener('pointerup', onUp)
      hitLayer.addEventListener('pointercancel', onCancel)
      hitLayer.addEventListener('lostpointercapture', onLostCapture)
      window.addEventListener('pointerdown', onWindowDown, true)
      window.addEventListener('pointerup', onWindowEnd, true)
      window.addEventListener('pointercancel', onWindowCancel, true)
      window.addEventListener('blur', onBlur)
      window.addEventListener('focus', onFocus)
      actionBtn.addEventListener('click', onAction)
      stopClaim = claimObjectTouches(hitLayer, onObject)
      syncOverlay()
      updateMatrices()
    },
    update(dt) {
      if (!started || disposed) return
      if (!canAct()) {
        pointers.clear()
        blockedMulti = false
        cancelDrag()
        wishHandle?.setEnabled(false)
        return
      }
      wishHandle?.setEnabled(step === 1)
      wishHandle?.update(dt)
      const delta = Math.min(Math.max(dt, 0), 0.05)
      elapsed += delta
      const quiet = reduced()
      if (quiet) wobble = wobbleVelocity = 0
      else {
        const target = step === 3 ? 0 : dragLean + Math.sin(elapsed * 0.9) * 0.009
        wobbleVelocity += (-(wobble - target) * 26 - wobbleVelocity * 7) * delta
        wobble += wobbleVelocity * delta
      }
      doll.rotation.z = quiet ? 0 : wobble
      if (settling) {
        settleK = quiet ? 1 : Math.min(1, settleK + delta / 0.95)
        const eased = settleK * settleK * (3 - 2 * settleK)
        doll.position.y = THREE.MathUtils.lerp(HELD_Y, REST_Y, eased)
        if (settleK >= 1) complete()
      } else {
        const targetY = step === 2 ? HELD_Y : REST_Y
        doll.position.y = THREE.MathUtils.lerp(doll.position.y, targetY, quiet ? 1 : 1 - Math.exp(-delta * 10))
      }
      brush.position.lerp(brushTarget, quiet ? 1 : 1 - Math.exp(-delta * 18))
      ;(contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.37 - (doll.position.y - REST_Y) * 0.8
      camera.position.copy(cameraHome)
      camera.lookAt(cameraLookAt)
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopResize()
      stopClaim()
      pointers.clear()
      cancelDrag()
      hitLayer.removeEventListener('pointerdown', onDown)
      hitLayer.removeEventListener('pointermove', onMove)
      hitLayer.removeEventListener('pointerup', onUp)
      hitLayer.removeEventListener('pointercancel', onCancel)
      hitLayer.removeEventListener('lostpointercapture', onLostCapture)
      window.removeEventListener('pointerdown', onWindowDown, true)
      window.removeEventListener('pointerup', onWindowEnd, true)
      window.removeEventListener('pointercancel', onWindowCancel, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      actionBtn.removeEventListener('click', onAction)
      wishHandle?.dispose()
      wishHandle = null
      fx.dispose()
      styleRenderer.dispose()
      disposeTree(world)
      shadowMap.dispose()
      scene.clear()
      renderer.dispose()
      renderer.forceContextLoss()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
