import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
const smooth=(x:number)=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t)}
export function createWaterBowlsModel(){
 const root=new THREE.Group();root.name='water-bowls-subject';root.position.y=-.012
 const material=(color:number,metalness=0,roughness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness})
 const wood=material(0x945d3e),gold=material(0xd4ac58,.25,.52),copper=material(0xbc7850,.35,.4),robe=material(0xc99c44,.18,.65),hair=material(0x3f5051),jugmat=material(0xeee4cb,.05,.35)
 const watermat=createRitualMaterial({color:0x75bec8,transparent:true,opacity:.8,roughness:.19,metalness:0,depthWrite:false},{kind:'water',strength:.3})
 const finish=(source:THREE.BufferGeometry)=>{
  const raw=source.index?source.toNonIndexed():source,p=raw.getAttribute('position'),faces:number[]=[]
  for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(p,i+n));if(new THREE.Triangle(v[0]!,v[1]!,v[2]!).getArea()>1e-12)v.forEach(q=>faces.push(q.x,q.y,q.z))}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();if(raw!==source)raw.dispose();source.dispose();return g
 }
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root,x=0,y=0,z=0)=>{const o=new THREE.Mesh(finish(g),m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const ball=(name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=mesh(name,new THREE.SphereGeometry(1,24,16),m,parent,x,y,z);o.scale.set(sx,sy,sz);return o}
 const box=(name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material)=>mesh(name,new THREE.BoxGeometry(sx,sy,sz),m,root,x,y,z)
 const lathe=(profile:number[][])=>new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x!,y!)),48)
 const altar=box('altar-top',0,.94,0,3.7,.12,1.7,wood)
 for(const x of[-1.65,1.65])for(const z of[-.65,.65])box('altar-leg-'+x+'-'+z,x,.44,z,.13,.88,.13,wood)
 const plinth=mesh('buddha-plinth',new THREE.CylinderGeometry(.52,.57,.12,48),gold,root,0,1.06,-.43)
 plinth.scale.z=.65
 const buddha=new THREE.Group();buddha.name='seated-buddha';buddha.position.set(0,1.12,-.43);root.add(buddha)
 ball('buddha-crossed-legs',0,.12,.03,.46,.13,.26,robe,buddha)
 ball('buddha-robed-torso',0,.42,-.015,.25,.35,.17,robe,buddha)
 ball('buddha-neck',0,.75,-.015,.09,.1,.09,gold,buddha)
 ball('buddha-head',0,.91,-.015,.145,.19,.125,gold,buddha)
 ball('buddha-hair',0,1.035,-.035,.146,.105,.115,hair,buddha)
 ball('buddha-ushnisha',0,1.13,-.035,.065,.075,.065,hair,buddha)
 for(const s of[-1,1]){
  ball('buddha-ear-'+s,s*.15,.88,-.015,.034,.095,.035,gold,buddha)
  const arm=ball('buddha-arm-'+s,s*.225,.38,.02,.075,.24,.075,robe,buddha);arm.rotation.z=s*.28
  const fore=ball('buddha-forearm-'+s,s*.14,.22,.15,.15,.055,.06,gold,buddha);fore.rotation.z=-s*.15
  ball('buddha-eye-'+s,s*.05,.925,.105,.028,.006,.007,hair,buddha)
 }
 ball('buddha-hands',0,.22,.19,.11,.038,.075,gold,buddha)
 ball('buddha-nose',0,.89,.111,.02,.035,.025,gold,buddha)
 const bowls:THREE.Mesh[]=[],waters:THREE.Mesh[]=[]
 const bowlProfile=[[0,0],[.065,0],[.08,.025],[.095,.04],[.19,.17],[.19,.185],[.176,.185],[.176,.17],[.082,.045],[0,.045]]
 for(let i=0;i<7;i++){
  bowls.push(mesh('offering-bowl-'+i,lathe(bowlProfile),copper,root,(i-3)*.394,1,.2))
  const w=mesh('offering-water-'+i,new THREE.CylinderGeometry(1,1,1,48),watermat,root,(i-3)*.394,1.06,.2);w.castShadow=false;waters.push(w)
 }
 const jug=new THREE.Group();jug.name='water-jug';root.add(jug)
 const body=mesh('jug-body',lathe([[0,0],[.13,0],[.2,.06],[.22,.28],[.19,.47],[.15,.5],[.13,.5],[.17,.46],[.195,.28],[.17,.07],[0,.035]]),jugmat,jug)
 const handle=mesh('jug-handle',new THREE.TorusGeometry(.17,.035,12,32),jugmat,jug,-.23,.28,0);handle.scale.set(.7,1,1)
 // A closed ceramic lip joins the hollow body; its end is the actual stream origin.
 const lipShape=new THREE.Shape();lipShape.moveTo(-.075,-.16);lipShape.lineTo(.075,-.16);lipShape.lineTo(.035,-.27);lipShape.lineTo(-.035,-.27);lipShape.closePath()
 const lip=mesh('jug-pouring-lip',new THREE.ExtrudeGeometry(lipShape,{depth:.022,bevelEnabled:false}),jugmat,jug,0,.49,0);lip.rotation.x=Math.PI/2
 const jugWater=mesh('jug-water',new THREE.CylinderGeometry(.1,.1,.1,48),watermat,jug);jugWater.castShadow=false
 // Clip the modeled inner volume by a horizontal world plane; a tilted disk would cross the wall.
 const insideRadius=(y:number)=>y<.07?.17*(y-.035)/.035:y<.28?.17+.025*(y-.07)/.21:y<.46?.195-.025*(y-.28)/.18:.17-.04*(y-.46)/.04
 const jugLiquid=(level:number,angle:number)=>{
  const c=Math.cos(angle),s=Math.sin(angle),rings:THREE.Vector3[][]=[],top:THREE.Vector3[]=[]
  for(let i=0;i<48;i++){const phi=i/48*Math.PI*2;let lo=.035,hi=.5;for(let j=0;j<24;j++){const y=(lo+hi)/2,r=insideRadius(y)-.002;if(y*c-r*Math.sin(phi)*s>level)hi=y;else lo=y}const y=(lo+hi)/2,r=insideRadius(y)-.002;top.push(new THREE.Vector3(r*Math.cos(phi),y,r*Math.sin(phi)))}
  for(let k=1;k<=12;k++)rings.push(top.map((p,i)=>{const y=.035+(p.y-.035)*k/12,r=Math.max(0,insideRadius(y)-.002),phi=i/48*Math.PI*2;return new THREE.Vector3(r*Math.cos(phi),y,r*Math.sin(phi))}))
  const vertices:number[]=[],bottom=new THREE.Vector3(0,.035,0),centre=new THREE.Vector3(0,level/c,0),tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray())
  for(let i=0;i<48;i++){const j=(i+1)%48;tri(bottom,rings[0]![i]!,rings[0]![j]!);for(let k=1;k<12;k++){tri(rings[k-1]![i]!,rings[k]![i]!,rings[k]![j]!);tri(rings[k-1]![i]!,rings[k]![j]!,rings[k-1]![j]!)}tri(centre,top[j]!,top[i]!)}
  const g=jugWater.geometry,old=g.getAttribute('position');if(old.count!==vertices.length/3){g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.deleteAttribute('normal')}else{(old.array as Float32Array).set(vertices);old.needsUpdate=true}g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere()
 }
 const stream=mesh('water-stream',new THREE.CylinderGeometry(.006,.007,1,12),watermat);stream.castShadow=false
 const channelSections=[[-.128,.4995,.506],[-.13,.5,.506],[-.15,.5,.506],[-.172,.49,.496],[-.285,.49,.496]].map(([z,b,t])=>[new THREE.Vector3(-.006,b!,z!),new THREE.Vector3(.006,b!,z!),new THREE.Vector3(.006,t!,z!),new THREE.Vector3(-.006,t!,z!)])
 const channelFaces:number[]=[],channelTri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>channelFaces.push(...a.toArray(),...b.toArray(),...c.toArray())
 const front=channelSections[0]!,back=channelSections[channelSections.length-1]!
 channelTri(front[0]!,front[1]!,front[2]!);channelTri(front[0]!,front[2]!,front[3]!);channelTri(back[0]!,back[2]!,back[1]!);channelTri(back[0]!,back[3]!,back[2]!)
 for(let i=0;i<channelSections.length-1;i++)for(let k=0;k<4;k++){const j=(k+1)%4,a=channelSections[i]!,b=channelSections[i+1]!;channelTri(a[k]!,b[k]!,b[j]!);channelTri(a[k]!,b[j]!,a[j]!)}
 const channelGeometry=new THREE.BufferGeometry();channelGeometry.setAttribute('position',new THREE.Float32BufferAttribute(channelFaces,3))
 const lipWater=mesh('lip-water',channelGeometry,watermat,jug);lipWater.castShadow=false
 const tip=new THREE.Vector3(0,.493,-.285),flowStart=new THREE.Vector3(),flowEnd=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0)
 const rest=new THREE.Vector3(-1.5,1,.64),left=new THREE.Vector3(-1.182,1.6,.72),right=new THREE.Vector3(1.182,1.6,.72)
 const setWater=(i:number,f:number)=>{
  const h=.065+.095*f,r=.082+(h-.045)/.125*.094
  // A tapered water volume remains within the bowl's inner wall at every level.
  const g=waters[i]!.geometry,pa=g.getAttribute('position'),base=g.userData.base??(g.userData.base=Array.from(pa.array))
  for(let n=0;n<pa.count;n++){const yy=base[n*3+1]!+.5,rad=.081+(r-.081)*yy;pa.setXYZ(n,base[n*3]!*rad,base[n*3+1]!*(h-.045),base[n*3+2]!*rad)}
  pa.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();waters[i]!.position.y=1+(.045+h)/2
 }
 const pose=(step:number,n:number)=>{
  const t=THREE.MathUtils.clamp(n,0,1);for(const o of[stream,lipWater]){o.visible=false;o.position.set(0,0,0);o.scale.set(1,1,1);o.quaternion.identity()}jug.rotation.set(0,0,0);jug.position.copy(rest)
  let progress=step>=2?1:0,activeBowl=-1,pour=0,tilt=0
  if(step===0){const u=smooth(t/.65);jug.position.copy(rest).lerp(new THREE.Vector3(-1.5,1.6,.72),u);if(t>.65)jug.position.lerpVectors(new THREE.Vector3(-1.5,1.6,.72),left,smooth((t-.65)/.35))}
  else if(step===1){
   const f=t*7,i=Math.min(6,Math.floor(f)),q=t===1?1:f-i;jug.position.set((i-3)*.394,1.6,.72)
   tilt=q<.12?smooth(q/.12):q<=.7?1:1-smooth((q-.7)/.12)
   pour=THREE.MathUtils.clamp((q-.12)/.58,0,1);progress=(i+pour)/7;activeBowl=i
   jug.rotation.x=-(.7+.35*progress)*tilt
   const tipZ=tip.y*Math.sin(jug.rotation.x)+tip.z*Math.cos(jug.rotation.x)
   jug.position.z=THREE.MathUtils.lerp(.72,.2-tipZ,tilt)
   if(q>.82&&i<6)jug.position.x+=.394*smooth((q-.82)/.18)
   stream.visible=q>.12&&q<.7
  }else if(step===2){jug.position.copy(right);if(t<.7)jug.position.lerpVectors(right,new THREE.Vector3(-1.5,1.6,.64),smooth(t/.7));else jug.position.lerpVectors(new THREE.Vector3(-1.5,1.6,.64),rest,smooth((t-.7)/.3))}
  for(let i=0;i<7;i++)setWater(i,THREE.MathUtils.clamp(progress*7-i,0,1))
  const exitLevel=.5*Math.cos(jug.rotation.x)+.128*Math.sin(jug.rotation.x)
  jugLiquid(Math.min(THREE.MathUtils.lerp(.32-.15*progress,exitLevel,tilt),exitLevel-1e-8),jug.rotation.x)
  root.updateMatrixWorld(true)
  if(stream.visible){
   flowStart.copy(tip).applyMatrix4(jug.matrixWorld);flowEnd.set((activeBowl-3)*.394,1.065+.095*pour,.2).add(root.position)
   const delta=flowStart.clone().sub(flowEnd);stream.position.copy(flowStart).add(flowEnd).multiplyScalar(.5).sub(root.position);stream.scale.y=delta.length();stream.quaternion.setFromUnitVectors(axis,delta.normalize())
   lipWater.visible=true
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,altar,buddha,bowls,waters,jug,body,handle,lip,stream,lipWater,tip,targets:[jug,jug,jug],roots:[jug,jug,jug],anchors:[[0,.28,.18],[0,.28,.18],[0,.28,.18]] as [number,number,number][],pose,dispose(){}}
}

