import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { bakeCreviceAO } from '@wbr/scene-runtime/prop-geometry'
import { addContactShadow } from '../cozy-furniture'
import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { graphemeLength } from '@wbr/i18n'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createPosePlacement } from '../pose-placement'
import { addStageLights, CEL_STYLE, createLampHalo, createPointerRay, createSceneFeedback,
  createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '留一盏烛光',
  hints: ['把前面的蜡烛拖到烛架空位。', '轻点自己的灯芯，让烛光亮起。',
    '想着惦念的人，静看这一点光。', '烛光留在这里，陪这份心意静静亮着。'],
  actions: ['安放蜡烛', '点亮灯芯', '静看烛光'],
  returning: '静看这一点光，再轻点自己的蜡烛，把想念留在这里。',
}

export function createVotiveCandleCatholic(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx
  const safe = shared.assertSafeCopy
  ;[COPY.title, COPY.returning, ...COPY.hints, ...COPY.actions].forEach(safe)
  let step = Math.max(0, Math.min(3, Math.floor(ctx.initialProgress ?? 0)))
  let started = false, disposed = false, clock = 0, dragging = false
  const active = () => started && !disposed && (ctx.isActive?.() ?? true)
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 60)

  const projectedGuide = (goal: THREE.Vector3, grip: THREE.Vector3, contact: THREE.Vector3) => {
    camera.updateMatrixWorld(true)
    const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera)
    g.x+=a.x-b.x;g.y+=a.y-b.y
    return g.unproject(camera)
  }
  const home = new THREE.Vector3(0, 1.55, 4.8), look = new THREE.Vector3(0, 1.05, 0)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'votive-candle-catholic', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xe4e7ec, ground: 0xa8acaa, key: 0xffe4b3, rim: 0xd8e1ee })
  const world = new THREE.Group(); scene.add(world)
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .92 })
  const stone = material(0xc6b6a0), stoneFace = new THREE.MeshStandardMaterial({ color: 0xe0cdb2, roughness: .92, vertexColors: true }), wax = material(0xffe9b4), waxBody = new THREE.MeshStandardMaterial({ color: 0xffe9b4, roughness: .92, vertexColors: true }), steel = material(0x666f69)
  applyCraftSurface(steel, { kind: 'metal', strength: .45 })
  applyCraftSurface(stone, { kind: 'stone', strength: .4 })
  applyCraftSurface(stoneFace, { kind: 'stone', strength: .4 })

  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, xyz: number[], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(xyz[0], xyz[1], xyz[2]); parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, xyz: number[]) =>
    add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.04, h / 3)), mat, xyz)
  const baseY = Math.min(getEnvironmentSurfaceY('votive-candle-catholic'), -.04)
  const baseH = .15 - baseY
  box(2.5, baseH, 1.6, stone, [0, baseY + baseH / 2, .1])
  addContactShadow(world, {
    name: 'votive-base-contact-ao',
    width: 2.74,
    depth: 1.84,
    y: baseY + 0.0018,
    center: [0, 0.1],
    shape: 'rounded-rect',
    opacity: 0.28,
  })
  // An original stone arcade: no sacred image or replicated holy site.
  const arch = new THREE.Shape()
  arch.moveTo(-1.2, .15); arch.lineTo(1.2, .15); arch.lineTo(1.2, 2.4)
  arch.quadraticCurveTo(0, 2.65, -1.2, 2.4); arch.closePath()
  const opening = new THREE.Path()
  opening.moveTo(-.74, .23); opening.lineTo(-.74, 1.63)
  opening.bezierCurveTo(-.74, 2.2, .74, 2.2, .74, 1.63); opening.lineTo(.74, .23); opening.closePath()
  arch.holes.push(opening)
  const archGeo = bakeCreviceAO(
    new THREE.ExtrudeGeometry(arch, { depth: .12, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 3, steps: 1 }),
    { groundY: 0.15, groundRange: 0.36, cavityCenter: [0, 0.06], cavityRadius: 0.80, cavityTopY: 2.15, strength: 0.38, tint: 0x4b3d35 },
  )
  add(archGeo, stoneFace, [0, 0, -.73])
  for (const x of [-1.06, 1.06]) for (let i = 0; i < 6; i++) box(.32, .018, .23, stone, [x, .3 + i * .32, -.62])
  // Stepped two-tier rack: lower tier stepped forward so its flames rise in open air clear of the upper shelf.
  box(1.65, .065, .34, steel, [0, .37, .34]).name = 'votive-lower-shelf'
  box(1.65, .065, .48, steel, [0, .7575, -.06]).name = 'votive-upper-shelf'
  for (const x of [-.79, .79]) {
    box(.08, .64, .08, steel, [x, .47, -.06])
    box(.08, .25, .08, steel, [x, .275, .34])
    box(.06, .06, .46, steel, [x, .37, .14])
  }
  // Only the thin rim and shallow wax pool scatter; the candle body and drips stay matte.
  const waxTop = createRitualMaterial({ color: 0xffe9b4, roughness: .92 }, { kind: 'wax', strength: .14, fiber: false })
  const waxPool = createRitualMaterial({ color: 0xddc695, roughness: .92 }, { kind: 'wax', strength: .10, fiber: false })
  const halos: ReturnType<typeof createLampHalo>[] = []
  // HDR flame radiance tuned for AgX + Night Mipmap Bloom (threshold ~0.78).
  const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.55, 0.82, 0.28), toneMapped: false, transparent: true, opacity: .94, depthWrite: false })
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.85, 1.15), toneMapped: false })
  const candleBodyGeo = bakeCreviceAO(new THREE.CylinderGeometry(.091, .11, .94, 28), {
    groundY: -0.47,
    groundRange: 0.24,
    strength: 0.34,
    tint: 0x6b5239,
  })
  const flameGeo = new THREE.LatheGeometry([new THREE.Vector2(0,0), new THREE.Vector2(.045,.045), new THREE.Vector2(.053,.115), new THREE.Vector2(.02,.22), new THREE.Vector2(0,.29)], 20)
  const haloBaseOpacity = ctx.stage === 'night' ? .16 : .11
  function candle(parent: THREE.Object3D, scale: number, lit: boolean) {
    const group = new THREE.Group(); group.scale.setScalar(scale); parent.add(group)
    add(candleBodyGeo, waxBody, [0, .47, 0], group)
    add(new THREE.TorusGeometry(.074, .022, 8, 28), waxTop, [0, .941, 0], group).rotation.x = Math.PI / 2
    add(new THREE.CylinderGeometry(.071, .071, .018, 24), waxPool, [0, .943, 0], group)
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, y = .78 - (i % 3) * .11
      const drip = add(new THREE.CapsuleGeometry(.014 + i % 2 * .003, .07 + i % 3 * .035, 3, 8), wax,
        [Math.cos(a) * .094, y, Math.sin(a) * .094], group)
      drip.rotation.z = Math.sin(a) * .08
    }
    const wick = add(new THREE.CylinderGeometry(.012, .012, .063, 8), material(0x665746), [0, .973, 0], group)
    const flame = new THREE.Group(); flame.position.y = .982; group.add(flame)
    const outerFlame = add(flameGeo, fireMat, [0, 0, 0], flame); outerFlame.userData.toonSurface = { outline: false }
    const core = add(flameGeo, coreMat, [0, .015, .005], flame); core.scale.set(.47, .65, .47); core.userData.toonSurface = { outline: false }
    flame.visible = lit
    const halo = createLampHalo(0xffb85e, .58); halo.sprite.position.y = 1.12; halo.material.opacity = haloBaseOpacity
    halo.sprite.visible = lit; group.add(halo.sprite); halos.push(halo)
    return { group, flame, wick, halo }
  }
  const background: ReturnType<typeof candle>[] = []
  for (const [i, x] of [-.59, -.33, .34, .59].entries()) {
    const s = i % 2 ? .6 : .48
    const c = candle(world, s, true)
    c.group.position.set(x, .4025, .34); background.push(c)
    addContactShadow(world, {
      name: `votive-bg-candle-ao-${i}`,
      width: 0.27 * s,
      depth: 0.27 * s,
      y: 0.4025 + 0.0016,
      center: [x, 0.34],
      shape: 'ellipse',
      opacity: 0.28,
    })
  }
  const start = new THREE.Vector3(-.60, .15, .65), placed = new THREE.Vector3(0, .79, .01)
  const main = candle(world, 1, step >= 2); main.group.name = 'votive-main-candle'
  main.group.position.copy(step ? placed : start)
  const mainShadow = addContactShadow(world, {
    name: 'votive-main-candle-ao',
    width: 0.28,
    depth: 0.28,
    y: (step ? placed.y : start.y) + 0.0016,
    center: [step ? placed.x : start.x, step ? placed.z : start.z],
    shape: 'ellipse',
    opacity: 0.30,
  })
  const invisible = new THREE.MeshBasicMaterial({ visible: false })
  const heldTarget = add(new THREE.SphereGeometry(.21, 16, 10), invisible, [0,.5,0], main.group)
  heldTarget.name = 'votive-held-target'
  const wickTarget = add(new THREE.SphereGeometry(.18, 16, 10), invisible, [0,.99,0], main.group)
  wickTarget.name = 'votive-wick-target'
  const target = add(new THREE.SphereGeometry(.27, 16, 10), invisible, [.0, .95, .01])
  target.name = 'votive-placement-target'
  addInteractionCue(heldTarget, {
    kind: 'drag', label: '拖蜡烛到空位', priority: 2,
    enabled: () => active() && step === 0,
    destination: () => projectedGuide(placement.destination(0),heldTarget.getWorldPosition(new THREE.Vector3()),main.group.getWorldPosition(new THREE.Vector3())), targetLabel: '烛架空位',
  })
  addInteractionCue(wickTarget, {
    kind: 'tap', label: '轻点自己的灯芯', priority: 2,
    enabled: () => active() && step === 1,
  })
  addInteractionCue(heldTarget, {
    kind: 'tap', label: '轻点蜡烛静看', priority: 2,
    enabled: () => active() && step === 2 && ctx.returning === true,
  })
  const collar = add(new THREE.TorusGeometry(.14,.014,8,32), steel, [0,.792,.01]); collar.rotation.x = Math.PI/2
  const glow = new THREE.PointLight(0xffc070, step >= 2 ? 1.8 : 0, 3.6, 1.9)
  glow.position.set(0, 1.91, .21); world.add(glow)
  // Soft warm candlelight bounce catching the carved stone alcove behind the candle rack.
  const archBounce = new THREE.PointLight(0xffac52, step >= 2 ? 0.95 : 0.52, 3.4, 1.8)
  archBounce.position.set(0, 1.18, -.28); world.add(archBounce)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.actions[0] }, safe)
  const wish = document.createElement('div'); wish.className = 'scene-wish-slot'; overlay.append(wish)
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(new THREE.Vector3(0,0,1), -.65), point = new THREE.Vector3()
  const placement = createPosePlacement(canvas,camera,{
    roots:[main.group],targets:[main.group],anchors:[[0,0,0]],
    pose(_step,n){main.group.position.lerpVectors(start,placed,n);world.updateMatrixWorld(true)},
  },scene)
  main.group.position.copy(step ? placed : start)
  const matrices = () => { world.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const reset = () => { placement.cancel(); dragging = false; if (!step) main.group.position.copy(start) }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x,y) { matrices(); return (step < 2 || step === 2 && ctx.returning === true) && ray.hits(x,y,[step === 1 ? wickTarget : heldTarget]) },
    onStart(x,y) { dragging = true; feedback.prepare(); if(step===0 && !placement.begin(0,x,y))pointer.cancel() },
    onMove(x,y) {
      if (step || !dragging) return
      if (placement.move(x,y) && pointer.finish()) { dragging=false; placement.capture(); advance(true) }
    },
    onRelease(x,y) {
      dragging = false; matrices()
      if (!step && placement.move(x,y)) { placement.capture(); advance() }
      else if (step === 1 && ray.hits(x,y,[wickTarget])) advance()
      else if (step === 2 && ctx.returning && ray.hits(x,y,[heldTarget])) finish()
      else reset()
    },
    onCancel: reset,
  })
  const writer = gestures.createWishWrite({ maxLen: 40, saves: Boolean(ctx.saveWish) && !ctx.returning, onSubmit: finish })
  writer.mount(wish,{})
  const feedback = createSceneFeedback(ctx)
  let stopResize = () => {}
  const ending = createQuietEnding(ctx, { ui: ui, isActive: () => started && !disposed && active(),
    duration: 3, motion: 'glow', targets: () => [main.group], cancelInput: () => { pointer.cancel() }, complete: () => finish(),
  })
  function sync() {
    ui.renderDots(step,3); ui.actionBtn.hidden = step === 3
    wish.hidden = step !== 2 || Boolean(ctx.returning)
    writer.setEnabled(step === 2 && active() && !ctx.returning)
    setSafeText(ui.hintEl,step === 2 && ctx.returning ? COPY.returning : COPY.hints[step],safe)
    setSafeText(ui.actionBtn,COPY.actions[Math.min(step,2)],safe)
    main.flame.visible = main.halo.sprite.visible = step >= 2
    glow.intensity = step >= 2 ? 1.8 : 0
    archBounce.intensity = step >= 2 ? 0.95 : 0.52
    mainShadow.visible = !dragging
    mainShadow.position.set(step ? placed.x : start.x, (step ? placed.y : start.y) + 0.0016, step ? placed.z : start.z)
    ending.sync(step === 2)
  }
  function advance(placedInput=false) {
    if (!active() || (pointer.isBusy() && !placedInput) || step > 1) return
    step++; main.group.position.copy(placed); sync(); ctx.onProgress?.(step)
    feedback.impact({
      freqs: step === 1 ? [392,587] : [523,784],
      duration: .3,
      gain: .03,
      cue: step === 1 ? 'stone' : 'air',
      cueStrength: step === 1 ? .54 : .58,
    })
  }
  function finish(text = '') {
    if (!text.trim() && !ending.completing) return
    if (!active() || pointer.isBusy() || step !== 2) return
    const line = text.trim(); if (graphemeLength(line) > 40) return
    step = 3; sync()
    if (line && !ctx.returning) { ctx.saveWish?.(line); if (disposed || !active()) return }
    ctx.onProgress?.(3); if (disposed || !active()) return
    overlay.dispatchEvent(new CustomEvent('scene:complete',{ bubbles:true }))
  }
  const action = () => { feedback.prepare(); if (step < 2) advance(); else finish() }
  const resize = () => {
    const aspect = sizeStage(canvas,renderer,style,camera)
    home.z = 4.8 + portraitBoost(aspect,3); camera.position.copy(home); camera.lookAt(look)
  }
  sync()
  return {
    start() { if (started || disposed) return; started = true; resize(); stopResize = observeCanvasResize(canvas,resize); ui.actionBtn.addEventListener('click',action); sync() },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); writer.setEnabled(false); return }
      feedback.update()
      writer.setEnabled(step === 2 && !ctx.returning)
      const reduced = ctx.isReducedMotion?.() ?? false
      if (!reduced) clock += Math.max(0,Math.min(.1,dt))
      mainShadow.visible = !dragging
      for (const [i,c] of [main,...background].entries()) {
        const breath = reduced ? 0 : Math.sin(clock * 2.1 + i * 1.3) * 0.032 + Math.sin(clock * 5.2 + i * 1.9) * 0.015
        const scaleY = 1 + breath
        const invW = reduced ? 1 : 1 / Math.sqrt(scaleY)
        c.flame.rotation.z = reduced ? 0 : Math.sin(clock * 1.7 + i * 1.3) * .032 + Math.sin(clock * 4.3 + i * 2.1) * .014
        c.flame.rotation.x = reduced ? 0 : Math.cos(clock * 2.3 + i * 1.7) * .015
        c.flame.scale.set(invW, scaleY, invW)
        c.halo.material.opacity = haloBaseOpacity * (1 + breath * 0.65)
      }
      const bounceFlicker = reduced ? 1 : 1 + Math.sin(clock * 2.7) * 0.045 + Math.sin(clock * 6.1) * 0.02
      glow.intensity = (step >= 2 ? 1.8 : 0) * bounceFlicker
      archBounce.intensity = (step >= 2 ? 0.95 : 0.52) * bounceFlicker
      ending.update(dt)
      if (disposed || !(active())) return
      style.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true; pointer.dispose(); stopResize(); writer.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click',action)
      halos.forEach(h=>h.dispose()); glow.dispose(); archBounce.dispose()
      lights.ambient.dispose(); lights.hemi.dispose(); lights.key.dispose(); lights.rim.dispose()
      style.dispose(); disposeTree(world); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay','scene-overlay--stage')
    },
  }
}
