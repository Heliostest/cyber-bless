import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createRuyiBodyGeometry } from './geometry'
import { createContactShadow, createOutlineShell, createRuyiToonMaterial } from './toon'

// Original cloud-headed ruyi silhouette and display furniture, not a museum
// replica. The raised head, S-undulating handle, celadon colour and the
// one-piece two-post stand are product-original forms.
export const RUYI_COLORS = {
  jade: { lit: 0xe3f4ea, base: 0xa8d8c2, shade: 0x5e9e92, line: 0x2c5450 },
  wood: { lit: 0x7a4e38, base: 0x6a4330, shade: 0x452a1f, line: 0x24150f },
  pad: { lit: 0xc8735c, base: 0xb8644f, shade: 0x8c4a3a, line: 0x4a2219 },
  stone: 0x958d80,
} as const

const STAND = { x: .62, z: -.24, top: .46 }
const PREP = { x: -.74, z: .42, floor: -.10, top: .16 }
const CARRY = .90

/** Smooth, welded normals so an inverted hull stays closed around hard edges. */
function shellGeometry(source: THREE.BufferGeometry) {
  const copy = source.clone()
  for (const name of Object.keys(copy.attributes)) if (name !== 'position') copy.deleteAttribute(name)
  const welded = mergeVertices(copy, 1e-5); copy.dispose()
  welded.computeVertexNormals(); welded.computeBoundingBox(); welded.computeBoundingSphere()
  return welded
}

/** A soft cushion whose flat top is exactly at `height`. */
function cushion(radius: number, height: number) {
  const r = radius, h = height
  const g = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(r - .012, 0), new THREE.Vector2(r - .002, .006), new THREE.Vector2(r, h * .5),
    new THREE.Vector2(r - .004, h - .006), new THREE.Vector2(r - .016, h), new THREE.Vector2(0, h),
  ], 32)
  return g
}

export function createChineseRuyiScepterModel(){
 const root=new THREE.Group();root.name='chinese-ruyi-scepter-root'
 const subject=new THREE.Group();subject.name='chinese-ruyi-scepter-subject';root.add(subject)
 const scepter=new THREE.Group();scepter.name='ruyi-scepter';subject.add(scepter)
 // Small product motions live here, never on the placement root above.
 const motion=new THREE.Group();motion.name='ruyi-scepter-motion';scepter.add(motion)
 const jade=createRuyiToonMaterial('ruyi-celadon-toon',RUYI_COLORS.jade,{jade:true})
 const wood=createRuyiToonMaterial('ruyi-stand-wood-toon',RUYI_COLORS.wood,{bands:[.40,.86]})
 const pad=createRuyiToonMaterial('ruyi-stand-pad-toon',RUYI_COLORS.pad,{bands:[.40,.84]})
 const stone=new THREE.MeshStandardMaterial({color:RUYI_COLORS.stone,roughness:.96})
 applyCraftSurface(stone,{kind:'stone',strength:.35})
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const lined=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material,line:number,x=0,y=0,z=0)=>{const m=mesh(parent,name,g,mat,x,y,z);m.add(createOutlineShell(name+'-line',shellGeometry(g),line));return m}
 // A low slab only a little larger than the stand, in a mid warm grey.
 const slab=mesh(subject,'ruyi-stone-base',new RoundedBoxGeometry(1.72,.12,.66,2,.02),stone,STAND.x,-.06,STAND.z)
 slab.userData.toonSurface={outline:true}
 const body=createRuyiBodyGeometry(),[left,right]=body.supports
 // One-piece dark wooden supports: a plank, two round posts, collars and soft pads.
 const support=(kind:'low'|'high',x0:number,floor:number,top:number,z:number)=>{
  const span=right-left,baseH=kind==='high'?.075:.05,width=span+(kind==='high'?.36:.26),depth=kind==='high'?.30:.22
  lined(subject,'ruyi-'+kind+'-base',new RoundedBoxGeometry(width,baseH,depth,2,.022),wood,RUYI_COLORS.wood.line,x0+(left+right)/2,floor+baseH/2,z)
  for(const[i,x]of[left,right].entries()){
   const padH=.03,collarH=.026,postH=top-padH-collarH-floor-baseH
   lined(subject,'ruyi-'+kind+'-post-'+i,new THREE.CylinderGeometry(.040,.050,postH,24),wood,RUYI_COLORS.wood.line,x0+x,floor+baseH+postH/2,z)
   lined(subject,'ruyi-'+kind+'-seat-'+i,new THREE.CylinderGeometry(.078,.062,collarH,28),wood,RUYI_COLORS.wood.line,x0+x,top-padH-collarH/2,z)
   lined(subject,'ruyi-'+kind+'-pad-'+i,cushion(.084,padH),pad,RUYI_COLORS.pad.line,x0+x,top-padH,z)
  }
  const shadow=createContactShadow('ruyi-'+kind+'-contact-shadow',width+.30,depth+.26,kind==='high'?.40:.30)
  shadow.position.set(x0+(left+right)/2,floor+.004,z);subject.add(shadow)
 }
 support('low',PREP.x,PREP.floor,PREP.top,PREP.z)
 support('high',STAND.x,0,STAND.top,STAND.z)
 // A single closed body joins the raised cloud head to the S-undulating handle.
 const jadeBody=mesh(motion,'ruyi-jade-body',body.body,jade)
 jadeBody.add(createOutlineShell('ruyi-jade-line',body.body,RUYI_COLORS.jade.line))
 const checkpoints=[[PREP.x,PREP.top,PREP.z],[PREP.x,CARRY,PREP.z],[STAND.x,CARRY,STAND.z],[STAND.x,STAND.top,STAND.z]]as const
 function pose(step:number,n:number){const s=THREE.MathUtils.clamp(Math.floor(step),0,3),t=THREE.MathUtils.clamp(n,0,1),a=checkpoints[s]!,b=checkpoints[Math.min(s+1,3)]!;if(t===0)scepter.position.set(a[0],a[1],a[2]);else if(t===1)scepter.position.set(b[0],b[1],b[2]);else scepter.position.set(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);root.updateMatrixWorld(true)}
 pose(0,0)
 const anchor=[body.head[0],body.head[1],body.head[2]]as [number,number,number]
 return{root,subject,scepter,motion,jade,checkpoints,targets:[scepter,scepter,scepter],roots:[scepter,scepter,scepter],anchors:[anchor,anchor,anchor],pose}
}
