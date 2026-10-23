import * as THREE from 'three'

// Strip primitive pole/seam degeneracies; keep closed solids and outward winding.
function solid(source:THREE.BufferGeometry){
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),data:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-20)continue;data.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6}
 if(volume<0)for(let i=0;i<data.length;i+=9)for(let j=0;j<3;j++){const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data,3));geometry.computeVertexNormals();if(input!==source)input.dispose();source.dispose();return geometry
}
export function createKoreanSotdaeModel(){
 const root=new THREE.Group();root.name='sotdae-subject'
 const actor=new THREE.Group();actor.name='sotdae-pole';root.add(actor)
 const materials=new Map<string,THREE.MeshStandardMaterial>()
 const material=(color:string)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));return materials.get(color)!}
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,color:string,position:[number,number,number])=>{const m=new THREE.Mesh(solid(g),material(color));m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const ground=mesh(root,'sotdae-earthen-socket',new THREE.LatheGeometry([[0,0],[1.25,0],[1.25,.12],[.09,.12],[.09,.02],[0,.02]].map(([x,y])=>new THREE.Vector2(x!,y!)),32),'#b49d70',[0,0,0])
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
 // Use actual transformed collar vertices for the support contact planes.
 const supports=collars.map((collar,i)=>{const p=collar.geometry.getAttribute('position'),v=new THREE.Vector3();let top=Infinity;for(let j=0;j<p.count;j++)top=Math.min(top,v.fromBufferAttribute(p,j).applyMatrix4(collar.matrixWorld).y);return mesh(root,`sotdae-support-${i}`,new THREE.BoxGeometry(.18,top-.12,.24),'#6b6758',[-.92+[.35,1.05][i]!, (.12+top)/2,.48])})
 root.updateMatrixWorld(true)
 return{root,actor,shaft,collars,supports,ground,pose,targets:[actor,actor,actor],roots:[actor,actor,actor],anchors:[[0,.80,.02],[0,.80,.02],[0,.80,.02]] as [number,number,number][],dispose(){}}
}
