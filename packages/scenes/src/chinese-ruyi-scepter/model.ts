import * as THREE from 'three'

// Original cloud-headed ruyi silhouette and display furniture, not a museum replica.
export function createChineseRuyiScepterModel(){
 const root=new THREE.Group();root.name='chinese-ruyi-scepter-root'
 const subject=new THREE.Group();subject.name='chinese-ruyi-scepter-subject';root.add(subject)
 const scepter=new THREE.Group();scepter.name='ruyi-scepter';subject.add(scepter)
 const jade=new THREE.MeshStandardMaterial({color:0x8dbba6,roughness:.24,metalness:.08}),wood=new THREE.MeshStandardMaterial({color:0x674b38,roughness:.65}),pad=new THREE.MeshStandardMaterial({color:0xc9a16a,roughness:.86}),stone=new THREE.MeshStandardMaterial({color:0xb9b9a5,roughness:.96})
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat=wood)=>mesh(subject,name,new THREE.BoxGeometry(w,h,d),mat,x,y,z)
 box('ruyi-stone-base',4.8,.12,2.6,0,-.06,.20,stone)
 const support=(kind:string,i:number,x:number,top:number,z:number)=>{
  box('ruyi-'+kind+'-foot-'+i,.34,.06,.42,x,.03,z)
  box('ruyi-'+kind+'-post-'+i,.10,top-.12,.10,x,.06+(top-.12)/2,z)
  box('ruyi-'+kind+'-seat-'+i,.26,.04,.42,x,top-.04,z)
  box('ruyi-'+kind+'-pad-'+i,.22,.02,.40,x,top-.01,z,pad)
 }
 for(const[i,x]of[-.80,.78].entries()){support('low',i,-.65+x,.28,.55);support('high',i,.65+x,.58,-.25)}
 // A single closed outline joins the broad lobed head to an S-curved handle.
 const shape=new THREE.Shape();shape.moveTo(-.55,.07)
 shape.bezierCurveTo(-.10,.15,.15,.22,.45,.12)
 shape.bezierCurveTo(.70,.02,.95,0,1.15,.04)
 shape.bezierCurveTo(1.35,.08,1.38,-.12,1.16,-.16)
 shape.bezierCurveTo(.86,-.19,.64,-.07,.40,-.03)
 shape.bezierCurveTo(.08,.04,-.20,-.08,-.55,-.07)
 shape.bezierCurveTo(-.72,-.10,-.65,-.34,-.88,-.43)
 shape.bezierCurveTo(-1.04,-.50,-1.12,-.29,-1.29,-.35)
 shape.bezierCurveTo(-1.56,-.44,-1.61,-.13,-1.36,0)
 shape.bezierCurveTo(-1.61,.13,-1.56,.44,-1.29,.35)
 shape.bezierCurveTo(-1.12,.29,-1.04,.50,-.88,.43)
 shape.bezierCurveTo(-.65,.34,-.72,.10,-.55,.07);shape.closePath()
 const body=new THREE.ExtrudeGeometry(shape,{depth:.10,bevelEnabled:true,bevelThickness:.012,bevelSize:.016,bevelSegments:3,steps:1,curveSegments:20})
 body.rotateX(-Math.PI/2);body.computeBoundingBox();body.translate(0,-body.boundingBox!.min.y,0)
 mesh(scepter,'ruyi-jade-body',body,jade)
 const checkpoints=[[-.65,.28,.55],[-.65,1.10,.55],[.65,1.10,-.25],[.65,.58,-.25]]as const
 function pose(step:number,n:number){const s=THREE.MathUtils.clamp(Math.floor(step),0,3),t=THREE.MathUtils.clamp(n,0,1),a=checkpoints[s]!,b=checkpoints[Math.min(s+1,3)]!;if(t===0)scepter.position.set(a[0],a[1],a[2]);else if(t===1)scepter.position.set(b[0],b[1],b[2]);else scepter.position.set(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,subject,scepter,targets:[scepter,scepter,scepter],roots:[scepter,scepter,scepter],anchors:[[-.94,.13,0],[-.94,.13,0],[-.94,.13,0]]as[number,number,number][],pose}
}
