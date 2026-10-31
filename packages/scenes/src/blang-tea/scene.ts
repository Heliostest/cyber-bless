import { createQuietEnding } from '../quiet-ending'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '茶山一盏',
  leaf: '把装着茶叶的木茶匙拖入壶口，添入茶叶。',
  pour: '握住壶把，朝杯内拖动，慢慢倒出一盏茶。',
  rest: '轻点茶杯，静看茶色。为山林与照料茶山的人留一刻感谢。',
  adding: '茶叶落入敞开的陶壶…',
  pouring: '壶嘴倾下，茶水流入杯中…',
  done: '茶色安静下来，带着对茶山的珍惜继续前行。',
} as const
type Checkpoint = 0 | 1 | 2 | 3
const SCOOP_HOME = new THREE.Vector3(-1.00, .901, .62)
// The lower handle attachment is the held pivot; the body lifts before tilting.
const POT_HOME = new THREE.Vector3(-.96, 1.10, -.23)
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Original modern tea ware; ecology appreciation, never a Tea Ancestor rite. */
export function createBlangTea(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0, inactiveRendered = false
  let stopResize = () => {}, dragging = false, maxTravel = 0
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3 } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '添入茶叶' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)

  const projectedGuide = (goal: THREE.Vector3, grip: THREE.Vector3, contact: THREE.Vector3) => {
    camera.updateMatrixWorld(true)
    const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera)
    g.x+=a.x-b.x;g.y+=a.y-b.y
    return g.unproject(camera)
  }
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'blang-tea', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff2d7, ground: 0xb5bea4, key: 0xffe2ba, rim: 0xd0e0d4, keyPosition: [-3, 5, 3], keyIntensity: 1.3, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'tea-garden-table'; scene.add(world)
  const material = (color: number, roughness = .84) => new THREE.MeshStandardMaterial({ color, roughness })
  const wood = material(0xc3a074), edge = material(0x99764f), clay = material(0x819d8d, .72), inside = material(0x607e70), cream = material(0xeee2bd), leafMat = material(0x5f7953), teaMat = createRitualMaterial({ color: 0xc39442, roughness: .22, transmission: .32, attenuationColor: 0xc39442, attenuationDistance: .26 }, { kind: 'tea', thickness: .12, strength: .35 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number,number,number], name = '', parent: THREE.Object3D = world) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.name = name; m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const box = (w: number,h: number,d: number,mat: THREE.Material,p: [number,number,number],name='',parent:THREE.Object3D=world) => add(new RoundedBoxGeometry(w,h,d,3,Math.min(.04,h/3)),mat,p,name,parent)
  const tube = (points: number[][],radius:number,mat:THREE.Material,parent:THREE.Object3D=world,name='') => {
    const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p as [number,number,number])))
    const mesh = add(new THREE.TubeGeometry(curve,40,radius,10,false),mat,[0,0,0],name,parent)
    mesh.userData.toonSurface={outline:false};return mesh
  }
  const lathe = (profile:number[][],mat:THREE.Material,p:[number,number,number],name='',parent:THREE.Object3D=world) => add(new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),48),mat,p,name,parent)
  addCraftTable(world, { name: 'tea-table', topName: 'tea-table-top', width: 3.18, depth: 1.93, surfaceY: .795, thickness: .13, center: [0,0], support: 'arched', finish: 'chestnut' })
  box(2.95,.055,1.68,edge,[0,.8225,0],'tea-tray-base')
  box(2.83,.024,1.56,wood,[0,.862,0],'tea-tray-surface')
  for(const x of [-1.44,1.44])box(.055,.09,1.64,wood,[x,.875,0])
  for(const z of [-.80,.80])box(2.89,.09,.055,wood,[0,.875,z])
  for(const z of [-.62,-.50,-.38,-.26,-.14,-.02,.10,.22,.34,.46,.58])box(2.67,.007,.012,edge,[0,.878,z])
  const shadow = add(new THREE.PlaneGeometry(3.8,2.7),new THREE.ShadowMaterial({opacity:.12}),[0,.006,0]);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false

  const pot = new THREE.Group(); pot.name='tea-pot-pivot'; world.add(pot)
  // The profile returns down the inside: this is a genuinely hollow open vessel.
  lathe([[0,0],[.24,0],[.32,.03],[.40,.13],[.44,.31],[.40,.49],[.29,.62],[.245,.68],[.22,.68],[.215,.62],[.265,.55],[.34,.42],[.37,.27],[.29,.09],[0,.09]],clay,[.54,-.21,0],'tea-pot-body',pot)
  const potFoot = lathe([[.22,0],[.25,.02],[.25,.045],[.22,.05]],inside,[.54,-.225,0],'tea-pot-foot',pot)
  potFoot.userData.toonSurface={outline:false}
  const mouth = add(new THREE.CylinderGeometry(.212,.212,.013,36),inside,[.54,.39,0],'tea-pot-mouth',pot)
  tube([[.82,.05,0],[1.00,.10,0],[1.15,.25,0],[1.24,.37,0]],.073,clay,pot,'tea-pot-curved-spout')
  const spoutTip = add(new THREE.TorusGeometry(.061,.013,10,28),inside,[1.24,.37,0],'tea-pot-spout-rim',pot);spoutTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(.6,.8,0))
  tube([[.23,.04,0],[-.10,-.015,0],[-.23,.13,0],[-.23,.32,0],[-.06,.45,0],[.25,.35,0]],.053,clay,pot,'tea-pot-loop-handle')
  const handle = add(new THREE.CylinderGeometry(.066,.066,.21,20),clay,[-.23,.20,.022],'tea-pot-handle-grip',pot)
  handle.rotation.z=-.08
  // A removable lid rests on its own coaster, leaving the mouth unmistakably open.
  add(new THREE.CylinderGeometry(.31,.32,.025,36),cream,[.04,.895,-.58],'tea-lid-coaster')
  const lid=add(new THREE.SphereGeometry(1,28,16,0,Math.PI*2,0,Math.PI/2),clay,[.04,.913,-.58],'tea-pot-lid');lid.scale.set(.27,.075,.27)
  add(new THREE.SphereGeometry(.043,20,12),inside,[.04,1.011,-.58],'tea-lid-knob')

  const cup = new THREE.Group();cup.name='tea-cup';cup.position.set(.99,.89,.20);world.add(cup)
  lathe([[0,0],[.14,0],[.185,.025],[.235,.17],[.235,.235],[.214,.242],[.207,.215],[.16,.065],[0,.065]],cream,[0,0,0],'tea-cup-body',cup)
  const cupInterior=add(new THREE.CylinderGeometry(.201,.201,.014,36),cream,[0,.177,0],'tea-cup-interior',cup)
  const liquid=add(new THREE.CylinderGeometry(.202,.202,.012,40),teaMat,[0,.185,0],'tea-liquid',cup);liquid.castShadow=false
  // The rounded clay thumb rest is part of the cup wall, not a hidden hit proxy.
  const touch=add(new THREE.SphereGeometry(1,24,16),clay,[0,.135,.221],'tea-cup-touch',cup);touch.scale.set(.102,.065,.026)
  add(new THREE.CylinderGeometry(.29,.30,.035,36),inside,[.99,.881,.20],'tea-cup-saucer')

  const scoop=new THREE.Group();scoop.name='tea-leaf-scoop';world.add(scoop)
  const scoopBowl=lathe([[0,0],[.09,0],[.16,.018],[.175,.04],[.156,.055],[.12,.035],[0,.02]],wood,[.07,0,0],'tea-scoop-bowl',scoop);scoopBowl.scale.set(1,1,1.35)
  const grip=box(.39,.034,.10,wood,[-.20,.015,0],'tea-scoop-grip',scoop)
  box(.50,.015,.24,cream,[-1.04,.886,.62],'tea-scoop-rest')
  const scoopLeaves=new THREE.Group();scoopLeaves.name='tea-leaves-on-scoop';scoop.add(scoopLeaves)
  const potLeaves=new THREE.Group();potLeaves.name='tea-leaves-in-pot';pot.add(potLeaves)
  for(let i=0;i<5;i++){
    const leaf=add(new THREE.SphereGeometry(1,14,10),leafMat,[.035+i*.018,.041+i*.003,(i%2-.5)*.07],'',scoopLeaves);leaf.scale.set(.075,.01,.025);leaf.rotation.y=i*.65
    const wet=add(new THREE.SphereGeometry(1,14,10),leafMat,[.50+(i%3)*.035,.409,(i%2-.5)*.07],'',potLeaves);wet.scale.set(.056,.008,.02);wet.rotation.y=i*.75
  }
  const stream=add(new THREE.CylinderGeometry(.013,.018,1,14),teaMat,[0,0,0],'tea-stream');stream.castShadow=false;stream.userData.toonSurface={outline:false}
  const streamStart=new THREE.Vector3(),streamEnd=new THREE.Vector3(.99,1.081,.20),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0)
  const matrices=()=>{scene.updateMatrixWorld(true);camera.updateMatrixWorld(true)}
  const restorePose=()=>{
    scoop.position.copy(SCOOP_HOME);scoop.rotation.z=0;pot.position.copy(POT_HOME);pot.rotation.z=0
    scoopLeaves.visible=checkpoint===0;potLeaves.visible=checkpoint>=1;liquid.visible=checkpoint>=2;liquid.scale.set(1,1,1);stream.visible=false;matrices()
  }
  const enabled=(at:number)=>()=>active()&&!transition&&checkpoint===at
  addInteractionCue(grip,{kind:'drag',label:'添入茶叶',enabled:enabled(0),destination:mouth,targetLabel:'敞开的壶口',priority:3})
  addInteractionCue(handle,{kind:'drag',label:'握壶把倒茶',enabled:enabled(1),destination:()=>projectedGuide(cupInterior.getWorldPosition(new THREE.Vector3()),handle.getWorldPosition(new THREE.Vector3()),pot.localToWorld(new THREE.Vector3(1.24,.37,0))),targetLabel:'倒入杯内',priority:3})
  addInteractionCue(touch,{kind:'tap',label:'轻点茶杯静看',enabled:enabled(2),priority:3})
  const ray=createPointerRay(canvas,camera),down=new THREE.Vector2(),plane=new THREE.Plane(),point=new THREE.Vector3(),offset=new THREE.Vector3()
  const source=()=>checkpoint===0?grip:checkpoint===1?handle:touch
  // Only opaque visible surfaces qualify; a held object may cross its receptacle.
  const touchTarget = createTouchTarget(canvas, camera, scene)
  const hitsVisible = (x: number, y: number, target: THREE.Object3D, held?: THREE.Object3D) => touchTarget.hit(x, y, target, { ignore: held })
  const automaticReady = (x: number, y: number) => {
    const contact = projectTouchPoint(canvas, camera, checkpoint === 0 ? grip : pot, checkpoint === 0 ? [0,0,0] : [1.24,.37,0])
    return checkpoint < 2 && insideCanvas(canvas,x,y) && !!contact && !touchTarget.occluded(x,y,checkpoint === 0 ? mouth : cupInterior,{ignore:checkpoint === 0 ? scoop : pot}) && touchTarget.hit(contact.x,contact.y,checkpoint === 0 ? mouth : cupInterior,{ignore:checkpoint === 0 ? scoop : pot})
  }
  const reset=()=>{dragging=false;maxTravel=0;if(!transition)restorePose()}
  const previewPour=(t:number)=>{pot.position.copy(POT_HOME).add(new THREE.Vector3(.718*t,.50*t,.43*t));pot.rotation.z=-t*.60;matrices()}
  const pointer=createObjectPointer(ui.hitLayer,{
    isActive:active,
    canStart(x,y){if(transition||checkpoint===3)return false;matrices();return hitsVisible(x,y,source())},
    onStart(x,y){down.set(x,y);maxTravel=0;dragging=checkpoint<2;feedback.prepare();plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),checkpoint===0?scoop.position:pot.position);if(ray.aim(x,y).ray.intersectPlane(plane,point))offset.copy(checkpoint===0?scoop.position:pot.position).sub(point)},
    onMove(x,y){
      maxTravel=Math.max(maxTravel,Math.hypot(x-down.x,y-down.y));if(!dragging)return
      if(checkpoint===0){if(ray.aim(x,y).ray.intersectPlane(plane,point))scoop.position.copy(point).add(offset)}
      else if(ray.aim(x,y).ray.intersectPlane(plane,point))pot.position.copy(point).add(offset)
      matrices()
      if(automaticReady(x,y)&&pointer.finish()){dragging=false;advance(true)}
    },
    onRelease(x,y){
      maxTravel=Math.max(maxTravel,Math.hypot(x-down.x,y-down.y));matrices()
      const valid=checkpoint<2?dragging&&automaticReady(x,y):maxTravel<12&&hitsVisible(x,y,touch)
      dragging=false;if(valid)advance();else reset()
    },onCancel:reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => active(), duration: 3, motion: 'glow',
    targets: () => [cup], cancelInput: () => pointer.cancel(), complete: () => advance(),
  })
  const sync=()=>{
    ui.renderDots(checkpoint,3);ui.actionBtn.hidden=checkpoint===3;ui.actionBtn.disabled=!active()||!!transition||checkpoint===3
    ui.actionBtn.setAttribute('aria-disabled',String(ui.actionBtn.disabled));ui.hitLayer.style.pointerEvents=checkpoint<3&&!transition?'auto':'none'
    setSafeText(ui.actionBtn,checkpoint===0?'添入茶叶':checkpoint===1?'握壶把倒茶':'轻点茶杯静看',safe)
    setSafeText(ui.hintEl,transition?transition.step===0?COPY.adding:COPY.pouring:checkpoint===0?COPY.leaf:checkpoint===1?COPY.pour:checkpoint===2?COPY.rest:COPY.done,safe)
    ending.sync(checkpoint === 2 && !transition)
  }
  function settled(){
    if(!active()||!transition)return
    checkpoint=(transition.step+1) as Checkpoint;transition=null;restorePose();sync();ctx.onProgress?.(checkpoint);feedback.impact({freqs:[392,523.25],duration:.17,gain:.012})
  }
  function advance(placed=false){
    if (checkpoint === 2 && !ending.completing) return
    if(!active()||(pointer.isBusy()&&!placed)||transition||checkpoint===3)return
    if(checkpoint===2){checkpoint=3;restorePose();sync();ctx.onProgress?.(3);if(!active())return;feedback.impact({freqs:[392,587.33],duration:.2,gain:.012});if(active())overlay.dispatchEvent(new CustomEvent('scene:complete',{bubbles:true}));return}
    transition={step:checkpoint,time:0,from:(checkpoint===0?scoop:pot).position.clone()};sync();if(ctx.isReducedMotion?.())settled()
  }
  const action=()=>{if(!active()||pointer.isBusy()||transition||checkpoint===3)return;feedback.prepare();advance()}
  const blur=()=>{focused=false;pointer.cancel();sync()},focus=()=>{focused=true;if(!disposed)sync()}
  const resize=()=>{const aspect=sizeStage(canvas,renderer,style,camera),boost=portraitBoost(aspect,8);camera.position.set(0,4.5+boost*.65,4.9+boost);camera.lookAt(0,1,0);matrices()}
  restorePose();sync()
  return {
    start(){if(started||disposed)return;started=true;const initial=ctx.initialProgress??0;checkpoint=(Number.isFinite(initial)?THREE.MathUtils.clamp(Math.floor(initial),0,3):0) as Checkpoint;restorePose();resize();stopResize=observeCanvasResize(canvas,()=>{if(!disposed)resize()});ui.actionBtn.addEventListener('click',action);window.addEventListener('blur',blur);window.addEventListener('focus',focus);sync()},
    update(dt){
      if(!started||disposed)return
      if(!active()){pointer.cancel();ui.actionBtn.disabled=true;ui.actionBtn.setAttribute('aria-disabled','true');if(!inactiveRendered){style.render();inactiveRendered=true}return}
      if(inactiveRendered){inactiveRendered=false;sync()}
      if(transition){
        const delta=Number.isFinite(dt)?THREE.MathUtils.clamp(dt,0,.05):0
        transition.time=ctx.isReducedMotion?.()?1:Math.min(1,transition.time+delta/(transition.step===0?.65:1.25))
        const t=transition.time
        if(transition.step===0){
          const mouthPosition=mouth.getWorldPosition(new THREE.Vector3());mouthPosition.x+=.18;mouthPosition.y+=.15
          scoop.position.lerpVectors(transition.from,mouthPosition,smooth(Math.min(t*2,1)));scoop.rotation.z=-Math.sin(t*Math.PI)*.45
          scoopLeaves.visible=t<.48;potLeaves.visible=t>=.48
        }else {
          // Lift/tilt, hold the pour, then return the pot to its tray.
          const amount=t<.22?smooth(t/.22):t>.78?1-smooth((t-.78)/.22):1
          previewPour(amount);if(t<.22)pot.position.lerpVectors(transition.from,POT_HOME.clone().add(new THREE.Vector3(.718,.50,.43)),smooth(t/.22));matrices();stream.visible=t>=.22&&t<.78;liquid.visible=t>=.22;liquid.scale.y=Math.max(.15,smooth(THREE.MathUtils.clamp((t-.22)/.56,0,1)))
          streamStart.set(1.24,.37,0).applyMatrix4(pot.matrixWorld);direction.copy(streamStart).sub(streamEnd);stream.position.copy(streamStart).add(streamEnd).multiplyScalar(.5);stream.scale.y=direction.length();stream.quaternion.setFromUnitVectors(up,direction.normalize())
        }
        if(t===1)settled()
      }
      if (!active()) return
      ending.update(dt)
      if (!active()) return
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose(){if(disposed)return;ending.dispose(); disposed=true;pointer.dispose();stopResize();feedback.dispose();ui.actionBtn.removeEventListener('click',action);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);style.dispose();disposeTree(world);Object.values(lights).forEach(l=>l.dispose());scene.clear();renderer.dispose();renderer.forceContextLoss();overlay.replaceChildren();overlay.classList.remove('scene-overlay','scene-overlay--stage')},
  }
}
