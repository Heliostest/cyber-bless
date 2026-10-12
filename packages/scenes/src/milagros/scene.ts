import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, claimObjectTouches, createPointerRay, createSceneFeedback,
  createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost,
  setSafeText, sizeStage,
} from '../procedural-kit'

const LABELS = ['心形', '手形', '小屋', '花形']
const VARIANTS = ['heart', 'hand', 'home', 'flower']
const COPY = {
  title: '留一枚感谢', choose: '选好这枚', hang: '挂上小符', leave: '留在这里',
  hints: ['选一枚想留下的小符，再点「选好这枚」。', '把小符拖到木架的挂点，或点下方挂上。',
    '留一句祝愿或感谢，也可以只把小符留在这里。', '小符已挂好，这份心意留在了这里。'],
}

function charmShape(kind: number) {
  const shape = new THREE.Shape()
  if (kind === 0) {
    shape.moveTo(0, -0.27)
    shape.bezierCurveTo(-0.09, -0.15, -0.32, 0.02, -0.25, 0.18)
    shape.bezierCurveTo(-0.18, 0.34, -0.04, 0.29, 0, 0.17)
    shape.bezierCurveTo(0.04, 0.29, 0.18, 0.34, 0.25, 0.18)
    shape.bezierCurveTo(0.32, 0.02, 0.09, -0.15, 0, -0.27)
  } else if (kind === 1) {
    // Five distinct fingers and a small rounded palm; an original silhouette.
    shape.moveTo(-0.13, -0.26)
    shape.lineTo(-0.23, -0.02); shape.quadraticCurveTo(-0.29, 0.09, -0.23, 0.1)
    shape.lineTo(-0.14, 0.02); shape.lineTo(-0.14, 0.25)
    shape.quadraticCurveTo(-0.13, 0.32, -0.09, 0.28); shape.lineTo(-0.075, 0.1)
    shape.lineTo(-0.055, 0.32); shape.quadraticCurveTo(-0.02, 0.37, 0.01, 0.32)
    shape.lineTo(0.02, 0.11); shape.lineTo(0.05, 0.29)
    shape.quadraticCurveTo(0.09, 0.33, 0.11, 0.27); shape.lineTo(0.115, 0.09)
    shape.lineTo(0.15, 0.22); shape.quadraticCurveTo(0.2, 0.26, 0.21, 0.19)
    shape.lineTo(0.19, -0.06); shape.quadraticCurveTo(0.18, -0.23, 0.12, -0.26)
    shape.lineTo(-0.13, -0.26)
  } else if (kind === 2) {
    shape.moveTo(-0.23, -0.24); shape.lineTo(0.23, -0.24); shape.lineTo(0.23, 0.08)
    shape.lineTo(0.29, 0.08); shape.lineTo(0, 0.34); shape.lineTo(-0.29, 0.08)
    shape.lineTo(-0.23, 0.08); shape.closePath()
  } else {
    for (let i = 0; i <= 80; i++) {
      const angle = i / 80 * Math.PI * 2, radius = 0.21 + Math.cos(angle * 5) * 0.06
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
    }
  }
  return shape
}

