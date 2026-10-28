import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

/** A cutaway home and two handfuls of roasted beans; proportions and paths are illustrative. */
export function createSetsubunModel() {
  const root=new THREE.Group();root.name='beans-root'
  const subject=new THREE.Group();subject.name='beans-subject';root.add(subject)
  const mat=(color:number,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness})
  const wood=mat(0xae7b4c),lightWood=mat(0xd7ad73),paper=createRitualMaterial({color:0xf3e6bb,roughness:.85}, { kind: 'paper', strength: .24, fiber: 'paper' }),stone=mat(0xc5c6ab),floor=mat(0xc99560),beanMat=mat(0xd9b667,.7),hilumMat=mat(0x94714b)
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const box=(name:string,size:[number,number,number],p:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(new THREE.BoxGeometry(...size),m,parent,name);o.position.set(...p);return o}
  const inside=box('beans-inside-floor',[3,.16,2.5],[0,.015,.70],floor)
  const outside=box('beans-outside-stone',[3,.10,1.8],[0,-.015,-1.45],stone)
  box('beans-threshold',[3,.06,.35],[0,.065,-.725],stone)
  // Thin seams sit in the floor surface; they do not add a raised support plane.
  for(let i=0;i<7;i++)box('beans-floor-seam-'+i,[.012,.004,2.48],[-1.28+i*.42,.093,.70],wood)
  for(const x of [-1.25,1.25])box('beans-post-'+x,[.12,2.2,.46],[x,1.195,-.61],wood)
  box('beans-header',[2.62,.12,.46],[0,2.355,-.61],wood)
  const bottomTrack=box('beans-bottom-track',[2.62,.05,.42],[0,.12,-.61],lightWood)
  const topTrack=box('beans-top-track',[2.62,.05,.42],[0,2.27,-.61],lightWood)
  const panel=(name:string,z:number)=>{
    const g=new THREE.Group();g.name=name+'-root';g.position.set(name==='beans-door'?-.57:.57,.145,z);subject.add(g)
    const face=box(name,[1.12,2.1,.07],[0,1.05,0],paper,g)
    for(const x of [-.53,.53])box(name+'-edge-'+x,[.06,2.1,.09],[x,1.05,0],wood,g)
    for(const y of [.03,.55,1.05,1.55,2.07])box(name+'-rail-'+y,[1.12,.06,.09],[0,y,0],lightWood,g)
    box(name+'-vertical',[.04,2.1,.09],[0,1.05,0],lightWood,g)
    return {g,face}
  }
  panel('beans-fixed-panel',-.72)
  const door=panel('beans-door',-.50)
  // A solid bottom and four separate wooden walls make the masu visibly hollow.
  const cup=new THREE.Group();cup.name='beans-masu';cup.position.set(-.62,.095,.55);subject.add(cup)
  box('beans-masu-bottom',[.82,.04,.72],[0,.02,0],lightWood,cup)
  for(const x of [-.39,.39])box('beans-masu-side-'+x,[.04,.25,.72],[x,.165,0],lightWood,cup)
  for(const z of [-.34,.34])box('beans-masu-end-'+z,[.74,.25,.04],[0,.165,z],wood,cup)
  const groups:THREE.Group[]=[],bodies:THREE.Mesh[][]=[],targets:THREE.Mesh[]=[door.face]
  const starts=[new THREE.Vector3(-.79,.218,.55),new THREE.Vector3(-.45,.218,.55)]
  const ends=[new THREE.Vector3(-.64,.118,-1.60),new THREE.Vector3(-.12,.178,1.48)]
  for(const [batch,label] of ['out','in'].entries()){
    const g=new THREE.Group();g.name='beans-'+label+'-root';subject.add(g);groups.push(g);const list:THREE.Mesh[]=[]
    for(let i=0;i<3;i++){
      const b=mesh(new THREE.SphereGeometry(1,20,12),beanMat,g,i===1?'beans-'+label:'beans-'+label+'-'+i);b.scale.set(.105,.083,.085);list.push(b)
      const h=mesh(new THREE.SphereGeometry(1,12,8),hilumMat,b,'beans-'+label+'-hilum-'+i);h.scale.set(.32,.13,.12);h.position.set(0,.10,.94)
    }
    bodies.push(list);targets.push(list[1]!)
  }
  const pose=(step:number,amount:number)=>{
    const t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0
    const opening=step>0?1:step===0?t:0;door.g.position.x=-.57+1.14*opening
    for(let batch=0;batch<2;batch++){
      const p=step>batch+1?1:step===batch+1?t:0,travel=THREE.MathUtils.smoothstep(p,.20,.86)
      const arc=p===0||p===1?0:.85*Math.sin(Math.PI*p)
      groups[batch]!.position.lerpVectors(starts[batch]!,ends[batch]!,travel)
      groups[batch]!.position.y=THREE.MathUtils.lerp(starts[batch]!.y,ends[batch]!.y,p)+arc
      bodies[batch]!.forEach((b,i)=>{
        b.position.set((i-1)*.32*travel,0,THREE.MathUtils.lerp((i-1)*.21,(i-1)*.18,travel))
      })
    }
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,targets,roots:[door.g,...groups],anchors:[[.20,-.12,.04],[0,.05,.04],[0,.05,.04]] as [number,number,number][],pose,bodies,inside,outside,bottomTrack,topTrack}
}
