import { sceneTemplate } from '../scene-localization'
import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '木版留春', rub: '拿起左侧棕擦，在纸背左右刷过，让枝叶的墨色转印到纸上。',
  peel: '捏住右下纸角，向上慢慢揭起，看看纸上留下的枝叶。',
  quiet: '轻点印纸静看，或写一句心意后点「写好了」。',
  returning: '轻点印纸，回看这一份春意。', done: '留一枝春意在日常。',
  moving: '棕擦刷过纸背，枝叶的墨色慢慢留下…', lifting: '纸角轻轻扬起，印出的枝叶显露出来…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const PAD_HOME = new THREE.Vector3(-1.34, .865, .60)
const ease = (t: number) => t * t * (3 - 2 * t)

/** A secular original branch print: the materials and transfer, not a ritual reproduction. */
export function createChineseWoodblockPrint(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, locked = false, suspended = false, at: Checkpoint = 0
  let stopResize = () => {}, writer: GestureHandle | null = null
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let dragging = false, travel = 0, rubTravel = 0, minRubX = Infinity, maxRubX = -Infinity, upward = 0, lastContact: THREE.Vector3 | null = null
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !locked, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '用棕擦刷印纸背' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'chinese-woodblock-print', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf2eedf, ground: 0xa8afa1, key: 0xfff0d8, rim: 0xdce9e2, keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512); lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .015
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 12 })
  const world = new THREE.Group(); world.name = 'woodblock-workbench'; scene.add(world)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness })
  const wood = mat(0xb59467), darkWood = mat(0x836348), cutWood = mat(0x9b784f), paleWood = mat(0xc4a575)
  const paperMat = createRitualMaterial({ color: 0xeee6cc, roughness: .9 }, { kind: 'paper', strength: .22, fiber: 'paper' }), paperEdge = createRitualMaterial({ color: 0xe0d4b5, roughness: .9 }, { kind: 'paper', strength: .10, fiber: 'paper' }), ink = mat(0x334c5b), sage = mat(0x91a89a), bristle = mat(0x8f754d)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent = world as THREE.Object3D) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), material, p, parent)
  const tube = (name: string, points: XYZ[], radius: number, material: THREE.Material, parent = world as THREE.Object3D) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(8, points.length * 8), radius, 5, false), material, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  addCraftTable(world, { name: 'woodblock-table', topName: 'woodblock-table', width: 3.55, depth: 2.45, surfaceY: .745, thickness: .13, center: [0,.08], support: 'trestle', finish: 'chestnut' })
  const shadow = add('woodblock-contact-shadow', new THREE.PlaneGeometry(3.8, 2.75), new THREE.ShadowMaterial({ opacity: .13 }), [0, .003, .1]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box('woodblock-carved-block', [2.12, .14, 1.94], [.1, .824, .08], darkWood)
  box('woodblock-cut-field', [1.99, .035, 1.81], [.1, .906, .08], cutWood)
  for (const x of [-.91, 1.11]) box('woodblock-inked-border', [.028, .038, 1.82], [x, .93, .08], ink)
  for (const z of [-.82, .98]) box('woodblock-inked-border', [2.02, .038, .028], [.1, .93, z], ink)
  // Paired narrow cuts in the exposed wood field make the matrix readable as a carved block.
  for (let i = 0; i < 17; i++) {
    const x = -.8 + i * .11
    tube('woodblock-carving-gouge', [[x, .927, -.70], [x + .016, .927, -.30], [x - .011, .927, .2], [x + .01, .927, .82]], .006, paleWood)
  }
  const paper = new THREE.Group(); paper.name = 'woodblock-paper'; paper.position.set(.1, .994, -.72); world.add(paper)
  const backGeometry = new THREE.PlaneGeometry(1.82, 1.6, 24, 24); backGeometry.rotateX(-Math.PI / 2)
  const back = add('woodblock-paper-back', backGeometry, paperMat, [0, 0, .8], paper)
  back.userData.toonSurface = { outline: false }
  const faceGeometry = new THREE.PlaneGeometry(1.82, 1.6, 24, 24); faceGeometry.rotateX(Math.PI / 2)
  const face = add('woodblock-print-face', faceGeometry, paperMat, [0, -.014, .8], paper)
  face.userData.toonSurface = { outline: false }
  // Raised paper lip is part of the sheet and is the actual graspable corner.
  const cornerGeometry = new THREE.PlaneGeometry(.28, .25, 6, 6); cornerGeometry.rotateX(-Math.PI / 2)
  const corner = add('woodblock-paper-corner', cornerGeometry, paperMat, [.765, .009, 1.475], paper)
  corner.userData.toonSurface = { outline: false }
  const edges = [
    tube('woodblock-paper-edge', [[-.91, -.006, 0], [-.91, -.006, .8], [-.91, -.006, 1.6]], .007, paperEdge, paper),
    tube('woodblock-paper-edge', [[.91, -.006, 0], [.91, -.006, .8], [.91, -.006, 1.6]], .007, paperEdge, paper),
    tube('woodblock-paper-edge', [[-.91, -.006, 1.6], [0, -.006, 1.6], [.91, -.006, 1.6]], .007, paperEdge, paper),
  ]
  // One original branching drawing is pressed into the matrix and transferred to the reverse of the paper.
  const branches: XYZ[][] = [
    [[-.54, 0, .20], [-.40, 0, .51], [-.22, 0, .82], [-.07, 0, 1.13], [.16, 0, 1.43]],
    [[-.37, 0, .54], [-.61, 0, .74], [-.66, 0, 1.04]], [[-.25, 0, .76], [.11, 0, .83], [.47, 0, 1.09]],
    [[-.09, 0, 1.09], [-.32, 0, 1.27], [-.41, 0, 1.46]], [[.03, 0, 1.27], [.31, 0, 1.36], [.54, 0, 1.47]],
  ]
  const leafPositions: [number, number, number, number][] = [[-.5,.41,-.9,.17],[-.31,.61,.85,.17],[-.59,.78,-.75,.17],[-.66,1.01,.1,.16],[-.44,.94,1.0,.17],[-.05,.84,.85,.17],[.21,.94,1.1,.18],[.44,1.09,.35,.18],[-.22,1.20,-.9,.15],[-.4,1.43,-.3,.15],[.13,1.43,.3,.15],[.30,1.36,1.1,.16],[.53,1.47,.7,.14]]
  const print = new THREE.Group(); print.name = 'woodblock-printed-branches'; face.add(print); print.position.z = -.8
  const carving = new THREE.Group(); carving.name = 'woodblock-carved-branches'; world.add(carving); carving.position.set(.1, .947, -.72)
  for (const [parent, side] of [[print, -1], [carving, 1]] as const) {
    for (const points of branches) tube(parent === print ? 'woodblock-printed-stem' : 'woodblock-relief-stem', points.map(([x, , z]) => [x, side * .006, z]), parent === print ? .012 : .021, ink, parent)
    for (const [x, z, angle, length] of leafPositions) {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(-length * .49, length * .38, -length * .34, length * .84, 0, length); shape.bezierCurveTo(length * .36, length * .72, length * .48, length * .32, 0, 0)
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: parent === print ? .002 : .015, bevelEnabled: false, curveSegments: 8 })
      geometry.rotateX(Math.PI / 2); geometry.rotateY(angle)
      const leaf = add(parent === print ? 'woodblock-printed-leaf' : 'woodblock-relief-leaf', geometry, ink, [x, side * .009, z], parent); leaf.userData.toonSurface = { outline: false }
    }
  }
  box('woodblock-paper-hinge-clamp', [1.45, .045, .11], [.1, 1.0, -.77], paleWood)
  box('woodblock-pad-rest', [.52, .025, .58], [-1.34, .761, .60], sage)
  const pad = new THREE.Group(); pad.name = 'woodblock-rubbing-pad'; world.add(pad)
  add('woodblock-rubbing-bristles', new THREE.CylinderGeometry(.205, .222, .11, 40), bristle, [0, -.043, 0], pad)
  add('woodblock-rubbing-cap', new THREE.CylinderGeometry(.178, .201, .075, 40), darkWood, [0, .049, 0], pad)
  // Concentric bindings and individual bristle ridges are attached to the tool.
  for (let i = 0; i < 36; i++) {
    const a = i * Math.PI * 2 / 36
    tube('woodblock-palm-fibre', [[Math.cos(a) * .20, -.09, Math.sin(a) * .20], [Math.cos(a) * .211, -.035, Math.sin(a) * .211]], .006, paleWood, pad)
  }
  const grip = box('woodblock-rubbing-grip', [.27, .08, .09], [0, .12, 0], paleWood, pad)
  const printedMeshes: THREE.Mesh[] = []; print.traverse(o => { if ((o as THREE.Mesh).isMesh) printedMeshes.push(o as THREE.Mesh) })
  const originals = new Map<THREE.BufferGeometry, Float32Array>()
  for (const m of [back, face, corner, ...edges, ...printedMeshes]) originals.set(m.geometry, Float32Array.from(m.geometry.getAttribute('position').array))
  const bend = (amount: number) => {
    paper.rotation.x = amount === 0 ? 0 : -1.82 * amount
    for (const m of [back, face, corner, ...edges, ...printedMeshes]) {
      const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute, original = originals.get(m.geometry)!
      for (let i = 0; i < pos.count; i++) {
        const z = original[i * 3 + 2] + m.position.z
        const curl = amount * .055 * Math.sin(z / 1.6 * Math.PI) + Math.pow(Math.max(0, z / 1.6), 8) * .010
        pos.setY(i, original[i * 3 + 1] + curl)
      }
      pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere()
    }
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { pad.position.copy(PAD_HOME); pad.rotation.set(0, 0, 0); face.visible = at > 0; bend(at >= 2 ? 1 : 0); matrices() }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', label: '拿棕擦，左右刷纸', priority: 3, enabled: enabled(0), destination: back, targetLabel: '纸背左右刷过' }),
    addInteractionCue(corner, { kind: 'drag', direction: [0, -1], label: '捏纸角，向上揭开', priority: 3, enabled: enabled(1) }),
    addInteractionCue(face, { kind: 'tap', label: '轻点印纸静看', anchor: [.60, .04252, -.35], priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0), point = new THREE.Vector3()
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const visibleHit = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh || held && belongsTo(object, held)) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(object)
    })
    return belongsTo(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object, target)
  }
  let acceptedRub = 0, acceptedMinX = Infinity, acceptedMaxX = -Infinity
  const rubComplete = () => rubTravel + 1e-6 >= .75 && maxRubX - minRubX + 1e-6 >= .45
  const reset = () => {
    dragging = false; travel = upward = 0; lastContact = null
    rubTravel = acceptedRub; minRubX = acceptedMinX; maxRubX = acceptedMaxX
    if (!motion) restore()
    if (started && !disposed) sync()
  }
  // Ignore synchronous pointer input from host callbacks before it can reach
  // the controller's inactive-cancel path and discard the original pointer.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (locked) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => ui.hitLayer.addEventListener(type, guardCallbackInput, true))
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return visibleHit(x, y, at === 0 ? pad : at === 1 ? corner : paper) },
    onStart(x, y) { callbackBoundary(() => feedback.prepare()); if (!inputActive()) { pointer.cancel(); return }; down.set(x, y); dragging = at < 2; travel = upward = 0; lastContact = null },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (at === 0 && dragging) {
        const contact = visibleHit(x, y, paper, pad)
        if (ray.aim(x, y).ray.intersectPlane(plane, point)) {
          pad.position.copy(point); pad.position.y += .095
          if (contact) { if (lastContact) rubTravel += lastContact.distanceTo(point); lastContact = point.clone(); minRubX = Math.min(minRubX, point.x); maxRubX = Math.max(maxRubX, point.x) } else lastContact = null
        }
      } else if (at === 1 && dragging) { upward = Math.max(0, down.y - y); bend(THREE.MathUtils.clamp(upward / 64, 0, 1)) }
      matrices()
      if (at === 0) sync()
    },
    onRelease(x, y) {
      matrices()
      const valid = at === 0 ? dragging && travel >= 8 && rubComplete() && visibleHit(x, y, paper, pad)
        : at === 1 ? dragging && upward >= 42 && down.y - y >= 42 && Math.abs(x - down.x) < Math.max(70, upward * .8)
          : travel < 12 && Math.hypot(x - down.x, y - down.y) < 12 && visibleHit(x, y, paper)
      // A released contact stroke stays on the paper. Cancellation or a drop
      // away from it discards this stroke, preserving earlier accepted work.
      if (at === 0 && dragging && travel >= 8 && visibleHit(x, y, paper, pad)) {
        acceptedRub = rubTravel; acceptedMinX = minRubX; acceptedMaxX = maxRubX
      }
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: inputActive, duration: 3, motion: 'glow', targets: () => [face], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    delete ui.hintEl.dataset.progress
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '用棕擦刷印纸背' : at === 1 ? '揭开印纸' : '轻点印纸静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.moving : COPY.lifting : at === 0 ? COPY.rub : at === 1 ? COPY.peel : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    if (at === 0 && !motion && rubTravel > 0) {
      ui.hintEl.dataset.progress = 'true'
      const coverage = Math.min(99, Math.floor(100 * Math.min(1, rubTravel / .75, Math.max(0, maxRubX - minRubX) / .45)))
      setSafeText(ui.hintEl, rubComplete()
        ? lastContact ? '刷印已到位，可以松手揭纸。' : '刷印已覆盖，请把棕擦移回纸面。'
        : sceneTemplate("刷印 {p0}%，抬手后也可以接着擦。", { p0: coverage }), safe)
    }
    ending.sync(at === 2 && !motion)
  }
  function callbackBoundary(work: () => void) { locked = true; sync(); try { work() } finally { locked = false; if (!disposed) sync() } }
  function settle() {
    if (!inputActive() || !motion) return
    const next = (motion.step + 1) as Checkpoint
    callbackBoundary(() => { at = next; motion = null; restore(); sync(); ctx.onProgress?.(at); if (active()) feedback.impact({ freqs: [392, 523.25], duration: .14, gain: .009, type: 'triangle' }) })
  }
  function begin() { if (!inputActive() || pointer.isBusy() || motion || at >= 2) return; motion = { step: at as 0 | 1, time: 0, from: -paper.rotation.x / 1.82 }; sync(); if (reduced()) settle() }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    callbackBoundary(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      if (disposed) return
      ctx.onProgress?.(3); if (!active()) return
      feedback.impact({ freqs: [392, 587.33], duration: .21, gain: .01 }); if (!active()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3) return; callbackBoundary(() => feedback.prepare()); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 4.8, 6.4 + portraitBoost(aspect, 8)); camera.lookAt(0, 1.05, .04); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: text => { if (!inputActive() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; callbackBoundary(() => feedback.prepare()); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed || locked) return
      if (!active()) { pointer.cancel(); writer?.setEnabled(false); if (!suspended) { suspended = true; sync() }; return }
      if (suspended) { suspended = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      if (motion) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .72); const t = ease(motion.time)
        if (motion.step === 0) { pad.position.set(.1 + Math.sin(t * Math.PI * 4) * .57, 1.09, .1 + Math.cos(t * Math.PI * 2) * .22); if (t > .88) pad.position.lerp(PAD_HOME, (t - .88) / .12) }
        else bend(THREE.MathUtils.lerp(motion.from, 1, t))
        if (motion.time === 1) settle()
      }
      ending.update(dt)
      if (!disposed && active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => ui.hitLayer.removeEventListener(type, guardCallbackInput, true))
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
