import { placementHit } from '../placement-hit'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '木马安放', polish: '拿起桌前的软布，轻拭木马侧面的彩鞍。',
  place: '轻托木马彩鞍，把它安放到右侧木座。四只木蹄稳稳落下。',
  rest: '轻点木马，静看彩鞍与木纹。',
  polishing: '软布拂过木纹，彩鞍露出温润的光泽…', placing: '木马缓缓落上木座…',
  done: '让手作陪伴平常的一天。',
} as const
const HORSE_HOME = new THREE.Vector3(-.68, .72, -.1), HORSE_REST = new THREE.Vector3(.72, .842, -.1)
const CLOTH_HOME = new THREE.Vector3(-1.12, .746, .58)
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

/** Original carving and paint, inspired by a public craft tradition rather than a magical rite. */
export function createDalarnaWoodenHorse(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let dragging = false, maxTravel = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '轻拭木马' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'dalarna-wooden-horse', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff0d8, ground: 0xb3b7a2, key: 0xffdfb8, rim: 0xd8e7d8, keyPosition: [-3, 5, 3], keyIntensity: 1.25, rimIntensity: .4 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .022
  const world = new THREE.Group(); world.name = 'horse-workbench'; scene.add(world)
  const mat = (color: number, roughness = .86) => new THREE.MeshStandardMaterial({ color, roughness })
  const red = mat(0xbd5e4d), darkRed = mat(0x994c43), cream = mat(0xeee2bd), blue = mat(0x809c9c), gold = mat(0xc6a467)
  const oak = mat(0xc3a074), darkOak = mat(0xa68463), clothMat = mat(0x8ca797), ink = mat(0x5e594d)
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, material: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.035, h / 3, d / 3)), material, xyz, name, parent)
  const tube = (points: number[][], radius: number, material: THREE.Material, parent: THREE.Object3D = world) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 24, radius, 7, false), material, [0, 0, 0], '', parent)
  addCraftTable(world, { name: 'horse-table', topName: 'horse-table', width: 3.25, depth: 1.7, surfaceY: .72, thickness: .12, center: [0,0], support: 'arched', finish: 'birch' })
  const shadow = add(new THREE.PlaneGeometry(3.8, 2.5), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  box(1.45, .10, .90, darkOak, [.72, .77, -.1], 'horse-plinth')
  const plinth = box(1.39, .022, .84, cream, [.72, .831, -.1], 'horse-plinth-inset')
  // Four distinct legs and an extruded carved silhouette retain a wooden toy's broad planes.
  const horse = new THREE.Group(); horse.name = 'dalarna-horse'; world.add(horse)
  const profile = new THREE.Shape()
  profile.moveTo(-.52, .48); profile.bezierCurveTo(-.69, .63, -.64, .94, -.40, 1.00)
  profile.quadraticCurveTo(-.12, 1.04, .17, 1.00); profile.bezierCurveTo(.23, 1.16, .21, 1.40, .34, 1.54)
  profile.lineTo(.46, 1.42); profile.lineTo(.56, 1.52); profile.lineTo(.59, 1.33)
  profile.bezierCurveTo(.71, 1.29, .91, 1.20, .88, 1.08); profile.quadraticCurveTo(.82, 1.01, .71, 1.09)
  profile.lineTo(.52, 1.15); profile.bezierCurveTo(.48, .98, .58, .68, .46, .49)
  profile.quadraticCurveTo(.03, .40, -.52, .48)
  const bodyGeo = new THREE.ExtrudeGeometry(profile, { depth: .36, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .034, bevelThickness: .034, curveSegments: 12 }); bodyGeo.translate(0, 0, -.18)
  add(bodyGeo, red, [0, 0, 0], 'horse-carved-body', horse)
  let i = 0
  for (const x of [-.40, .36]) for (const z of [-.145, .145]) {
    add(new THREE.CylinderGeometry(.10, .13, .55, 8), red, [x, .275, z], `horse-leg-${i++}`, horse)
    box(.19, .07, .19, darkRed, [x, .05, z], '', horse)
  }
  const saddle = box(.46, .28, .022, cream, [-.12, .83, .229], 'horse-painted-saddle', horse)
  box(.46, .28, .022, cream, [-.12, .83, -.229], '', horse)
  // Simple invented leaf strokes avoid copying a maker's decorative pattern.
  for (const z of [-.247, .247]) {
    for (const x of [-.27, .03]) {
      const leaf = add(new THREE.SphereGeometry(1, 14, 10), blue, [x, .87, z], '', horse); leaf.scale.set(.035, .07, .008); leaf.rotation.z = x < 0 ? -.35 : .35
    }
    tube([[-.27, .75, z], [-.12, .73, z], [.03, .75, z]], .012, gold, horse)
    const eye = add(new THREE.SphereGeometry(.017, 12, 8), ink, [.59, 1.27, z > 0 ? .218 : -.218], '', horse); eye.scale.z = .4
  }
  tube([[.23, 1.05, -.21], [.29, 1.27, -.21], [.38, 1.39, -.21]], .035, darkRed, horse)
  tube([[-.56, .85, 0], [-.73, .74, 0], [-.68, .56, 0]], .045, darkRed, horse)
  tube([[.50, 1.18, .218], [.64, 1.14, .218], [.78, 1.09, .218]], .012, gold, horse)
  const cloth = box(.34, .036, .26, clothMat, [0, 0, 0], 'horse-polishing-cloth')
  for (const z of [-.085, .085]) box(.28, .006, .008, cream, [0, .020, z], '', cloth)
  cloth.rotation.y = -.12
  // Small bench accessories are ordinary workshop objects, not ritual apparatus.
  box(.44, .038, .22, darkOak, [-1.06, .741, -.63])
  const brush = add(new THREE.CylinderGeometry(.023, .023, .40, 12), gold, [-1.06, .79, -.63]); brush.rotation.z = Math.PI / 2
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = () => { horse.position.copy(checkpoint >= 2 ? HORSE_REST : HORSE_HOME); cloth.position.copy(CLOTH_HOME); cream.roughness = checkpoint >= 1 ? .60 : .9; matrices() }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  const seatGripGoal = () => {
    matrices()
    const goal = plinth.getWorldPosition(new THREE.Vector3()).project(camera), grip = saddle.getWorldPosition(new THREE.Vector3()).project(camera), foot = horse.getWorldPosition(new THREE.Vector3()).project(camera)
    goal.x += grip.x - foot.x; goal.y += grip.y - foot.y
    return goal.unproject(camera)
  }
  addInteractionCue(cloth, { kind: 'drag', label: '轻拭木马彩鞍', priority: 3, enabled: enabled(0), destination: saddle, targetLabel: '彩鞍侧面' })
  addInteractionCue(saddle, { kind: 'drag', label: '安放木马', priority: 3, enabled: enabled(1), destination: seatGripGoal, targetLabel: '四蹄落在右侧木座' })
  addInteractionCue(saddle, { kind: 'tap', label: '轻点木马静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const moving = () => checkpoint === 0 ? cloth : horse
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      if (!(object as THREE.Mesh).isMesh) return
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === held) return
      meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object === target
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore() }
  const placementReady = (x: number, y: number) => checkpoint < 2 && maxTravel > 0
    && placementHit(canvas, camera, checkpoint === 0 ? cloth : horse, x, y, (px, py) => hitsVisible(px, py, checkpoint === 0 ? saddle : plinth, moving()))
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); return hitsVisible(x, y, checkpoint === 0 ? cloth : saddle) },
    onStart(x, y) { down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare(); const object = moving(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), (checkpoint === 0 ? cloth : saddle).getWorldPosition(new THREE.Vector3())); if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(object.position).sub(point) },
    onMove(x, y) { maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) moving().position.copy(point).add(offset); matrices();
      if (dragging && placementReady(x, y) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && placementReady(x, y) : maxTravel < 12 && hitsVisible(x, y, saddle)
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '轻拭木马' : checkpoint === 1 ? '安放木马' : '轻点木马静看', safe)
    setSafeText(ui.hintEl, transition ? transition.step === 0 ? COPY.polishing : COPY.placing : checkpoint === 0 ? COPY.polish : checkpoint === 1 ? COPY.place : checkpoint === 2 ? COPY.rest : COPY.done, safe)
  }
  function settle() { if (!active() || !transition) return; checkpoint = (transition.step + 1) as Checkpoint; transition = null; restore(); sync(); ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [392, 523.25], duration: .17, gain: .013 }) }
  function advance(arrived = false) {
    if (!active() || (pointer.isBusy() && !arrived) || transition || checkpoint === 3) return
    if (checkpoint === 2) { checkpoint = 3; restore(); sync(); ctx.onProgress?.(3); feedback.impact({ freqs: [392, 587.33], duration: .22, gain: .013 }); overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return }
    transition = { step: checkpoint, time: 0, from: moving().position.clone() }; sync(); if (ctx.isReducedMotion?.()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 8); camera.position.set(0, 3.3 + boost * .4, 5.6 + boost); camera.lookAt(0, 1.0, 0); matrices() }
  restore(); sync()
  return {
    start() { if (started || disposed) return; started = true; const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint; restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() }); ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      if (transition) {
        const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0; transition.time = ctx.isReducedMotion?.() ? 1 : Math.min(1, transition.time + delta / .75); const t = ease(transition.time)
        if (transition.step === 0) {
          const surface = saddle.getWorldPosition(new THREE.Vector3()); surface.z += .10
          if (t < .65) { cloth.position.lerpVectors(transition.from, surface, Math.min(1, t / .28)); cloth.position.x += Math.sin(t / .65 * Math.PI * 2) * .08 }
          else cloth.position.lerpVectors(surface, CLOTH_HOME, (t - .65) / .35)
        } else { horse.position.lerpVectors(transition.from, HORSE_REST, t); if (!ctx.isReducedMotion?.()) horse.position.y += Math.sin(t * Math.PI) * .22 }
        if (transition.time === 1) settle()
      }
      style.render()
    },
    dispose() { if (disposed) return; disposed = true; pointer.dispose(); stopResize(); feedback.dispose(); ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage') },
  }
}
