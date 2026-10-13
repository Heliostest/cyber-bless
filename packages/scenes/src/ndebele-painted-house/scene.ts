import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '彩墙寄家', assemble: '把桌前的彩色小板放到左侧墙面的留白处，完成自己的几何配色。',
  display: '握住房屋底座前的木把，把彩绘小屋移到右侧展台。',
  rest: '轻点底座，静看色彩与家屋的轮廓。向南非恩德贝莱家屋彩绘的创作者致意。',
  moving: '小板与小屋缓缓就位…', done: '留一刻欣赏家屋艺术与手作的耐心。（当代工艺致敬练习结束）',
} as const
const HOME = new THREE.Vector3(-.85, .72, 0), REST = new THREE.Vector3(.95, .88, 0)
const PANEL_HOME = new THREE.Vector3(-1.5, .96, .88), JOIN = new THREE.Vector3(-.44, .65, .495)
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** An original workshop miniature, appreciating public domestic wall art. */
export function createNdebelePaintedHouse(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '放好彩色小板' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'ndebele-painted-house', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff0dc, ground: 0xb8b8a0, key: 0xffe7c7, rim: 0xdce7da, keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .022
  const world = new THREE.Group(); world.name = 'house-workbench'; scene.add(world)
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .9 })
  const cream = material(0xf0e3c6), pale = material(0xdbcba8), teal = material(0x428a88), ochre = material(0xd8ac57), terracotta = material(0xbd7057), ink = material(0x51483b), oak = material(0xbda17a), walnut = material(0x876d50), dark = material(0x494038)
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, xyz: [number, number, number], name: string, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, xyz: [number, number, number], name: string, parent: THREE.Object3D = world, radius = .018) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, h / 3, d / 3)), mat, xyz, name, parent)
  box(4, .12, 2.05, oak, [0, .66, 0], 'house-table')
  for (const x of [-1.7, 1.7]) for (const z of [-.73, .73]) box(.14, .6, .14, walnut, [x, .3, z], 'house-table-leg')
  const shadow = add(new THREE.PlaneGeometry(4.7, 2.8), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0], 'house-contact-shadow'); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box(1.76, .14, 1.27, walnut, [.95, .79, 0], 'house-plinth')
  const seat = box(1.70, .02, 1.20, cream, [.95, .87, 0], 'house-display-seat')
  const house = new THREE.Group(); house.name = 'house-miniature'; world.add(house)
  box(1.63, .12, 1.10, oak, [0, .06, 0], 'house-base', house)
  const grip = box(.38, .115, .14, walnut, [0, .065, .595], 'house-base-grip', house)
  // Four deep walls, a real doorway recess and a modest flat roof form the model.
  box(.16, .92, .83, cream, [-.67, .58, -.005], 'house-left-wall', house)
  box(.16, .92, .83, cream, [.67, .58, -.005], 'house-right-wall', house)
  box(1.20, .92, .13, cream, [0, .58, -.355], 'house-back-wall', house)
  box(.58, .92, .15, cream, [-.46, .58, .365], 'house-facade-left', house)
  box(.32, .92, .15, cream, [.59, .58, .365], 'house-facade-right', house)
  box(.62, .31, .15, cream, [.14, .885, .365], 'house-door-lintel', house)
  box(.55, .63, .045, dark, [.10, .435, .165], 'house-door-recess', house)
  box(.53, .028, .28, pale, [.10, .135, .295], 'house-doorstep', house)
  box(1.60, .105, .98, cream, [0, 1.0925, -.005], 'house-roof', house)
  box(1.54, .035, .92, terracotta, [0, 1.1625, -.005], 'house-roof-cap', house)
  // Original plain fields and thin framing; no tracing or clan/artist motifs.
  const field = (x: number, y: number, w: number, h: number, color: THREE.Material, name: string) => {
    box(w + .025, h + .025, .008, ink, [x, y, .445], name + '-frame', house, .002)
    box(w, h, .009, color, [x, y, .454], name, house, .002)
  }
  field(-.44, .29, .40, .13, terracotta, 'house-lower-clay-field')
  field(.59, .63, .20, .40, ochre, 'house-right-ochre-field')
  field(.59, .29, .20, .13, teal, 'house-right-teal-field')
  field(.08, .94, .77, .075, teal, 'house-lintel-teal-field')
  box(.44, .48, .008, ink, [-.44, .65, .445], 'house-slot-frame', house, .002)
  const slot = box(.405, .445, .02, pale, [-.44, .65, .455], 'house-facade-slot', house, .002)
  const panel = new THREE.Group(); panel.name = 'house-paint-panel'; world.add(panel)
  box(.39, .43, .02, ink, [0, 0, -.02], 'house-panel-frame', panel, .002)
  const colorPanel = box(.36, .40, .035, teal, [0, 0, .0025], 'house-color-panel', panel, .002)
  box(.33, .055, .008, ochre, [0, .152, .023], 'house-panel-ochre-band', panel, .002)
  box(.11, .12, .008, terracotta, [.105, -.12, .023], 'house-panel-clay-corner', panel, .002)
  box(.56, .025, .29, pale, [-1.5, .7325, .88], 'house-panel-pad')
  // Small, closed color pots remain workshop props, away from the gesture anchors.
  for (const [x, color] of [[-.24, teal], [.02, ochre], [.28, terracotta]] as const) {
    add(new THREE.CylinderGeometry(.085, .085, .09, 24), cream, [x, .765, .83], 'house-paint-pot')
    add(new THREE.CylinderGeometry(.071, .071, .013, 24), color, [x, .8165, .83], 'house-paint-pot-lid')
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => {
    house.position.copy(checkpoint >= 2 ? REST : HOME); house.rotation.set(0, 0, 0)
    if (checkpoint >= 1) { house.add(panel); panel.position.copy(JOIN) } else { world.add(panel); panel.position.copy(PANEL_HOME) }
    panel.rotation.set(0, 0, 0); matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(colorPanel, { kind: 'drag', label: '放好彩色小板', priority: 3, enabled: enabled(0), destination: slot, targetLabel: '墙面留白处' })
  addInteractionCue(grip, { kind: 'drag', label: '移到右侧展台', priority: 3, enabled: enabled(1), destination: seat, targetLabel: '小屋展台' })
  addInteractionCue(grip, { kind: 'tap', label: '轻点底座静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? panel : house
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.every(mat => mat.transparent && mat.opacity < .5)) return
      for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === held) return
      meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object === target
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return hitsVisible(x, y, checkpoint === 0 ? colorPanel : grip) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare(); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), object.position); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) { maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices() },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && maxTravel >= 8 && hitsVisible(x, y, checkpoint === 0 ? slot : seat, moving()) : maxTravel < 12 && hitsVisible(x, y, grip)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '放好彩色小板' : checkpoint === 1 ? '移到右侧展台' : '轻点底座静看', safe)
    setSafeText(ui.hintEl, transition ? COPY.moving : checkpoint === 0 ? COPY.assemble : checkpoint === 1 ? COPY.display : checkpoint === 2 ? COPY.rest : COPY.done, safe)
  }
  function settle() {
    if (!active() || !transition) return
    checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync()
    ctx.onProgress?.(checkpoint); if (!active()) return; feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .013 })
  }
  function advance() {
    if (!active() || pointer.isBusy() || transition || checkpoint === 3) return
    if (checkpoint === 2) {
      checkpoint = 3; restore(); sync(); ctx.onProgress?.(3)
      if (!active()) return
      feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .013 })
      if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return
    }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.2 + boost * .4, 6.5 + boost); camera.lookAt(0, 1.24, 0); matrices() }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        const dest = transition.step === 0 ? house.localToWorld(JOIN.clone()) : REST
        moving().position.lerpVectors(transition.from, dest, t)
        if (!ctx.isReducedMotion?.()) moving().position.y += Math.sin(t * Math.PI) * .12
        if (transition.time === 1) settle()
      }
      if (active()) style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
