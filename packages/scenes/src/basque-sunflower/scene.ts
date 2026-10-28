import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { placementHit } from '../placement-hit'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '太阳花迎门', assembleAction: '装好花心', hangAction: '把太阳花挂上门钉', quietAction: '轻点花心静看',
  assemble: '把左下方的花心拖入尖瓣中央，拼好这朵纸木太阳花。',
  hang: '握住花心，拖到右侧门框上的木钉。',
  quiet: '带着迎门的心意，轻点花心静看。',
  returning: '轻点花心，回看这一份迎门的心意。',
  moving: '让纸木太阳花轻轻落稳…',
  done: '太阳花已挂好，留一刻安静给归家的人。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const HOME = new THREE.Vector3(-.59, 1.16, .37), HUNG = new THREE.Vector3(.78, 1.129, .07)
const CENTER_HOME = new THREE.Vector3(-1.27, .531, .60), CENTER_SEAT = new THREE.Vector3(0, 0, .092)
const ease = (t: number) => t * t * (3 - 2 * t)

/** An original artificial craft tribute to public folklore; no ritual or protective efficacy. */
export function createBasqueSunflower(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, inactiveRendered = false, at: Checkpoint = 0
  let writer: GestureHandle | null = null, stopResize = () => {}, dragging = false, travel = 0
  let motion: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.assembleAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'basque-sunflower', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3f1df, ground: 0x929c80, key: 0xffebc7, rim: 0xc7ded8,
    keyPosition: [-3, 5, 4], keyIntensity: 1.2, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.4, right: 2.4, top: 3.2, bottom: -.8, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'sunflower-courtyard-workshop'; scene.add(world)
  const material = (color: number, roughness = .88) => new THREE.MeshStandardMaterial({ color, roughness })
  const walnut = material(0x80674b), oak = material(0xb29367), grain = material(0x987d58)
  const paper = createRitualMaterial({ color: 0xe7dfbc, roughness: .88 }, { kind: 'paper', strength: .22, fiber: 'paper' }), innerPaper = createRitualMaterial({ color: 0xcac9b0, roughness: .88 }, { kind: 'paper', strength: .16, fiber: 'paper' }), seed = material(0x977640), seedLight = material(0xb6975c)
  const sage = material(0x9aa995), stone = material(0xc8c7ba), flax = material(0xb5a380)
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...p)
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: [number, number, number], p: [number, number, number], mat: THREE.Material = oak, parent: THREE.Object3D = world) =>
    add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(v => v / 3))), mat, p, parent)
  const disc = (name: string, radius: number, depth: number, p: [number, number, number], mat: THREE.Material, parent: THREE.Object3D = world) => {
    const mesh = add(name, new THREE.CylinderGeometry(radius, radius, depth, 48), mat, p, parent); mesh.rotation.x = Math.PI / 2; return mesh
  }
  const tube = (name: string, points: [number, number, number][], radius: number, mat: THREE.Material, parent: THREE.Object3D = world) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 16, radius, 6, false), mat, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }

  // A small standing door display and a low craft shelf share the courtyard ground.
  box('sunflower-display-foot', [1.83, .10, .67], [.78, .05, -.12], stone)
  box('sunflower-mount-board', [1.40, 2.18, .15], [.78, 1.20, -.06], walnut)
  for (const x of [.02, 1.54]) box('sunflower-door-jamb', [.14, 2.38, .22], [x, 1.27, -.04], oak)
  box('sunflower-door-lintel', [1.76, .16, .25], [.78, 2.45, -.02], oak)
  box('sunflower-door-sill', [1.63, .12, .29], [.78, .16, -.01], grain)
  for (const x of [.26, .52, 1.04, 1.30]) box('sunflower-door-plank-joint', [.009, 2.06, .007], [x, 1.20, .018], grain)
  for (const y of [.54, 2.15]) box('sunflower-door-brace', [1.34, .075, .025], [.78, y, .024], grain)
  disc('sunflower-peg-shaft', .035, .32, [.78, 1.85, .08], oak)
  const peg = disc('sunflower-peg-cap', .075, .045, [.78, 1.85, .2625], seedLight)
  const endGrain = add('sunflower-peg-end-ring', new THREE.TorusGeometry(.052, .003, 6, 32), grain, [.78, 1.85, .286])
  endGrain.userData.toonSurface = { outline: false }
  box('sunflower-work-shelf', [1.63, .09, .82], [-.83, .205, .45], oak)
  for (const x of [-1.49, -.19]) box('sunflower-work-foot', [.15, .16, .58], [x, .08, .44], walnut)
  box('sunflower-center-rest', [.55, .035, .27], [-1.27, .2675, .60], sage)
  box('sunflower-center-rest-back', [.34, .27, .06], [-1.27, .40, .50], grain)
  box('sunflower-work-easel', [.085, 1.11, .085], [-.59, .80, .235], walnut)
  box('sunflower-easel-crossbar', [.93, .07, .21], [-.59, .76, .325], grain)
  const ground = add('sunflower-contact-shadow', new THREE.PlaneGeometry(3.7, 1.8), new THREE.ShadowMaterial({ opacity: .12 }), [0, .002, .13])
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false

  const flower = new THREE.Group(); flower.name = 'sunflower-ornament'; world.add(flower)
  disc('sunflower-wood-backing', .37, .075, [0, 0, -.0175], grain, flower)
  const blade = new THREE.Shape()
  blade.moveTo(-.046, .255); blade.lineTo(-.067, .38); blade.lineTo(-.087, .46); blade.lineTo(-.033, .431)
  blade.lineTo(0, .685); blade.lineTo(.036, .447); blade.lineTo(.077, .478); blade.lineTo(.057, .367); blade.lineTo(.043, .255); blade.closePath()
  const bladeGeometry = new THREE.ExtrudeGeometry(blade, { depth: .015, bevelEnabled: false })
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2
    const petal = add(`sunflower-pointed-petal-${i}`, bladeGeometry, i % 3 ? paper : innerPaper, [0, 0, .005], flower); petal.rotation.z = angle
    const inner = add(`sunflower-pointed-petal-inner-${i}`, bladeGeometry, i % 2 ? paper : innerPaper, [0, 0, .024], flower)
    inner.scale.set(.70, .79, 1); inner.rotation.z = angle + Math.PI / 32
    const r0 = .31, r1 = .59
    tube('sunflower-paper-fold', [[-Math.sin(angle) * r0, Math.cos(angle) * r0, .023], [-Math.sin(angle) * r1, Math.cos(angle) * r1, .023]], .0025, flax, flower)
  }
  const seat = disc('sunflower-center-seat', .27, .03, [0, 0, .03], seedLight, flower)
  const rim = add('sunflower-center-rim', new THREE.TorusGeometry(.279, .013, 8, 48), flax, [0, 0, .047], flower)
  rim.userData.toonSurface = { outline: false }
  // The open top of the flax loop contacts the top of the peg shaft at y=1.885.
  const loop = add('sunflower-hanging-loop', new THREE.TorusGeometry(.09, .014, 10, 40), flax, [0, .68, -.005], flower)
  loop.userData.toonSurface = { outline: false }
  tube('sunflower-left-tie', [[-.035, .33, -.025], [-.05, .48, -.015], [-.045, .604, -.005]], .012, flax, flower)
  tube('sunflower-right-tie', [[.035, .33, -.025], [.05, .48, -.015], [.045, .604, -.005]], .012, flax, flower)
  const centerPiece = new THREE.Group(); centerPiece.name = 'sunflower-center-piece'; world.add(centerPiece)
  const center = add('sunflower-center', new THREE.SphereGeometry(1, 40, 24), seed, [0, 0, 0], centerPiece); center.scale.set(.246, .246, .06)
  // Seed-like wooden dimples follow rings, leaving a clear central finger contact.
  const pipGeometry = new THREE.SphereGeometry(1, 7, 5)
  for (let row = 0; row < 4; row++) {
    const radius = .088 + row * .039, count = 12 + row * 6
    for (let i = 0; i < count; i++) {
      const angle = (i + (row % 2) * .5) / count * Math.PI * 2
      const pip = add('sunflower-wooden-seed', pipGeometry, (row + i) % 3 ? seedLight : seed,
        [Math.cos(angle) * radius, Math.sin(angle) * radius, .06 * Math.sqrt(1 - (radius / .246) ** 2)], centerPiece)
      pip.scale.set(.012, .016, .010); pip.rotation.z = angle; pip.userData.toonSurface = { outline: false }
    }
  }

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    flower.position.copy(at >= 2 ? HUNG : HOME)
    if (at >= 1) { flower.add(centerPiece); centerPiece.position.copy(CENTER_SEAT) }
    else { world.add(centerPiece); centerPiece.position.copy(CENTER_HOME) }
    matrices()
  }
  const cueActive = (step: number) => () => active() && !motion && at === step
  addInteractionCue(center, { kind: 'drag', label: '握住花心', priority: 3, enabled: cueActive(0), destination: seat, targetLabel: '尖瓣中央' })
  addInteractionCue(center, { kind: 'drag', label: '把太阳花挂上门钉', priority: 3, enabled: cueActive(1), destination: peg, targetLabel: '门框木钉' })
  addInteractionCue(center, { kind: 'tap', label: '轻点花心静看', priority: 3, enabled: cueActive(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => at === 0 ? centerPiece : flower
  const belongsTo = (object: THREE.Object3D | undefined, root: THREE.Object3D) => {
    for (let p = object; p; p = p.parent ?? undefined) if (p === root) return true
    return false
  }
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh || (held && belongsTo(object, held))) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.every(mat => !mat.visible || mat.opacity === 0)) return
      meshes.push(object)
    })
    return belongsTo(ray.aim(x, y).intersectObjects(meshes, false)[0]?.object, target)
  }
  const reset = () => { dragging = false; travel = 0; if (!motion) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); return hitsVisible(x, y, centerPiece) },
    onStart(x, y) {
      down.set(x, y); travel = 0; dragging = at < 2; feedback.prepare()
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), center.getWorldPosition(new THREE.Vector3()))
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(moving().position).sub(point)
    },
    onMove(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset)
      matrices();
      if (dragging && at < 2 && travel > 0 && placementHit(canvas, camera, center, x, y, (px, py) => hitsVisible(px, py, at === 0 ? seat : peg, moving())) && pointer.finish()) { dragging = false; begin(true) }
    },
    onRelease(x, y) {
      travel = Math.max(travel, Math.hypot(x - down.x, y - down.y)); matrices()
      // Only the carried subtree is excluded; all external scene occluders remain authoritative.
      const valid = at < 2 ? dragging && travel > 0 && placementHit(canvas, camera, center, x, y, (px, py) => hitsVisible(px, py, at === 0 ? seat : peg, moving()))
        : at === 2 && travel < 12 && hitsVisible(x, y, centerPiece)
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !active() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = at < 3 && !motion ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(active() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? COPY.assembleAction : at === 1 ? COPY.hangAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : at === 0 ? COPY.assemble : at === 1 ? COPY.hang : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function settle() {
    if (!active() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore(); sync(); ctx.onProgress?.(at)
    feedback.impact({ freqs: [349.23, 440], duration: .17, gain: .012, type: 'triangle' })
  }
  function begin(arrived = false) {
    if (!active() || (pointer.isBusy() && !arrived) || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, from: moving().position.clone() }; sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || at !== 2) return
    at = 3; restore(); sync(); if (text.trim() && !returning) ctx.saveWish?.(text.trim())
    ctx.onProgress?.(3); feedback.impact({ freqs: [349.23, 523.25], duration: .24, gain: .012 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || at === 3) return; feedback.prepare(); if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0, 2.65, 5.5 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.24, .08); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
        onSubmit: text => { if (!active() || pointer.isBusy() || motion || at !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }; return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .7)
        const t = ease(motion.time)
        moving().position.lerpVectors(motion.from, motion.step === 0 ? flower.position.clone().add(CENTER_SEAT) : HUNG, t)
        if (!reduced()) moving().position.y += .08 * Math.sin(Math.PI * t)
        if (motion.time === 1) settle()
      }
      matrices(); style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
