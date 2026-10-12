import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '草编迎春', weave: '编入一束草', hang: '挂上草编', rest: '静看草编',
  hints: ['按住桌边草束，依次拖到折编点。四束草合成一只小十字（民俗手作致敬）。',
    '把编好的草十字拖到门楣挂点。', '轻点挂着的草编，留一会儿安静。', '这段手作已留下（产品改编练习）。'],
} as const
const HELD = new THREE.Vector3(-0.32, 1.04, 0.52)
const CROSS_SCALE = 0.78
const HUNG = new THREE.Vector3(0, 1.98 - 0.98 * CROSS_SCALE, 0.25)
const LOOSE = new THREE.Vector3(0.75, 0.57, 0.83)
const FOLDS: [number,number,number][] = [[-.08,-.15,.11],[.15,-.08,.11],[.08,.15,.11],[-.15,.08,.11]]

/** Four simplified rush placements, followed by hanging and a quiet viewing. */
export function createBrigidsCross(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  for (const text of [COPY.title,COPY.weave,COPY.hang,COPY.rest,...COPY.hints]) shared.assertSafeCopy(text)
  let step=0, woven=0, started=false, disposed=false, completed=false, clock=0
  let settling=0, dragging=false, pressX=0, pressY=0
  let stopResize=()=>{}
  const active=()=>started&&!disposed&&(ctx.isActive?.()??true)
  const reduced=()=>ctx.isReducedMotion?.()??false
  const { renderer, scene }=createWarmStage(canvas)
  const camera=new THREE.PerspectiveCamera(40,1,.1,60), look=new THREE.Vector3(0,1.08,0)
  camera.position.set(0,1.7,5.05); camera.lookAt(look)
  const style=createDebugRenderStyle(renderer,scene,camera,{id:ctx.sceneId??'st-brigids-cross',label:COPY.title})
  style.setStyle(CEL_STYLE)
  const lights=addStageLights(scene,ctx.stage,{sky:0xfff2d6,ground:0xc1c8a1,key:0xffe3bd,rim:0xe2ead2})
  const world=new THREE.Group(); scene.add(world)
  const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.94})
  const timber=mat(0xbe916e), edge=mat(0x947657), cream=mat(0xf4e6c1), cord=mat(0xd4ba8c)
  const rushes=[mat(0x819568),mat(0xa4b07b),mat(0x91a36c)]
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,p:[number,number,number],parent:THREE.Object3D=world)=>{
    const mesh=new THREE.Mesh(geometry,material); mesh.position.set(...p); parent.add(mesh); return mesh
  }
  const stalk=(points:[number,number,number][],material:THREE.Material,parent:THREE.Object3D,radius=.014)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)))
    const mesh=add(new THREE.TubeGeometry(curve,Math.max(12,points.length*5),radius,6,false),material,[0,0,0],parent)
    mesh.userData.toonSurface={outline:false}; return mesh
  }
  // A small working table in front of an original cottage lintel.
  add(new RoundedBoxGeometry(2.58,.14,1.3,3,.05),timber,[0,.27,.3])
  add(new RoundedBoxGeometry(2.4,.022,1.14,2,.015),cream,[0,.35,.32]).userData.toonSurface={outline:false}
  for(const x of [-1.05,1.05]) {
    add(new RoundedBoxGeometry(.17,2.2,.2,3,.04),timber,[x,1.1,-.18])
    add(new RoundedBoxGeometry(.28,.07,.52,2,.02),edge,[x,.035,-.1])
    add(new RoundedBoxGeometry(.14,.27,.14,2,.035),edge,[x,.13,.25])
  }
  add(new RoundedBoxGeometry(2.35,.2,.25,3,.045),timber,[0,2.07,-.13])
  const peg=add(new THREE.CylinderGeometry(.025,.028,.15,12),edge,[0,1.98,.065]); peg.rotation.x=Math.PI/2
  const invisible=new THREE.MeshBasicMaterial({visible:false})
  const hangTarget=add(new THREE.SphereGeometry(.21,16,12),invisible,[0,1.98,.17]); hangTarget.name='brigid-hang-target'
  const hookRing=add(new THREE.TorusGeometry(.1,.012,6,24),cord,[0,1.96,.08])

  const cross=new THREE.Group(); cross.name='brigid-cross'; cross.scale.setScalar(CROSS_SCALE); world.add(cross)
  const center=new THREE.Group(); cross.add(center)
  // Raised concentric interlocks and four offset rush bundles follow the local reference.
  for(let i=0;i<6;i++) {
    const r=.06+i*.028, z=.018+(i%2)*.012
    stalk([[-r,-r,z],[r,-r,z],[r,r,z],[-r,r,z],[-r,-r,z]],rushes[i%3],center,.017)
  }
  const arms:THREE.Group[]=[]
  for(let side=0;side<4;side++) {
    const arm=new THREE.Group(); arm.rotation.z=side*Math.PI/2; cross.add(arm); arms.push(arm)
    for(let i=0;i<7;i++) {
      const y=-.16+i*.044
      stalk([[.13,y,.01],[.48,y*.74,.01+(i%2)*.008],[.86+(i%3)*.012,y*.55,.01]],rushes[(side+i)%3],arm)
    }
    for(const x of [.66,.70]) stalk([[x,-.12,.04],[x,.09,.04],[x,.09,-.04],[x,-.12,-.04],[x,-.12,.04]],cord,arm,.013)
  }
  const loop=stalk([[-.12,.66,.05],[-.13,.91,.02],[0,.98,.02],[.13,.91,.02],[.12,.66,.05]],cord,cross,.012)
  const crossHit=add(new THREE.SphereGeometry(.27,16,12),invisible,[0,0,.065],cross); crossHit.name='brigid-cross-hit'
  const loose=new THREE.Group(); loose.name='brigid-loose-rush'; world.add(loose)
  for(let i=0;i<5;i++) stalk([[-.34,i*.028-.056,0],[0,i*.028-.056,.007],[.36,i*.023-.046,.016]],rushes[i%3],loose,.018)
  const looseHit=add(new THREE.SphereGeometry(.23,16,12),invisible,[0,0,.025],loose); looseHit.name='brigid-reed-hit'
  const weaveTarget=add(new THREE.SphereGeometry(.18,16,12),invisible,[0,0,0]); weaveTarget.name='brigid-weave-target'
  const guide=add(new THREE.TorusGeometry(.075,.009,6,24),new THREE.MeshBasicMaterial({color:0xb8d6b3,transparent:true,opacity:.65,depthWrite:false}),[0,0,0])
  guide.userData.toonSurface={outline:false}
  const canCue=()=>active()&&!settling&&step<3
  addInteractionCue(looseHit,{kind:'drag',label:'拖草束到折编点',enabled:()=>canCue()&&step===0,destination:weaveTarget,targetLabel:'当前折编点'})
  addInteractionCue(crossHit,{kind:'drag',label:'把草编挂上门楣',enabled:()=>canCue()&&step===1,destination:hangTarget,targetLabel:'门楣挂点'})
  addInteractionCue(crossHit,{kind:'tap',label:'轻点草编静看',enabled:()=>canCue()&&step===2})
  const ui=createStepOverlay(overlay,{title:COPY.title,stepsAria:'步骤',action:COPY.weave},shared.assertSafeCopy)
  const feedback=createSceneFeedback(ctx), ray=createPointerRay(canvas,camera)
  const plane=new THREE.Plane(), dragPoint=new THREE.Vector3(), offset=new THREE.Vector3()
  const carried=()=>step===0?loose:cross
  function pose() {
    cross.position.copy(step>=2?HUNG:HELD); loose.position.copy(LOOSE)
    cross.rotation.set(0,0,0)
    for(let i=0;i<4;i++) arms[i].visible=i<woven
    loop.visible=step>=1
    loose.visible=step===0; guide.visible=step===0; hookRing.visible=step===1
    if(step===0) { weaveTarget.position.copy(HELD).add(new THREE.Vector3(...FOLDS[Math.min(3,woven)]).multiplyScalar(CROSS_SCALE)); guide.position.copy(weaveTarget.position).add(new THREE.Vector3(0,0,.01)) }
    world.updateMatrixWorld(true)
  }
  function sync() {
    ui.renderDots(step,3); ui.actionBtn.hidden=step===3; ui.actionBtn.disabled=settling>0
    setSafeText(ui.actionBtn,[COPY.weave,COPY.hang,COPY.rest,COPY.rest][step],shared.assertSafeCopy)
    setSafeText(ui.hintEl,COPY.hints[step],shared.assertSafeCopy)
  }
  function advance() {
    if(!active()||settling||step===3) return
    if(step===0) { woven++; if(woven===4) { step=1; ctx.onProgress?.(1) } }
    else { step++; ctx.onProgress?.(step) }
    settling=reduced()?0:.18
    pose(); sync()
    feedback.impact({freqs:step===3?[264,396]:[220,330],duration:.18,gain:.025})
    if(step===3&&!completed) { completed=true; overlay.dispatchEvent(new CustomEvent('scene:complete',{bubbles:true})) }
  }
  const pointer=createObjectPointer(ui.hitLayer,{
    isActive:active,
    canStart:(x,y)=>!settling&&step<3&&ray.hits(x,y,[step===0?looseHit:crossHit]),
    onStart(x,y) {
      dragging=true; pressX=x; pressY=y; feedback.prepare()
      const object=carried(); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),object.position)
      if(ray.aim(x,y).ray.intersectPlane(plane,dragPoint)) offset.copy(object.position).sub(dragPoint)
    },
    onMove(x,y) {
      if(!dragging||step===2) return
      if(ray.aim(x,y).ray.intersectPlane(plane,dragPoint)) {
        carried().position.copy(dragPoint).add(offset)
        carried().position.x=THREE.MathUtils.clamp(carried().position.x,-1.15,1.15)
        carried().position.y=THREE.MathUtils.clamp(carried().position.y,.4,2.12)
        world.updateMatrixWorld(true)
      }
    },
    onRelease(x,y) {
      const valid=dragging&&(step===2?Math.hypot(x-pressX,y-pressY)<12&&ray.hits(x,y,[crossHit]):ray.hits(x,y,[step===0?weaveTarget:hangTarget]))
      dragging=false
      if(valid) advance(); else pose()
    },
    onCancel() { dragging=false; pose() },
  })
  const action=()=>{if(!active()||pointer.isBusy()||settling||step===3)return;feedback.prepare();advance()}
  const resize=()=>{if(disposed)return;const aspect=sizeStage(canvas,renderer,style,camera);camera.position.set(0,1.7,5.05+portraitBoost(aspect,4));camera.lookAt(look);camera.updateMatrixWorld(true)}
  return {
    start() {
      if(started||disposed)return
      started=true
      const initial=ctx.initialProgress??0; step=Number.isFinite(initial)?THREE.MathUtils.clamp(Math.floor(initial),0,3):0
      woven=step>=1?4:0; completed=step===3
      pose(); sync(); resize(); stopResize=observeCanvasResize(canvas,resize); ui.actionBtn.addEventListener('click',action)
    },
    update(dt) {
      if(!started||disposed)return
      if(!active()) {pointer.cancel();style.render();return}
      const delta=Number.isFinite(dt)?Math.max(0,dt):0
      if(settling) {settling=Math.max(0,settling-delta);if(reduced())settling=0;sync()}
      if(!reduced())clock+=delta
      if(step>=2&&!dragging)cross.rotation.z=reduced()?0:Math.sin(clock*1.15)*.015
      style.render()
    },
    dispose() {
      if(disposed)return
      disposed=true;pointer.dispose();stopResize();ui.actionBtn.removeEventListener('click',action);feedback.dispose()
      style.dispose();disposeTree(world)
      for(const light of Object.values(lights))light.dispose()
      scene.clear();renderer.dispose();renderer.forceContextLoss()
      overlay.replaceChildren();overlay.classList.remove('scene-overlay','scene-overlay--stage')
    },
  }
}
