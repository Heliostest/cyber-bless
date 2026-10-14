import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '毛线织暖', insert: '拿住右侧木针，向左上方短拖，让针尖穿入左针末端的线圈。',
  pull: '向右下方短拖右针，把绕好的毛线带出旧圈；松手，旧圈滑下。',
  quiet: '轻点奶白与灰色的织片，静看这一针留下的柔软。',
  done: '留一针暖意在日常。（当代编织欣赏练习结束）',
  inserting: '木针穿入旧圈，工作线轻轻绕过针尖…', pulling: '新圈穿过旧圈，旧圈从左针尖滑下…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const HOME = new THREE.Vector3(.90, 0, .235), INSERTED = new THREE.Vector3(.64, .20, .235), DRAWN = new THREE.Vector3(.93, -.15, .235)
const BALL_EXIT: XYZ = [.98, -.58, .42]
const ease = (t: number) => t * t * (3 - 2 * t)
const vectors = (points: XYZ[]) => points.map(p => new THREE.Vector3(...p))

/** An original swatch and one ordinary knit stitch, not an exclusive regional technique. */
export function createFaroeseWoolKnit(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, stopResize = () => {}, insertAmount = 0, pullAmount = 0
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let dragging = false, moved = false, maxTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向左上穿入线圈' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'faroese-wool-knit', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xeff2e9, ground: 0xada58d, key: 0xfff0d9, rim: 0xd6e6e4, keyPosition: [-3, 5, 4], keyIntensity: 1.7, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .015
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 12 })
  const world = new THREE.Group(); world.name = 'wool-workbench'; scene.add(world)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness })
  const wood = mat(0xba956c), darkWood = mat(0x8d7053), needleWood = mat(0xc39254, .68), needleEnd = mat(0x956b40, .72)
  const boardMat = mat(0xc8d3ca), boardEdge = mat(0xa8b7ab), cream = mat(0xeee3cc, .98), grey = mat(0x7b8982, .98), ballShade = mat(0xd8cbb4, .98)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent: THREE.Object3D = world) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.025, ...size.map(n => n / 3))), material, p, parent)
  const tube = (name: string, points: XYZ[], radius: number, material: THREE.Material, parent: THREE.Object3D, segments = 48) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vectors(points)), segments, radius, 7, false), material, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false, roughness: .98 }; return mesh as THREE.Mesh<THREE.TubeGeometry>
  }
  box('wool-table', [3.75, .13, 2.12], [0, .65, .06], wood)
  for (const x of [-1.53, 1.53]) for (const z of [-.75, .87]) box('wool-table-leg', [.13, .58, .13], [x, .295, z], darkWood)
  box('wool-table-apron', [3.25, .15, .08], [0, .52, .94], darkWood)
  const shadow = add('wool-contact-shadow', new THREE.PlaneGeometry(3.95, 2.4), new THREE.ShadowMaterial({ opacity: .12 }), [0, .003, .08]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  const board = new THREE.Group(); board.name = 'wool-sloping-board'; board.position.set(0, 1.59, 0); board.rotation.x = -.70; world.add(board)
  const backing = box('wool-board-backing', [3.37, 2.37, .09], [0, 0, -.055], boardEdge, board)
  box('wool-board-surface', [3.32, 2.32, .06], [0, 0, -.003], boardMat, board)
  board.updateWorldMatrix(true, true)
  const supportBase = new THREE.Vector3(0, .719, -.67)
  const supportHeight = new THREE.Raycaster(supportBase, new THREE.Vector3(0, 1, 0)).intersectObject(backing)[0]!.distance - .006
  box('wool-board-support', [.20, supportHeight, .04], [0, supportBase.y + supportHeight / 2, supportBase.z], darkWood)
  box('wool-board-foot', [2.72, .07, .11], [0, .758, .82], darkWood)

  // Each open loop passes from the back of one course to the front of the next.
  // Short V-shaped front legs overlap the previous course; their smaller holes
  // and thicker yarn read as a textile rather than a ladder of separate rings.
  // All 90 stitches share one geometry and two rough wool materials.
  const stitchPoints: XYZ[] = [[-.0925, -.06, .08], [-.025, -.10, .105], [-.020, -.055, .17], [-.046, .025, .17], [-.070, .09, .17], [-.053, .14, .11], [.053, .14, .11], [.070, .09, .17], [.046, .025, .17], [.020, -.055, .17], [.025, -.10, .105], [.0925, -.06, .08]]
  const stitchGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vectors(stitchPoints)), 44, .032, 7, false)
  const swatch = new THREE.Group(); swatch.name = 'wool-swatch'; board.add(swatch)
  for (let row = 0; row < 10; row++) for (let column = 0; column < 9; column++) {
    const m = add(`wool-stitch-${row}-${column}`, stitchGeometry, row === 2 || row === 3 || row === 7 ? grey : cream, [-1.19 + column * .185, -.80 + row * .132, 0], swatch)
    m.userData.toonSurface = { outline: false, roughness: .98 }
  }
  tube('wool-cast-on-edge', [[-1.31, -.90, .08], [-1.18, -.96, .08], [-.9, -.94, .08], [-.55, -.96, .08], [-.2, -.94, .08], [.30, -.94, .08], [.49, -.91, .08]], .025, cream, swatch, 50)
  // Short joins connect adjacent courses at alternating sample edges.
  for (let row = 0; row < 9; row++) {
    const x = row % 2 ? -1.2825 : .3825, y = -.80 + row * .132
    tube(`wool-course-join-${row}`, [[x, y - .06, .08], [x + (row % 2 ? -.025 : .025), y, .07], [x, y + .072, .08]], .032, row === 2 || row === 3 || row === 7 ? grey : cream, swatch, 12)
  }
  const livePoints = (x: number, drop = 0): XYZ[] => {
    // Before lowering, carry the crown beyond the left needle's x=.44 tip.
    // The two feet remain in the existing fabric while the old loop slips free.
    const overTip = Math.sin(drop * Math.PI) * .36
    return [[x - .07, .45, .12], [x - .045 + overTip * .4, .57 - drop * .13, .14], [x - .05 + overTip, .71 - drop * .28, .17], [x + overTip, .75 - drop * .30, .22], [x + .055 + overTip, .71 - drop * .27, .27], [x + .045 + overTip * .4, .57 - drop * .12, .19], [x + .07, .45, .13]]
  }
  for (let i = 0; i < 8; i++) tube(`wool-live-loop-${i}`, livePoints(-1.19 + i * .185), .032, cream, swatch, 34)
  const oldLoop = tube('wool-active-old-loop', livePoints(.25), .03, cream, swatch, 42)

  // Needles are genuine tapered wooden solids, supported by small board rests.
  const leftNeedle = new THREE.Group(); leftNeedle.name = 'wool-left-needle'; leftNeedle.position.set(-.62, .66, .215); leftNeedle.rotation.z = -Math.PI / 2; board.add(leftNeedle)
  add('wool-left-needle-shaft', new THREE.CylinderGeometry(.037, .037, 1.74, 14), needleWood, [0, 0, 0], leftNeedle)
  add('wool-left-needle-tip', new THREE.ConeGeometry(.037, .19, 14), needleWood, [0, .965, 0], leftNeedle)
  add('wool-left-needle-stop', new THREE.SphereGeometry(.068, 14, 10), needleEnd, [0, -.91, 0], leftNeedle)
  box('wool-left-needle-rest', [.15, .15, .15], [-1.45, .66, .102], darkWood, board)
  const needle = new THREE.Group(); needle.name = 'wool-right-needle'; needle.rotation.z = .70; board.add(needle)
  const grip = add('wool-right-needle-grip', new THREE.CylinderGeometry(.047, .047, .52, 16), needleWood, [0, -.32, 0], needle)
  add('wool-right-needle-shaft', new THREE.CylinderGeometry(.038, .047, .58, 16), needleWood, [0, .23, 0], needle)
  add('wool-right-needle-tip', new THREE.ConeGeometry(.038, .18, 16), needleWood, [0, .61, 0], needle)
  add('wool-right-needle-stop', new THREE.SphereGeometry(.063, 14, 10), needleEnd, [0, -.61, 0], needle)
  const rightRest = box('wool-right-needle-rest', [.19, .13, .16], [1.17, -.33, .107], darkWood, board); rightRest.rotation.z = .70
  for (const n of [leftNeedle, needle]) n.traverse(o => { if ((o as THREE.Mesh).isMesh) o.userData.toonSurface = { outline: false, roughness: .68 } })

  const cup = add('wool-yarnball-cup', new THREE.CylinderGeometry(.39, .34, .055, 36), wood, [1.02, -.70, .055], board); cup.rotation.x = Math.PI / 2
  const ball = new THREE.Group(); ball.name = 'wool-yarnball'; ball.position.set(1.02, -.70, .36); board.add(ball)
  const core = add('wool-yarnball-core', new THREE.SphereGeometry(.29, 28, 18), ballShade, [0, 0, 0], ball); core.userData.toonSurface = { outline: false, roughness: .98 }
  // One continuous winding in each of three directions makes a compact wound ball.
  for (let band = 0; band < 3; band++) {
    const points: XYZ[] = []
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(band * .78, band * .61, band * .88))
    for (let i = 0; i <= 300; i++) {
      const t = i / 300, latitude = -.86 + t * 1.72, angle = t * Math.PI * 2 * 11
      const p = new THREE.Vector3(Math.cos(latitude) * Math.cos(angle), Math.sin(latitude), Math.cos(latitude) * Math.sin(angle)).multiplyScalar(.297).applyQuaternion(q)
      points.push([p.x, p.y, p.z])
    }
    tube(`wool-yarnball-winding-${band}`, points, .014, band === 1 ? ballShade : cream, ball, 420)
  }
  const working = tube('wool-working-yarn', [BALL_EXIT, [.79, -.10, .16], [.42, .45, .16], [.33, .59, .17]], .023, cream, board, 80)
  const drawnLoop = tube('wool-drawn-loop', [[.19, .40, .14], [.22, .60, .24], [.30, .60, .26], [.34, .40, .16]], .025, cream, board, 48)
  const updateTube = (mesh: THREE.Mesh<THREE.TubeGeometry>, points: XYZ[]) => {
    const old = mesh.geometry, p = old.parameters
    mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vectors(points)), p.tubularSegments, p.radius, p.radialSegments, false); old.dispose()
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const pose = (insert: number, pull: number, wrap: number, slip: number) => {
    insertAmount = insert; pullAmount = pull
    needle.position.lerpVectors(HOME, INSERTED, insert).lerp(DRAWN, pull)
    // The small right rest follows the shaft along its shallow board groove.
    rightRest.position.set(needle.position.x + .27, needle.position.y - .33, .107)
    const tip = new THREE.Vector3(-Math.sin(.70) * .49, Math.cos(.70) * .49, 0).add(needle.position)
    const wrapCenter = new THREE.Vector3(.33, .59, .17).lerp(tip, wrap)
    const yarn: XYZ[] = [BALL_EXIT, [.79, -.32, .15], [.71, .15, .13], [wrapCenter.x + .13, wrapCenter.y -.07, .17]]
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + i / 10 * Math.PI * 1.65 * wrap
      yarn.push([wrapCenter.x + Math.cos(a) * .061 * wrap, wrapCenter.y + Math.sin(a) * .058 * wrap, wrapCenter.z + Math.cos(a) * .056 * wrap])
    }
    yarn.push([.33, .42, .16]); updateTube(working, yarn)
    drawnLoop.visible = pull > 0
    updateTube(drawnLoop, [[.19, .40, .14], [tip.x - .055, tip.y + .015, tip.z + .04], [tip.x, tip.y + .06, tip.z], [tip.x + .06, tip.y -.015, tip.z -.04], [.34, .40, .16]])
    updateTube(oldLoop, livePoints(.25, slip)); matrices()
  }
  const restore = () => pose(at > 0 ? 1 : 0, at >= 2 ? 1 : 0, at > 0 ? 1 : 0, at >= 2 ? 1 : 0)
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const quietStitch = swatch.getObjectByName('wool-stitch-3-3')!
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', label: '拿住木针，向左上穿入', anchor: [0, 0, .047], priority: 3, enabled: enabled(0) }),
    addInteractionCue(grip, { kind: 'drag', label: '向右下抽出新线圈', anchor: [0, 0, .047], priority: 3, enabled: enabled(1) }),
    addInteractionCue(quietStitch, { kind: 'tap', label: '轻点织片静看', anchor: [.046, .025, .202], priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const belongs = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(o => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const direction = () => at === 0 ? new THREE.Vector2(-.8, -.6) : new THREE.Vector2(42, 46).normalize()
  const reset = () => { dragging = moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed) restore() }
  // Stop callback-dispatched input before the pointer controller can cancel its owner.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); const hit = nearestHit(x, y); return at < 2 ? belongs(hit?.object, needle) : belongs(hit?.object, swatch) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y, dir = direction()
      along = dx * dir.x + dy * dir.y; maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along)
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(dx * dir.y - dy * dir.x)); moved ||= maxTravel > 0
      if (dragging) { const amount = THREE.MathUtils.clamp(along / (at === 0 ? 60 : 62.29), 0, 1); at === 0 ? pose(amount, 0, 0, 0) : pose(1, amount, 1, 0) }
    },
    onRelease(x, y) {
      const dx = x - down.x, dy = y - down.y, dir = direction(), end = dx * dir.x + dy * dir.y
      const valid = at < 2 ? dragging && moved && along >= 42 && end >= 42 && end <= 84 && maxTravel <= 90 && minAlong >= -8 && backtrack <= 9 && maxCross <= 18 && Math.abs(dx * dir.y - dy * dir.x) <= 18
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && belongs(nearestHit(x, y)?.object, swatch)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, at === 0 ? '向左上穿入线圈' : at === 1 ? '向右下抽出新线圈' : '轻点织片静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.inserting : COPY.pulling : at === 0 ? COPY.insert : at === 1 ? COPY.pull : at === 2 ? COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (active()) feedback.impact({ freqs: [220, 330], duration: .12, gain: .007, type: 'sine' }) })
  }
  function advance() {
    if (!inputActive() || pointer.isBusy() || motion || at === 3) return
    if (at === 2) {
      at = 3; restore(); withHostCallbacks(() => { ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [220, 293.66], duration: .18, gain: .006 }); if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) }); return
    }
    motion = { step: at, time: 0, from: at === 0 ? insertAmount : pullAmount }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera); camera.position.set(0, 4.1, 7.2 + portraitBoost(aspect, 7)); camera.lookAt(0, 1.19, 0); matrices() }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleVersion++; pointer.cancel(); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      if (motion) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .82); const t = ease(motion.time)
        if (motion.step === 0) pose(THREE.MathUtils.lerp(motion.from, 1, Math.min(t * 2, 1)), 0, ease(THREE.MathUtils.clamp((t - .35) / .65, 0, 1)), 0)
        else pose(1, THREE.MathUtils.lerp(motion.from, 1, Math.min(t * 1.7, 1)), 1, ease(THREE.MathUtils.clamp((t - .4) / .6, 0, 1)))
        if (motion.time === 1) settle()
      }
      if (active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      disposed = true; lifecycleVersion++; pointer.dispose(); stopResize(); feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
