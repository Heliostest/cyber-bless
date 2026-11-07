// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { addInteractionCue, createInteractionCues } from './interaction-cues'
import { bindSceneMotion } from './scene-motion'
const handles: ReturnType<typeof createInteractionCues>[]=[]
// Geometry and lifecycle tests do not rasterize fonts; the browser verifies the actual texture.
beforeEach(()=>{ vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null) })
afterEach(()=>{ handles.splice(0).forEach(h=>h.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(motion?: { active: boolean; reducedMotion: boolean }, redraw: () => void = () => {}) {
  const host=document.createElement('div'), canvas=document.createElement('canvas'), hit=document.createElement('div'), overlay=document.createElement('div')
  overlay.className='scene-overlay-host'; hit.className='scene-hit-layer'; overlay.append(hit); host.append(canvas,overlay); document.body.append(host)
  Object.defineProperties(canvas,{clientWidth:{value:320},clientHeight:{value:400}})
  canvas.getBoundingClientRect=()=>({left:10,top:20,width:320,height:400}) as DOMRect
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(40,.8,.1,20)
  camera.position.z=4; camera.lookAt(0,0,0); camera.updateMatrixWorld()
  const source=new THREE.Mesh(new THREE.SphereGeometry(.2),new THREE.MeshBasicMaterial())
  const target=new THREE.Object3D(); target.position.x=.6; scene.add(source,target)
  let enabled=true
  const remove=addInteractionCue(source,{kind:'drag',label:'拖起小物',enabled:()=>enabled,destination:target,targetLabel:'放到这里'})
  if(motion) bindSceneMotion(host,()=>motion)
  const cues=createInteractionCues(canvas,scene,camera,redraw); handles.push(cues)
  const update=()=>{scene.updateMatrixWorld(true); cues.update()}; update()
  return {host,hit,canvas,scene,camera,source,target,cues,update,remove,disable:()=>{enabled=false},enable:()=>{enabled=true}}
}
it('draws the connector toward the exact touch point before revealing that point',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),s=mount({active:true,reducedMotion:false})
  const line=s.scene.getObjectByName('interaction-cue-leader') as THREE.Line
  const point=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
  const length=()=>{const p=line.geometry.getAttribute('position');return new THREE.Vector3().fromBufferAttribute(p,0).distanceTo(new THREE.Vector3().fromBufferAttribute(p,1))}
  expect(length()).toBeCloseTo(0)
  expect(Number(point.style.getPropertyValue('--cue-reveal'))).toBe(0)
  clock.mockReturnValue(200);s.update();const middleLength=length()
  expect(middleLength).toBeGreaterThan(0)
  expect(Number(point.style.getPropertyValue('--cue-reveal'))).toBe(0)
  clock.mockReturnValue(400);s.update()
  expect(Number(point.style.getPropertyValue('--cue-reveal'))).toBeGreaterThan(0)
  clock.mockReturnValue(700);s.update()
  expect(length()).toBeGreaterThan(middleLength)
  expect(Number(point.style.getPropertyValue('--cue-reveal'))).toBe(1)
  expect(new THREE.Vector3().fromBufferAttribute(line.geometry.getAttribute('position'),1).project(s.camera).x).toBeCloseTo(0)
})
it('fades the touch point and retracts its connector before releasing the departing group',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),s=mount({active:true,reducedMotion:false})
  clock.mockReturnValue(700);s.update()
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  const point=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!,released=vi.fn()
  board.material.map!.addEventListener('dispose',released)
  s.disable();s.update()
  expect(board.parent).not.toBeNull();expect(released).not.toHaveBeenCalled()
  expect(s.host.querySelector('.scene-cue-guide')).toBeNull()
  clock.mockReturnValue(760);s.update()
  expect(Number(point.style.getPropertyValue('--cue-reveal'))).toBeLessThan(1)
  clock.mockReturnValue(1000);s.update()
  expect(board.parent).toBeNull();expect(point.isConnected).toBe(false);expect(released).toHaveBeenCalledOnce()
})
it('revives an interrupted exit without replacing the label texture or touch point',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),s=mount({active:true,reducedMotion:false})
  clock.mockReturnValue(700);s.update()
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite,texture=board.material.map
  const point=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
  s.disable();s.update();clock.mockReturnValue(760);s.update();s.enable();s.update()
  clock.mockReturnValue(1400);s.update()
  expect(s.scene.getObjectByName('interaction-cue-placard')).toBe(board)
  expect(board.material.map).toBe(texture)
  expect(s.host.querySelector('[data-cue-role="source"]')).toBe(point)
  expect(board.material.opacity).toBe(1)
  expect(Number(point.style.getPropertyValue('--cue-reveal'))).toBe(1)
})
it('revives every selected cue before trimming the retiring-group budget',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),s=mount({active:true,reducedMotion:false})
  let first=true
  for (let i=0;i<5;i++) {
    const object=new THREE.Object3D();object.position.x=(i-2)*.1;s.scene.add(object)
    addInteractionCue(object,{kind:'tap',label:`小物 ${i}`,enabled:()=>i<2?first:!first})
  }
  s.update();clock.mockReturnValue(700);s.update()
  const root=s.scene.getObjectByName('interaction-cue-presentations')!
  const original=root.children.filter(n=>n.name==='interaction-cue-placard')
  expect(original).toHaveLength(3)
  first=false;s.disable();s.update();clock.mockReturnValue(760);s.update()
  first=true;s.enable();s.update()
  expect(original.every(board=>board.parent===root)).toBe(true)
  expect(root.children.filter(n=>n.name==='interaction-cue-placard')).toHaveLength(6)
  clock.mockReturnValue(1400);s.update()
  expect(root.children.filter(n=>n.name==='interaction-cue-placard')).toHaveLength(3)
})
it('keeps a departing connector and touch point anchored while its object moves',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),s=mount({active:true,reducedMotion:false})
  clock.mockReturnValue(700);s.update();s.disable();s.update()
  s.source.position.set(-.4,.2,0);clock.mockReturnValue(730);s.update()
  const projected=s.source.getWorldPosition(new THREE.Vector3()).project(s.camera)
  const point=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
  expect(Number(point.dataset.x)).toBeCloseTo((projected.x+1)*160)
  expect(Number(point.dataset.y)).toBeCloseTo((1-projected.y)*200)
  const line=s.scene.getObjectByName('interaction-cue-leader') as THREE.Line
  // The leader has not begun retracting at 30ms, so it still reaches the point.
  const end=new THREE.Vector3().fromBufferAttribute(line.geometry.getAttribute('position'),1).project(s.camera)
  expect(end.x).toBeCloseTo(projected.x);expect(end.y).toBeCloseTo(projected.y)
})
it('keeps the connector and point established while changing only the current instruction',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),s=mount({active:true,reducedMotion:false})
  clock.mockReturnValue(700);s.update()
  const line=s.scene.getObjectByName('interaction-cue-leader') as THREE.Line
  s.source.userData.interactionCues[0].label='下一步，请继续';s.update()
  const p=line.geometry.getAttribute('position')
  expect(new THREE.Vector3().fromBufferAttribute(p,0).distanceTo(new THREE.Vector3().fromBufferAttribute(p,1))).toBeGreaterThan(0)
  expect(Number(s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!.style.getPropertyValue('--cue-reveal'))).toBe(1)
})
it('preserves the visible text composite when exit interrupts a crossfade',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),s=mount({active:true,reducedMotion:false})
  clock.mockReturnValue(700);s.update();s.source.userData.interactionCues[0].label='下一步';s.update()
  clock.mockReturnValue(720);s.update()
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  const ghost=s.scene.getObjectByName('interaction-cue-retiring') as THREE.Sprite
  const composite=board.material.opacity+ghost.material.opacity
  expect(composite).toBeCloseTo(1)
  s.disable();s.update()
  expect(ghost.parent!==null).toBe(true)
  expect(board.material.opacity+ghost.material.opacity).toBeCloseTo(composite)
  clock.mockReturnValue(870);s.update()
  expect(board.material.opacity+ghost.material.opacity).toBeLessThan(composite)
  clock.mockReturnValue(1020);s.update();expect(ghost.parent).toBeNull();expect(board.parent).toBeNull()
})
it('immediately clears departing GPU resources when motion is reduced, paused or disposed',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),motion={active:true,reducedMotion:false},s=mount(motion)
  clock.mockReturnValue(700);s.update()
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite,released=vi.fn()
  board.material.map!.addEventListener('dispose',released)
  s.disable();s.update();motion.reducedMotion=true;s.update()
  expect(board.parent).toBeNull();expect(released).toHaveBeenCalledOnce()
  expect(s.host.querySelector('[data-retiring]')).toBeNull()
  motion.reducedMotion=false;s.enable();s.update();clock.mockReturnValue(1400);s.update();s.disable();s.update()
  s.cues.dispose();s.cues.dispose()
  expect(s.scene.getObjectByName('interaction-cue-presentations')).toBeUndefined()
})
it('hands over different cues without leaving the old instruction in the current guide',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0),s=mount({active:true,reducedMotion:false})
  clock.mockReturnValue(700);s.update()
  addInteractionCue(s.target,{kind:'tap',label:'轻点新的小物',enabled:()=>true})
  s.disable();s.update()
  expect(s.host.querySelector('.scene-cue-guides')!.textContent).toBe('轻点新的小物')
  expect(s.host.querySelector('[data-retiring="true"]')).not.toBeNull()
  clock.mockReturnValue(1500);s.update()
  expect(s.host.querySelector('[data-retiring="true"]')).toBeNull()
  expect(s.host.querySelectorAll('[data-cue-role="source"]')).toHaveLength(1)
})
it('reveals a new placard gently without moving its actual manipulation point',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0)
  const s=mount({active:true,reducedMotion:false})
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  expect(board.material.opacity).toBe(0)
  clock.mockReturnValue(180); s.update()
  expect(board.material.opacity).toBeGreaterThan(0)
  expect(board.material.opacity).toBeLessThan(1)
  expect(Number(s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!.dataset.y)).toBeCloseTo(200)
  clock.mockReturnValue(700); s.update()
  expect(board.material.opacity).toBe(1)
})
it('crossfades changed instructions and releases each retired texture, including rapid replacements',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0)
  const s=mount({active:true,reducedMotion:false})
  clock.mockReturnValue(700); s.update()
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  const oldMap=board.material.map!, retired=vi.fn(); oldMap.addEventListener('dispose',retired)
  s.source.userData.interactionCues[0].label='下一步'; s.update()
  expect(s.scene.getObjectByName('interaction-cue-retiring')).toBeDefined()
  expect(retired).not.toHaveBeenCalled()
  clock.mockReturnValue(760); s.source.userData.interactionCues[0].label='最后一步'; s.update()
  expect(retired).toHaveBeenCalledOnce()
  expect(s.scene.getObjectByName('interaction-cue-presentations')!.children.filter(n=>n.name==='interaction-cue-retiring')).toHaveLength(1)
  clock.mockReturnValue(1500); s.update()
  expect(s.scene.getObjectByName('interaction-cue-retiring')).toBeUndefined()
  expect(board.material.opacity).toBe(1)
})
it('settles an in-flight reveal and stops requesting frames when motion is reduced or the scene pauses',async()=>{
  vi.spyOn(performance,'now').mockReturnValue(0)
  vi.spyOn(window,'requestAnimationFrame').mockReturnValue(73)
  const cancel=vi.spyOn(window,'cancelAnimationFrame')
  const motion={active:true,reducedMotion:false},s=mount(motion)
  await Promise.resolve()
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  motion.reducedMotion=true; s.update()
  expect(board.material.opacity).toBe(1)
  expect(cancel).toHaveBeenCalledWith(73)
  expect(s.host.querySelector<HTMLElement>('.scene-object-cues')!.dataset.motion).toBe('still')
  motion.active=false; s.update()
  expect(s.scene.getObjectByName('interaction-cue-presentations')!.visible).toBe(false)
})
it('shares an existing scene frame and only redraws the world itself for an on-demand owner',async()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0)
  const callbacks: FrameRequestCallback[]=[]
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{callbacks.push(callback);return callbacks.length})
  const redraw=vi.fn()
  const s=mount({active:true,reducedMotion:false},redraw)
  await Promise.resolve()
  clock.mockReturnValue(16); s.update(); callbacks.shift()!(16)
  expect(redraw).not.toHaveBeenCalled()
  await Promise.resolve()
  clock.mockReturnValue(32); callbacks.shift()!(32)
  expect(redraw).toHaveBeenCalledOnce()
})
it('keeps live progress fully readable instead of restarting a reveal on every numeric update',()=>{
  const clock=vi.spyOn(performance,'now').mockReturnValue(0)
  const s=mount({active:true,reducedMotion:false})
  const hint=document.createElement('p'); hint.className='scene-hint'; hint.dataset.progress='true'
  s.host.querySelector('.scene-overlay-host')!.append(hint)
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  for(let progress=1;progress<=40;progress++) {
    clock.mockReturnValue(progress*16); hint.textContent=`刷印 ${progress}%，抬手后也可以接着擦。`; s.update()
    expect(board.material.opacity).toBe(1)
    expect(s.scene.getObjectByName('interaction-cue-retiring')).toBeUndefined()
  }
})
it('projects the actual source and target with passive labels',()=>{
  const s=mount(), source=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!, target=s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!
  expect(source).not.toBeNull(); expect(target).not.toBeNull()
  expect(source.textContent).toBe(''); expect(target.textContent).toBe('')
  const guide=s.host.querySelector('.scene-overlay-host .scene-cue-guides')!
  expect(guide.textContent).toContain('拖起小物'); expect(guide.textContent).toContain('放到这里')
  expect(Number(source.dataset.x)).toBeCloseTo(160); expect(Number(source.dataset.y)).toBeCloseTo(200)
  expect(Number(target.dataset.x)).toBeGreaterThan(160)
  expect(s.host.querySelector('.scene-object-cues')!.getAttribute('aria-hidden')).toBe('true')
})
it('keeps optional inspection help visible in the guide shelf and follows its current locale and phase',()=>{
  const s=mount(), hint=document.createElement('div')
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  const originalHeight=(board.material.map!.image as HTMLCanvasElement).height
  hint.className='scene-hint'; hint.dataset.placementInspection='true'; hint.title='Two fingers turn the object.'
  s.host.querySelector('.scene-overlay-host')!.append(hint); s.update()
  const help=s.host.querySelector('.scene-cue-guides .scene-inspection-help')!
  expect(help?.textContent).toBe(hint.title)
  expect((board.material.map!.image as HTMLCanvasElement).height).toBeGreaterThan(originalHeight)
  expect(s.hit.contains(help)).toBe(false)
  hint.title='Deux doigts pour tourner.'; s.update()
  expect(help.textContent).toBe(hint.title)
  delete hint.dataset.placementInspection; s.update()
  expect(s.host.querySelector('.scene-inspection-help')).toBeNull()
  expect((board.material.map!.image as HTMLCanvasElement).height).toBe(originalHeight)
})
it('shows direction in the separate guide and follows a moving destination without drawing across the object',()=>{
  const s=mount()
  const direction=s.host.querySelector<HTMLElement>('.scene-cue-direction')!
  expect(direction.style.getPropertyValue('--cue-angle')).toBe('0deg')
  s.target.position.set(0,.6,0); s.update()
  expect(direction.style.getPropertyValue('--cue-angle')).toBe('-90deg')
  expect(s.host.querySelector('.scene-object-cue-path')).toBeNull()
})
it('uses the shared tray for a woodfish hit layer too',()=>{
  const s=mount()
  s.host.className='library-scene-stage woodfish-stage'
  s.hit.classList.add('woodfish-object'); s.update()
  const overlay=s.host.querySelector('.scene-overlay-host')!
  expect(overlay.querySelector('.scene-cue-guides')?.textContent).toContain('拖起小物')
  expect(s.hit.querySelector('.scene-cue-guides')).toBeNull()
  s.cues.dispose(); expect(overlay.querySelector('.scene-cue-guides')).toBeNull()
})
it('follows movement and hides completed or unavailable cues',()=>{
  const s=mount(); s.source.position.x=-.4; s.update()
  expect(Number(s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!.dataset.x)).toBeLessThan(160)
  s.disable(); s.update(); expect(s.host.querySelector('.scene-object-cues')!.childElementCount).toBe(0)
})
it('does not move offscreen points to a misleading position inside the canvas',()=>{
  const s=mount(); s.source.position.x=100; s.update()
  expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
  s.source.position.set(0,0,5); s.update(); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
})
it('hides a source whose parent is invisible and survives overlay resets',()=>{
  const s=mount(); const parent=new THREE.Group(); s.scene.add(parent); parent.add(s.source); parent.visible=false; s.update()
  expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
  parent.visible=true; s.hit.replaceChildren(); s.update()
  expect(s.host.querySelector('[data-cue-role="source"]')).not.toBeNull()
})
it('uses the real object ray to choose cursor without changing game callbacks',()=>{
  const s=mount(); const move=(x:number)=>s.hit.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:x,clientY:220}))
  move(170); expect(s.hit.style.cursor).toBe('grab')
  move(20); expect(s.hit.style.cursor).toBe('')
  const cue=s.source.userData.interactionCues[0]; cue.kind='tap'; s.update(); move(170); expect(s.hit.style.cursor).toBe('pointer')
})
it('releases DOM/listeners, restores cursor and handles detached canvases',()=>{
  const s=mount(); s.cues.dispose(); s.cues.dispose(); s.update()
  expect(s.host.querySelector('.scene-object-cues')).toBeNull()
  s.hit.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:170,clientY:220})); expect(s.hit.style.cursor).toBe('')
  expect(()=>createInteractionCues(undefined,s.scene,new THREE.Camera()).dispose()).not.toThrow()
})
it('shows the destination while a real drag is active and clears presentation on cancellation',()=>{
  const s=mount()
  s.hit.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:170,clientY:220}))
  expect(s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!.dataset.dragging).toBe('true')
  expect(s.host.querySelector('[data-cue-role="target"]')).not.toBeNull()
  window.dispatchEvent(new MouseEvent('pointercancel'))
  expect(s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!.dataset.dragging).toBeUndefined()
  expect(s.hit.style.cursor).toBe('')
})
it('uses a direct tap marker when it is also a drag destination, then restores the destination when the tap is unavailable',()=>{
  const s=mount()
  const removeTap=addInteractionCue(s.target,{kind:'tap',label:'点这里',enabled:()=>true})
  s.update()
  expect(s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!.hidden).toBe(true)
  expect(s.host.querySelectorAll('[data-cue-role="source"]')).toHaveLength(2)
  removeTap(); s.update()
  expect(s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!.hidden).toBe(false)
  s.scene.remove(s.source); s.update()
  expect(s.host.querySelector('.scene-object-cues')!.childElementCount).toBe(0)
})
it('keeps a nearby drag destination visible while following closely spaced path points',()=>{
  const s=mount(); s.target.position.x=.08; s.update()
  const source=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
  const target=s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!
  expect(Math.abs(Number(source.dataset.x)-Number(target.dataset.x))).toBeLessThan(24)
  expect(target.hidden).toBe(false)
  s.hit.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:170,clientY:220}))
  s.source.position.copy(s.target.position); s.target.position.x+=.08; s.update()
  expect(target.hidden).toBe(false)
})
it('keeps cue coordinates on the canvas when its positioned host has a border',()=>{
  const s=mount()
  s.host.getBoundingClientRect=()=>({left:5,top:15,width:330,height:410}) as DOMRect
  Object.defineProperties(s.host,{clientLeft:{value:5},clientTop:{value:5}})
  s.update()
  const layer=s.host.querySelector<HTMLElement>('.scene-object-cues')!
  expect(layer.style.left).toBe('0px');expect(layer.style.top).toBe('0px')
  expect(Number(s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!.dataset.x)).toBeCloseTo(160)
})

