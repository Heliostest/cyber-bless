import * as THREE from 'three'

/** Original assisted steelyard; authored levelling poses, without calibrated measurements. */
export function createSteelyardModel(){
 const root=new THREE.Group();root.name='steelyard-subject'
 const wood=new THREE.MeshStandardMaterial({color:'#b88a55',roughness:.83}),brass=new THREE.MeshStandardMaterial({color:'#bc995f',metalness:.5,roughness:.52}),bronze=new THREE.MeshStandardMaterial({color:'#8b6d4b',metalness:.45,roughness:.6}),rope=new THREE.MeshStandardMaterial({color:'#ece4c9',roughness:1}),orange=new THREE.MeshStandardMaterial({color:'#e5a64f',roughness:.65}),green=new THREE.MeshStandardMaterial({color:'#6c7842',roughness:.9})
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const group=(name:string)=>{const o=new THREE.Group();o.name=name;root.add(o);return o}
 const revolve=(profile:[number,number][])=>{const v:number[]=[],indices:number[]=[],rows:number[][]=[],n=48;for(const[r,y]of profile){const row:number[]=[];for(let i=0;i<(r===0?1:n);i++){row.push(v.length/3);const a=i*2*Math.PI/n;v.push(r*Math.cos(a),y,r*Math.sin(a))}rows.push(row)}for(let k=0;k<rows.length-1;k++){const a=rows[k]!,b=rows[k+1]!;for(let i=0;i<n;i++){const j=(i+1)%n;if(a.length===1)indices.push(a[0]!,b[j]!,b[i]!);else if(b.length===1)indices.push(a[i]!,a[j]!,b[0]!);else indices.push(a[i]!,a[j]!,b[i]!,a[j]!,b[j]!,b[i]!)}}let volume=0;for(let i=0;i<indices.length;i+=3){const a=new THREE.Vector3().fromArray(v,indices[i]!*3),b=new THREE.Vector3().fromArray(v,indices[i+1]!*3),c=new THREE.Vector3().fromArray(v,indices[i+2]!*3);volume+=a.dot(b.cross(c))/6}if(volume<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2]!,indices[i+1]!];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();return g}
 const cylinder=(a:THREE.Vector3,b:THREE.Vector3,r:number)=>new THREE.CylinderGeometry(r,r,a.distanceTo(b),16).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray())
 const beamPivot=group('steelyard-beam-pivot');beamPivot.position.y=1.85
 const beam=mesh('steelyard-beam',new THREE.CylinderGeometry(.055,.055,2.9,32).rotateZ(-Math.PI/2).translate(.5,0,0),wood,beamPivot)
 const hinge=mesh('steelyard-hinge',new THREE.CylinderGeometry(.09,.09,.17,32).rotateX(Math.PI/2),brass);hinge.position.y=1.85
 const liftRing=mesh('steelyard-lift-ring',new THREE.TorusGeometry(.14,.025,16,48),brass);liftRing.position.y=2.08
 const pan=group('steelyard-pan'),pin=mesh('steelyard-pan-pin',new THREE.SphereGeometry(.09,24,16),brass,pan)
 const cords=Array.from({length:3},(_,i)=>{const a=i*2*Math.PI/3;return mesh('steelyard-pan-cord-'+i,cylinder(new THREE.Vector3(0,-.04,0),new THREE.Vector3(.445*Math.cos(a),-.9,.445*Math.sin(a)),.012),rope,pan)})
 const bowl=mesh('steelyard-bowl',revolve([[0,-1.03],[.32,-1.03],[.46,-.92],[.46,-.89],[.43,-.89],[.29,-.99],[0,-.99]]),brass,pan)
 const fruit=mesh('steelyard-citrus',new THREE.SphereGeometry(.2,32,20),orange,pan);fruit.position.y=-.79
 const stem=mesh('steelyard-stem',new THREE.CylinderGeometry(.022,.022,.1,16),green,pan);stem.position.y=-.56
 const weight=group('steelyard-weight'),eye=mesh('steelyard-weight-eye',new THREE.TorusGeometry(.08,.015,16,48).rotateY(Math.PI/2),brass,weight)
 const weightCord=mesh('steelyard-weight-cord',cylinder(new THREE.Vector3(0,-.08,0),new THREE.Vector3(0,-.36,0),.013),rope,weight)
 const counterweight=mesh('steelyard-counterweight',revolve([[0,-.65],[.17,-.65],[.22,-.60],[.16,-.4],[.08,-.34],[0,-.34]]),bronze,weight)
 function pose(step:number,n:number){const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1),theta=step===0?.18*(1-t):0,w=step===0?THREE.MathUtils.lerp(.35,.85,t):.85,lift=step===1?THREE.MathUtils.lerp(0,.28,t):step===2?THREE.MathUtils.lerp(.28,0,t):0;root.position.y=lift===0?0:lift;beamPivot.rotation.z=theta===0?0:theta;pan.position.set(-.85*Math.cos(theta),1.85-.85*Math.sin(theta),0);weight.position.set(w*Math.cos(theta),1.85+w*Math.sin(theta),0);root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,subject:root,beamPivot,beam,hinge,liftRing,pan,pin,cords,bowl,fruit,stem,weight,eye,weightCord,counterweight,pose,targets:[counterweight,liftRing,liftRing],roots:[counterweight,liftRing,liftRing],anchors:[[0,-.48,.16],[.12,.04,.018],[.12,.04,.018]] as [number,number,number][]}
}
