import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'
import { createObjectPointer } from '../object-pointer'

const COPY = {
  title: '木牌记愿', flip: '翻到背面', blank: '先留白', acknowledge: '留一份感谢', hang: '挂上木牌',
  front: '从木牌上向左右轻拖，翻到背面；也可点下方翻面。（民俗工艺的产品改编）',
  write: '写下一句短愿，或先留白；只有点「写好了」才会保存。',
  return: '静看走过的一段路，把感谢留在这块木牌上。',
  ready: '把木牌拖到横梁中央的挂点，或点下方挂上。',
  hanging: '木牌轻轻落在横梁下…',
  done: '木牌已经挂好，心意留在了这里。（练习结束）',
} as const
const HELD = new THREE.Vector3(0.35, 0.8, 0.62)
const HUNG = new THREE.Vector3(0, 1.04, 0.05)

function plaqueShape() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.7, -0.5); shape.lineTo(0.7, -0.5); shape.lineTo(0.7, 0.26)
  shape.lineTo(0, 0.6); shape.lineTo(-0.7, 0.26); shape.closePath()
  for (const x of [-0.32, 0.32]) {
    const hole = new THREE.Path()
    hole.absarc(x, 0.28, 0.043, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  return shape
}
function tube(points: readonly (readonly [number, number, number])[], radius: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 6, false), material)
}
function leafGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0); shape.bezierCurveTo(-0.02, 0.1, 0.02, 0.23, 0.13, 0.27)
  shape.bezierCurveTo(0.17, 0.16, 0.1, 0.02, 0, 0)
  return new THREE.ShapeGeometry(shape, 16)
}