it('puts the instruction in the Three scene and connects its leader to the actual moving white point',()=>{
  const s=mount()
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  const leader=s.scene.getObjectByName('interaction-cue-leader') as THREE.Line
  expect(board?.isSprite).toBe(true); expect(leader?.isLine).toBe(true)
  expect(board.layers.test(s.source.layers)).toBe(false)
  const end=()=>new THREE.Vector3().fromBufferAttribute(leader.geometry.getAttribute('position'),1).project(s.camera)
  expect(end().x).toBeCloseTo(0); expect(end().y).toBeCloseTo(0)
  s.source.position.set(-.4,.2,0); s.update()
  const projected=s.source.getWorldPosition(new THREE.Vector3()).project(s.camera)
  expect(end().x).toBeCloseTo(projected.x); expect(end().y).toBeCloseTo(projected.y)
  expect(s.host.style.getPropertyValue('--cue-guide-height')).toBe('')
})

it('keeps a long localized placard within the canvas and releases all of its GPU resources',()=>{
  const s=mount(), cue=s.source.userData.interactionCues[0]
  cue.label='Déplacez délicatement le petit objet vers le repère indiqué'; s.source.position.set(.9,.9,0); s.update()
  const board=s.scene.getObjectByName('interaction-cue-placard') as THREE.Sprite
  const leader=s.scene.getObjectByName('interaction-cue-leader') as THREE.Line
  const center=board.position.clone().project(s.camera)
  const right=board.position.clone().add(new THREE.Vector3(board.scale.x/2,0,0)).project(s.camera)
  expect(center.x-(right.x-center.x)).toBeGreaterThanOrEqual(-1)
  expect(right.x).toBeLessThanOrEqual(1)
  const texture=board.material.map!, disposeMap=vi.fn(), disposeMat=vi.fn(), disposeLine=vi.fn()
  texture.addEventListener('dispose',disposeMap); board.material.addEventListener('dispose',disposeMat); leader.geometry.addEventListener('dispose',disposeLine)
  s.disable(); s.update()
  expect(s.scene.getObjectByName('interaction-cue-placard')).toBeUndefined()
  expect(disposeMap).toHaveBeenCalledOnce(); expect(disposeMat).toHaveBeenCalledOnce(); expect(disposeLine).toHaveBeenCalledOnce()
})

it('hides the Three placard for a paused overlay and never creates one for compact instrument points',()=>{
  const s=mount(), layer=s.host.querySelector<HTMLElement>('.scene-object-cues')!
  layer.hidden=true; s.update()
  const root=s.scene.getObjectByName('interaction-cue-presentations')!
  expect(root.visible).toBe(false)
  layer.hidden=false; s.source.userData.interactionCues[0].compact=true; s.update()
  expect(s.scene.getObjectByName('interaction-cue-placard')).toBeUndefined()
  expect(s.host.querySelector('[data-cue-role="source"]')).not.toBeNull()
})
