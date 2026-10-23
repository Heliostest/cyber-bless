import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '庭前一铃', steps: '步骤', pull: '向下轻拉铃绳', settle: '轻收铃绳', greet: '轻点铃身问安',
  ready: '按住粗铃绳，向下轻拉，再松手，听一声铃响。',
  ringing: '一声暖铃，余音慢慢落下…',
  held: '轻点铃绳，让它缓缓回到安静的位置。',
  settling: '铃绳缓缓回到原处…',
  quiet: '铃已安静。轻点金色铃身，留一句无声的问安。',
  greeting: '停一停，把问安留在这一刻…',
  done: '一声铃响，一份问安。',
  pullCue: '向下轻拉铃绳', target: '往下轻拉', settleCue: '轻点铃绳收好', greetCue: '轻点铃身问安',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type Motion = { kind: 'ring' | 'settle' | 'greet'; time: number; from: number }
const smooth = (t: number) => t * t * (3 - 2 * t)

function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 32) {
  const curve = new THREE.CatmullRomCurve3(points)
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material)
}

/** A shrine's round suzu and thick bell rope; one ring, a gentle return, then a quiet greeting. */
export function createShrineSuzuBell(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  const safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, completed = false
  let checkpoint: Checkpoint = 0, motion: Motion | null = null
  let wasActive = false
  let downX = 0, downY = 0, pullAmount = 0
  let stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.pull }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const look = new THREE.Vector3(0, 1.4, 0)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'shrine-suzu-bell', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, {
    sky: 0xfff4e5, ground: 0xc4b698, key: 0xffe9ca, rim: 0xd5e7cf,
    keyIntensity: 1.1, keyPosition: [-2.7, 4.4, 3.5], rimIntensity: 0.4,
  })
  const world = new THREE.Group(); world.name = 'suzu-timber-and-bell'; scene.add(world)
  const mat = (color: number, roughness = 0.91) => new THREE.MeshStandardMaterial({ color, roughness })
  const wood = mat(0xb9936c), endWood = mat(0x997755), woodGrain = mat(0xa98560)
  const cream = mat(0xe8deba), rust = mat(0xb16f53), green = mat(0x819a76)
  const gold = mat(0xd8b468, 0.52), goldLight = mat(0xe8c887, 0.64), darkGold = mat(0x75583d)
  gold.metalness = 0.28
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, xyz: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...xyz); parent.add(mesh); return mesh
  }
  const detail = (mesh: THREE.Mesh) => { mesh.userData.toonSurface = { outline: false }; return mesh }
  const timber = new THREE.Group(); timber.name = 'suzu-original-timber-lintel'; world.add(timber)
  for (const x of [-1.02, 1.02]) {
    add(new RoundedBoxGeometry(0.18, 2.6, 0.25, 3, 0.035), wood, [x, 1.3, -0.21], timber)
    add(new RoundedBoxGeometry(0.31, 0.13, 0.4, 3, 0.04), endWood, [x, 0.065, -0.2], timber)
    add(new RoundedBoxGeometry(0.23, 0.19, 0.31, 3, 0.035), endWood, [x, 2.49, -0.2], timber)
  }
  add(new RoundedBoxGeometry(2.48, 0.23, 0.36, 4, 0.048), wood, [0, 2.66, -0.16], timber)
  add(new RoundedBoxGeometry(2.57, 0.08, 0.43, 3, 0.027), endWood, [0, 2.815, -0.16], timber)
  // Original shallow grain and inset end pins keep the lintel plain, without shrine text or seals.
  for (const y of [2.6, 2.7]) detail(add(new RoundedBoxGeometry(1.96, 0.008, 0.012, 2, 0.002), woodGrain, [0, y, 0.028], timber))
  for (const x of [-1.02, 1.02]) detail(add(new THREE.SphereGeometry(0.037, 12, 8), endWood, [x, 2.66, 0.03], timber))

  const suspension = add(new THREE.TorusGeometry(0.102, 0.024, 9, 32), darkGold, [0, 2.52, 0.07])
  suspension.scale.set(0.75, 1, 1)
  const hanging = new THREE.Group(); hanging.name = 'suzu-hanging-object'; hanging.position.set(0, 2.17, 0.11); world.add(hanging)
  const bell = new THREE.Group(); bell.name = 'suzu-round-split-bell'; hanging.add(bell)
  const eye = add(new THREE.TorusGeometry(0.078, 0.027, 9, 32), goldLight, [0, 0.31, 0], bell)
  eye.scale.set(0.85, 1, 1)
  const body = add(new THREE.SphereGeometry(0.31, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.73), gold, [0, 0, 0], bell)
  body.name = 'suzu-bell-body'
  // The two separated lower lobes reveal a dark interior and a real opening at the bell's bottom.
  const interior = add(new THREE.SphereGeometry(0.273, 24, 16), darkGold, [0, 0, 0], bell)
  interior.name = 'suzu-dark-interior'
  const lowerLobes: THREE.Mesh[] = []
  for (const phi of [0.045, Math.PI + 0.045]) {
    const lobe = add(new THREE.SphereGeometry(0.31, 24, 12, phi, Math.PI - 0.09, Math.PI * 0.725, Math.PI * 0.275), gold, [0, 0, 0], bell)
    lobe.name = 'suzu-split-lower-lobe'; lowerLobes.push(lobe)
  }
  const band = detail(add(new THREE.TorusGeometry(0.304, 0.014, 8, 48), goldLight, [0, -0.035, 0], bell))
  band.rotation.x = Math.PI / 2
  // A narrow mouth and its rounded ends are visible from the user's view, as on a round suzu.
  const mouth = detail(add(new RoundedBoxGeometry(0.36, 0.025, 0.025, 3, 0.01), darkGold, [0, -0.135, 0.275], bell))
  mouth.name = 'suzu-sound-slot'
  for (const x of [-0.17, 0.17]) {
    const hole = detail(add(new THREE.SphereGeometry(0.035, 14, 10), darkGold, [x, -0.13, 0.254], bell))
    hole.scale.set(1, 1, 0.26)
  }
  const rope = new THREE.Group(); rope.name = 'suzu-braided-rope'; hanging.add(rope)
  const ropeMeshes: THREE.Mesh[] = []
  // Three separate helices make a thick cream/rust/sage braid, rather than a wind-chime cord.
  for (const [i, material] of [cream, rust, green].entries()) {
    const points: THREE.Vector3[] = []
    for (let n = 0; n <= 100; n++) {
      const t = n / 100, angle = t * Math.PI * 2 * 5 + i * Math.PI * 2 / 3
      points.push(new THREE.Vector3(Math.cos(angle) * 0.058, -0.265 - t * 0.79, Math.sin(angle) * 0.058))
    }
    const strand = detail(tube(points, 0.047, material, 100)); strand.name = `suzu-braid-strand-${i}`
    rope.add(strand); ropeMeshes.push(strand)
  }
  const neck = add(new THREE.TorusGeometry(0.092, 0.032, 10, 32), cream, [0, -1.065, 0], rope)
  neck.rotation.x = Math.PI / 2; ropeMeshes.push(neck)
  const grip = add(new RoundedBoxGeometry(0.23, 0.28, 0.2, 4, 0.037), wood, [0, -1.205, 0.01], rope)
  grip.name = 'suzu-rope-grip'; ropeMeshes.push(grip)
  const collar = add(new THREE.TorusGeometry(0.099, 0.032, 9, 32), cream, [0, -1.375, 0], rope)
  collar.rotation.x = Math.PI / 2; ropeMeshes.push(collar)
  const tassel = new THREE.Group(); tassel.name = 'suzu-heavy-tassel'; rope.add(tassel)
  for (let i = 0; i < 28; i++) {
    const angle = i / 28 * Math.PI * 2, r = i % 3 === 0 ? 0.055 : 0.09
    const points = [new THREE.Vector3(Math.cos(angle) * r * 0.65, -1.385, Math.sin(angle) * r * 0.65),
      new THREE.Vector3(Math.cos(angle) * r * 1.6, -1.49, Math.sin(angle) * r * 1.6),
      new THREE.Vector3(Math.cos(angle) * r * 1.72, -1.67 + (i % 4) * 0.011, Math.sin(angle) * r * 1.72)]
    const fringe = detail(tube(points, 0.012, i % 9 === 0 ? green : i % 11 === 0 ? rust : cream, 12))
    tassel.add(fringe); ropeMeshes.push(fringe)
  }
  const target = add(new THREE.SphereGeometry(0.065, 12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [0, 0.24, 0.14])
  target.name = 'suzu-pull-target'
  addInteractionCue(grip, {
    kind: 'drag', label: COPY.pullCue, priority: 2, destination: target, targetLabel: COPY.target,
    enabled: () => active() && !motion && checkpoint === 0,
  })
  addInteractionCue(grip, {
    kind: 'tap', label: COPY.settleCue, priority: 2,
    enabled: () => active() && !motion && checkpoint === 1,
  })
  addInteractionCue(body, {
    kind: 'tap', label: COPY.greetCue, priority: 2,
    enabled: () => active() && !motion && checkpoint === 2,
  })

  const touchTarget = createTouchTarget(canvas, camera, scene)
  const ray = createPointerRay(canvas, camera)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const sources = () => checkpoint < 2 ? ropeMeshes : [body, ...lowerLobes]
  const pose = (amount: number, sway = 0) => {
    pullAmount = amount
    hanging.rotation.z = amount * 0.038 + sway
    rope.scale.y = 1 + amount * 0.115
    matrices()
  }
  const restorePose = () => pose(checkpoint === 1 && !reduced() ? 0.32 : 0)
  const sync = () => {
    ui.renderDots(checkpoint, 3)
    ui.actionBtn.hidden = checkpoint === 3
    ui.actionBtn.disabled = !active() || !!motion || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    setSafeText(ui.actionBtn, [COPY.pull, COPY.settle, COPY.greet, COPY.greet][checkpoint], safe)
    setSafeText(ui.hintEl, motion ? motion.kind === 'ring' ? COPY.ringing : motion.kind === 'settle' ? COPY.settling : COPY.greeting : [COPY.ready, COPY.held, COPY.quiet, COPY.done][checkpoint], safe)
  }
  const advance = (next: Checkpoint) => {
    checkpoint = next
    sync()
    ctx.onProgress?.(next)
    if (next === 3 && !completed) {
      completed = true
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    }
  }
  const finishMotion = () => {
    const kind = motion?.kind
    motion = null
    if (kind === 'settle') advance(2)
    else if (kind === 'greet') advance(3)
    restorePose(); sync()
  }
  const perform = () => {
    if (!active() || pointer.isBusy() || motion || checkpoint === 3) return
    if (checkpoint === 0) {
      motion = { kind: 'ring', time: 0, from: Math.max(pullAmount, 0.8) }
      advance(1)
      // Only the first pull rings. Settling and greeting stay quiet; repeats never score.
      feedback.impact({ freqs: [587.33, 1174.66, 1762], duration: 0.7, gain: 0.035 })
    } else motion = { kind: checkpoint === 1 ? 'settle' : 'greet', time: 0, from: pullAmount }
    if (reduced()) finishMotion()
    else sync()
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { matrices(); return !motion && checkpoint < 3 && touchTarget.hit(x, y, sources()) },
    onStart(x, y) { downX = x; downY = y; feedback.prepare() },
    onMove(x, y) {
      if (checkpoint === 0 && !reduced()) pose(THREE.MathUtils.clamp((y - downY) / 90, 0, 1), THREE.MathUtils.clamp((x - downX) / 900, -0.025, 0.025))
    },
    onRelease(x, y) {
      const dx = x - downX, dy = y - downY
      matrices()
      const valid = checkpoint === 0 ? dy >= 45 && dy > Math.abs(dx) * 1.1 : Math.hypot(dx, dy) < 12 && touchTarget.hit(x, y, sources())
      if (valid) perform()
      else restorePose()
    },
    onCancel() { if (!motion) restorePose() },
  })
  const action = () => {
    if (!active() || pointer.isBusy() || motion || checkpoint === 3) return
    feedback.prepare(); perform()
  }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0.1, 1.93, 5.65 + portraitBoost(aspect, 3.5))
    camera.lookAt(look); matrices()
  }
  sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      completed = checkpoint === 3
      restorePose(); resize(); sync()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
    },
    update(dt) {
      if (!started || disposed) return
      const isActive = active()
      if (wasActive !== isActive) { wasActive = isActive; sync() }
      if (!isActive) { pointer.cancel(); style.render(); return }
      if (motion) {
        const delta = Number.isFinite(dt) ? Math.min(0.05, Math.max(0, dt)) : 0
        const duration = motion.kind === 'settle' ? 0.65 : motion.kind === 'ring' ? 0.75 : 0.35
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / duration)
        const t = motion.time, p = smooth(t)
        if (motion.kind === 'ring') pose(THREE.MathUtils.lerp(motion.from, 0.32, p), Math.sin(t * Math.PI * 4) * (1 - t) * 0.045)
        else if (motion.kind === 'settle') pose(motion.from * (1 - p))
        if (t === 1) finishMotion()
      } else if (reduced() && !pointer.isBusy()) pose(0)
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(scene)
      Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
