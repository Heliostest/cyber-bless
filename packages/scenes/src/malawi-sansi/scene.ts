import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { completesDirectionalDrag } from '../directional-drag'
import { addStageLights, CEL_STYLE, createPointerRay, createChimeAudio, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'
import { createSansiModel, SANSI_KEYS } from './model'

export function createMalawiSansi(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  let started=false,disposed=false,focused=true,suspended=false,notifying=false,controlsBusy=false,at=0,lifecycleVersion=0,callbackVersion=0
  let stopResize=()=>{},candidate=-1,held=-1,amount=0,invalid=false,moved=false,along=0,pathTravel=0,maxCross=0,maxAlong=0,minAlong=0,backtrack=0
  const motions:({time:number;force:number}|null)[]=Array(9).fill(null),values=Array<number>(9).fill(0)
  const active=()=>started&&!disposed&&focused&&(ctx.isActive?.()??true),inputActive=()=>active()&&!notifying&&at<3
  const callbackActive=()=>active()&&callbackVersion===lifecycleVersion
  const audio=createChimeAudio(),feedback=createSceneFeedback({...ctx,isSoundEnabled:()=>false})
  const ui=createStepOverlay(overlay,{title:'铁舌轻鸣',stepsAria:'自由演奏',action:'结束仪式'},safe)
  overlay.classList.add('scene-overlay--sansi');ui.dotsEl.hidden=true
  ui.actionBtn.classList.add('scene-sansi-finish');ui.actionBtn.title='结束演奏'
  const keyboard=document.createElement('div');keyboard.className='scene-sansi-keys';keyboard.setAttribute('role','group');keyboard.setAttribute('aria-label','铁舌音符，从左到右排列')
  const noteButtons=SANSI_KEYS.map((note,key)=>{
    const button=document.createElement('button');button.type='button';button.className='scene-sansi-key';button.dataset.key=String(key)
    setSafeText(button,note.name,safe);button.setAttribute('aria-label','左起第'+(key+1)+'根，'+note.name);button.title='键盘 '+(key+1)
    keyboard.append(button);return button
  })
  overlay.append(keyboard)
  const {scene,renderer}=createWarmStage(canvas),camera=new THREE.PerspectiveCamera(40,1,.1,40)
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  const style=createDebugRenderStyle(renderer,scene,camera,{id:ctx.sceneId??'malawi-sansi',label:'铁舌轻鸣'});style.setStyle(CEL_STYLE)
  const cueLayer=canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights=addStageLights(scene,ctx.stage,{sky:0xeaf4ed,ground:0xa39c74,key:0xffedca,rim:0xd6f3ff,keyPosition:[-3,5,4],keyIntensity:2,rimIntensity:.8})
  lights.key.castShadow=true;lights.key.shadow.mapSize.set(1024,1024);lights.key.shadow.bias=-.0004;lights.key.shadow.normalBias=.008
  Object.assign(lights.key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15})
  const model=createSansiModel();scene.add(model.subject)
  const matrices=()=>{scene.updateMatrixWorld(true);camera.updateMatrixWorld(true)}
  const paint=()=>{
    for(let key=0;key<9;key++){
      const motion=motions[key];values[key]=motion?motion.force*Math.exp(-5*motion.time)*Math.cos((8+key*.3)*Math.PI*motion.time):0
      if(held===key)values[key]=amount
      noteButtons[key]!.dataset.ringing=String(!!motion)
    }
    model.pose(values);matrices()
  }
  const removeCues=model.targets.map((target,key)=>addInteractionCue(target,{kind:'tap',label:key===4?'点按或下拨铁舌，自由演奏':SANSI_KEYS[key]!.name,anchor:model.anchors[key],compact:key!==4,keepVisible:true,priority:3,enabled:()=>inputActive()}))
  const ray=createPointerRay(canvas,camera),down=new THREE.Vector2(),previous=new THREE.Vector2()
  const nearest=(x:number,y:number)=>{
    const meshes:THREE.Object3D[]=[]
    scene.traverseVisible(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;const materials=Array.isArray(m.material)?m.material:[m.material];if(materials.some(m=>m.visible&&(!m.transparent||m.opacity>=1)))meshes.push(o)})
    return ray.aim(x,y).intersectObjects(meshes,false)[0]?.object
  }
  const reset=()=>{held=-1;amount=0;moved=invalid=false;pathTravel=maxCross=maxAlong=minAlong=backtrack=along=0;if(!disposed){paint();sync()}}
  const guardedEvents=['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture']
  const guardCallbackInput=(event:Event)=>{if(notifying)event.stopImmediatePropagation()}
  guardedEvents.forEach(type=>{window.addEventListener(type,guardCallbackInput,true);ui.hitLayer.addEventListener(type,guardCallbackInput,true)})
  const pointer=createObjectPointer(ui.hitLayer,{
    isActive:inputActive,
    canStart(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return false;matrices();const hit=nearest(x,y);candidate=model.targets.findIndex(target=>target===hit);return candidate>=0},
    onStart(x,y){const key=candidate;if(!prepareInput()){pointer.cancel();return};held=key;amount=0;down.set(x,y);previous.copy(down);moved=invalid=false;pathTravel=maxCross=maxAlong=minAlong=backtrack=along=0;sync()},
    onMove(x,y){
      if(!Number.isFinite(x)||!Number.isFinite(y)){invalid=true;return}
      pathTravel+=Math.hypot(x-previous.x,y-previous.y);previous.set(x,y);along=y-down.y;moved=true
      maxAlong=Math.max(maxAlong,along);minAlong=Math.min(minAlong,along);backtrack=Math.max(backtrack,maxAlong-along);maxCross=Math.max(maxCross,Math.abs(x-down.x))
      amount=THREE.MathUtils.clamp(along/60,0,1);paint()
    },
    onRelease(x,y){
      const key=held,end=y-down.y,cross=x-down.x,travel=pathTravel+Math.hypot(x-previous.x,y-previous.y)
      const tap=Number.isFinite(x)&&Number.isFinite(y)&&travel<=8&&down.distanceTo(new THREE.Vector2(x,y))<=8
      const drag=moved&&completesDirectionalDrag({along,end,maxAlong,minAlong,backtrack,maxCross,cross,travel})
      const force=tap ? .65 : Math.max(.5,amount);const valid=!invalid&&key>=0&&(tap||drag)
      held=-1;amount=0;if(valid)play(key,force);else reset()
    },onCancel:reset,
  })
  function sync(){
    const controlsActive=active()&&at<3;controlsBusy=pointer.isBusy()
    if(cueLayer)cueLayer.hidden=!active()
    ui.actionBtn.hidden=at===0||at===3;ui.actionBtn.disabled=!controlsActive||controlsBusy||at===0
    ui.actionBtn.setAttribute('aria-disabled',String(ui.actionBtn.disabled));ui.hitLayer.style.pointerEvents=inputActive()?'auto':'none'
    keyboard.hidden=at===3;noteButtons.forEach(button=>button.disabled=!controlsActive||controlsBusy)
    setSafeText(ui.hintEl,at===3?'指尖停下，余音轻轻散去。': '点按或向下轻拨任意铁舌，试着奏出自己的旋律。键盘1–9也可演奏，想收尾时点「结束仪式」。',safe)
  }
  function withHostCallbacks(work:()=>void){notifying=true;callbackVersion=lifecycleVersion;sync();try{work()}finally{notifying=false;if(!disposed)sync()}}
  function prepareInput(unlock=true){const version=lifecycleVersion;withHostCallbacks(()=>{feedback.prepare();if(unlock&&callbackActive()&&(ctx.isSoundEnabled?.()??true))audio.unlock()});return inputActive()&&version===lifecycleVersion}
  function play(key:number,force:number){
    if(!inputActive()||pointer.isBusy())return
    motions[key]=ctx.isReducedMotion?.()?null:{time:0,force};paint()
    const changed=at<2;at=2
    withHostCallbacks(()=>{
      if(changed)ctx.onProgress?.(2);if(!callbackActive())return
      const note=SANSI_KEYS[key]!
      ctx.haptic?.(force>.8?'heavy':note.frequency<=349.23?'medium':'light');if(!callbackActive())return
      if(ctx.isSoundEnabled?.()??true)audio.play({freqs:[note.frequency,note.frequency*2.01,note.frequency*4.9],duration:.8,gain:.03+force*.025,type:'sine'})
    })
  }
  const actions=noteButtons.map((button,key)=>{const action=()=>{if(inputActive()&&!pointer.isBusy()&&prepareInput())play(key,.65)};button.addEventListener('click',action);return action})
  const keydown=(event:KeyboardEvent)=>{
    const target=event.target instanceof Element?event.target:null
    if(event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey||!inputActive()||target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return
    const key=Number(event.key)-1;if(event.key.length!==1||key<0||key>=9||!Number.isInteger(key))return;event.preventDefault();actions[key]!()
  }
  const finish=()=>{
    if(!inputActive()||at===0||pointer.isBusy()||!prepareInput(false))return
    at=3;motions.fill(null);held=-1;paint();audio.dispose()
    withHostCallbacks(()=>{ctx.onProgress?.(3);if(!callbackActive())return;ctx.haptic?.('medium');if(callbackActive())overlay.dispatchEvent(new CustomEvent('scene:complete',{bubbles:true}))})
  }
  const blur=()=>{focused=false;lifecycleVersion++;pointer.cancel();sync()},focus=()=>{focused=true;if(!disposed)sync()}
  const resize=()=>{
    const aspect=sizeStage(canvas,renderer,style,camera),target=new THREE.Vector3(0,.20,.02),direction=new THREE.Vector3(.12,1.8,1.5).normalize()
    camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld(true)
    const inverse=camera.quaternion.clone().invert(),tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),p=new THREE.Vector3();let distance=3.4
    for(const amount of [0,1,-.6]){
      model.pose(Array(9).fill(amount));matrices()
      model.subject.traverse(o=>{const m=o as THREE.Mesh;if(!m.geometry)return;const vertices=m.geometry.getAttribute('position');for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(vertices,i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse);distance=Math.max(distance,p.z+Math.abs(p.x)/(tangent*aspect*.86),p.z+Math.abs(p.y)/(tangent*.86))}})
    }
    paint();camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);matrices()
  }
  return {
    start(){if(started||disposed)return;started=true;const initial=ctx.initialProgress??0;at=Number.isFinite(initial)?THREE.MathUtils.clamp(Math.floor(initial),0,3):0;resize();stopResize=observeCanvasResize(canvas,()=>{if(!disposed)resize()});ui.actionBtn.addEventListener('click',finish);window.addEventListener('keydown',keydown);window.addEventListener('blur',blur);window.addEventListener('focus',focus);sync()},
    update(dt){
      if(!started||disposed)return
      if(!active()){lifecycleVersion++;pointer.cancel();if(!suspended){suspended=true;sync()};return}
      if(notifying)return;if(suspended){suspended=false;sync()}
      if(controlsBusy!==pointer.isBusy())sync()
      const delta=Number.isFinite(dt)?THREE.MathUtils.clamp(dt,0,.05):0
      if(motions.some(Boolean)){motions.forEach((motion,key)=>{if(!motion)return;motion.time+=delta/.65;if(motion.time>=1||ctx.isReducedMotion?.())motions[key]=null});paint()}
      if(active()){matrices();style.render()}
    },
    dispose(){
      if(disposed)return;disposed=true;lifecycleVersion++;pointer.dispose();stopResize();feedback.dispose();audio.dispose();removeCues.forEach(remove=>remove())
      ui.actionBtn.removeEventListener('click',finish);noteButtons.forEach((button,key)=>button.removeEventListener('click',actions[key]!));window.removeEventListener('keydown',keydown)
      guardedEvents.forEach(type=>{window.removeEventListener(type,guardCallbackInput,true);ui.hitLayer.removeEventListener(type,guardCallbackInput,true)})
      window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);style.dispose();disposeTree(model.subject);Object.values(lights).forEach(light=>light.dispose());scene.clear();renderer.dispose();renderer.forceContextLoss();overlay.replaceChildren();overlay.classList.remove('scene-overlay','scene-overlay--stage','scene-overlay--sansi')
    },
  }
}
