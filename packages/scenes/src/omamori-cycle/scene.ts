import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'
import { createObjectPointer } from '../object-pointer'

const COPY = {
  title: '御守伴行', choose: '选一只小袋', carry: '别在包上', thank: '留一份感谢', quiet: '静候片刻', returnBag: '送到返还箱',
  select: '轻点一只小袋，让它陪伴接下来的一程。',
  selectReturn: '轻点这一程的小袋，带着感谢送回。',
  clasp: '按住小袋，把绳环拖到旅行包的扣环上。',
  box: '把小袋拖到木制返还箱。',
  placing: '小袋轻轻落定…',
  wish: '轻点小袋静候，或留一句心意后点「写好了」。',
  gratitude: '轻点返还箱或小袋，谢谢走过的这一程。',
  done: '让这份心意陪你同行。',
  returned: '谢谢这一程，感谢已轻轻留下。',
} as const
const VARIANTS = ['coral', 'sage', 'indigo'] as const
const HELD = new THREE.Vector3(-0.62, 1.66, 0.56)
const HUNG = new THREE.Vector3(0.58, 1.08, 0.47)
const RETURNED = new THREE.Vector3(0.58, 1.32, 0.42)
const DISPLAY = [-1.0, -0.43, 0.14] as const

function cord(points: readonly (readonly [number, number, number])[], radius: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 24, radius, 6, false), material)
}
function pouchGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.22, -0.34); shape.lineTo(0.22, -0.34); shape.lineTo(0.23, 0.2)
  shape.lineTo(0.15, 0.34); shape.lineTo(-0.15, 0.34); shape.lineTo(-0.23, 0.2); shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.17, bevelEnabled: true, bevelSize: 0.02,
    bevelThickness: 0.025, bevelSegments: 3, curveSegments: 12, steps: 1 })
  geometry.translate(0, 0, -0.085)
  return geometry
}

