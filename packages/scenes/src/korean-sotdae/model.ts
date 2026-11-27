import { applyCraftSurface, type CraftSurfaceOptions } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// Strip primitive pole/seam degeneracies; keep closed solids and outward winding.
function solid(source:THREE.BufferGeometry){
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),data:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-20)continue;data.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6}
 if(volume<0)for(let i=0;i<data.length;i+=9)for(let j=0;j<3;j++){const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data,3));geometry.computeVertexNormals();if(input!==source)input.dispose();source.dispose();return geometry
}
function paintEarthenMound(geometry:THREE.BufferGeometry,baseHex:string){
 const pos=geometry.getAttribute('position'),base=new THREE.Color(baseHex),colors=new Float32Array(pos.count*3),c=new THREE.Color()
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),r=Math.hypot(x,z),ang=Math.atan2(z,x)
  // Subtle deterministic rammed-earth tonal bands and organic soil variation (no stone/ceramic claim).
  const shade=(y<.06&&r<.10?-.10:0)+.028*Math.sin(y*62+ang*2)+.018*Math.cos(ang*5+r*14)-.035*THREE.MathUtils.clamp((r-.24)/.14,0,1)
  c.copy(base).offsetHSL(0,shade*.15,shade)
  colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
 return geometry
}
export function createKoreanSotdaeModel(){
 const root=new THREE.Group();root.name='sotdae-subject'
 const actor=new THREE.Group();actor.name='sotdae-pole';root.add(actor)
 const materials=new Map<string,THREE.MeshStandardMaterial>()
 const material=(color:string,surface?:CraftSurfaceOptions)=>{
  const key=`${color}:${surface?.kind??''}:${surface?.axis??''}`
  if(!materials.has(key)){const m=new THREE.MeshStandardMaterial({color,roughness:.88});if(surface)applyCraftSurface(m,surface);materials.set(key,m)}
  return materials.get(key)!
 }
 const surfaceFor=(name:string):CraftSurfaceOptions|undefined=>{
  if(/^sotdae-(shaft$|collar-|support-)/.test(name)||/^sotdae-bird-(tail$|neck$)/.test(name))return{kind:'wood',strength:.4,axis:'y'}
  if(/^sotdae-bird-(body$|head$|bill$|wing-)/.test(name))return{kind:'wood',strength:.4,axis:'z'}
 }
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,color:string,position:[number,number,number])=>{const m=new THREE.Mesh(solid(g),material(color,surfaceFor(name)));m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 // Compact chamfered rammed-earth mound socket grounded cleanly on the courtyard instead of a giant flat earth disc.
 const moundProfile: [number, number][] = [[0,0],[.35,0],[.36,.024],[.33,.064],[.27,.102],[.20,.12],[.11,.12],[.09,.108],[.09,.02],[0,.02]]
 const moundGeo=paintEarthenMound(solid(new THREE.LatheGeometry(moundProfile.map(([x,y])=>new THREE.Vector2(x,y)),36)),'#b49d70')
 const moundMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,vertexColors:true})
 const ground=new THREE.Mesh(moundGeo,moundMat);ground.name='sotdae-earthen-socket';ground.castShadow=ground.receiveShadow=true;root.add(ground)
 const shaft=mesh(actor,'sotdae-shaft',new THREE.CylinderGeometry(.055,.055,1.56,12),'#976345',[0,.78,0])
 const collars=[.35,1.05].map((y,i)=>mesh(actor,`sotdae-collar-${i}`,new THREE.CylinderGeometry(.075,.075,.10,12),'#a97b50',[0,y,0]))
 const duck=new THREE.Group();duck.name='sotdae-duck';actor.add(duck)
 const ellipsoid=(name:string,p:[number,number,number],scale:[number,number,number],color:string)=>{const m=mesh(duck,name,new THREE.SphereGeometry(1,12,8),color,p);m.scale.set(...scale);return m}
 ellipsoid('sotdae-bird-body',[0,1.68,0],[.16,.20,.36],'#c59b68')
 const tail=mesh(duck,'sotdae-bird-tail',new THREE.ConeGeometry(.13,.36,8),'#c59b68',[0,1.66,-.36]);tail.rotation.x=-Math.PI/2
 const start=new THREE.Vector3(0,1.72,.17),end=new THREE.Vector3(0,1.99,.25),neck=mesh(duck,'sotdae-bird-neck',new THREE.CylinderGeometry(.08,.085,start.distanceTo(end),12),'#c59b68',start.clone().add(end).multiplyScalar(.5).toArray() as [number,number,number]);neck.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize())
 ellipsoid('sotdae-bird-head',[0,2.02,.28],[.12,.13,.14],'#c59b68')
 mesh(duck,'sotdae-bird-bill',new THREE.BoxGeometry(.17,.065,.26),'#d7b779',[0,2,.475])
 for(const side of[-1,1]){ellipsoid(`sotdae-bird-wing-${side}`,[side*.14,1.68,-.02],[.055,.115,.245],'#ad8054');mesh(duck,`sotdae-bird-eye-${side}`,new THREE.SphereGeometry(.018,8,6),'#382d24',[side*.109,2.055,.33])}
 const pose=(step:number,t:number)=>{const n=THREE.MathUtils.clamp(t,0,1);if(step===0){actor.position.set(-.92,.40+.42*n,.48);actor.rotation.set(0,0,-Math.PI/2)}else if(step===1){actor.position.set(-.92*(1-n),.82,.48*(1-n));actor.rotation.set(0,0,-Math.PI/2*(1-n))}else{actor.position.set(0,step===2?.82-.80*n:.02,0);actor.rotation.set(0,0,0)}root.updateMatrixWorld(true)}
 pose(0,0)
 // Use actual transformed collar vertices for the chamfered wooden support contact planes, grounded on courtyard.
 const supports=collars.map((collar,i)=>{const p=collar.geometry.getAttribute('position'),v=new THREE.Vector3();let top=Infinity;for(let j=0;j<p.count;j++)top=Math.min(top,v.fromBufferAttribute(p,j).applyMatrix4(collar.matrixWorld).y);return mesh(root,`sotdae-support-${i}`,new RoundedBoxGeometry(.18,top,.24,2,.016),'#6b6758',[-.92+[.35,1.05][i]!, top/2,.48])})
 root.updateMatrixWorld(true)
 return{root,actor,shaft,collars,supports,ground,pose,targets:[actor,actor,actor],roots:[actor,actor,actor],anchors:[[0,.80,.02],[0,.80,.02],[0,.80,.02]] as [number,number,number][],dispose(){}}
}
