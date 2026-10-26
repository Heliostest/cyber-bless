import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '巨偶待游', assemble: '把桌前的小花章别在衣襟上，为节庆巨偶添一枚自己的装饰。',
  suspend: '握住底座前的木把，将完整巨偶移到右侧圆台，站稳后静静欣赏。',
  rest: '轻点底座静看。把街头节庆的热闹，收进一件安静的小手作。',
  moving: '小花章与巨偶缓缓就位…', done: '准备妥当，留一刻欣赏手作的耐心。',
} as const
const HOME = new THREE.Vector3(-.73, .72, 0), REST = new THREE.Vector3(.79, .86, 0)
const ROSETTE_HOME = new THREE.Vector3(-1.27, .87, .65), JOIN = new THREE.Vector3(-.14, 1.29, .284)
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original dressed festival miniature; a contemporary workshop pause. */
export function createCatalanFestivalGiant(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '别上小花章' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'catalan-festival-giant', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xffefd8, ground: 0xb3b7a2, key: 0xffe7c0, rim: 0xd8e7d8, keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 4, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .022
  const world = new THREE.Group(); world.name = 'giant-workbench'; scene.add(world)
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .85 })
  const clay = material(0xbc7057), ochre = material(0xd6ac60), oak = material(0xb9976a), walnut = material(0x785740), cream = material(0xf0dfb3), sage = material(0x608e89), skin = material(0xe3b895), hair = material(0x855840), ink = material(0x4b392b)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.025, h / 3, d / 3)), mat, xyz, name, parent)
  const ball = (r: number, xyz: [number, number, number], mat: THREE.Material, parent: THREE.Object3D, name = '') => add(new THREE.SphereGeometry(r, 24, 18), mat, xyz, name, parent)
  const stem = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, parent: THREE.Object3D) => {
    const mesh = add(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 16), mat, [0, 0, 0], '', parent)
    mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return mesh
  }
  const disc = (r: number, h: number, xyz: [number, number, number], mat: THREE.Material, name = '', parent: THREE.Object3D = world) => add(new THREE.CylinderGeometry(r, r, h, 48), mat, xyz, name, parent)
  addCraftTable(world, { name: 'giant-table', topName: 'giant-table', width: 3.5, depth: 1.85, surfaceY: .72, thickness: .12, center: [0,0], support: 'trestle', finish: 'honey' })
  const shadow = add(new THREE.PlaneGeometry(4, 2.6), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  disc(.59, .12, [.79, .78, 0], walnut, 'giant-plinth')
  const peg = disc(.53, .02, [.79, .85, 0], cream, 'giant-display-seat')
  const figure = new THREE.Group(); figure.name = 'giant-figure'; world.add(figure)
  disc(.49, .12, [0, .06, 0], oak, 'giant-base', figure)
  const lift = box(.28, .115, .09, walnut, [0, .074, .485], 'giant-base-grip', figure)
  // A fluted textile skirt conceals the miniature timber carrier frame.
  const vertices: number[] = [], indices: number[] = []
  const radial = 64, rows = 18
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= radial; i++) {
    const t = j / rows, angle = i / radial * Math.PI * 2
    const radius = .45 * (1 - t) + .205 * t + .018 * Math.cos(angle * 12) * (1 - t)
    vertices.push(Math.sin(angle) * radius, .125 + t * 1.015, Math.cos(angle) * radius)
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < radial; i++) { const a = j * (radial + 1) + i, b = a + radial + 1; indices.push(a, a + 1, b, a + 1, b + 1, b) }
  const skirtGeo = new THREE.BufferGeometry(); skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); skirtGeo.setIndex(indices); skirtGeo.computeVertexNormals()
  add(skirtGeo, clay, [0, 0, 0], 'giant-fluted-skirt', figure)
  const hemPoints = Array.from({ length: 128 }, (_, i) => {
    const angle = i / 128 * Math.PI * 2, t = (.21 - .125) / 1.015
    const r = .45 * (1 - t) + .205 * t + .018 * Math.cos(angle * 12) * (1 - t) + .005
    return new THREE.Vector3(Math.sin(angle) * r, .21, Math.cos(angle) * r)
  })
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPoints, true), 256, .012, 8, true), cream, [0, 0, 0], 'giant-hem', figure)
  add(new THREE.CylinderGeometry(.275, .205, .40, 40), sage, [0, 1.32, 0], 'giant-bodice', figure)
  disc(.225, .075, [0, 1.135, 0], ochre, 'giant-waistband', figure)
  for (const x of [-1, 1]) {
    stem(new THREE.Vector3(x * .235, 1.40, 0), new THREE.Vector3(x * .40, 1.04, .10), .104, sage, figure)
    ball(.105, [x * .40, 1.035, .10], cream, figure).scale.y = .45
    ball(.087, [x * .40, .947, .12], skin, figure).scale.y = 1.25
  }
  disc(.105, .20, [0, 1.55, 0], skin, '', figure)
  const head = ball(.255, [0, 1.82, 0], skin, figure, 'giant-face'); head.scale.set(.88, 1.10, .85)
  const hairCap = add(new THREE.SphereGeometry(.261, 32, 20, 0, Math.PI * 2, 0, 1.15), hair, [0, 1.82, 0], 'giant-hair', figure); hairCap.scale.set(.92, 1.10, .90)
  for (const x of [-1, 1]) { const lock = ball(.086, [x * .21, 1.76, -.02], hair, figure); lock.scale.set(.7, 1.5, .95); ball(.036, [x * .087, 1.86, .205], cream, figure); ball(.018, [x * .087, 1.86, .235], ink, figure) }
  ball(.045, [0, 1.79, .23], skin, figure).scale.set(.65, 1.15, .8)
  const smile = add(new THREE.TorusGeometry(.063, .009, 8, 20, Math.PI * .75), walnut, [0, 1.754, .216], '', figure); smile.rotation.z = Math.PI * 1.13
  disc(.32, .037, [0, 2.061, 0], ochre, 'giant-hat-brim', figure)
  add(new THREE.CylinderGeometry(.185, .24, .14, 40), ochre, [0, 2.142, 0], 'giant-hat', figure)
  disc(.244, .035, [0, 2.092, 0], sage, '', figure)
  const join = ball(.075, [-.14, 1.29, .284], cream, figure, 'giant-lapel')
  for (const y of [1.22, 1.36, 1.46]) ball(.018, [.07, y, .27], ochre, figure)
  const rosette = new THREE.Group(); rosette.name = 'giant-rosette'; world.add(rosette)
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, p = ball(.044, [Math.sin(a) * .078, Math.cos(a) * .078, 0], i % 2 ? cream : ochre, rosette)
    p.scale.set(.65, 1.05, .45); p.rotation.z = -a
  }
  const grip = disc(.064, .046, [0, 0, .018], clay, 'giant-rosette-grip', rosette); grip.rotation.x = Math.PI / 2
  const pad = box(.46, .03, .43, sage, [-1.27, .735, .65], 'giant-rosette-pad')
  // A few actual workshop supplies support the context without competing for taps.
  disc(.115, .09, [.12, .765, .57], cream)
  box(.24, .008, .18, clay, [.24, .725, .25])
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    figure.position.copy(checkpoint >= 2 ? REST : HOME); figure.rotation.set(0, 0, 0)
    if (checkpoint >= 1) { figure.add(rosette); rosette.position.copy(JOIN) } else { world.add(rosette); rosette.position.copy(ROSETTE_HOME) }
    pad.visible = true; matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(grip, { kind: 'drag', label: '别上小花章', priority: 3, enabled: enabled(0), destination: join, targetLabel: '衣襟上的小扣' })
  addInteractionCue(lift, { kind: 'drag', label: '移到圆形展台', priority: 3, enabled: enabled(1), destination: peg, targetLabel: '右侧圆台' })
  addInteractionCue(lift, { kind: 'tap', label: '轻点底座静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? rosette : figure
  const touchTarget = createTouchTarget(canvas, camera, scene)
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => touchTarget.hit(x, y, target, { ignore: held })
  const automaticReady = (x: number, y: number) => {
    if (checkpoint >= 2 || !insideCanvas(canvas, x, y)) return false
    const contact = projectTouchPoint(canvas, camera, checkpoint === 0 ? grip : lift, [0,0,0])
    return !!contact && !touchTarget.occluded(x,y,checkpoint === 0 ? join : peg,{ignore:moving()}) && touchTarget.hit(contact.x, contact.y, checkpoint === 0 ? join : peg, { ignore: moving() })
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return hitsVisible(x, y, checkpoint === 0 ? grip : lift) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare(); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), object.position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) { maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices(); if (dragging && automaticReady(x, y) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && automaticReady(x, y) : maxTravel < 12 && hitsVisible(x, y, lift)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '别上小花章' : checkpoint === 1 ? '移到圆形展台' : '轻点底座静看', safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.assemble : checkpoint === 1 ? COPY.suspend : checkpoint === 2 ? COPY.rest : COPY.done, safe)
  }
  function settle() { if (!active() || !transition) return; checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync(); ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .013 }) }
  function advance(placed = false) {
    if (!active() || (pointer.isBusy() && !placed) || transition || checkpoint === 3) return
    if (checkpoint === 2) { checkpoint = 3; restore(); sync(); ctx.onProgress?.(3); feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .013 }); overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.8 + boost * .4, 6.1 + boost); camera.lookAt(0, 1.58, 0); matrices() }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        const dest = transition.step === 0 ? figure.localToWorld(JOIN.clone()) : REST
        moving().position.lerpVectors(transition.from, dest, t)
        if (!ctx.isReducedMotion?.()) moving().position.y += Math.sin(t * Math.PI) * .15
        if (transition.time === 1) settle()
      }
      style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
