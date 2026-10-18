import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '绘牌记谢', pathAction: '绘一段归途', windowAction: '描一线窗光', quietAction: '轻点陶牌静看',
  path: '借意大利谢恩绘牌的灵感，画一段归途。把调色盘上的笔头拖到陶牌下方的暖色点。',
  window: '从笔头出发，沿细线向右上描到窗里的暖色点，为这幅记谢小画添上窗光。',
  quiet: '画面已留住归途与窗光。轻点陶牌静看，或写下自己想说的感谢后点「写好了」。',
  returning: '轻点陶牌，回看这幅记谢小画，想起自己感念的人与事。',
  moving: '让这一笔轻轻落在陶牌上…',
  done: '归途与窗光已画好。这幅小画，留住你自己的感谢。',
} as const
const HOME = new THREE.Vector3(-.97, .84, .50)
const ORIGIN = new THREE.Vector3(-.44, 1.13, .225)
const WINDOW_START = new THREE.Vector3(-.19, 1.91, .255)
const WINDOW_END = new THREE.Vector3(.25, 2.16, .255)
type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1; time: number; from: THREE.Vector3; guided: boolean }
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Original ceramic studio miniature, inspired by painting as a record of thanks. */
export function createItalianExVoto(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0
  let motion: Motion | null = null, dragging = false, maxTravel = 0, inactiveRendered = false
  let traceInvalid = false, traceMax = 0, traceSamples = 0
  let writer: GestureHandle | null = null, stopResize = () => {}
  const returning = ctx.returning === true
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.pathAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'italian-ex-voto', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff1de, ground: 0xb7b69e, key: 0xffe2ba, rim: 0xd5e4ed,
    keyPosition: [-3, 5, 4], keyIntensity: 1.2, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3.5, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'exvoto-world'; scene.add(world)
  const mat = (color: number, roughness = .84) => new THREE.MeshStandardMaterial({ color, roughness })
  const oak = mat(0xb98f69), edge = mat(0x9d7556), board = mat(0xd9b991)
  const ceramic = mat(0xffefd0, .52), glaze = mat(0xf7e4bb, .5), blue = mat(0x7299ac), blueLight = mat(0xb4cbd1)
  const terra = mat(0xba7964), gold = mat(0xe7b365), grass = mat(0x94ac88), leaf = mat(0x729178), bristle = mat(0xa86e40)
  const cream = mat(0xf9eacb), handleMat = mat(0x659399), metal = mat(0xd6cab2, .45), ink = mat(0x657c7c)
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const sphere = new THREE.SphereGeometry(1, 24, 16)
  const oval = (p: [number, number, number], scale: [number, number, number], material: THREE.Material, parent = world) => {
    const mesh = add(sphere, material, p, parent); mesh.scale.set(...scale); return mesh
  }
  const stroke = (points: THREE.Vector3[], radius: number, material: THREE.Material, parent: THREE.Object3D = world) => {
    const mesh = add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(20, points.length * 5), radius, 8, false), material, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  const rounded = (w: number, h: number, d: number, p: [number, number, number], material: THREE.Material, parent: THREE.Object3D = world, r = .04) =>
    add(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 3, h / 3, d / 3)), material, p, parent)
  const table = new THREE.Group(); table.name = 'exvoto-table'; world.add(table)
  rounded(2.78, .14, 1.22, [0, .64, .05], board, table)
  for (const x of [-1.12, 1.12]) for (const z of [-.4, .48]) rounded(.14, .58, .14, [x, .29, z], oak, table)
  for (const z of [-.43, .47]) rounded(2.36, .14, .10, [0, .51, z], oak, table)
  const shadow = add(new THREE.PlaneGeometry(3.5, 2.0), new THREE.ShadowMaterial({ opacity: .13 }), [0, .004, .03])
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  const easel = new THREE.Group(); easel.name = 'exvoto-easel'; world.add(easel)
  for (const x of [-.61, .61]) {
    const leg = rounded(.105, 2.11, .13, [x, 1.70, -.13], oak, easel); leg.rotation.z = x < 0 ? -.11 : .11
  }
  rounded(.12, 2.18, .13, [0, 1.74, -.19], edge, easel)
  const backLeg = rounded(.11, 1.95, .13, [0, 1.60, -.49], edge, easel); backLeg.rotation.x = -.22
  rounded(1.94, .12, .38, [0, .91, -.02], oak, easel)
  rounded(.43, .12, .20, [0, 2.70, -.02], oak, easel)
  const plaque = rounded(1.70, 1.71, .20, [0, 1.80, .025], ceramic, world, .15); plaque.name = 'exvoto-ceramic-plaque'
  const painted = new THREE.Group(); painted.name = 'exvoto-painted-scene'; world.add(painted)
  rounded(1.46, 1.46, .025, [0, 1.8, .142], glaze, painted, .06)
  // Fine cobalt ceramic edge and scattered hand-painted leaves; no borrowed sacred imagery.
  for (const x of [-.77, .77]) stroke([new THREE.Vector3(x, 1.13, .142), new THREE.Vector3(x, 1.80, .142), new THREE.Vector3(x, 2.47, .142)], .012, blue, painted)
  for (const y of [1.04, 2.56]) stroke([new THREE.Vector3(-.64, y, .142), new THREE.Vector3(0, y, .142), new THREE.Vector3(.64, y, .142)], .012, blue, painted)
  for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) {
    const l = oval([sign * (.66 - i * .047), 2.40 + i * .035, .16], [.05, .023, .006], blue, painted); l.rotation.z = sign * -.7
  }
  const sun = oval([-.46, 2.25, .17], [.13, .13, .009], gold, painted); sun.name = 'exvoto-painted-sun'
  oval([-.30, 1.40, .17], [.39, .20, .013], grass, painted)
  oval([.30, 1.40, .18], [.36, .24, .013], leaf, painted)
  const house = new THREE.Group(); house.name = 'exvoto-painted-home'; painted.add(house)
  rounded(.75, .81, .025, [.13, 1.87, .183], blueLight, house)
  const roofShape = new THREE.Shape(); roofShape.moveTo(-.31, 2.27); roofShape.lineTo(.13, 2.50); roofShape.lineTo(.57, 2.27); roofShape.closePath()
  const roof = add(new THREE.ExtrudeGeometry(roofShape, { depth: .018, bevelEnabled: false }), terra, [0, 0, .19], house)
  roof.userData.toonSurface = { outline: false }
  rounded(.18, .32, .025, [.29, 1.62, .21], ink, house)
  rounded(.58, .48, .022, [.03, 2.04, .215], blue, house)
  rounded(.45, .36, .018, [.03, 2.04, .237], cream, house)
  for (const x of [-.23, .29]) rounded(.042, .45, .024, [x, 2.04, .255], terra, house)
  rounded(.64, .055, .035, [.03, 1.79, .248], terra, house)
  const curtain = stroke([new THREE.Vector3(.09, 2.23, .257), new THREE.Vector3(.10, 2.07, .257), new THREE.Vector3(.15, 1.85, .257)], .012, gold, house)
  curtain.name = 'exvoto-window-curtain'
  const routeOrigin = oval(ORIGIN.toArray() as [number, number, number], [.085, .065, .017], gold); routeOrigin.name = 'exvoto-route-origin'
  const route = new THREE.Group(); route.name = 'exvoto-warm-homeward-path'; world.add(route)
  const routePoints = [ORIGIN, new THREE.Vector3(-.18, 1.20, .21), new THREE.Vector3(.02, 1.30, .22), new THREE.Vector3(.05, 1.43, .22), new THREE.Vector3(.29, 1.48, .23)]
  const curve = new THREE.CatmullRomCurve3(routePoints)
  for (let i = 0; i < 22; i++) {
    const p = curve.getPoint(i / 21); oval(p.toArray() as [number, number, number], [.046, .024, .008], gold, route)
  }
  const routePencil = stroke(routePoints, .007, board); routePencil.name = 'exvoto-route-pencil'
  const traceGuide = stroke([WINDOW_START, WINDOW_END], .011, gold); traceGuide.name = 'exvoto-window-guide'
  const windowEnd = oval(WINDOW_END.toArray() as [number, number, number], [.072, .061, .014], gold); windowEnd.name = 'exvoto-window-end'
  const windowLight = stroke([WINDOW_START, WINDOW_END], .035, gold); windowLight.name = 'exvoto-painted-window-light'
  for (let i = 1; i < 5; i++) {
    const p = WINDOW_START.clone().lerp(WINDOW_END, i / 5)
    const bead = oval(p.toArray() as [number, number, number], [.019, .019, .012], cream); bead.name = `exvoto-window-bead-${i}`
    traceGuide.add(bead); bead.position.copy(p) // Guide has its geometry in world space and identity transform.
  }
  const palette = new THREE.Group(); palette.name = 'exvoto-palette'; palette.position.set(-.94, .745, .26); world.add(palette)
  const paletteBody = oval([0, 0, 0], [.39, .044, .28], oak, palette); paletteBody.rotation.y = -.2
  oval([.21, .042, -.08], [.06, .008, .045], edge, palette)
  for (const [x, z, material] of [[-.16, -.10, gold], [.04, -.16, terra], [.18, .09, blue], [-.14, .10, cream]] as const) {
    oval([x, .043, z], [.072, .02, .062], material, palette)
  }
  const brush = new THREE.Group(); brush.name = 'exvoto-brush'; world.add(brush)
  const tip = oval([0, 0, 0], [.077, .076, .047], bristle, brush); tip.name = 'exvoto-brush-tip'
  const tuft = oval([-.04, .055, 0], [.056, .084, .041], gold, brush); tuft.rotation.z = -.54
  stroke([new THREE.Vector3(-.06, .10, 0), new THREE.Vector3(-.10, .17, 0)], .042, metal, brush)
  stroke([new THREE.Vector3(-.10, .17, 0), new THREE.Vector3(-.20, .34, 0), new THREE.Vector3(-.27, .46, 0)], .03, handleMat, brush)
  oval([-.27, .46, 0], [.029, .035, .029], cream, brush)
  // Small studio cloth and two spare brushes clarify a painting station rather than a votive wall.
  rounded(.38, .035, .32, [.91, .75, .35], cream)
  for (let i = 0; i < 2; i++) stroke([new THREE.Vector3(.83 + i * .09, .79, .14), new THREE.Vector3(.94 + i * .07, .80, .57)], .017, i ? terra : handleMat)

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restorePose = () => {
    brush.position.copy(checkpoint === 1 ? WINDOW_START : HOME)
    route.children.forEach(child => { child.visible = checkpoint >= 1 }); routePencil.visible = checkpoint === 0
    windowLight.visible = checkpoint >= 2; traceGuide.visible = checkpoint === 1; windowEnd.visible = checkpoint === 1
    routeOrigin.visible = checkpoint === 0; matrices()
  }
  const cueActive = (at: number) => () => active() && !motion && checkpoint === at
  addInteractionCue(tip, { kind: 'drag', label: '拖笔头绘归途', priority: 3, enabled: cueActive(0), destination: routeOrigin, targetLabel: '归途起笔处' })
  addInteractionCue(tip, { kind: 'drag', label: '沿线向右上描窗光', priority: 3, enabled: cueActive(1), destination: windowEnd, targetLabel: '窗光终点' })
  addInteractionCue(plaque, { kind: 'tap', label: '轻点陶牌静看', priority: 3, enabled: cueActive(2), anchor: [0, 0, .101] })
  const finishPickables: THREE.Object3D[] = [plaque]
  painted.traverse(object => { if ((object as THREE.Mesh).isMesh) finishPickables.push(object) })
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const down = new THREE.Vector2(), line = WINDOW_END.clone().sub(WINDOW_START), lineLengthSq = line.lengthSq()
  const resetDrag = () => { dragging = false; maxTravel = 0; traceInvalid = false; traceMax = 0; traceSamples = 0; if (!motion) restorePose() }
  const traceAt = (x: number, y: number) => {
    if (traceInvalid || !ray.aim(x, y).ray.intersectPlane(plane, point)) { traceInvalid = true; return }
    const t = point.clone().sub(WINDOW_START).dot(line) / lineLengthSq
    const distance = point.distanceTo(WINDOW_START.clone().addScaledVector(line, t))
    if (distance > .09 || t < -.14 || t > 1.18 || t < traceMax - .16) { traceInvalid = true; return }
    // A jump straight to the end is not a painted stroke: accept modest directional samples only.
    if (t - traceMax > .42) { traceInvalid = true; return }
    if (t > traceMax + .025) traceSamples++
    traceMax = Math.max(traceMax, t); brush.position.copy(point); matrices()
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (motion || checkpoint === 3) return false; matrices(); return ray.hits(x, y, checkpoint === 2 ? finishPickables : [tip]) },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; traceInvalid = false; traceMax = 0; traceSamples = 0; feedback.prepare()
      if (checkpoint === 1) plane.set(new THREE.Vector3(0, 0, 1), -WINDOW_START.z)
      else if (checkpoint === 0) {
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), brush.position)
        if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(brush.position).sub(point)
      }
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || checkpoint >= 2) return
      if (checkpoint === 1) traceAt(x, y)
      else if (ray.aim(x, y).ray.intersectPlane(plane, point)) {
        brush.position.copy(point).add(offset); brush.position.x = THREE.MathUtils.clamp(brush.position.x, -1.35, 1.1)
        brush.position.y = THREE.MathUtils.clamp(brush.position.y, .76, 2.3); matrices()
      }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint === 0 ? dragging && maxTravel > 8 && ray.hits(x, y, [routeOrigin])
        : checkpoint === 1 ? dragging && !traceInvalid && traceSamples >= 3 && traceMax >= .86 && ray.hits(x, y, [windowEnd])
        : checkpoint === 2 && maxTravel < 12 && ray.hits(x, y, finishPickables)
      dragging = false
      if (valid) { if (checkpoint < 2) begin(true); else finish() } else resetDrag()
    },
    onCancel: resetDrag,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!motion || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); wishSlot.hidden = returning || checkpoint !== 2
    writer?.setEnabled(active() && !returning && checkpoint === 2 && !motion)
    ui.hitLayer.style.pointerEvents = checkpoint < 3 && !motion ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? COPY.pathAction : checkpoint === 1 ? COPY.windowAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, motion ? COPY.moving : checkpoint === 0 ? COPY.path : checkpoint === 1 ? COPY.window
      : checkpoint === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function settled() {
    if (!active() || !motion) return
    checkpoint = (motion.step + 1) as Checkpoint; motion = null; restorePose(); sync(); ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: checkpoint === 1 ? [392, 493.88] : [440, 659.25], duration: .22, gain: .017, type: 'triangle' })
  }
  function begin(guided = false) {
    if (!active() || pointer.isBusy() || motion || checkpoint >= 2) return
    motion = { step: checkpoint as 0 | 1, time: 0, from: brush.position.clone(), guided }; dragging = false; sync()
    if (reduced()) settled()
  }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || motion || checkpoint !== 2) return
    const line = text.trim(); checkpoint = 3; restorePose(); sync()
    if (line && !returning) ctx.saveWish?.(line)
    ctx.onProgress?.(3); feedback.impact({ freqs: [392, 587.33], duration: .26, gain: .017 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || motion || checkpoint === 3) return; feedback.prepare(); if (checkpoint < 2) begin(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0, 3.15, 5.6 + portraitBoost(aspect, 6.6)); camera.lookAt(0, 1.45, 0); matrices()
  }
  restorePose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restorePose(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
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
        if (!inactiveRendered) { style.render(); inactiveRendered = true }; return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(checkpoint === 2 && !returning && !motion); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .8)
        const t = smooth(motion.time)
        if (motion.step === 0) {
          if (t < .32) brush.position.lerpVectors(motion.from, ORIGIN, t / .32)
          else brush.position.copy(curve.getPoint((t - .32) / .68))
          route.children.forEach((child, i) => { child.visible = i / route.children.length <= (t - .32) / .68 })
        } else {
          brush.position.lerpVectors(motion.guided ? motion.from : WINDOW_START, WINDOW_END, t)
          windowLight.visible = true; windowLight.scale.set(t, t, 1)
          windowLight.position.set(WINDOW_START.x * (1 - t), WINDOW_START.y * (1 - t), 0)
        }
        if (motion.time === 1) { windowLight.scale.set(1, 1, 1); windowLight.position.set(0, 0, 0); settled() }
      }
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
