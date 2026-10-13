import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '旅途一页',
  open: '拖封面书角向左翻开。受摩拉维亚朝圣步道启发的现代手记，非真实朝圣仪轨。',
  ribbon: '把布书签拖入页边的黄铜夹口，为走过的一段路留一处标记。',
  rest: '轻点页上的叶形记号，愿旅人一路平安。这一页只供静看，不会保存文字。',
  opening: '封面缓缓翻开，纸上的山路露出来…',
  placing: '布书签在这一页停下…',
  done: '停留片刻，再带着从容继续走。（练习结束）',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const RIBBON_HOME = new THREE.Vector3(-.85, .838, .80)
const RIBBON_REST = new THREE.Vector3(.86, 1.001, -.25)
const smooth = (t: number) => t * t * (3 - 2 * t)

/** A contemporary traveller's book, not a historic liturgical object or prayer script. */
export function createCzechPilgrimJournal(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let transition: { step: 0 | 1; time: number; angle: number; from: THREE.Vector3; ribbonAngle: number } | null = null
  let stopResize = () => {}, dragging = false, maxTravel = 0
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向左翻开手记' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'czech-pilgrim-journal', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff3df, ground: 0xb9bda5, key: 0xffe6c7, rim: 0xd6e5df, keyPosition: [-3, 5, 3], keyIntensity: 1.25, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'journal-reading-table'; scene.add(world)
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .9 })
  const oak = material(0xc6a47b), edge = material(0xaa8764), leather = material(0x748f84), leatherEdge = material(0x57776e)
  const paper = material(0xfff0d1), paperEdge = material(0xd8c5a4), brass = material(0xcfac68), ribbonMat = material(0xc77d70)
  const ink = material(0x849d82), pathMat = material(0xc79b70), water = material(0x9fb7b2)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...p); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, p: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.035, h / 3)), mat, p, name, parent)
  const tube = (points: number[][], radius: number, mat: THREE.Material, parent: THREE.Object3D = world) => {
    const mesh = add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number,number,number]))), 40, radius, 6, false), mat, [0, 0, 0], '', parent)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }
  box(3.15, .13, 1.9, oak, [0, .71, 0], 'journal-table-top')
  for (const x of [-1.28, 1.28]) for (const z of [-.68, .68]) box(.14, .645, .14, edge, [x, .3225, z])
  for (const z of [-.65,.65]) box(2.7,.16,.10,edge,[0,.57,z])
  const shadow = add(new THREE.PlaneGeometry(3.8, 2.6), new THREE.ShadowMaterial({ opacity: .12 }), [0,.005,0]); shadow.rotation.x=-Math.PI/2;shadow.castShadow=false
  box(2.90, .026, 1.62, leatherEdge, [0,.792,0], 'journal-reading-mat')
  // Stacked page edges, an actual hinge and a cloth-bound cover are independently modelled.
  box(1.13,.07,1.31,leather,[.565,.844,0],'journal-back-cover')
  for (let i=0;i<5;i++) box(1.07,.022,1.25,i%2?paper:paperEdge,[.553,.89+i*.019,0],`journal-page-edge-${i}`)
  box(1.07,.013,1.25,paper,[.553,.985,0],'journal-right-page')
  const hinge=new THREE.Group();hinge.name='journal-hinge';hinge.position.set(0,.995,0);world.add(hinge)
  box(1.15,.055,1.34,leather,[.575,.028,0],'journal-front-cover',hinge)
  box(1.06,.006,1.25,paper,[.56,-.004,0],'journal-inside-cover',hinge)
  for(const z of [-.49,.49])box(.9,.006,.018,brass,[.575,.059,z],'',hinge)
  for(const x of [.14,1.01])box(.018,.006,.98,brass,[x,.059,0],'',hinge)
  const corner=box(.21,.016,.20,brass,[.987,.075,.50],'journal-cover-corner',hinge)
  // Simple original hills on the cover; no saint or replicated sacred art.
  tube([[.30,.063,.18],[.46,.063,-.13],[.57,.063,.04],[.73,.063,-.22],[.84,.063,.17]],.014,brass,hinge)
  const spine=add(new THREE.CylinderGeometry(.065,.065,1.36,20),leatherEdge,[0,.925,0],'journal-spine');spine.rotation.x=Math.PI/2
  const coverRest=box(.23,.035,.23,brass,[-1.07,.922,.50],'journal-cover-rest')
  box(.23,.1,.23,oak,[-1.07,.855,.50])
  box(.23,.135,.23,oak,[-1.07,.872,-.50])
  // The opened spread carries a quiet miniature landscape: a winding path, stream and tree rows.
  tube([[.29,1.003,.47],[.52,1.003,.29],[.37,1.003,.05],[.63,1.003,-.22],[.56,1.003,-.48]],.026,pathMat)
  tube([[.18,1.004,.45],[.19,1.004,.14],[.29,1.004,-.14],[.20,1.004,-.49]],.012,water)
  for(const [x,z] of [[.76,.25],[.77,-.1],[.34,-.36],[.40,.45]]){
    const leaf=add(new THREE.SphereGeometry(1,14,10),ink,[x,1.004,z]);leaf.scale.set(.045,.006,.085);leaf.rotation.y=.25
  }
  const slot=box(.19,.022,.24,brass,[.86,1.014,-.45],'journal-ribbon-slot')
  box(.13,.024,.028,leatherEdge,[.86,1.03,-.54])
  const ribbon=new THREE.Group();ribbon.name='journal-ribbon';world.add(ribbon)
  box(.135,.014,.53,ribbonMat,[0,0,0],'journal-ribbon-cloth',ribbon)
  const grip=box(.165,.026,.13,brass,[0,.019,-.20],'journal-ribbon-grip',ribbon)
  for(const x of [-.045,.045])box(.006,.003,.44,paper,[x,.010,-.01],'',ribbon)
  const seal=add(new THREE.SphereGeometry(1,20,12),ink,[.76,1.025,.45],'journal-page-seal');seal.scale.set(.12,.024,.09)
  // A closed pencil on a rest and a small travel cup make this a contemporary pause.
  box(.18,.035,.60,oak,[-1.25,.827,-.49],'journal-pencil-rest')
  const pencil=add(new THREE.CylinderGeometry(.023,.023,.58,8),pathMat,[-1.25,.862,-.49]);pencil.rotation.x=Math.PI/2
  add(new THREE.LatheGeometry([[0,0],[.1,0],[.14,.035],[.17,.20],[.15,.215],[.13,.19],[.10,.05],[0,.05]].map(([x,y])=>new THREE.Vector2(x,y)),28),leather,[1.33,.805,-.59],'journal-travel-cup')
  const tea=add(new THREE.CylinderGeometry(.127,.127,.008,24),pathMat,[1.33,.973,-.59]);tea.castShadow=false
  const matrices=()=>{scene.updateMatrixWorld(true);camera.updateMatrixWorld(true)}
  const restorePose=()=>{hinge.rotation.z=checkpoint>=1?Math.PI:0;ribbon.position.copy(checkpoint>=2?RIBBON_REST:RIBBON_HOME);ribbon.rotation.y=checkpoint>=2?0:Math.PI/2;matrices()}
  const enabled=(at:number)=>()=>active()&&!transition&&checkpoint===at
  addInteractionCue(corner,{kind:'drag',label:'向左翻开书角',priority:3,enabled:enabled(0),destination:coverRest,targetLabel:'翻到左侧'})
  addInteractionCue(grip,{kind:'drag',label:'放入布书签',priority:3,enabled:enabled(1),destination:slot,targetLabel:'页边夹口'})
  addInteractionCue(seal,{kind:'tap',label:'轻点这一页',priority:3,enabled:enabled(2)})
  const source=()=>checkpoint===0?corner:checkpoint===1?grip:seal
  const ray=createPointerRay(canvas,camera),down=new THREE.Vector2(),plane=new THREE.Plane(),point=new THREE.Vector3(),offset=new THREE.Vector3()
  const reset=()=>{dragging=false;maxTravel=0;if(!transition)restorePose()}
  const pointer=createObjectPointer(ui.hitLayer,{
    isActive:active,
    canStart(x,y){if(transition||checkpoint===3)return false;matrices();return ray.hits(x,y,[source()])},
    onStart(x,y){down.set(x,y);maxTravel=0;dragging=checkpoint<2;feedback.prepare();plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),ribbon.position);if(ray.aim(x,y).ray.intersectPlane(plane,point))offset.copy(ribbon.position).sub(point)},
    onMove(x,y){
      maxTravel=Math.max(maxTravel,Math.hypot(x-down.x,y-down.y))
      if(!dragging)return
      if(checkpoint===0){
        const target=coverRest.getWorldPosition(new THREE.Vector3()).project(camera),rect=canvas.getBoundingClientRect(),targetX=rect.left+(target.x+1)*rect.width/2
        hinge.rotation.z=THREE.MathUtils.clamp((down.x-x)/Math.max(1,down.x-targetX),0,1)*Math.PI
      }else if(ray.aim(x,y).ray.intersectPlane(plane,point))ribbon.position.copy(point).add(offset)
      matrices()
    },
    onRelease(x,y){
      maxTravel=Math.max(maxTravel,Math.hypot(x-down.x,y-down.y));matrices()
      const valid=checkpoint<2?dragging&&maxTravel>=8&&ray.hits(x,y,[checkpoint===0?coverRest:slot]):maxTravel<12&&ray.hits(x,y,[seal])
      dragging=false;if(valid)advance();else reset()
    },onCancel:reset,
  })
  const sync=()=>{
    ui.renderDots(checkpoint,3);ui.actionBtn.hidden=checkpoint===3;ui.actionBtn.disabled=!active()||!!transition||checkpoint===3
    ui.actionBtn.setAttribute('aria-disabled',String(ui.actionBtn.disabled));ui.hitLayer.style.pointerEvents=checkpoint<3&&!transition?'auto':'none'
    setSafeText(ui.actionBtn,checkpoint===0?'向左翻开手记':checkpoint===1?'放入布书签':'轻点这一页',safe)
    setSafeText(ui.hintEl,transition?transition.step===0?COPY.opening:COPY.placing:checkpoint===0?COPY.open:checkpoint===1?COPY.ribbon:checkpoint===2?COPY.rest:COPY.done,safe)
  }
  function settled(){if(!active()||!transition)return;checkpoint=(transition.step+1) as Checkpoint;transition=null;restorePose();sync();ctx.onProgress?.(checkpoint);feedback.impact({freqs:[392,523.25],duration:.18,gain:.014})}
  function advance(){
    if(!active()||pointer.isBusy()||transition||checkpoint===3)return
    if(checkpoint===2){checkpoint=3;restorePose();sync();ctx.onProgress?.(3);feedback.impact({freqs:[392,587.33],duration:.23,gain:.014});overlay.dispatchEvent(new CustomEvent('scene:complete',{bubbles:true}));return}
    transition={step:checkpoint,time:0,angle:hinge.rotation.z,from:ribbon.position.clone(),ribbonAngle:ribbon.rotation.y};sync();if(ctx.isReducedMotion?.())settled()
  }
  const action=()=>{if(!active()||pointer.isBusy()||transition||checkpoint===3)return;feedback.prepare();advance()}
  const blur=()=>{focused=false;pointer.cancel();sync()},focus=()=>{focused=true;if(!disposed)sync()}
  const resize=()=>{const aspect=sizeStage(canvas,renderer,style,camera),boost=portraitBoost(aspect,10);camera.position.set(0,4.2+boost*.45,5.2+boost);camera.lookAt(0,.95,0);matrices()}
  restorePose();sync()
  return {
    start(){if(started||disposed)return;started=true;const initial=ctx.initialProgress??0;checkpoint=(Number.isFinite(initial)?THREE.MathUtils.clamp(Math.floor(initial),0,3):0) as Checkpoint;restorePose();resize();stopResize=observeCanvasResize(canvas,()=>{if(!disposed)resize()});ui.actionBtn.addEventListener('click',action);window.addEventListener('blur',blur);window.addEventListener('focus',focus);sync()},
    update(dt){
      if(!started||disposed)return
      if(!active()){pointer.cancel();ui.actionBtn.disabled=true;ui.actionBtn.setAttribute('aria-disabled','true');if(!inactiveRendered){style.render();inactiveRendered=true}return}
      if(inactiveRendered){inactiveRendered=false;sync()}
      if(transition){const delta=Number.isFinite(dt)?THREE.MathUtils.clamp(dt,0,.05):0;transition.time=ctx.isReducedMotion?.()?1:Math.min(1,transition.time+delta/.7);const t=smooth(transition.time)
        if(transition.step===0)hinge.rotation.z=THREE.MathUtils.lerp(transition.angle,Math.PI,t)
        else {ribbon.position.lerpVectors(transition.from,RIBBON_REST,t);ribbon.rotation.y=THREE.MathUtils.lerp(transition.ribbonAngle,0,t);if(!ctx.isReducedMotion?.())ribbon.position.y+=Math.sin(t*Math.PI)*.2}
        if(transition.time===1)settled()
      }style.render()
    },
    dispose(){if(disposed)return;disposed=true;pointer.dispose();stopResize();feedback.dispose();ui.actionBtn.removeEventListener('click',action);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);style.dispose();disposeTree(world);Object.values(lights).forEach(l=>l.dispose());scene.clear();renderer.dispose();renderer.forceContextLoss();overlay.replaceChildren();overlay.classList.remove('scene-overlay','scene-overlay--stage')},
  }
}