export function createEmaVotivePlaque(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  const returning = ctx.returning === true
  let step = 0, started = false, disposed = false, focused = true
  let saved = false, dragging = false, hanging = false, hangT = 0
  let turnT = 1, turnFrom = 0, backAngle = Math.PI, angleTarget = 0
  let downX = 0, downY = 0, clock = 0
  const hangFrom = HELD.clone(), dragOffset = new THREE.Vector3()
  let writer: GestureHandle | null = null
  let stopResize = () => {}
  const canAct = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.flip }, safe)
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)

  const { scene, renderer } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const home = new THREE.Vector3(0.12, 1.68, 4.55), look = new THREE.Vector3(0, 1.1, 0)
  camera.position.copy(home); camera.lookAt(look)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'ema-votive-plaque', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff4e3, ground: 0xc4ad8e, key: 0xffe6c1, rim: 0xd8ede0 })
  const world = new THREE.Group(); scene.add(world)
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.91 })
  const wood = material(0xd5af7b), timber = material(0xb58b64), edgeWood = material(0x966e4e)
  const ropeMat = material(0xe5d9b8), green = material(0x84ab88), coral = material(0xd99077)
  const cream = material(0xf3ddb3), gold = material(0xd4ae63), ink = material(0x776951)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); parent.add(mesh); return mesh
  }
  const paint = (mesh: THREE.Mesh) => { mesh.userData.toonSurface = { outline: false }; return mesh }
  const rack = new THREE.Group(); rack.name = 'ema-rack'; world.add(rack)
  for (const x of [-1.08, 1.08]) {
    add(new RoundedBoxGeometry(0.18, 2.16, 0.23, 3, 0.04), timber, [x, 1.08, -0.2], rack)
    add(new RoundedBoxGeometry(0.35, 0.09, 0.68, 3, 0.035), edgeWood, [x, 0.045, -0.14], rack)
  }
  for (const y of [0.64, 1.87]) add(new RoundedBoxGeometry(2.38, 0.17, 0.23, 3, 0.04), timber, [0, y, -0.11], rack)
  for (const x of [-0.82, 0, 0.82]) {
    const peg = add(new THREE.CylinderGeometry(0.027, 0.029, 0.16, 12), edgeWood, [x, 1.84, 0.06], rack)
    peg.rotation.x = Math.PI / 2
  }
  const target = add(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshBasicMaterial({ visible: false }), [0, 1.84, 0.09], rack)
  target.name = 'ema-hang-target'
  const guide = add(new THREE.TorusGeometry(0.12, 0.008, 6, 36), new THREE.MeshBasicMaterial({ color: 0xb4cbbb, transparent: true, opacity: 0.65, depthWrite: false }), [0, 1.84, 0.155], rack)
  guide.userData.toonSurface = { outline: false }

  const plaque = new THREE.Group(); plaque.name = 'ema-plaque'; plaque.position.copy(HELD); world.add(plaque)
  const bodyGeometry = new THREE.ExtrudeGeometry(plaqueShape(), { depth: 0.1, bevelEnabled: true,
    bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 24, steps: 1 })
  bodyGeometry.translate(0, 0, -0.05)
  const body = add(bodyGeometry, wood, [0, 0, 0], plaque); body.name = 'ema-plaque-body'
  const rope = tube([[-0.32, 0.28, 0.076], [-0.33, 0.5, 0.08], [-0.12, 0.76, 0.015],
    [0, 0.8, 0], [0.12, 0.76, 0.015], [0.33, 0.5, 0.08], [0.32, 0.28, 0.076]], 0.018, ropeMat)
  rope.name = 'ema-rope'; plaque.add(rope)
  for (const x of [-0.32, 0.32]) {
    const knot = add(new THREE.SphereGeometry(0.027, 10, 8), ropeMat, [x, 0.267, 0.085], plaque)
    knot.scale.set(1, 0.75, 0.65)
  }
  const painting = new THREE.Group(); painting.name = 'ema-front-painting'; plaque.add(painting)
  painting.add(paint(tube([[-0.42, -0.36, 0.065], [-0.27, -0.12, 0.065], [0.02, 0.08, 0.065], [0.22, 0.28, 0.065]], 0.009, green)))
  const leaf = leafGeometry()
  for (const [x, y, angle] of [[-0.31, -0.2, 0.5], [-0.07, -0.02, -1.45], [0.06, 0.12, -0.4], [-0.29, -0.2, -1.55]]) {
    const mesh = paint(add(leaf, green, [x, y, 0.066], painting)); mesh.rotation.z = angle
  }
  for (const [cx, cy, scale, mat] of [[-0.22, 0.07, 1, coral], [0.31, -0.22, 0.64, cream]] as const) {
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2
      const petal = paint(add(new THREE.CircleGeometry(0.093 * scale, 24), mat,
        [cx + Math.cos(a) * 0.084 * scale, cy + Math.sin(a) * 0.084 * scale, 0.067], painting))
      petal.scale.set(1, 0.85, 1); petal.rotation.z = a
    }
    paint(add(new THREE.CircleGeometry(0.049 * scale, 24), gold, [cx, cy, 0.07], painting))
  }
  // A few shallow grain lines continue across the wood; the flower has no sacred lettering.
  const grain = new THREE.MeshStandardMaterial({ color: 0xb18e65, transparent: true, opacity: 0.2, roughness: 1 })
  for (const z of [-0.064, 0.064]) for (const y of [-0.39, -0.3, -0.03, 0.17]) {
    plaque.add(paint(tube([[-0.6, y, z], [-0.21, y + 0.008, z], [0.25, y - 0.008, z], [0.6, y, z]], 0.002, grain)))
  }
  const written = new THREE.Group(); written.name = 'ema-written-lines'; written.visible = false; plaque.add(written)
  for (const [y, width] of [[0.04, 0.76], [-0.1, 0.57], [-0.24, 0.66]]) {
    written.add(paint(tube([[-width / 2, y, -0.067], [-0.08, y + 0.008, -0.067], [width / 2, y - 0.007, -0.067]], 0.01, ink)))
  }
  // Two little neighboring plaques give the rack a sense of use without copying a shrine display.
  for (const [i, x] of [-0.82, 0.82].entries()) {
    const neighbor = new THREE.Group(); neighbor.position.set(x, 1.576, 0.02); neighbor.scale.setScalar(0.33)
    neighbor.rotation.z = i === 0 ? -0.05 : 0.06; rack.add(neighbor)
    add(bodyGeometry, wood, [0, 0, 0], neighbor)
    neighbor.add(new THREE.Mesh(rope.geometry, ropeMat))
    paint(add(new THREE.CircleGeometry(0.13, 20), i === 0 ? green : coral, [0, -0.03, 0.067], neighbor))
  }

  const ray = createPointerRay(canvas, camera)
  const matrices = () => { scene.updateMatrixWorld(); camera.updateMatrixWorld() }
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -HELD.z), point = new THREE.Vector3()
  const resetDrag = () => {
    dragging = false
    if (!hanging && step < 3) { plaque.position.copy(HELD); plaque.rotation.y = angleTarget }
    plaque.rotation.z = 0
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: canAct,
    canStart(x, y) { matrices(); return !hanging && (step === 0 || step === 2) && ray.hits(x, y, [body]) },
    onStart(x, y) {
      dragging = true; downX = x; downY = y; feedback.prepare()
      if (step === 2 && ray.aim(x, y).ray.intersectPlane(plane, point)) dragOffset.copy(plaque.position).sub(point)
    },
    onMove(x, y) {
      if (step === 0) {
        plaque.rotation.y = Math.PI * THREE.MathUtils.clamp((x - downX) / Math.max(canvas.getBoundingClientRect().width * 0.35, 1), -1, 1)
      } else if (step === 2 && ray.aim(x, y).ray.intersectPlane(plane, point)) {
        point.add(dragOffset)
        plaque.position.set(THREE.MathUtils.clamp(point.x, -1.1, 1.1), THREE.MathUtils.clamp(point.y, 0.4, 2.15), HELD.z)
      }
    },
    onRelease(x, y) {
      dragging = false
      if (step === 0 && Math.abs(x - downX) >= Math.max(36, canvas.getBoundingClientRect().width * 0.14) && Math.abs(x - downX) > Math.abs(y - downY)) {
        flip(x < downX ? -1 : 1)
      } else if (step === 2) {
        matrices()
        if (ray.hits(x, y, [target])) hang(); else resetDrag()
      } else resetDrag()
    },
    onCancel: resetDrag,
  })
  const sync = () => {
    ui.renderDots(step, 3); ui.actionBtn.hidden = step === 3
    ui.actionBtn.disabled = hanging; ui.actionBtn.setAttribute('aria-disabled', String(hanging))
    wishSlot.hidden = step !== 1 || returning; guide.visible = step === 2 && !hanging
    writer?.setEnabled(step === 1 && !returning && canAct())
    ui.hitLayer.style.pointerEvents = (step === 0 || step === 2) && !hanging ? 'auto' : 'none'
    setSafeText(ui.hintEl, step === 0 ? COPY.front : step === 1 ? returning ? COPY.return : COPY.write : step === 2 ? hanging ? COPY.hanging : COPY.ready : COPY.done, safe)
    setSafeText(ui.actionBtn, step === 0 ? COPY.flip : step === 1 ? returning ? COPY.acknowledge : COPY.blank : COPY.hang, safe)
  }
  function flip(direction = 1) {
    if (!canAct() || pointer.isBusy() || step !== 0) return
    step = 1; dragging = false; turnFrom = plaque.rotation.y
    backAngle = direction * Math.PI; angleTarget = backAngle; turnT = reduced() ? 1 : 0
    if (reduced()) plaque.rotation.y = backAngle
    sync(); ctx.onProgress?.(1)
    feedback.impact({ freqs: [523.25, 659.25], duration: 0.2, gain: 0.022, type: 'triangle' })
  }
  function leave(text = '') {
    if (!canAct() || pointer.isBusy() || step !== 1) return
    const line = text.trim()
    // Move phase before host callbacks so repeated and reentrant submissions cannot save twice.
    step = 2; written.visible = Boolean(line) && !returning
    sync()
    if (line && !returning && !saved) { saved = true; ctx.saveWish?.(line) }
    ctx.onProgress?.(2)
    feedback.impact({ freqs: [659.25], duration: 0.18, gain: 0.018 })
  }
  function complete() {
    if (!canAct() || step !== 2 || !hanging) return
    step = 3; hanging = false; plaque.position.copy(HUNG); plaque.rotation.set(0, backAngle, 0); clock = 0
    sync(); ctx.onProgress?.(3)
    feedback.impact({ freqs: [392, 587.33], duration: 0.28, gain: 0.025 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  function hang() {
    if (!canAct() || pointer.isBusy() || step !== 2 || hanging) return
    dragging = false; hanging = true; hangT = 0; hangFrom.copy(plaque.position)
    sync()
    if (reduced()) complete()
  }
  const action = () => {
    if (!canAct() || pointer.isBusy() || hanging) return
    feedback.prepare()
    if (step === 0) flip(); else if (step === 1) leave(); else if (step === 2) hang()
  }
  const blur = () => { focused = false; pointer.cancel(); writer?.setEnabled(false) }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    home.z = 4.55 + portraitBoost(aspect, 3); camera.position.copy(home); camera.lookAt(look)
  }
  sync()
  return {
    start() {
      if (started || disposed) return
      started = true; step = THREE.MathUtils.clamp(Math.floor(ctx.initialProgress ?? 0), 0, 3)
      angleTarget = step === 0 ? 0 : Math.PI; plaque.rotation.y = angleTarget
      plaque.position.copy(step === 3 ? HUNG : HELD)
      resize(); stopResize = observeCanvasResize(canvas, resize)
      if (!returning) {
        writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
          onSubmit: text => { if (!canAct() || pointer.isBusy()) return; feedback.prepare(); leave(text) } })
        writer.mount(wishSlot, {})
      }
      ui.actionBtn.addEventListener('click', action)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      sync(); matrices()
    },
    update(dt) {
      if (!started || disposed) return
      if (!canAct()) { pointer.cancel(); writer?.setEnabled(false); return }
      writer?.setEnabled(step === 1 && !returning); writer?.update(dt)
      const delta = Math.min(Math.max(dt, 0), 0.05), quiet = reduced()
      if (!dragging) {
        turnT = quiet ? 1 : Math.min(1, turnT + delta / 0.65)
        const eased = turnT * turnT * (3 - 2 * turnT)
        plaque.rotation.y = THREE.MathUtils.lerp(turnFrom, angleTarget, eased)
      }
      if (hanging) {
        hangT = quiet ? 1 : Math.min(1, hangT + delta / 0.8)
        const eased = hangT * hangT * (3 - 2 * hangT)
        plaque.position.lerpVectors(hangFrom, HUNG, eased)
        plaque.rotation.z = quiet ? 0 : Math.sin(hangT * Math.PI) * 0.025
        if (hangT === 1) complete()
      } else if (step === 3) {
        if (!quiet) clock += delta
        plaque.rotation.z = quiet ? 0 : Math.sin(clock * 2.1) * Math.exp(-clock * 1.2) * 0.025
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