export function createMilagros(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const safe = shared.assertSafeCopy
  for (const text of [COPY.title, COPY.choose, COPY.hang, COPY.leave, ...COPY.hints]) safe(text)
  let step = Math.max(0, Math.min(3, Math.floor(ctx.initialProgress ?? 0)))
  let selected = Math.max(0, VARIANTS.indexOf(ctx.initialVariant ?? 'heart'))
  let started = false, disposed = false, elapsed = 1, clock = 0
  let drag: { id: number; stage: number; x: number; y: number } | null = null
  let blocked = false
  const pointers = new Set<number>()
  const canAct = () => started && !disposed && (ctx.isActive?.() ?? true)
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60)
  const home = new THREE.Vector3(0.12, 1.72, 4.75)
  const look = new THREE.Vector3(0, 1.08, 0)
  camera.position.copy(home); camera.lookAt(look)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'milagros', label: COPY.title })
  style.setStyle(CEL_STYLE)
  addStageLights(scene, ctx.stage, { sky: 0xfff5e9, ground: 0xc7bca2, key: 0xffe7c1, rim: 0xd7ecdf })
  const world = new THREE.Group(); scene.add(world)
  const material = (color: number, metalness = 0, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, metalness, roughness })
  const wood = material(0xbe9169), paper = material(0xf8e8c9), darkWood = material(0x987355)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); parent.add(mesh); return mesh
  }
  add(new RoundedBoxGeometry(2.08, 1.65, 0.17, 3, 0.085), wood, 0, 1.32, -0.1)
  const panel = add(new RoundedBoxGeometry(1.87, 1.43, 0.05, 2, 0.055), paper, 0, 1.32, 0.01)
  panel.userData.toonSurface = { outline: false }
  for (const x of [-0.71, 0.71]) add(new RoundedBoxGeometry(0.16, 0.47, 0.18, 2, 0.03), darkWood, x, 0.36, -0.07)
  add(new RoundedBoxGeometry(2.35, 0.13, 0.84, 3, 0.065), wood, 0, 0.16, 0.45)
  const liner = add(new RoundedBoxGeometry(2.17, 0.027, 0.71, 2, 0.02), paper, 0, 0.24, 0.45)
  liner.userData.toonSurface = { outline: false }
  const pinMat = material(0xc49b50, 0.45, 0.42)
  const pin = add(new THREE.SphereGeometry(0.048, 12, 8), pinMat, 0, 1.69, 0.16)
  pin.name = 'milagros-pin'
  const pinTarget = add(new THREE.SphereGeometry(0.24, 16, 8), new THREE.MeshBasicMaterial({ visible: false }), 0, 1.65, 0.20)
  pinTarget.name = 'milagros-pin-target'
  const guide = add(new THREE.TorusGeometry(0.15, 0.008, 6, 32),
    new THREE.MeshBasicMaterial({ color: 0xebce82, transparent: true, opacity: 0.65, depthWrite: false }), 0, 1.65, 0.14)
  const charmGroups: THREE.Group[] = [], charmMeshes: THREE.Mesh[] = []
  const starts: THREE.Vector3[] = [], charmMaterials: THREE.MeshStandardMaterial[] = []
  const colors = [0xe8bd75, 0xb7c5c3, 0xdab48a, 0xedcf87]
  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group(); group.name = `milagros-charm-${i}`
    const start = new THREE.Vector3(-0.81 + i * 0.54, 0.41, 0.72)
    group.position.copy(start); group.scale.setScalar(0.73)
    world.add(group); charmGroups.push(group); starts.push(start)
    const mat = material(colors[i], 0.55, 0.35); charmMaterials.push(mat)
    const mesh = add(new THREE.ExtrudeGeometry(charmShape(i), {
      depth: 0.028, bevelEnabled: true, bevelSegments: 2, steps: 1,
      bevelSize: 0.016, bevelThickness: 0.014, curveSegments: 16,
    }), mat, 0, 0, 0, group)
    mesh.name = `milagros-symbol-${i}`; mesh.userData.choice = i
    mesh.userData.toonSurface = { metalness: 0.55, roughness: 0.35 }
    charmMeshes.push(mesh)
    const ring = add(new THREE.TorusGeometry(0.047, 0.010, 8, 24), mat, 0, 0.37, 0.025, group)
    ring.userData.toonSurface = { metalness: 0.55, roughness: 0.35 }
    // Two tiny pressed marks catch light and give the metal a handmade face.
    for (const x of [-0.07, 0.07]) add(new THREE.SphereGeometry(0.017, 8, 6), mat, x, 0.02, 0.055, group).scale.z = 0.25
  }
  // Small original ornaments suggest accumulated thanks without copying a sacred site.
  for (let i = 0; i < 3; i++) {
    const mesh = add(new THREE.ExtrudeGeometry(charmShape(i), { depth: 0.025, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 2 }),
      material(0xcbb48f, 0.35, 0.6), i === 1 ? 0.65 : -0.64, i === 2 ? 0.89 : 1.42, 0.065)
    mesh.scale.setScalar(0.34); mesh.rotation.z = i === 1 ? 0.1 : -0.12
  }
  const held = new THREE.Vector3(0.62, 1.04, 0.62)
  const hung = new THREE.Vector3(0, 1.22, 0.18)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.choose }, safe)
  const choices = document.createElement('div'); choices.className = 'scene-wish-slot'
  const row = document.createElement('div'); row.className = 'scene-craft-choices'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', '选择小符')
  const buttons = LABELS.map((label, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label
    button.setAttribute('aria-label', `选择${label}小符`)
    button.addEventListener('click', () => { if (canAct() && step === 0 && !blocked && !drag && !pointers.size) select(i, true) })
    row.append(button); return button
  })
  choices.append(row); overlay.append(choices)
  const wish = document.createElement('div'); wish.className = 'scene-wish-slot'; overlay.append(wish)
  const writer = gestures.createWishWrite({ maxLen: 40, saves: Boolean(ctx.saveWish) && !ctx.returning, onSubmit: text => finish(text) })
  writer.mount(wish, {})
  const feedback = createSceneFeedback(ctx)
  const ray = createPointerRay(canvas, camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.62), point = new THREE.Vector3()
  const selectedHits = (x: number, y: number) => ray.hits(x, y, [charmMeshes[selected]])
  const onObject = (x: number, y: number) => canAct() && (step === 0 ? ray.hits(x, y, charmMeshes) : step === 1 && selectedHits(x, y))
  const stopClaim = claimObjectTouches(ui.hitLayer, onObject)
  let unobserve = () => {}
  function select(index: number, remember = false) {
    selected = index
    if (remember) ctx.onVariantChange?.(VARIANTS[index])
    charmMaterials.forEach((mat, i) => { mat.emissive.set(i === index ? 0x7b481c : 0); mat.emissiveIntensity = i === index ? 0.16 : 0 })
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
  }
  function sync() {
    ui.renderDots(step, 3); choices.hidden = step !== 0; wish.hidden = step !== 2 || Boolean(ctx.returning)
    ui.actionBtn.hidden = step === 3
    setSafeText(ui.hintEl, COPY.hints[step], safe)
    setSafeText(ui.actionBtn, step === 0 ? COPY.choose : step === 1 ? COPY.hang : COPY.leave, safe)
    guide.visible = step === 1
    writer.setEnabled(step === 2 && canAct() && !ctx.returning)
    charmGroups.forEach((group, i) => {
      if (i !== selected) { group.position.copy(starts[i]); group.scale.setScalar(0.73) }
    })
  }
  function choose() {
    if (!canAct() || step !== 0) return
    step = 1; elapsed = ctx.isReducedMotion?.() ? 1 : 0
    ctx.onProgress?.(1); feedback.impact({ freqs: [523, 784], duration: 0.3, gain: 0.055 }); sync()
  }
  function hang() {
    if (!canAct() || step !== 1) return
    step = 2; drag = null; elapsed = 1
    charmGroups[selected].position.copy(hung); charmGroups[selected].scale.setScalar(1.15)
    ctx.onProgress?.(2); feedback.impact({ freqs: [659, 988], duration: 0.45, gain: 0.06 }); sync()
  }
  function finish(text = '') {
    if (!canAct() || step !== 2) return
    const line = text.trim()
    step = 3; drag = null
    if (line && !ctx.returning) ctx.saveWish?.(line)
    ctx.onProgress?.(3); sync()
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => {
    if (!canAct() || blocked || drag || pointers.size) return
    feedback.prepare()
    if (step === 0) choose(); else if (step === 1) hang(); else if (step === 2) finish(wish.querySelector('input')?.value ?? '')
  }
  const resetDrag = () => { drag = null; if (step === 1) charmGroups[selected].position.copy(held) }
  const down = (event: PointerEvent) => {
    if (!canAct() || (event.button ?? 0) !== 0 || step > 1) return
    pointers.add(event.pointerId)
    if (pointers.size > 1 || event.isPrimary === false) { blocked = true; resetDrag(); return }
    if (blocked || !onObject(event.clientX, event.clientY)) return
    if (step === 0) {
      const hit = ray.aim(event.clientX, event.clientY).intersectObjects(charmMeshes, false)[0]
      if (hit) select(hit.object.userData.choice, true)
    }
    feedback.prepare(); drag = { id: event.pointerId, stage: step, x: event.clientX, y: event.clientY }
    try { ui.hitLayer.setPointerCapture?.(event.pointerId) } catch { /* Capture may be absent in an embedded surface. */ }
  }
  const move = (event: PointerEvent) => {
    if (!canAct()) { resetDrag(); return }
    if (!drag || blocked || drag.id !== event.pointerId || drag.stage !== 1) return
    if (ray.aim(event.clientX, event.clientY).ray.intersectPlane(plane, point)) {
      charmGroups[selected].position.set(THREE.MathUtils.clamp(point.x, -1.1, 1.1), THREE.MathUtils.clamp(point.y, 0.5, 1.95), held.z)
    }
  }
  const up = (event: PointerEvent) => {
    const previous = drag, multi = blocked
    pointers.delete(event.pointerId)
    if (previous?.id === event.pointerId) drag = null
    if (pointers.size === 0) blocked = false
    if (!previous || previous.id !== event.pointerId || multi || !canAct()) { resetDrag(); return }
    if (previous.stage === 0 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 9) choose()
    else if (previous.stage === 1 && ray.hits(event.clientX, event.clientY, [pinTarget])) hang()
    else resetDrag()
  }
  const cancel = (event: PointerEvent) => { pointers.delete(event.pointerId); resetDrag(); if (!pointers.size) blocked = false }
  const otherDown = (event: PointerEvent) => {
    if (!canAct() || step > 1 || (event.button ?? 0) !== 0) return
    pointers.add(event.pointerId)
    if (pointers.size > 1 || event.isPrimary === false) { blocked = true; resetDrag() }
  }
  const windowEnd = (event: PointerEvent) => {
    if (!ui.hitLayer.contains(event.target as Node) && drag?.id === event.pointerId) resetDrag()
    pointers.delete(event.pointerId)
    if (!pointers.size) blocked = false
  }
  const blur = () => { pointers.clear(); blocked = false; resetDrag() }
  const lostCapture = (event: PointerEvent) => { if (drag?.id === event.pointerId) cancel(event) }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); home.z = 4.75 + portraitBoost(aspect, 3); camera.position.copy(home); camera.lookAt(look) }
  select(selected); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; resize(); unobserve = observeCanvasResize(canvas, resize)
      ui.actionBtn.addEventListener('click', action)
      ui.hitLayer.addEventListener('pointerdown', down); ui.hitLayer.addEventListener('pointermove', move)
      ui.hitLayer.addEventListener('pointerup', up); ui.hitLayer.addEventListener('pointercancel', cancel)
      ui.hitLayer.addEventListener('lostpointercapture', lostCapture)
      window.addEventListener('pointerdown', otherDown, true)
      window.addEventListener('pointerup', windowEnd); window.addEventListener('pointercancel', windowEnd)
      window.addEventListener('blur', blur)
      if (step === 1) { charmGroups[selected].position.copy(held); charmGroups[selected].scale.setScalar(1.1) }
      if (step >= 2) { charmGroups[selected].position.copy(hung); charmGroups[selected].scale.setScalar(1.15) }
      sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!(ctx.isActive?.() ?? true)) { pointers.clear(); blocked = false; resetDrag(); writer.setEnabled(false); return }
      writer.setEnabled(step === 2 && !ctx.returning)
      elapsed = Math.min(1, elapsed + Math.max(0, dt) / 0.6)
      const reduced = ctx.isReducedMotion?.() ?? false
      if (!reduced) clock += Math.max(0, dt)
      if (step === 1 && !drag) {
        const t = reduced ? 1 : elapsed, eased = 1 - Math.pow(1 - t, 3)
        charmGroups[selected].position.lerpVectors(starts[selected], held, eased)
        charmGroups[selected].scale.setScalar(0.73 + eased * 0.37)
      }
      if (step >= 2) charmGroups[selected].rotation.z = reduced ? 0 : Math.sin(clock * 1.3) * Math.exp(-clock * 0.08) * 0.035
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointers.clear(); drag = null; unobserve(); stopClaim(); writer.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action)
      ui.hitLayer.removeEventListener('pointerdown', down); ui.hitLayer.removeEventListener('pointermove', move)
      ui.hitLayer.removeEventListener('pointerup', up); ui.hitLayer.removeEventListener('pointercancel', cancel)
      ui.hitLayer.removeEventListener('lostpointercapture', lostCapture)
      window.removeEventListener('pointerdown', otherDown, true)
      window.removeEventListener('pointerup', windowEnd); window.removeEventListener('pointercancel', windowEnd)
      window.removeEventListener('blur', blur)
      style.dispose(); disposeTree(world); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