export function createOmamoriCycle(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  const returning = ctx.returning === true
  let step = 0, started = false, disposed = false, focused = true, dragging = false, placing = false, saved = false
  let inactiveRendered = false
  let selected = Math.max(0, VARIANTS.findIndex(variant => variant === ctx.initialVariant))
  let startIndex = -1, downX = 0, downY = 0, placeT = 0, clock = 0
  const dragOffset = new THREE.Vector3(), placeFrom = new THREE.Vector3()
  let writer: GestureHandle | null = null, stopResize = () => {}
  const canAct = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.choose }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const home = new THREE.Vector3(0.1, 2.2, 5.2), look = new THREE.Vector3(0, 1.02, 0)
  camera.position.copy(home); camera.lookAt(look)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'omamori-cycle', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff5e2, ground: 0xc7b295, key: 0xffe8c6, rim: 0xd7e7de })
  const world = new THREE.Group(); world.name = 'omamori-world'; scene.add(world)
  const material = (color: number, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness })
  const wood = material(0xd4ae7d), woodEdge = material(0xb89164), cream = material(0xf5e8c8), gold = material(0xd0b56e, 0.62)
  const rope = material(0xf7eed9), leaf = material(0x94ac84), bagMat = material(0xa8bcb1), bagEdge = material(0x718e82)
  const coral = material(0xd79485), sage = material(0x90ad95), indigo = material(0x8b97b8), seam = material(0xc5ad81)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); parent.add(mesh); return mesh
  }
  const paint = (mesh: THREE.Mesh) => { mesh.userData.toonSurface = { outline: false }; return mesh }

  // A small office table keeps the three closed bags within reach.
  const table = new THREE.Group(); table.name = 'omamori-office-table'; world.add(table)
  add(new RoundedBoxGeometry(2.78, 0.14, 1.26, 3, 0.065), wood, [0, 0.7, -0.06], table)
  add(new RoundedBoxGeometry(2.65, 0.07, 1.15, 3, 0.03), woodEdge, [0, 0.625, -0.06], table)
  for (const x of [-1.1, 1.1]) for (const z of [-0.43, 0.32]) add(new RoundedBoxGeometry(0.16, 0.63, 0.16, 2, 0.026), woodEdge, [x, 0.32, z], table)
  const tray = add(new RoundedBoxGeometry(1.83, 0.04, 0.48, 3, 0.022), cream, [-0.45, 0.795, 0.38], table)
  tray.name = 'omamori-display-tray'

  const travelBag = new THREE.Group(); travelBag.name = 'omamori-travel-bag'; travelBag.visible = !returning; world.add(travelBag)
  add(new RoundedBoxGeometry(0.9, 0.87, 0.47, 4, 0.16), bagMat, [0.61, 1.18, -0.08], travelBag)
  add(new RoundedBoxGeometry(0.65, 0.34, 0.045, 3, 0.07), bagEdge, [0.61, 1.1, 0.175], travelBag)
  add(new RoundedBoxGeometry(0.59, 0.27, 0.048, 3, 0.055), bagMat, [0.61, 1.12, 0.2], travelBag)
  travelBag.add(cord([[0.3, 1.48, -0.07], [0.32, 1.88, -0.07], [0.62, 1.96, -0.07], [0.91, 1.87, -0.07], [0.93, 1.48, -0.07]], 0.042, bagEdge))
  const clasp = add(new RoundedBoxGeometry(0.17, 0.16, 0.085, 3, 0.025), gold, [0.58, 1.6, 0.235], travelBag)
  clasp.name = 'omamori-clasp'
  add(new THREE.TorusGeometry(0.072, 0.012, 7, 24), gold, [0.58, 1.49, 0.26], travelBag)
  for (const x of [0.35, 0.87]) add(new THREE.SphereGeometry(0.022, 10, 8), gold, [x, 1.54, 0.205], travelBag)

  const returnBox = new THREE.Group(); returnBox.name = 'omamori-return-box'; returnBox.visible = returning; world.add(returnBox)
  const boxBody = add(new RoundedBoxGeometry(1.0, 0.56, 0.73, 3, 0.055), woodEdge, [0.6, 1.07, -0.03], returnBox)
  boxBody.name = 'omamori-return-box-body'
  add(new RoundedBoxGeometry(1.07, 0.09, 0.79, 3, 0.035), wood, [0.6, 1.39, -0.03], returnBox)
  const returnSlot = add(new RoundedBoxGeometry(0.6, 0.028, 0.28, 3, 0.018), cream, [0.58, 1.448, 0.12], returnBox)
  returnSlot.name = 'omamori-return-slot'
  for (const x of [0.21, 0.99]) add(new RoundedBoxGeometry(0.035, 0.43, 0.025, 2, 0.01), wood, [x, 1.1, 0.345], returnBox)
  // An original little flower on the return box takes the place of ritual lettering.
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2
    paint(add(new THREE.CircleGeometry(0.037, 16), cream, [0.6 + Math.cos(a) * 0.035, 1.06 + Math.sin(a) * 0.035, 0.352], returnBox))
  }
  paint(add(new THREE.CircleGeometry(0.025, 16), gold, [0.6, 1.06, 0.354], returnBox))

  const bodyGeo = pouchGeometry()
  const pouches = VARIANTS.map((variant, i) => {
    const root = new THREE.Group(); root.name = `omamori-pouch-${variant}`; world.add(root)
    const body = add(bodyGeo, [coral, sage, indigo][i], [0, 0, 0], root); body.name = `omamori-pouch-body-${variant}`
    // Filled extrusion, sealed top seam and a tied cord: no opening or interior contents.
    add(new RoundedBoxGeometry(0.31, 0.065, 0.21, 3, 0.02), seam, [0, 0.315, 0], root)
    for (const x of [-0.205, 0.205]) root.add(paint(cord([[x, -0.29, 0.105], [x, -0.06, 0.111], [x * 0.93, 0.18, 0.105]], 0.006, gold)))
    root.add(paint(cord([[-0.2, -0.305, 0.108], [0, -0.312, 0.11], [0.2, -0.305, 0.108]], 0.006, gold)))
    const knot = new THREE.Group(); knot.name = `omamori-knot-${variant}`; knot.position.set(0, 0.26, 0.12); root.add(knot)
    for (const x of [-0.067, 0.067]) {
      const loop = add(new THREE.TorusGeometry(0.057, 0.013, 7, 22), rope, [x, 0, 0], knot)
      loop.scale.set(1.13, 0.7, 1); loop.rotation.z = x < 0 ? -0.36 : 0.36
    }
    add(new THREE.SphereGeometry(0.03, 12, 10), rope, [0, -0.015, 0.018], knot)
    knot.add(cord([[-0.012, -0.017, 0.012], [-0.06, -0.1, 0.01], [-0.028, -0.16, 0.006]], 0.011, rope))
    knot.add(cord([[0.012, -0.017, 0.012], [0.06, -0.1, 0.01], [0.028, -0.14, 0.006]], 0.011, rope))
    root.add(cord([[-0.09, 0.325, 0], [-0.1, 0.51, -0.012], [0, 0.64, -0.015], [0.1, 0.51, -0.012], [0.09, 0.325, 0]], 0.011, rope))
    // Geometric stitches and flower sprigs are original decoration, without sacred scripts.
    for (const y of [-0.25, -0.13, -0.01, 0.11]) for (const x of [-0.15, 0.15]) {
      const stitch = paint(add(new THREE.PlaneGeometry(0.023, 0.023), gold, [x, y, 0.113], root)); stitch.rotation.z = Math.PI / 4
    }
    root.add(paint(cord([[-0.075, -0.23, 0.115], [-0.035, -0.09, 0.115], [0.038, 0.045, 0.115]], 0.006, leaf)))
    for (const [x, y, angle] of [[-0.07, -0.18, -0.8], [0.015, -0.1, 0.75]]) {
      const petal = paint(add(new THREE.CircleGeometry(0.033, 16), leaf, [x, y, 0.118], root)); petal.scale.set(0.55, 1.3, 1); petal.rotation.z = angle
    }
    for (const [cx, cy, scale] of [[0.055, 0.04, 1], [-0.065, -0.065, 0.63]]) {
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2 + i * 0.3
        const flower = paint(add(new THREE.CircleGeometry(0.035 * scale, 18), cream, [cx + Math.cos(a) * 0.028 * scale, cy + Math.sin(a) * 0.028 * scale, 0.12], root))
        flower.scale.set(1, 0.8, 1); flower.rotation.z = a
      }
      paint(add(new THREE.CircleGeometry(0.018 * scale, 16), gold, [cx, cy, 0.123], root))
    }
    addInteractionCue(body, { kind: 'tap', label: '轻点选一只小袋', priority: 3, compact: i !== selected,
      anchor: [0, 0, 0.1], enabled: () => canAct() && !placing && step === 0 })
    addInteractionCue(body, { kind: 'drag', label: returning ? '拖小袋到返还箱' : '拖小袋到扣环', priority: 3,
      anchor: [0, 0, 0.1], destination: returning ? returnSlot : clasp, targetLabel: returning ? '返还箱' : '旅行包扣环',
      enabled: () => canAct() && !placing && step === 1 && i === selected })
    addInteractionCue(body, { kind: 'tap', label: returning ? '轻点小袋致谢' : '轻点小袋静候', priority: 3,
      anchor: [0, 0, 0.1], compact: returning,
      enabled: () => canAct() && !placing && step === 2 && i === selected })
    return { root, body }
  })
  addInteractionCue(boxBody, { kind: 'tap', label: '轻点返还箱致谢', priority: 4, anchor: [0, -0.07, 0.37],
    enabled: () => canAct() && !placing && returning && step === 2 })

  const destination = returning ? RETURNED : HUNG
  const matrices = () => { scene.updateMatrixWorld(); camera.updateMatrixWorld() }
  const physicalLayout = () => {
    pouches.forEach(({ root }, i) => {
      const isSelected = i === selected && step > 0
      root.position.set(DISPLAY[i], 1.075, 0.38); root.scale.setScalar(0.72); root.rotation.set(0, 0, i === 1 ? 0.04 : -0.035)
      if (isSelected) {
        root.position.copy(step >= 2 ? destination : HELD); root.scale.setScalar(0.9); root.rotation.set(0, 0, 0)
      }
    })
  }
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -HELD.z), point = new THREE.Vector3()
  const resetDrag = () => { dragging = false; startIndex = -1; if (!placing) physicalLayout() }
  const objectAt = (x: number, y: number, candidates: THREE.Object3D[]) => ray.aim(x, y).intersectObjects(candidates, false)[0]?.object
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: canAct,
    canStart(x, y) {
      if (placing || step === 3) return false
      matrices()
      return Boolean(objectAt(x, y, step === 0 ? pouches.map(p => p.body) : returning && step === 2 ? [pouches[selected].body, boxBody] : [pouches[selected].body]))
    },
    onStart(x, y) {
      matrices(); downX = x; downY = y; feedback.prepare()
      startIndex = step === 0 ? pouches.findIndex(p => p.body === objectAt(x, y, pouches.map(p => p.body))) : selected
      dragging = step === 1
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) dragOffset.copy(pouches[selected].root.position).sub(point)
    },
    onMove(x, y) {
      if (!dragging || step !== 1) return
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) {
        point.add(dragOffset)
        pouches[selected].root.position.set(THREE.MathUtils.clamp(point.x, -1.35, 1.35), THREE.MathUtils.clamp(point.y, 0.8, 1.9), HELD.z)
      }
    },
    onRelease(x, y) {
      const index = startIndex; dragging = false; startIndex = -1; matrices()
      if (step === 0 && index >= 0 && Math.hypot(x - downX, y - downY) < 12 && ray.hits(x, y, [pouches[index].body])) choose(index)
      else if (step === 1 && ray.hits(x, y, [returning ? returnSlot : clasp])) place()
      else if (step === 2 && Math.hypot(x - downX, y - downY) < 12 && ray.hits(x, y, returning ? [pouches[selected].body, boxBody] : [pouches[selected].body])) finish()
      else resetDrag()
    },
    onCancel: resetDrag,
  })
  const sync = () => {
    ui.renderDots(step, 3); ui.actionBtn.hidden = step === 3
    ui.actionBtn.disabled = placing || !canAct(); ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    wishSlot.hidden = step !== 2 || returning
    writer?.setEnabled(step === 2 && !returning && !placing && canAct())
    ui.hitLayer.style.pointerEvents = step < 3 && !placing ? 'auto' : 'none'
    setSafeText(ui.hintEl, step === 0 ? returning ? COPY.selectReturn : COPY.select : step === 1 ? placing ? COPY.placing : returning ? COPY.box : COPY.clasp : step === 2 ? returning ? COPY.gratitude : COPY.wish : returning ? COPY.returned : COPY.done, safe)
    setSafeText(ui.actionBtn, step === 0 ? COPY.choose : step === 1 ? returning ? COPY.returnBag : COPY.carry : returning ? COPY.thank : COPY.quiet, safe)
  }
  function choose(index: number) {
    if (!canAct() || pointer.isBusy() || step !== 0 || placing) return
    selected = index; step = 1; physicalLayout(); sync()
    ctx.onVariantChange?.(VARIANTS[selected]); ctx.onProgress?.(1)
    feedback.impact({ freqs: [523.25, 659.25], duration: 0.18, gain: 0.019, type: 'triangle' })
  }
  function placed() {
    if (!canAct() || step !== 1 || !placing) return
    step = 2; placing = false; clock = 0; physicalLayout(); sync(); ctx.onProgress?.(2)
    feedback.impact({ freqs: [659.25], duration: 0.17, gain: 0.016 })
  }
  function place() {
    if (!canAct() || pointer.isBusy() || step !== 1 || placing) return
    placing = true; dragging = false; placeT = 0; placeFrom.copy(pouches[selected].root.position); sync()
    if (reduced()) placed()
  }
  function finish(text = '') {
    if (!canAct() || pointer.isBusy() || step !== 2 || placing) return
    const line = text.trim()
    // Set the terminal phase before any host callback, including saving a wish.
    step = 3; clock = 0; physicalLayout(); sync()
    if (line && !returning && !saved) { saved = true; ctx.saveWish?.(line) }
    ctx.onProgress?.(3)
    feedback.impact({ freqs: [392, 587.33], duration: 0.25, gain: 0.018 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => {
    if (!canAct() || pointer.isBusy() || placing) return
    feedback.prepare()
    if (step === 0) choose(selected); else if (step === 1) place(); else if (step === 2) finish()
  }
  const blur = () => { focused = false; pointer.cancel(); writer?.setEnabled(false); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    home.z = 5.2 + portraitBoost(aspect, 2.8); camera.position.copy(home); camera.lookAt(look)
  }
  physicalLayout(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; step = THREE.MathUtils.clamp(Math.floor(ctx.initialProgress ?? 0), 0, 3)
      physicalLayout(); resize(); stopResize = observeCanvasResize(canvas, resize)
      if (!returning) {
        writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
          onSubmit: text => { if (!canAct() || pointer.isBusy() || step !== 2 || placing) return; feedback.prepare(); finish(text) } })
        writer.mount(wishSlot, {})
      }
      ui.actionBtn.addEventListener('click', action)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      sync(); matrices()
    },
    update(dt) {
      if (!started || disposed) return
      if (!canAct()) {
        pointer.cancel(); writer?.setEnabled(false)
        // Refresh projected cues once while keeping animation and feedback paused.
        if (!inactiveRendered) { style.render(); inactiveRendered = true }
        return
      }
      inactiveRendered = false
      writer?.setEnabled(step === 2 && !returning && !placing); writer?.update(dt)
      ui.actionBtn.disabled = placing; ui.actionBtn.setAttribute('aria-disabled', String(placing))
      const delta = Math.min(Math.max(dt, 0), 0.05), quiet = reduced()
      if (placing) {
        placeT = quiet ? 1 : Math.min(1, placeT + delta / 0.6)
        const eased = placeT * placeT * (3 - 2 * placeT)
        pouches[selected].root.position.lerpVectors(placeFrom, destination, eased)
        pouches[selected].root.rotation.z = quiet ? 0 : Math.sin(placeT * Math.PI) * 0.035
        if (placeT === 1) placed()
      } else if (step >= 2 && !dragging) {
        if (!quiet) clock += delta
        pouches[selected].root.rotation.z = quiet || returning ? 0 : Math.sin(clock * 1.8) * Math.exp(-clock * 1.1) * 0.012
      }
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; stopResize(); pointer.dispose(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); lights.key.dispose(); lights.rim.dispose()
      scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
