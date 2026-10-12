// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { addInteractionCue, createInteractionCues } from './interaction-cues'
const handles: ReturnType<typeof createInteractionCues>[]=[]
afterEach(()=>{ handles.splice(0).forEach(h=>h.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount() {
  const host=document.createElement('div'), canvas=document.createElement('canvas'), hit=document.createElement('div')
  hit.className='scene-hit-layer'; host.append(canvas,hit); document.body.append(host)
  Object.defineProperties(canvas,{clientWidth:{value:320},clientHeight:{value:400}})
  canvas.getBoundingClientRect=()=>({left:10,top:20,width:320,height:400}) as DOMRect
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(40,.8,.1,20)
  camera.position.z=4; camera.lookAt(0,0,0); camera.updateMatrixWorld()
  const source=new THREE.Mesh(new THREE.SphereGeometry(.2),new THREE.MeshBasicMaterial())
  const target=new THREE.Object3D(); target.position.x=.6; scene.add(source,target)
  let enabled=true
  const remove=addInteractionCue(source,{kind:'drag',label:'拖起小物',enabled:()=>enabled,destination:target,targetLabel:'放到这里'})
  const cues=createInteractionCues(canvas,scene,camera); handles.push(cues)
  const update=()=>{scene.updateMatrixWorld(true); cues.update()}; update()
  return {host,hit,canvas,scene,source,target,cues,update,remove,disable:()=>{enabled=false}}
}
it('projects the actual source and target with passive labels',()=>{
  const s=mount(), source=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!, target=s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!
  expect(source).not.toBeNull(); expect(target).not.toBeNull()
  expect(source.textContent).toContain('拖起小物'); expect(target.textContent).toContain('放到这里')
  expect(Number(source.dataset.x)).toBeCloseTo(160); expect(Number(source.dataset.y)).toBeCloseTo(200)
  expect(Number(target.dataset.x)).toBeGreaterThan(160)
  expect(s.host.querySelector('.scene-object-cues')!.getAttribute('aria-hidden')).toBe('true')
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
it('keeps cue coordinates on the canvas when its positioned host has a border',()=>{
  const s=mount()
  s.host.getBoundingClientRect=()=>({left:5,top:15,width:330,height:410}) as DOMRect
  Object.defineProperties(s.host,{clientLeft:{value:5},clientTop:{value:5}})
  s.update()
  const layer=s.host.querySelector<HTMLElement>('.scene-object-cues')!
  expect(layer.style.left).toBe('0px');expect(layer.style.top).toBe('0px')
  expect(Number(s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!.dataset.x)).toBeCloseTo(160)
})
