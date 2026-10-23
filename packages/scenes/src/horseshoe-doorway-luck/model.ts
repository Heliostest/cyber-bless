import * as THREE from 'three'
/** Original compact digital mounting; counts and dimensions are product choices. */
export function createHorseshoeDoorwayLuckModel(){
 const root=new THREE.Group();root.name='horseshoe-doorway-luck-root'
 const subject=new THREE.Group();subject.name='horseshoe-doorway-luck-subject';root.add(subject)
 const iron=new THREE.MeshStandardMaterial({color:0x596967,metalness:.65,roughness:.4}),wood=new THREE.MeshStandardMaterial({color:0x9c6c42,roughness:.85}),stone=new THREE.MeshStandardMaterial({color:0xb6b2a1,roughness:.95})
 function mesh(name:string,g:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number){const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;subject.add(m);return m}
 const block=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat=wood)=>mesh(name,new THREE.BoxGeometry(w,h,d),mat,x,y,z)
 block('horseshoe-stone-base',4.6,.12,2,0,-.06,.15,stone)
 block('horseshoe-preparation-base',1.99,.10,.5,-1.02,.05,.60)
 block('horseshoe-post-left',.14,1.05,.25,-.15,.525,-.30)
 block('horseshoe-post-right',.14,1.05,.25,1.85,.525,-.30)
 block('horseshoe-crossbeam',2.25,.70,.25,.85,1.40,-.30)
 const shape=new THREE.Shape();shape.moveTo(-.29,.60);shape.lineTo(-.29,.28);shape.bezierCurveTo(-.29,.10,-.20,0,-.09,0);shape.lineTo(.09,0);shape.bezierCurveTo(.20,0,.29,.10,.29,.28);shape.lineTo(.29,.60);shape.lineTo(.17,.60);shape.lineTo(.17,.29);shape.bezierCurveTo(.17,.20,.10,.14,0,.14);shape.bezierCurveTo(-.10,.14,-.17,.20,-.17,.29);shape.lineTo(-.17,.60);shape.closePath()
 for(const x of[-.23,.23])for(const [y,r]of [[.53,.03],[.36,.022]]){const hole=new THREE.Path();hole.absarc(x,y!,r!,0,Math.PI*2,true);shape.holes.push(hole)}
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false,steps:1,curveSegments:16})
 const initial=[new THREE.Vector3(-1.65,.10,.55),new THREE.Vector3(-1.02,.10,.55),new THREE.Vector3(-.39,.10,.55)]
 const goal=[new THREE.Vector3(.18,1.10,-.11),new THREE.Vector3(.85,1.10,-.11),new THREE.Vector3(1.52,1.10,-.11)]
 const shoes=initial.map((p,i)=>mesh('horseshoe-'+i,geometry,iron,p.x,p.y,p.z))
 const pegGeometry=new THREE.CylinderGeometry(.015,.015,.19,16);pegGeometry.rotateX(Math.PI/2)
 const pegs=goal.flatMap((p,i)=>[-.23,.23].map((dx,k)=>mesh('horseshoe-peg-'+i+'-'+k,pegGeometry,iron,p.x+dx,1.645,-.08)))
 const anchors:[number,number,number][]=shoes.map(()=>[0,.07,.06])
 function pose(step:number,n:number){
  const s=Number.isFinite(step)?THREE.MathUtils.clamp(Math.floor(step),0,3):0,t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
  shoes.forEach((o,i)=>{if(i<s){o.position.copy(goal[i]!);return}o.position.copy(initial[i]!);if(i!==s||t===0)return;if(t===1){o.position.copy(goal[i]!);return}
   const a=initial[i]!,b=goal[i]!,knots=[0,.20,.50,.65,.90,1],points=[a,new THREE.Vector3(a.x,1.50,.55),new THREE.Vector3(b.x,1.50,.55),new THREE.Vector3(b.x,1.115,.55),new THREE.Vector3(b.x,1.115,-.11),b]
   const k=knots.findIndex((v,j)=>j<5&&t>=v&&t<knots[j+1]!)
   o.position.lerpVectors(points[k]!,points[k+1]!, (t-knots[k]!)/(knots[k+1]!-knots[k]!))
  });root.updateMatrixWorld(true)
 }
 pose(0,0);return{root,subject,shoes,pegs,roots:shoes,targets:shoes,anchors,pose}
}
