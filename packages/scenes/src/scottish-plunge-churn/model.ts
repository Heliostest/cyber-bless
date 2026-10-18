import * as THREE from 'three'

/** Original assisted plunge churn; cream is a static material illustration. */
export function createPlungeChurnModel(){
 const subject=new THREE.Group();subject.name='churn-subject'
 const assembly=new THREE.Group();assembly.name='churn-assembly';subject.add(assembly)
 const dasher=new THREE.Group();dasher.name='churn-dasher';assembly.add(dasher)
 const boards=['#b9905c','#c19c68','#ad8354'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.88}))
 const honey=new THREE.MeshStandardMaterial({color:'#d2b582',roughness:.82}),dark=new THREE.MeshStandardMaterial({color:'#725037',roughness:.78}),iron=new THREE.MeshStandardMaterial({color:'#616d6a',metalness:.65,roughness:.55}),pale=new THREE.MeshStandardMaterial({color:'#f2e5bb',roughness:.96})
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const lathe=(points:number[][])=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r!,y!)),64)
 const bodyGeometry=lathe([[.68,0],[.78,0],[.68,2],[.58,2],[.68,0]])
 bodyGeometry.clearGroups();for(let i=0;i<16;i++)bodyGeometry.addGroup(i*96,96,i%3)
 const body=mesh('churn-body',bodyGeometry,boards)
 const bottom=mesh('churn-bottom',new THREE.CylinderGeometry(.735,.735,.14,64),honey);bottom.position.y=.07
 const hoops=[.12,.96,1.76].map((low,i)=>{const high=low+.14,r=(y:number)=>.78-.05*y;return mesh('churn-hoop-'+i,lathe([[r(low)-.012,low],[r(low)+.035,low],[r(high)+.035,high],[r(high)-.012,high],[r(low)-.012,low]]),iron)})
 const lid=mesh('churn-lid',lathe([[.067,-.05],[.72,-.05],[.72,.05],[.067,.05],[.067,-.05]]),honey,assembly);lid.position.y=2.05
 const rod=mesh('churn-rod',new THREE.CylinderGeometry(.035,.035,2,24),honey,dasher);rod.position.y=1.64
 const grip=mesh('churn-grip',new THREE.CylinderGeometry(.085,.085,.26,24),dark,dasher);grip.position.y=2.57
 const blades=[0,1].map(i=>{const o=mesh('churn-blade-'+i,new THREE.BoxGeometry(.94,.09,.15),honey,dasher);o.position.y=.64+.02*i;o.rotation.y=i*Math.PI/2;return o})
 const cream=mesh('churn-cream',lathe([[.041,-.01],[.62,-.01],[.62,.01],[.041,.01],[.041,-.01]]),pale);cream.position.y=1.03
 function pose(step:number,n:number){const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1);assembly.position.y=step>=3?.65:step===2?.65*t:0;dasher.position.y=step===0?-.32*t:step===1?-.32*(1-t):0;dasher.rotation.y=step===0?0:step===1?.12*t:.12;subject.updateMatrixWorld(true)}
 pose(0,0)
 return{subject,assembly,dasher,body,bottom,hoops,lid,rod,grip,blades,cream,pose,targets:[grip,grip,lid],roots:[grip,grip,lid],anchors:[[.04,.1,.06],[.04,.1,.06],[.52,.051,.22]] as [number,number,number][]}
}
