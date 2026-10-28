import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

/** Original prepared nazar display: one closed, pierced glass surface and a rigid metal bail. */
export function createTurkishNazarBeadModel() {
 const root=new THREE.Group();root.name='turkish-nazar-bead-root'
 const subject=new THREE.Group();subject.name='turkish-nazar-bead-subject';root.add(subject)
 const charm=new THREE.Group();charm.name='nazar-charm';subject.add(charm)
 const matte=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.88})
 const wood=matte(0x9d7852),ceramic=matte(0xe7d8b9),stone=matte(0xc7bba4)
 const metal=new THREE.MeshPhysicalMaterial({color:0xbda66d,metalness:.68,roughness:.25,clearcoat:.35})
 const glass=[0x16488e,0xf2edda,0x6cbac9,0x152a42].map((color,index)=>index===0?createRitualMaterial({color,roughness:.16,clearcoat:1,clearcoatRoughness:.08,ior:1.5,envMapIntensity:.85,transmission:.1,attenuationColor:color,attenuationDistance:.2},{kind:'glass',thickness:.13,strength:.1}):new THREE.MeshPhysicalMaterial({color,roughness:.16,clearcoat:1,clearcoatRoughness:.08,ior:1.5,envMapIntensity:.85}))
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material|THREE.Material[],parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const box=(name:string,size:[number,number,number],p:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(name,new THREE.BoxGeometry(...size),m,parent);o.position.set(...p);return o}
 // One indexed closed surface. Coloured regions meet along shared vertices;
 // no opaque glass behind an applied eye and no stacked disks or floating decals.
 const positions:number[]=[],groups:number[][]=[[],[],[],[]],cache=new Map<string,number>()
 type P=[number,number,number]
 const index=(p:P)=>{const key=p.map(n=>Math.round(n*1e8)).join(',');let i=cache.get(key);if(i===undefined){i=positions.length/3;positions.push(...p);cache.set(key,i)}return i}
 const tri=(material:number,a:P,b:P,c:P,normal:P)=>{
  const n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)))
  if(n.lengthSq()<1e-20)return
  groups[material]!.push(index(a),...n.dot(new THREE.Vector3(...normal))<0?[index(c),index(b)]:[index(b),index(c)])
 }
 const circle=(r:number,y=0,count=64,clockwise=false)=>Array.from({length:count},(_,i)=>{const a=(clockwise?-1:1)*i/count*Math.PI*2;return new THREE.Vector2(r*Math.cos(a),y+r*Math.sin(a))})
 const cap=(z:number,holes:THREE.Vector2[][],front:boolean)=>{const outer=circle(.38),vertices=[...outer,...holes.flat()];for(const ids of THREE.ShapeUtils.triangulateShape(outer,holes)){const a=vertices[ids[0]!]!,b=vertices[ids[1]!]!,c=vertices[ids[2]!]!;tri(0,[a.x,a.y,z],[b.x,b.y,z],[c.x,c.y,z],[0,0,front?1:-1])}}
 cap(.065,[circle(.25,-.04,64,true),circle(.035,.29,32,true)],true)
 cap(-.065,[circle(.035,.29,32,true)],false)
 const skin=(a:{r:number;z:number},b:{r:number;z:number},y:number,count:number,inward=false)=>{
  for(let i=0;i<count;i++){const t=i/count*Math.PI*2,u=(i+1)/count*Math.PI*2,normal:P=[Math.cos(t)*(inward?-1:1),Math.sin(t)*(inward?-1:1),0]
   const p:P=[a.r*Math.cos(t),y+a.r*Math.sin(t),a.z],q:P=[a.r*Math.cos(u),y+a.r*Math.sin(u),a.z],r:P=[b.r*Math.cos(t),y+b.r*Math.sin(t),b.z],s:P=[b.r*Math.cos(u),y+b.r*Math.sin(u),b.z]
   tri(0,p,q,r,normal);tri(0,r,q,s,normal)
  }
 }
 const rim=[{r:.38,z:.065},{r:.398,z:.045},{r:.408,z:0},{r:.398,z:-.045},{r:.38,z:-.065}]
 for(let i=0;i<rim.length-1;i++)skin(rim[i]!,rim[i+1]!,0,64)
 skin({r:.035,z:.065},{r:.035,z:-.065},.29,32,true)
 const inlay=(material:number,outer:number,inner:number,zo:number,zi:number)=>{
  for(let i=0;i<64;i++){const t=i/64*Math.PI*2,u=(i+1)/64*Math.PI*2
   const a:P=[outer*Math.cos(t),-.04+outer*Math.sin(t),zo],b:P=[outer*Math.cos(u),-.04+outer*Math.sin(u),zo]
   const c:P=[inner*Math.cos(t),-.04+inner*Math.sin(t),zi],d:P=[inner*Math.cos(u),-.04+inner*Math.sin(u),zi]
   tri(material,a,b,c,[0,0,1]);if(inner>0)tri(material,c,b,d,[0,0,1])
  }
 }
 inlay(1,.25,.162,.065,.085);inlay(2,.162,.085,.085,.094);inlay(3,.085,0,.094,.099)
 const g=new THREE.BufferGeometry(),indices:number[]=[]
 for(const [material,part]of groups.entries()){g.addGroup(indices.length,part.length,material);indices.push(...part)}
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals()
 const bead=mesh('nazar-glass-eye',g,glass,charm);bead.userData.toonSurface={outline:false}
 // A rigid bail is a product fixture. Its rounded lower bar passes through the
 // actual upper hole and contacts the bore's upper edge, supporting the glass.
 class Arc extends THREE.Curve<THREE.Vector3>{
  private y:number;private z:number;private r:number;private a:number;private b:number
  constructor(y:number,z:number,r:number,a:number,b:number){super();this.y=y;this.z=z;this.r=r;this.a=a;this.b=b}
  getPoint(t:number,target=new THREE.Vector3()){const a=THREE.MathUtils.lerp(this.a,this.b,t);return target.set(0,this.y+this.r*Math.sin(a),this.z+this.r*Math.cos(a))}
 }
 const path=new THREE.CurvePath<THREE.Vector3>(),v=(y:number,z:number)=>new THREE.Vector3(0,y,z)
 path.add(new THREE.LineCurve3(v(.3155,0),v(.3155,.085)))
 path.add(new Arc(.3355,.085,.02,-Math.PI/2,0))
 path.add(new THREE.LineCurve3(v(.3355,.105),v(.70,.105)))
 path.add(new Arc(.70,0,.105,0,Math.PI))
 path.add(new THREE.LineCurve3(v(.70,-.105),v(.3355,-.105)))
 path.add(new Arc(.3355,-.085,.02,Math.PI,Math.PI*1.5))
 path.add(new THREE.LineCurve3(v(.3155,-.085),v(.3155,0)))
 const bail=mesh('nazar-hanger-loop',new THREE.TubeGeometry(path,128,.0095,12,true),metal,charm);bail.userData.toonSurface={outline:false}
 box('nazar-rest-base',[.42,.052,.30],[-.95,.026,.42],ceramic)
 box('nazar-rest-front',[.30,.15,.025],[-.95,.127,.555],ceramic)
 box('nazar-rest-back',[.30,.15,.025],[-.95,.127,.30],ceramic)
 const foot=mesh('nazar-stand-base',new THREE.CylinderGeometry(.19,.205,.07,40),wood);foot.position.set(.93,.035,.42)
 const post=mesh('nazar-stand-post',new THREE.CylinderGeometry(.045,.049,1.87,24),wood);post.position.set(.93,1.005,.42)
 const peg=mesh('nazar-peg',new THREE.CylinderGeometry(.024,.024,.68,32).rotateZ(-Math.PI/2),wood);peg.position.set(.60,1.7915,.42)
 const pegCap=mesh('nazar-peg-cap',new THREE.CylinderGeometry(.035,.035,.026,32).rotateZ(-Math.PI/2),wood);pegCap.position.set(.26,1.7915,.42)
 box('nazar-stone-base',[2.95,.12,1.35],[-.05,-.06,.35],stone,root)
 const states:[number,number,number][]=[[-.95,.46,.42],[-.95,1.16,.42],[.37,1.16,.42],[.37,1.02,.42]]
 const pose=(step:number,n:number)=>{const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0,i=THREE.MathUtils.clamp(Math.floor(step),0,3),a=states[i]!,b=states[Math.min(i+1,3)]!;charm.rotation.set(0,0,0)
  if(t===0||i===3)charm.position.set(...a);else if(t===1)charm.position.set(...b);else charm.position.set(THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t))
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,charm,targets:[charm,charm,charm],roots:[charm,charm,charm],anchors:[[0,-.04,.11],[0,-.04,.11],[0,-.04,.11]] as [number,number,number][],pose}
}
