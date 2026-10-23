import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPathSweep } from '../path-sweep'
import { createTouchTarget } from '../touch-target'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '红绳自持', wind: '从红绳端出发，沿支架上的浅色圆点顺序绕一圈。',
  clasp: '把松开的扣头拖到绳环下方的合扣点，轻轻收拢。',
  quiet: '轻点红绳环静看，或写一句照看自己的话后点「写好了」。',
  returning: '轻点红绳环，回看这一段对自己的照顾。',
  done: '心意相连，各自安好。把这一分照看留给自己。',
  moving: '红绳慢慢落稳…', windAction: '沿支架绕一圈', claspAction: '收拢合扣', quietAction: '轻点绳环静看',
  literary: '绕线成环', literaryText: '沿浅色圆点，慢慢绕好红绳。',
  contemporary: '留句心意', contemporaryText: '把照看自己的心意系在红绳上。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1; time: number; guided: boolean; from: THREE.Vector3 }
const CENTER = new THREE.Vector3(.3, 1.15, .31), RADIUS = .64
const CLASP_HOME = new THREE.Vector3(.91, .54, .36)
const SOCKET = new THREE.Vector3(.3, .51, .39)
const arcPoint = (t: number) => new THREE.Vector3(CENTER.x + Math.sin(t * Math.PI * 2) * RADIUS,
  CENTER.y - Math.cos(t * Math.PI * 2) * RADIUS, CENTER.z)
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Personal red-cord handwork, without a traditional ritual provenance claim. */
export function createHongshengRedString(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, inactiveRendered = false, checkpoint: Checkpoint = 0
  let motion: Motion | null = null, dragging = false, nextBead = 1, maxTravel = 0
  let writer: GestureHandle | null = null, stopResize = () => {}
  const returning = ctx.returning === true
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.windAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const layers = document.createElement('div'); layers.className = 'red-string-context-layers'
  layers.style.cssText = 'position:absolute;top:52px;left:12px;right:12px;display:flex;gap:8px;justify-content:center;pointer-events:none;font-size:11px;line-height:1.45;color:#634c42;'
  for (const [label, detail] of [[COPY.literary, COPY.literaryText], [COPY.contemporary, COPY.contemporaryText]]) {
    const card = document.createElement('div'); card.style.cssText = 'max-width:185px;flex:1;padding:6px 9px;border-radius:12px;background:rgba(255,247,230,.91);border:1px solid rgba(122,77,61,.14);'
    const tag = document.createElement('strong'), text = document.createElement('div')
    setSafeText(tag, label, safe); setSafeText(text, detail, safe); card.append(tag, text); layers.append(card)
  }
  overlay.append(layers)
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'hongsheng-red-string', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xffefdb, ground: 0xb5a49a, key: 0xffe4c8, rim: 0xe9ded4,
    keyPosition: [-3, 5, 3], keyIntensity: 1.15, rimIntensity: .42 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'red-string-handwork'; scene.add(world)
  const mat = (color: number, roughness = .87) => new THREE.MeshStandardMaterial({ color, roughness })
  const maple = mat(0xcdb08a), mapleLight = mat(0xe4cba4), cream = mat(0xf2dfbb), red = mat(0xbd4845), redLight = mat(0xd6645a), redShade = mat(0xa33d3e), brass = mat(0xcbad75, .48)
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, p: THREE.Vector3 | [number, number, number], parent: THREE.Object3D = world, name = '') => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name
    if (Array.isArray(p)) mesh.position.set(...p); else mesh.position.copy(p)
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, parent: THREE.Object3D, name: string, origin = new THREE.Vector3()) {
    const local = points.map(p => p.clone().sub(origin))
    return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(local), Math.max(16, points.length * 2), radius, 8, false), material, origin, parent, name)
  }
  const plinth = add(new RoundedBoxGeometry(2.85, .17, 1.32, 5, .08), mapleLight, [0, .085, 0], world, 'red-string-workboard')
  for (const x of [-1.07, 1.07]) add(new RoundedBoxGeometry(.24, .075, .8, 3, .025), maple, [x, .013, 0])
  const matPad = add(new RoundedBoxGeometry(.76, .025, .67, 4, .07), mat(0xd9c8ba), [-.96, .185, .08], world, 'red-string-spool-pad')
  plinth.userData.toonSurface = matPad.userData.toonSurface = { outline: false }
  const spool = new THREE.Group(); spool.name = 'red-string-spool'; spool.position.set(-.96, .199, .08); world.add(spool)
  for (const y of [.036, .56]) add(new THREE.CylinderGeometry(.30, .30, .07, 40), mapleLight, [0, y, 0], spool)
  add(new THREE.CylinderGeometry(.12, .12, .49, 24), maple, [0, .29, 0], spool)
  add(new THREE.CylinderGeometry(.242, .242, .43, 40), red, [0, .30, 0], spool)
  for (let i = 0; i < 17; i++) {
    const coil = add(new THREE.TorusGeometry(.244 + Math.sin(i * 1.8) * .004, .017, 7, 40), i % 3 ? redLight : redShade, [0, .097 + i * .025, 0], spool)
    coil.rotation.x = Math.PI / 2; coil.userData.toonSurface = { outline: false }
  }
  const spoolHole = add(new THREE.CylinderGeometry(.061, .061, .005, 20), mat(0x9d805e), [0, .598, 0], spool)
  spoolHole.userData.toonSurface = { outline: false }
  const holder = new THREE.Group(); holder.name = 'red-string-upright-holder'; holder.position.set(CENTER.x, CENTER.y, -.015); world.add(holder)
  add(new RoundedBoxGeometry(.83, .14, .71, 4, .06), maple, [0, -.91, 0], holder, 'red-string-holder-foot')
  add(new RoundedBoxGeometry(.19, .47, .20, 4, .06), maple, [0, -.66, -.09], holder)
  add(new THREE.TorusGeometry(.63, .125, 14, 72), mapleLight, [0, 0, .11], holder, 'red-string-rounded-upright')
  add(new THREE.TorusGeometry(.64, .055, 10, 72), maple, [0, 0, .255], holder, 'red-string-winding-groove')
  for (const x of [-.25, .25]) add(new THREE.SphereGeometry(.035, 10, 8), brass, [x, -.85, .31], holder)
  const feed = tube([new THREE.Vector3(-.75, .42, .23), new THREE.Vector3(-.66, .24, .43), new THREE.Vector3(-.32, .215, .49), new THREE.Vector3(.03, .29, .40), arcPoint(0)], .031, red, world, 'red-string-feed')
  const guides = new THREE.Group(); guides.name = 'red-string-winding-guides'; world.add(guides)
  tube(Array.from({ length: 97 }, (_, i) => arcPoint(i / 96)), .012, cream, guides, 'red-string-guide-track')
  const beads = Array.from({ length: 12 }, (_, i) => add(new THREE.SphereGeometry(.057, 14, 10), cream.clone(), arcPoint((i + 1) / 12), guides, `red-string-guide-${i + 1}`))
  const ring = new THREE.Group(); ring.name = 'red-string-bracelet'; world.add(ring)
  const strands = Array.from({ length: 12 }, (_, i) => {
    const mid = (i + .5) / 12, origin = arcPoint(mid)
    return tube(Array.from({ length: 13 }, (_, j) => arcPoint((i + j / 12) / 12)), .037, i % 2 ? redLight : red, ring,
      i === 2 ? 'red-string-quiet-strand' : `red-string-strand-${i + 1}`, origin)
  })
  const tip = add(new THREE.SphereGeometry(.082, 20, 14), red, arcPoint(0), world, 'red-string-tip')
  const claspHead = add(new RoundedBoxGeometry(.17, .125, .09, 4, .035), brass, CLASP_HOME, world, 'red-string-clasp-head')
  const claspSocket = add(new RoundedBoxGeometry(.20, .14, .1, 4, .035), brass, SOCKET, world, 'red-string-clasp-socket')
  const tail = new THREE.Group(); tail.name = 'red-string-loose-tail'; world.add(tail)
  const tailPoints = () => {
    const start = arcPoint(1), end = claspHead.position.clone()
    return [start, start.clone().lerp(end, .34).add(new THREE.Vector3(0, -.18, 0)), start.clone().lerp(end, .7).add(new THREE.Vector3(0, -.17, 0)), end]
  }
  const tailStrand = tube(tailPoints(), .03, red, tail, 'red-string-clasp-tail')
  function updateTail() {
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPoints()), 16, .03, 8, false)
    tailStrand.geometry.dispose(); tailStrand.geometry = geometry
  }
  const activeCue = (at: number) => () => active() && !motion && checkpoint === at
  addInteractionCue(tip, { kind: 'drag', label: '沿支架绕红绳', enabled: activeCue(0), destination: () => beads[Math.min(nextBead - 1, 11)].getWorldPosition(new THREE.Vector3()), targetLabel: '沿弧线到这里' })
  addInteractionCue(claspHead, { kind: 'drag', label: '拖扣头收拢', enabled: activeCue(1), destination: claspSocket, targetLabel: '绳环合扣点' })
  addInteractionCue(strands[2], { kind: 'tap', label: '轻点红绳环静看', enabled: activeCue(2) })
  function matrices() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  function winding(t: number) {
    strands.forEach((strand, i) => { strand.visible = i < Math.floor(t * 12 + .001) })
    tip.position.copy(arcPoint(t)); matrices()
  }
  function pose() {
    winding(checkpoint === 0 ? 0 : 1)
    tip.visible = checkpoint === 0; guides.visible = checkpoint === 0; feed.visible = checkpoint === 0
    claspHead.visible = checkpoint === 1; claspSocket.visible = checkpoint >= 1; tail.visible = checkpoint === 1
    claspHead.position.copy(CLASP_HOME); updateTail(); matrices()
  }
  function sync() {
    delete ui.hintEl.dataset.progress
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!motion || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    wishSlot.hidden = returning || checkpoint !== 2; writer?.setEnabled(active() && checkpoint === 2 && !returning && !motion)
    setSafeText(ui.actionBtn, [COPY.windAction, COPY.claspAction, COPY.quietAction, COPY.quietAction][checkpoint], safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : [COPY.wind, COPY.clasp, returning ? COPY.returning : COPY.quiet, COPY.done][checkpoint], safe)
  }
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(), dragPoint = new THREE.Vector3(), offset = new THREE.Vector3(), down = new THREE.Vector2()
  const touch = createTouchTarget(canvas, camera, scene)
  const windPath = createPathSweep(Array.from({ length: 13 }, (_, i) => { const p = arcPoint(i / 12); return [p.x, p.y] as const }), .075)
  const windReady = (x: number, y: number) => windPath.progress === 1 && touch.hit(x, y, beads[11]!, { ignore: tip })
  const resetDrag = () => { dragging = false; windPath.reset(); nextBead = 1; maxTravel = 0; beads.forEach(bead => (bead.material as THREE.MeshStandardMaterial).color.setHex(0xf2dfbb)); if (!motion) { pose(); sync() } }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { matrices(); return !motion && checkpoint < 3 && touch.hit(x, y, checkpoint === 0 ? [tip] : checkpoint === 1 ? [claspHead] : strands) },
    onStart(x, y) {
      dragging = true; windPath.reset(); nextBead = 1; maxTravel = 0; down.set(x, y); feedback.prepare()
      if (checkpoint === 0) plane.set(new THREE.Vector3(0, 0, 1), -CENTER.z)
      else if (checkpoint === 1) {
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), claspHead.position)
        if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) offset.copy(claspHead.position).sub(dragPoint)
      }
    },
    onMove(x, y) {
      if (!dragging) return
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (checkpoint === 0) {
        if (!ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) return
        windPath.sample([dragPoint.x, dragPoint.y]); nextBead = windPath.next
        winding(windPath.progress)
        beads.forEach((bead, i) => (bead.material as THREE.MeshStandardMaterial).color.setHex(i < nextBead - 1 ? 0x79ac82 : 0xf2dfbb))
        ui.hintEl.dataset.progress = 'true'
        setSafeText(ui.hintEl, windReady(x, y) ? '红绳已绕好，松手即可。' : windPath.progress === 1 ? '红绳已绕好，回到最后一处圆点附近松手。' : '已绕好 ' + Math.round(windPath.progress * 100) + '%，沿浅色圆点继续。', safe)
        tip.position.copy(dragPoint); matrices()
      } else if (checkpoint === 1 && ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) {
        claspHead.position.copy(dragPoint).add(offset)
        claspHead.position.x = THREE.MathUtils.clamp(claspHead.position.x, -1.3, 1.3)
        claspHead.position.y = THREE.MathUtils.clamp(claspHead.position.y, .25, 1.9); updateTail(); matrices()
      }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = Number.isFinite(x) && Number.isFinite(y) && dragging && !motion && (checkpoint === 0 ? windReady(x, y)
        : checkpoint === 1 ? ray.hits(x, y, [claspSocket]) : checkpoint === 2 && maxTravel < 12 && ray.hits(x, y, strands))
      dragging = false
      if (valid) { if (checkpoint < 2) begin(true); else finish() } else resetDrag()
    },
    onCancel: resetDrag,
  })
  function settled() {
    if (!active() || !motion) return
    checkpoint = (motion.step + 1) as Checkpoint; motion = null; nextBead = 1; pose(); sync()
    ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [330, 495], duration: .22, gain: .017, type: 'triangle' })
  }
  function begin(guided = false) {
    if (!active() || pointer.isBusy() || motion || checkpoint >= 2) return
    motion = { step: checkpoint as 0 | 1, time: 0, guided, from: (checkpoint === 0 ? tip : claspHead).position.clone() }
    dragging = false; sync(); if (reduced()) settled()
  }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || checkpoint !== 2) return
    const line = text.trim()
    // Set terminal state before host callbacks so reentrant submissions cannot save twice.
    checkpoint = 3; pose(); sync()
    if (line && !returning) ctx.saveWish?.(line)
    ctx.onProgress?.(3); feedback.impact({ freqs: [330, 495], duration: .3, gain: .017 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || checkpoint === 3) return; feedback.prepare(); if (checkpoint < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    // The library names the scene above its canvas; use that freed top strip for both context layers.
    layers.style.top = overlay.closest('.library-scene-stage') ? '10px' : '52px'
    camera.position.set(0, 2.55, 5.0 + portraitBoost(aspect, 4.8)); camera.lookAt(0, 1.0, 0); matrices()
  }
  pose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      pose(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning) {
        writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
          onSubmit: text => { if (!active() || pointer.isBusy() || motion || checkpoint !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } })
        writer.mount(wishSlot, {})
      }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }
        return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(checkpoint === 2 && !returning && !motion); writer?.update(dt)
      if (motion) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / (motion.step === 0 && !motion.guided ? 1.2 : .65))
        const t = smooth(motion.time)
        if (motion.step === 0) {
          if (motion.guided) tip.position.lerpVectors(motion.from, arcPoint(1), t)
          else winding(t)
        } else { claspHead.position.lerpVectors(motion.from, SOCKET, t); updateTail() }
        matrices(); if (motion.time === 1) settled()
      }
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(scene); Object.values(lights).forEach(l => l.dispose()); renderer.dispose(); renderer.forceContextLoss()
      scene.clear(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
