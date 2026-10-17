import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

type XYZ = [number, number, number]
type XY = [number, number]
type Checkpoint = 0 | 1 | 2 | 3
const COPY = {
  title: '纸鸢乘风', fit: '拿住右边备好的纸翼，向左上方短拖，让纸面贴合竹骨。',
  fly: '拿住木线轮的横柄，向下短拖收紧牵线，让纸鸢迎风抬起。',
  quiet: '轻点纸鸢的浅色胸口，静看竹骨、纸翼与牵线在阳光里相连。',
  fitting: '纸翼沿着对称的竹骨轻轻贴合…', flying: '牵线绷起，纸鸢迎着微风抬升…',
  done: '把轻盈留给今天。',
} as const
const PREPARED = new THREE.Vector3(.43, -.23, .13)
const KNOT: XYZ = [0, -.16, .36]
const ease = (t: number) => t * t * (3 - 2 * t)
const vectors = (points: XYZ[]) => points.map(p => new THREE.Vector3(...p))

/** Original swallow paper kite; a public-craft appreciation, not a heritage tutorial. */
export function createWeifangPaperKite(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let lifecycleVersion = 0, stopResize = () => {}, fitAmount = 0, liftAmount = 0, windTime = 0
  let motion: { step: 0 | 1; time: number; from: number } | null = null
  let dragging = false, moved = false, maxTravel = 0, maxCross = 0, maxAlong = 0, minAlong = 0, backtrack = 0, along = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true), inputActive = () => active() && !notifying
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向左上贴合纸翼' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'weifang-paper-kite', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf3f4dc, ground: 0x819a5e, key: 0xffedc4, rim: 0xc8e7ec, keyPosition: [-3, 6, 5], keyIntensity: 2.2, rimIntensity: .55 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0005; lights.key.shadow.normalBias = .014
  Object.assign(lights.key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -2, near: .1, far: 15 })
  const world = new THREE.Group(); world.name = 'kite-world'; scene.add(world)
  const subject = new THREE.Group(); subject.name = 'kite-subject'; world.add(subject)
  const kite = new THREE.Group(); kite.name = 'kite-airframe'; subject.add(kite)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness })
  const bamboo = mat(0xe1b86c, .76), bambooEdge = mat(0x9a6e3e, .84), cord = mat(0xe8dfbd, .98)
  const teal = mat(0x3b8a8a, .97), red = mat(0xc45d45, .97), ochre = mat(0xe5b453, .97), cream = mat(0xf3e5bf, .98), ink = mat(0x355955, .95)
  const wood = mat(0xb47e49, .72), woodEnd = mat(0xdfb575, .8)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = subject) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const tube = (name: string, points: XYZ[], radius: number, material: THREE.Material, parent: THREE.Object3D, segments = 36) => {
    const mesh = add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vectors(points)), segments, radius, 7, false), material, [0, 0, 0], parent)
    mesh.userData.toonSurface = { outline: false, roughness: .9 }; return mesh as THREE.Mesh<THREE.TubeGeometry>
  }
  const paper = (name: string, outline: XY[], material: THREE.Material, parent: THREE.Object3D, depth = .024) => {
    const shape = new THREE.Shape(); outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }); geometry.translate(0, 0, -depth / 2)
    const mesh = add(name, geometry, material, [0, 0, 0], parent); mesh.userData.toonSurface = { outline: false, roughness: .97 }; return mesh
  }
  const wing: XY[] = [[.13, .46], [.56, .72], [1.8, .64], [1.4, .18], [1.05, -.15], [.32, -.28], [.13, -.12]]
  const prepared = new THREE.Group(); prepared.name = 'kite-prepared-wing'; kite.add(prepared)
  const left = new THREE.Group(); left.name = 'kite-left-wing'; kite.add(left)
  let rightSkin!: THREE.Mesh
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right', parent = sign < 0 ? left : prepared
    const mirror = (outline: XY[]) => outline.map(([x, y]) => [x * sign, y] as XY)
    const skin = paper(`kite-paper-${side}`, mirror(wing), teal, parent)
    if (sign > 0) rightSkin = skin
    // The broad original colour blocks follow the feathers; no borrowed motif.
    const stripe = paper(`kite-cream-feather-${side}`, mirror([[.48, .57], [1.63, .59], [1.43, .43], [.59, .40]]), cream, parent, .004); stripe.position.z = .015
    const feather = paper(`kite-red-feather-${side}`, mirror([[.38, .25], [1.29, .23], [1.05, -.08], [.40, -.20]]), red, parent, .004); feather.position.z = .015
    const tip = paper(`kite-ochre-tip-${side}`, mirror([[1.49, .57], [1.73, .60], [1.43, .26], [1.28, .24]]), ochre, parent, .004); tip.position.z = .02
    for (let i = 0; i < 3; i++) {
      const x = .52 + i * .19
      const mark = paper(`kite-feather-mark-${side}-${i}`, mirror([[x, .18], [x + .055, .18], [x + .12, -.01], [x + .07, -.04]]), cream, parent, .003); mark.position.z = .02
    }
    // Bamboo stays on the airframe while the prepared skin slides into place.
    tube(`kite-bamboo-${side}`, [[0, .43, .048], [sign * .57, .70, .048], [sign * 1.8, .64, .048]], .021, bamboo, kite)
    tube(`kite-bamboo-diagonal-${side}`, [[0, -.25, .048], [sign * .80, .13, .048], [sign * 1.8, .64, .048]], .018, bamboo, kite)
    tube(`kite-bamboo-lower-${side}`, [[sign * .13, -.12, .045], [sign * .32, -.28, .045], [sign * 1.05, -.15, .045], [sign * 1.4, .18, .045], [sign * 1.8, .64, .045]], .014, bambooEdge, kite, 48)
  }
  const body = paper('kite-body-paper', [[0, .98], [.19, .78], [.17, .30], [.29, -.14], [.58, -1.10], [0, -.73], [-.58, -1.10], [-.29, -.14], [-.17, .30], [-.19, .78]], cream, kite, .028)
  const crown = paper('kite-red-crown', [[0, .98], [.19, .78], [.17, .52], [0, .61], [-.17, .52], [-.19, .78]], red, kite, .004); crown.position.z = .018
  const tail = paper('kite-teal-tail', [[0, -.16], [.22, -.22], [.48, -.97], [0, -.65], [-.48, -.97], [-.22, -.22]], teal, kite, .004); tail.position.z = .018
  for (const sign of [-1, 1]) {
    const eye = add(`kite-eye-${sign}`, new THREE.SphereGeometry(.027, 14, 10), ink, [sign * .09, .76, .026], kite); eye.scale.z = .35
    tube(`kite-bamboo-tail-${sign}`, [[0, -.20, .050], [sign * .24, -.50, .050], [sign * .58, -1.10, .050]], .016, bamboo, kite)
  }
  tube('kite-bamboo-spine', [[0, .96, .047], [0, .25, .047], [0, -.73, .047]], .019, bamboo, kite)
  for (const [i, y] of [.69, .43, -.20, -.69].entries()) {
    tube(`kite-spine-lashing-${i}`, [[-.035, y - .025, .049], [.035, y - .012, .067], [-.035, y, .071], [.035, y + .014, .067], [-.035, y + .025, .049]], .008, red, kite, 16)
  }
  // Three physical bridle legs tie to the bamboo. Their knot carries the reel line.
  const bridle = new THREE.Group(); bridle.name = 'kite-bridle'; kite.add(bridle)
  for (const [name, tie] of [['left', [-.48, .66, .048]], ['right', [.48, .66, .048]], ['bottom', [0, -.47, .048]]] as [string, XYZ][]) {
    const tieNode = new THREE.Object3D(); tieNode.name = `kite-bridle-tie-${name}`; tieNode.position.set(...tie); bridle.add(tieNode)
    tube(`kite-bridle-${name}`, [tie, [(tie[0] + KNOT[0]) / 2, (tie[1] + KNOT[1]) / 2, .21], KNOT], .009, cord, bridle, 20)
    const fastening = add(`kite-tie-wrap-${name}`, new THREE.TorusGeometry(.028, .007, 6, 14), red, tie, bridle); fastening.rotation.x = Math.PI / 2
  }
  add('kite-bridle-knot', new THREE.SphereGeometry(.027, 12, 8), cord, KNOT, bridle)
  const reel = new THREE.Group(); reel.name = 'kite-reel'; subject.add(reel)
  const grip = add('kite-reel-grip', new RoundedBoxGeometry(.55, .16, .15, 3, .035), wood, [0, -.19, .05], reel)
  for (const [side, x] of [['left', -.29], ['right', .29]] as [string, number][]) {
    const flange = add(`kite-reel-flange-${side}`, new THREE.CylinderGeometry(.25, .25, .072, 28), woodEnd, [x, .12, 0], reel); flange.rotation.z = Math.PI / 2
    const arm = add(`kite-reel-support-${side}`, new RoundedBoxGeometry(.07, .37, .075, 3, .018), wood, [x, -.055, .035], reel); arm.rotation.x = -.1
    const peg = add(`kite-reel-peg-${side}`, new THREE.CylinderGeometry(.045, .045, .11, 16), wood, [x + Math.sign(x) * .056, .12, 0], reel); peg.rotation.z = Math.PI / 2
  }
  const spindle = add('kite-reel-spindle', new THREE.CylinderGeometry(.11, .11, .57, 24), wood, [0, .12, 0], reel); spindle.rotation.z = Math.PI / 2
  const winding: XYZ[] = []
  for (let i = 0; i <= 480; i++) { const a = i / 480 * Math.PI * 2 * 20; winding.push([-.245 + i / 480 * .49, .12 + Math.cos(a) * .132, Math.sin(a) * .132]) }
  tube('kite-reel-winding', winding, .014, cord, reel, 480)
  const exit = new THREE.Object3D(); exit.name = 'kite-line-exit'; exit.position.copy(new THREE.Vector3(...winding[winding.length - 1])); reel.add(exit)
  const line = tube('kite-flying-line', [[0, .2, 0], [0, 1, 0], KNOT], .009, cord, subject, 40)
  const lineCurve = line.geometry.parameters.path as THREE.CatmullRomCurve3
  const linePosition = line.geometry.getAttribute('position') as THREE.BufferAttribute, lineNormal = line.geometry.getAttribute('normal') as THREE.BufferAttribute
  linePosition.setUsage(THREE.DynamicDrawUsage); lineNormal.setUsage(THREE.DynamicDrawUsage)
  const linePoint = new THREE.Vector3(), radial = new THREE.Vector3()
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const updateLine = () => {
    matrices()
    const a = exit.getWorldPosition(new THREE.Vector3()), b = bridle.localToWorld(new THREE.Vector3(...KNOT))
    const mid = a.clone().lerp(b, .5); mid.y -= .14 * (1 - liftAmount) + .035; mid.z += .08
    lineCurve.points[0].copy(a); lineCurve.points[1].copy(mid); lineCurve.points[2].copy(b); lineCurve.updateArcLengths()
    const frames = lineCurve.computeFrenetFrames(40, false)
    // Reuse the tube's buffers: wind should not create and destroy GPU objects.
    for (let i = 0; i <= 40; i++) {
      lineCurve.getPointAt(i / 40, linePoint)
      for (let j = 0; j <= 7; j++) {
        const angle = j / 7 * Math.PI * 2, index = i * 8 + j
        radial.copy(frames.normals[i]).multiplyScalar(-Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle)).normalize()
        lineNormal.setXYZ(index, radial.x, radial.y, radial.z)
        linePosition.setXYZ(index, linePoint.x + radial.x * .009, linePoint.y + radial.y * .009, linePoint.z + radial.z * .009)
      }
    }
    linePosition.needsUpdate = lineNormal.needsUpdate = true; line.geometry.computeBoundingBox(); line.geometry.computeBoundingSphere()
  }
  const pose = (fit: number, lift: number, wind = 0) => {
    fitAmount = fit; liftAmount = lift
    prepared.position.copy(PREPARED).multiplyScalar(1 - fit)
    kite.position.set(-.12 + Math.sin(wind) * .015, 1.61 + lift * .76 + Math.sin(wind * 1.3) * .012, 0)
    kite.rotation.z = Math.sin(wind * .85) * .018; kite.rotation.y = Math.sin(wind * .6) * .026
    reel.position.set(.94, .53 - lift * .17, .48)
    updateLine()
  }
  const restore = () => pose(at > 0 ? 1 : 0, at >= 2 ? 1 : 0)
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(rightSkin, { kind: 'drag', label: '向左上贴合纸翼', anchor: [1.05, .34, .012], priority: 3, enabled: enabled(0) }),
    addInteractionCue(grip, { kind: 'drag', label: '向下轻拉木线轮', anchor: [0, 0, .075], priority: 3, enabled: enabled(1) }),
    addInteractionCue(body, { kind: 'tap', label: '轻点纸鸢静看', anchor: [.08, .22, .014], priority: 3, enabled: enabled(2) }),
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
  const direction = () => at === 0 ? new THREE.Vector2(-.8, -.6) : new THREE.Vector2(0, 1)
  const reset = () => { dragging = moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0; if (!motion && !disposed && at < 2) restore() }
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) { if (motion || at === 3) return false; matrices(); const hit = nearestHit(x, y); return belongs(hit?.object, at === 0 ? prepared : at === 1 ? reel : body) },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; moved = false; maxTravel = maxCross = maxAlong = minAlong = backtrack = along = 0
    },
    onMove(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const dx = x - down.x, dy = y - down.y, dir = direction()
      along = dx * dir.x + dy * dir.y; maxAlong = Math.max(maxAlong, along); minAlong = Math.min(minAlong, along); backtrack = Math.max(backtrack, maxAlong - along)
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(dx * dir.y - dy * dir.x)); moved ||= maxTravel > 0
      if (dragging) { const amount = THREE.MathUtils.clamp(along / 60, 0, 1); at === 0 ? pose(amount, 0) : pose(1, amount) }
    },
    onRelease(x, y) {
      const dx = x - down.x, dy = y - down.y, dir = direction(), end = dx * dir.x + dy * dir.y
      const valid = at < 2 ? dragging && moved && along >= 42 && end >= 42 && end <= 84 && maxTravel <= 90 && minAlong >= -8 && backtrack <= 9 && maxCross <= 18 && Math.abs(dx * dir.y - dy * dir.x) <= 18
        : maxTravel < 12 && Math.hypot(dx, dy) < 12 && belongs(nearestHit(x, y)?.object, body)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    setSafeText(ui.actionBtn, at === 0 ? '向左上贴合纸翼' : at === 1 ? '向下轻拉木线轮' : '轻点纸鸢静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.fitting : COPY.flying : at === 0 ? COPY.fit : at === 1 ? COPY.fly : at === 2 ? COPY.quiet : COPY.done, safe)
  }
  function withHostCallbacks(work: () => void) { notifying = true; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() { const version = lifecycleVersion; withHostCallbacks(() => feedback.prepare()); return inputActive() && version === lifecycleVersion }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (active()) feedback.impact({ freqs: [293.66, 440], duration: .12, gain: .006, type: 'sine' }) })
  }
  function advance() {
    if (!inputActive() || pointer.isBusy() || motion || at === 3) return
    if (at === 2) {
      at = 3; restore(); withHostCallbacks(() => { ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [293.66, 392], duration: .18, gain: .006 }); if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) }); return
    }
    motion = { step: at, time: 0, from: at === 0 ? fitAmount : liftAmount }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; advance() }
  const blur = () => { focused = false; lifecycleVersion++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), distance = Math.max(5.7, 6.35 / aspect)
    camera.position.set(0, 1.72 + distance * .105, distance); camera.lookAt(0, 1.72, 0); matrices()
  }
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
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (motion) {
        motion.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, motion.time + delta / .82)
        const amount = THREE.MathUtils.lerp(motion.from, 1, ease(motion.time)); motion.step === 0 ? pose(amount, 0) : pose(1, amount)
        if (motion.time === 1) settle()
      } else if (at >= 2 && !pointer.isBusy()) {
        if (ctx.isReducedMotion?.()) { if (kite.rotation.z !== 0 || kite.rotation.y !== 0) restore() }
        else { windTime += delta; pose(1, 1, windTime) }
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
