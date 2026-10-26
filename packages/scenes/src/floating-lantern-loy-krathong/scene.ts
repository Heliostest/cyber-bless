import { placementHit } from '../placement-hit'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import { createStylizedWater } from '@wbr/scene-runtime/stylized-water'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const TITLE = '叶舟寄意'
const HINTS = ['把花朵拖到折叶灯的花座。', '轻点烛芯，让叶舟亮起一点光。',
  '带着此刻的心意，把叶舟拖到水面涟漪。', '叶舟安静地漂在水面，心意留在这一刻。']
const ACTIONS = ['安放花朵', '点亮烛芯', '轻推叶舟']
const DOCK = new THREE.Vector3(-.31, .365, .62), WATER = new THREE.Vector3(.69, -.0425, -.42)
const FLOWER = new THREE.Vector3(-1.02, .39, .58), SEAT = new THREE.Vector3(-.19, .20, .16)
type Motion = { step: number; t: number; from: THREE.Vector3; text: string }

/** Original folded banana-leaf float; the Thai festival branch only. */
export function createFloatingLantern(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  const returning = ctx.returning === true
  const returnHint = '把叶舟拖向涟漪，以这一点光留下感谢。'
  const note = '现实漂放请遵守当地水域与清理要求。'
  ;[TITLE, ...HINTS, ...ACTIONS, returnHint, note].forEach(safe)
  let started = false, disposed = false, focused = true, step = 0, motion: Motion | null = null
  let dragging = false, maxTravel = 0, inactiveRendered = false, stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 45)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'floating-lantern-loy-krathong', label: TITLE })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xdce9e6, ground: 0x9db5a7, key: 0xffe3b6, rim: 0xcde8e6 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -2, near: .1, far: 12 })
  lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'krathong-waterfront'; scene.add(world)
  const riverGeometry = new THREE.PlaneGeometry(5, 46, 1, 1)
  riverGeometry.rotateX(-Math.PI / 2)
  const waterEffect = createStylizedWater({
    geometry: riverGeometry, normal: 'y', depth: .24,
    color: 0x78c7c1, bedColor: 0xabb68f, opacity: .44, causticScale: 3.3,
  })
  waterEffect.surface.position.set(0, -.045, -13)
  world.add(waterEffect.surface)
  const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .92 })
  const wood = mat(0xb39471), endgrain = mat(0xd4b992), green = [mat(0x6f9f72), mat(0x90b381), mat(0xa3ba85)]
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: THREE.Vector3, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.copy(p)
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  // A short, supported landing joins the river environment; no floating display plinth.
  for (let i = 0; i < 6; i++) add('krathong-dock-board', new RoundedBoxGeometry(1.91, .12, .205, 3, .025), i % 2 ? wood : endgrain, new THREE.Vector3(-.45, .29, .28 + i * .213))
  for (const x of [-1.21, .30]) for (const z of [.36, 1.23]) add('krathong-dock-post', new THREE.CylinderGeometry(.066, .084, .42, 12), wood, new THREE.Vector3(x, .14, z))
  const boat = new THREE.Group(); boat.name = 'krathong-boat'; world.add(boat)
  add('krathong-banana-base', new THREE.CylinderGeometry(.40, .36, .105, 48), green[0], new THREE.Vector3(0, .055, 0), boat)
  // Each leaf is a folded closed triangular fan with a raised central ridge.
  const leafGeometry = () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -.15, .01, -.11, .15, .01, -.11, 0, .32, .07, 0, .09, .16,
      -.15, -.005, -.11, .15, -.005, -.11, 0, .30, .065, 0, .075, .16,
    ], 3))
    geometry.setIndex([0,2,3, 3,2,1, 4,7,6, 7,5,6, 0,4,2, 2,4,6, 2,6,1, 1,6,5, 1,5,3, 3,5,7, 3,7,0, 0,7,4])
    geometry.computeVertexNormals(); return geometry
  }
  const leafGeo = leafGeometry()
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2
    const leaf = add(`krathong-folded-leaf-${i}`, leafGeo, green[i % 3], new THREE.Vector3(Math.sin(a)*.355,.09,Math.cos(a)*.355), boat)
    leaf.rotation.y = a
  }
  const inner = add('krathong-leaf-liner', new THREE.CylinderGeometry(.31,.32,.06,40), green[2], new THREE.Vector3(0,.14,0), boat)
  inner.userData.toonSurface = { outline: false }
  const ivory = mat(0xf8e9c9), amber = mat(0xe0a75b)
  const flower = new THREE.Group(); flower.name = 'krathong-flower'; world.add(flower)
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + ring*.28, r = ring ? .065 : .12
    const petal = add('krathong-flower-petal', new THREE.SphereGeometry(1,12,8), ring ? amber : ivory, new THREE.Vector3(Math.sin(a)*r,.05+ring*.03,Math.cos(a)*r), flower)
    petal.scale.set(.055,.038,.103-ring*.024); petal.rotation.y = a; petal.rotation.x = -.12
  }
  const flowerSource = add('krathong-flower-source', new THREE.SphereGeometry(.067,16,10), amber, new THREE.Vector3(0,.083,0), flower)
  const flowerSeat = add('krathong-flower-seat', new THREE.CylinderGeometry(.13,.11,.028,24), amber, SEAT.clone(), boat)
  const candle = add('krathong-candle', new THREE.CylinderGeometry(.045,.052,.45,20), ivory, new THREE.Vector3(.10,.36,-.07), boat)
  const wickSource = add('krathong-wick-source', new THREE.CylinderGeometry(.012,.016,.047,12), mat(0x6d5c49), new THREE.Vector3(.10,.606,-.07), boat)
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffcb76, toneMapped: false })
  const flame = add('krathong-flame', new THREE.SphereGeometry(1,16,12), flameMat, new THREE.Vector3(.10,.685,-.07), boat)
  flame.scale.set(.032,.078,.032); flame.castShadow = false
  const glow = new THREE.PointLight(0xffcb82, 0, 2.3); glow.position.set(.10,.71,-.07); boat.add(glow)
  // A visible leaf binding offers a stable contact on the near folded face.
  const boatSource = add('krathong-boat-source', new RoundedBoxGeometry(.115,.049,.025,3,.012), green[2], new THREE.Vector3(0,.20,.52), boat)
  const waterTarget = add('krathong-water-target', new THREE.SphereGeometry(.30,40,12), new THREE.MeshBasicMaterial({color:0xc6e9dc,transparent:true,opacity:.26,depthWrite:false}), WATER.clone().add(new THREE.Vector3(0,.006,0)), world)
  // A shallow lens has a continuous raycast surface at the center of the ripple.
  waterTarget.scale.y = .007; waterTarget.castShadow = false
  const ripples = new THREE.Group(); ripples.position.copy(WATER); ripples.name = 'krathong-water-ripples'; world.add(ripples)
  const rippleMat = mat(0xd0e5d4)
  for (const r of [.22,.35,.48]) {
    const ring = add('krathong-ripple', new THREE.TorusGeometry(r,.009,6,48), rippleMat, new THREE.Vector3(0,.006,0), ripples)
    ring.rotation.x = -Math.PI/2; ring.castShadow = false; ring.userData.toonSurface = { outline: false }
  }
  const ready = () => active() && !motion
  addInteractionCue(flowerSource,{kind:'drag',label:'拖花朵到花座',priority:2,enabled:()=>ready()&&step===0,destination:flowerSeat,targetLabel:'叶舟花座'})
  addInteractionCue(wickSource,{kind:'tap',label:'轻点烛芯',priority:2,enabled:()=>ready()&&step===1})
  addInteractionCue(boatSource,{kind:'drag',label:'轻推叶舟入水',priority:2,enabled:()=>ready()&&step===2,destination:waterTarget,targetLabel:'水面涟漪'})
  const ui = createStepOverlay(overlay,{title:TITLE,stepsAria:'步骤',action:ACTIONS[0]},safe)
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  ui.titleEl.title = note
  let writer: ReturnType<typeof gestures.createWishWrite> | undefined
  const ray = createPointerRay(canvas,camera), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3(), down = new THREE.Vector2()
  const matrices = () => { world.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const resetPose = () => {
    boat.position.copy(step < 3 ? DOCK : WATER); boat.rotation.set(0,0,0)
    flower.position.copy(step === 0 ? FLOWER : boat.localToWorld(SEAT.clone()).add(new THREE.Vector3(0,.017,0)))
    flame.visible = step >= 2; glow.intensity = step >= 2 ? .65 : 0; ripples.visible = step >= 2; matrices()
  }
  const sync = () => {
    ui.renderDots(step,3); ui.actionBtn.hidden = step === 3; ui.actionBtn.disabled = !ready() || step === 3
    setSafeText(ui.actionBtn,ACTIONS[Math.min(step,2)],safe)
    setSafeText(ui.hintEl,motion ? ['花朵落在折叶之间…','烛芯亮起一点暖光…','叶舟轻轻离开岸边…'][motion.step] : step === 2 && returning ? returnHint : HINTS[step],safe)
    wishSlot.hidden = step !== 2 || returning; writer?.setEnabled(ready() && step === 2 && !returning)
  }
  function settled() {
    if (!motion) return
    const {text} = motion; step = motion.step + 1; motion = null; resetPose(); sync()
    // Terminal state precedes host callbacks: quiet and returning paths never submit text.
    if (step === 3 && text && !returning) ctx.saveWish?.(text)
    ctx.onProgress?.(step); feedback.impact({freqs:step===3?[392,587]:[440,660],duration:.25,gain:.02})
    if (step === 3) overlay.dispatchEvent(new CustomEvent('scene:complete',{bubbles:true}))
  }
  function begin(text = '', arrived = false) {
    if (!ready() || step === 3 || (pointer.isBusy() && !arrived)) return
    const line = text.trim(); if (line.length > 40) return
    dragging = false; motion = {step,t:0,from:(step===0?flower:boat).position.clone(),text:returning?'':line}
    feedback.prepare(); sync(); if (reduced()) settled()
  }
  const trackTravel = (x:number,y:number) => { maxTravel = Math.max(maxTravel,Math.hypot(x-down.x,y-down.y)) }
  const placementReady = (x: number, y: number) => step !== 1 && maxTravel > 0
    && placementHit(canvas, camera, step === 0 ? flowerSource : boatSource, x, y, (px, py) => ray.hits(px, py, [step === 0 ? flowerSeat : waterTarget]))
  const pointer = createObjectPointer(ui.hitLayer,{
    isActive:active,
    canStart(x,y) { matrices(); return ready() && step<3 && ray.hits(x,y,step===1?[wickSource,candle]:[step===0?flowerSource:boatSource]) },
    onStart(x,y) {
      dragging=true; maxTravel=0; down.set(x,y); feedback.prepare()
      const item = step===0?flower:boat
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),(step === 0 ? flowerSource : boatSource).getWorldPosition(new THREE.Vector3()))
      if (ray.aim(x,y).ray.intersectPlane(plane,point)) offset.copy(item.position).sub(point)
    },
    onMove(x,y) {
      trackTravel(x,y); if(!dragging || step===1)return
      if(ray.aim(x,y).ray.intersectPlane(plane,point)) {
        const item = step===0?flower:boat; item.position.copy(point).add(offset)
        if(step===2) flower.position.copy(boat.localToWorld(SEAT.clone()).add(new THREE.Vector3(0,.017,0)))
        matrices()
      }
      if (dragging && placementReady(x, y) && pointer.finish()) { dragging = false; begin('', true) }
    },
    onRelease(x,y) {
      trackTravel(x,y); matrices()
      const valid=dragging && (step===1 ? maxTravel<12 && ray.hits(x,y,[wickSource,candle]) : placementReady(x,y))
      dragging=false; if(valid)begin(); else resetPose()
    },
    onCancel() { dragging=false; if(!motion)resetPose() },
  })
  const action = () => begin()
  const blur = () => { focused=false; pointer.cancel(); sync() }
  const focus = () => { focused=true; if(!disposed)sync() }
  const resize = () => {
    const aspect=sizeStage(canvas,renderer,style,camera)
    camera.position.set(0,3.35,4.6+portraitBoost(aspect,3.4)); camera.lookAt(0,.65,.15); camera.updateMatrixWorld(true)
  }
  resetPose(); sync()
  return {
    start() {
      if(started||disposed)return
      started=true; const n=ctx.initialProgress??0; step=Number.isFinite(n)?THREE.MathUtils.clamp(Math.floor(n),0,3):0
      if(!returning) { writer=gestures.createWishWrite({maxLen:40,saves:!!ctx.saveWish,onSubmit:begin}); writer.mount(wishSlot,{}) }
      ui.actionBtn.addEventListener('click',action); window.addEventListener('blur',blur); window.addEventListener('focus',focus)
      resize(); resetPose(); sync(); stopResize=observeCanvasResize(canvas,resize)
    },
    update(dt) {
      if(!started||disposed)return
      if(!active()) { pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled=true; if(!inactiveRendered){style.render();inactiveRendered=true}return }
      inactiveRendered=false; ui.actionBtn.disabled=!!motion; writer?.setEnabled(step===2&&!motion&&!returning)
      waterEffect.update(dt, reduced())
      if(motion) {
        motion.t=reduced()?1:Math.min(1,motion.t+(Number.isFinite(dt)?Math.max(0,dt):0)/.75)
        const t=motion.t,p=t*t*(3-2*t)
        if(motion.step===0) flower.position.lerpVectors(motion.from,boat.localToWorld(SEAT.clone()).add(new THREE.Vector3(0,.017,0)),p)
        if(motion.step===1) {flame.visible=true;glow.intensity=p*.65}
        if(motion.step===2) {boat.position.lerpVectors(motion.from,WATER,p);flower.position.copy(boat.localToWorld(SEAT.clone()).add(new THREE.Vector3(0,.017,0)))}
        matrices(); if(t===1)settled()
      }
      style.render()
    },
    dispose() {
      if(disposed)return
      disposed=true;pointer.dispose();stopResize();writer?.dispose();feedback.dispose()
      ui.actionBtn.removeEventListener('click',action);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus)
      style.dispose();waterEffect.dispose();disposeTree(world);Object.values(lights).forEach(l=>l.dispose());glow.dispose()
      renderer.dispose();renderer.forceContextLoss();scene.clear();overlay.replaceChildren();overlay.classList.remove('scene-overlay','scene-overlay--stage')
    },
  }
}
