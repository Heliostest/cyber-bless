import * as THREE from 'three'

/** Original sand-pagoda diorama; one prepared paper-and-bamboo tung is planted beside it. */
export function createLannaSandPagodaModel() {
 const root=new THREE.Group();root.name='lanna-sand-pagoda-root'
 const subject=new THREE.Group();subject.name='lanna-sand-pagoda-subject';root.add(subject)
 const flag=new THREE.Group();flag.name='lanna-flag';subject.add(flag)
 const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.93})
 const sand=mat(0xd7b67d),sandLight=mat(0xe4c995),bamboo=mat(0xa5864e),node=mat(0xc4aa6b),paper=mat(0xf0bf83),wood=mat(0x90714f)
 let serial=0
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name?:string)=>{const o=new THREE.Mesh(g,m);o.name=name??`lanna-detail-${serial++}`;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const ground=mesh(new THREE.CylinderGeometry(1.13,1.17,.08,64),sand,root,'lanna-sand-bed');ground.position.y=-.04
 const tower=new THREE.Group();tower.name='lanna-tower';tower.position.set(-.16,0,-.18);subject.add(tower)
 // A continuous, capped lathe surface with stepped sand mouldings, not stacked floating solids.
 const profile=[[0,0],[.49,0],[.49,.09],[.44,.11],[.44,.17],[.39,.19],[.39,.25],[.34,.27],[.31,.34],[.30,.46],[.27,.57],[.22,.68],[.16,.76],[.12,.78],[.12,.82],[.09,.84],[.065,.91],[.045,.98],[0,1.06]]
 const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r!,y!)),48);g.computeVertexNormals();mesh(g,sandLight,tower,'lanna-sand-tower')
 const base=mesh(new THREE.CylinderGeometry(.13,.15,.035,24),wood,subject,'lanna-holder-base');base.position.set(-1.02,.0175,.58)
 const holder=mesh(new THREE.TorusGeometry(.055,.018,8,24),wood,subject,'lanna-holder-ring');holder.rotation.x=Math.PI/2;holder.position.set(-1.02,.095,.58)
 for(const dx of[-.055,.055]){const foot=mesh(new THREE.CylinderGeometry(.012,.014,.06,8),wood,subject);foot.position.set(-1.02+dx,.06,.58)}
 const pole=mesh(new THREE.CylinderGeometry(.016,.019,1.52,12),bamboo,flag,'lanna-pole');pole.position.y=.76
 for(const y of[.22,.57,.92,1.27]){const ring=mesh(new THREE.TorusGeometry(.017,.003,6,12),node,flag);ring.rotation.x=Math.PI/2;ring.position.y=y}
 const crossbar=mesh(new THREE.CylinderGeometry(.009,.009,.34,8),bamboo,flag,'lanna-crossbar');crossbar.rotation.z=Math.PI/2;crossbar.position.set(.16,1.48,0)
 const shape=new THREE.Shape();shape.moveTo(.035,1.48);shape.lineTo(.30,1.48);shape.lineTo(.30,.54);shape.lineTo(.235,.48);shape.lineTo(.17,.54);shape.lineTo(.10,.48);shape.lineTo(.035,.54);shape.closePath()
 const paperGeometry=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,steps:1});
 const tung=mesh(paperGeometry,paper,flag,'lanna-tung');tung.position.z=.008
 for(const [i,x] of[.09,.24].entries()){const tie=mesh(new THREE.TorusGeometry(.019,.0025,6,16),node,flag,`lanna-binding-${i}`);tie.rotation.y=Math.PI/2;tie.position.set(x,1.477,.006)}
 // Subtle paper creases are geometry; no sacred diagram, writing, borrowed pattern or texture.
 for(const y of[.78,1.04,1.30]){const crease=mesh(new THREE.BoxGeometry(.255,.003,.003),mat(0xe6b278),flag);crease.position.set(.1675,y,.018)}
 // Small irregular grains stay on the sand surface, away from the holder and planted pole.
 const grainMat=mat(0xbfa274)
 for(let i=0;i<25;i++){const a=i*2.39996,r=.77+.16*Math.sin(i*4.1),x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x-.68,z-.58)<.16||x<-.8)continue;const grain=mesh(new THREE.DodecahedronGeometry(.012+(i%3)*.004,0),grainMat,root);grain.position.set(x,.007,z);grain.scale.y=.4}
 const pose=(step:number,n:number)=>{
  const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
  flag.rotation.set(0,0,0)
  if(step<=0)flag.position.set(-1.02,t===1?.44:THREE.MathUtils.lerp(.04,.44,t),.58)
  else if(step===1)flag.position.set(t===1?.68:THREE.MathUtils.lerp(-1.02,.68,t),.44,.58)
  else flag.position.set(.68,step>=3||t===1?-.045:THREE.MathUtils.lerp(.44,-.045,t),.58)
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,flag,targets:[tung,tung,tung],roots:[flag,flag,flag],anchors:[[.17,.98,.02],[.17,.98,.02],[.17,.98,.02]] as [number,number,number][],pose}
}
