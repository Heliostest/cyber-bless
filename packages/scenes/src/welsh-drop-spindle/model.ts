import * as THREE from 'three'

/** Original assisted spindle; visible feed length varies, rigid tool never scales. */
export function createDropSpindleModel(){
 const subject=new THREE.Group();subject.name='spindle-subject'
 const tool=new THREE.Group();tool.name='spindle-tool';subject.add(tool)
 const wool=new THREE.Group();wool.name='spindle-wool';subject.add(wool)
 const woods=['#c39452','#d2aa6c','#b88746'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.86}))
 const dark=new THREE.MeshStandardMaterial({color:'#795735',roughness:.8}),cream=new THREE.MeshStandardMaterial({color:'#eee6d5',roughness:1}),yarn=new THREE.MeshStandardMaterial({color:'#d8cbbb',roughness:.96})
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D=tool)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const lathe=(points:number[][])=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r!,y!)),64)
 const shaft=mesh('spindle-shaft',new THREE.CylinderGeometry(.04,.028,2.02,32),woods[0]!);shaft.position.y=1.65
 const whorlGeometry=lathe([[.026,1],[.49,1],[.6,1.04],[.6,1.12],[.49,1.16],[.026,1.16],[.026,1]])
 whorlGeometry.clearGroups();for(let i=0;i<16;i++)whorlGeometry.addGroup(i*144,144,i%3)
 const whorl=mesh('spindle-whorl',whorlGeometry,woods)
 const marker=mesh('spindle-grain',new THREE.CylinderGeometry(.032,.032,.012,20),dark);marker.position.set(.38,1.16,-.16)
 const profile:number[][]=[[.024,1.25],[.1,1.25]]
 for(let i=0;i<=14;i++){const y=1.25+.05*i;profile.push([.15+.04*Math.sin(Math.PI*i/14)+(i%2?.006:-.006),y])}
 profile.push([.1,1.95],[.024,1.95],[.024,1.25])
 const cop=mesh('spindle-yarn-cop',lathe(profile),yarn)
 const thread=mesh('spindle-feed',new THREE.CylinderGeometry(.014,.014,1,16),yarn,subject)
 const lobes:[[number,number,number],number][]=[[[0,3.19,0],.19],[[-.14,3.19,0],.15],[[.14,3.18,0],.15],[[0,3.31,0],.16],[[0,3.21,.12],.14]]
 const tufts=lobes.map(([p,r],i)=>{const o=mesh('spindle-wool-'+i,new THREE.SphereGeometry(r,20,12),cream,wool);o.position.set(...p);return o})
 function pose(step:number,n:number){const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1);tool.rotation.y=step===0?1.5*Math.PI*t:1.5*Math.PI;tool.position.y=step===1?-.35*t:step===2?-.35*(1-t):0;if(tool.position.y===0)tool.position.y=0;const low=2.65+tool.position.y,high=3.06;thread.position.y=(low+high)/2;thread.scale.y=high-low;subject.updateMatrixWorld(true)}
 pose(0,0)
 return{subject,tool,wool,shaft,whorl,marker,cop,thread,tufts,pose,targets:[whorl,whorl,whorl],roots:[whorl,whorl,whorl],anchors:[[.43,1.163,.15],[.43,1.163,.15],[.43,1.163,.15]] as [number,number,number][]}
}
