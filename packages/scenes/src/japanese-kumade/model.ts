import * as THREE from 'three'

// Original flat bamboo-strip approximation; no shrine names, sacred inscription or replica.
export function createJapaneseKumadeModel(){
 const root=new THREE.Group();root.name='japanese-kumade-root'
 const subject=new THREE.Group();subject.name='japanese-kumade-subject';root.add(subject)
 const bamboo=new THREE.MeshStandardMaterial({color:0xd3b775,roughness:.65}),wood=new THREE.MeshStandardMaterial({color:0x93633c,roughness:.72}),red=new THREE.MeshStandardMaterial({color:0xa34c3b,roughness:.82}),stone=new THREE.MeshStandardMaterial({color:0xb9b9a5,roughness:.96}),gold=new THREE.MeshStandardMaterial({color:0xe8ba50,roughness:.38,metalness:.35}),edge=new THREE.MeshStandardMaterial({color:0xa7782d,roughness:.58,metalness:.2})
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],x=0,y=0,z=0)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat=wood)=>mesh(subject,name,new THREE.BoxGeometry(w,h,d),mat,x,y,z)
 box('kumade-stone-base',4.6,.12,2,0,-.06,.20,stone)
 box('kumade-holder-base',1.25,.12,.75,.65,.06,.03)
 box('kumade-holder-left',.10,.40,.26,.54,.32,.03)
 box('kumade-holder-right',.10,.40,.26,.76,.32,.03)
 box('kumade-holder-front',.12,.40,.10,.65,.32,.11)
 box('kumade-holder-back',.12,.40,.10,.65,.32,-.05)
 box('kumade-preparation-foot',1.45,.05,.50,-1.20,.025,0)
 box('kumade-preparation-panel',1.45,.70,.08,-1.20,.40,0)
 box('kumade-preparation-shelf',1.45,.04,.20,-1.20,.21,.09)
 box('kumade-preparation-trim',1.45,.06,.08,-1.20,.78,0,red)
 // Seven separated prongs join a broad central hub and long handle in one closed outline.
 const rake=new THREE.Shape();rake.moveTo(-.06,.12);rake.lineTo(-.06,.82);rake.lineTo(-.33,.96);rake.lineTo(-.33,1.05)
 for(let i=-3;i<=3;i++){const x=i*.30,y=2.40-Math.abs(i)*.08;rake.lineTo(x-.03,y);rake.quadraticCurveTo(x-.03,y+.04,x,y+.04);rake.quadraticCurveTo(x+.03,y+.04,x+.03,y);rake.lineTo(i*.10+.03,1.05);if(i<3)rake.lineTo((i+1)*.10-.03,1.05)}
 rake.lineTo(.33,.96);rake.lineTo(.06,.82);rake.lineTo(.06,.12);rake.closePath()
 mesh(subject,'kumade-bamboo-body',new THREE.ExtrudeGeometry(rake,{depth:.06,bevelEnabled:false,steps:1,curveSegments:10}),bamboo,.65)
 // Flat bottom supports the prepared paper badge on its shelf; front/back are actual surfaces.
 const oval=new THREE.Shape();oval.moveTo(-.055,-.20);oval.bezierCurveTo(-.18,-.18,-.18,.17,-.07,.21);oval.bezierCurveTo(-.03,.235,.03,.235,.07,.21);oval.bezierCurveTo(.18,.17,.18,-.18,.055,-.20);oval.closePath()
 const geometry=new THREE.ExtrudeGeometry(oval,{depth:.035,bevelEnabled:false,steps:1,curveSegments:16})
 const tags=[0,1,2].map(i=>{const tag=new THREE.Group();tag.name='kumade-tag-'+i;mesh(tag,'kumade-tag-surface-'+i,geometry,[gold,edge]);subject.add(tag);return tag})
 const initial=[[-1.65,.43,.04],[-1.20,.43,.04],[-.75,.43,.04]]as const,goals=[[.24,1.68,.06],[1.06,1.68,.06],[.65,1,.06]]as const
 function pose(step:number,n:number){const s=THREE.MathUtils.clamp(Math.floor(step),0,3),t=THREE.MathUtils.clamp(n,0,1);tags.forEach((tag,i)=>{const a=initial[i]!,b=goals[i]!;if(i<s||i===s&&t===1)tag.position.set(b[0],b[1],b[2]);else if(i!==s||t===0)tag.position.set(a[0],a[1],a[2]);else{const points=[a,[a[0],2.75,.55],[b[0],2.75,.55],b],k=t<.25?0:t<.75?1:2,u=k===0?t*4:k===1?(t-.25)*2:(t-.75)*4,p=points[k]!,q=points[k+1]!;tag.position.set(p[0]!+(q[0]!-p[0]!)*u,p[1]!+(q[1]!-p[1]!)*u,p[2]!+(q[2]!-p[2]!)*u)}});root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,subject,tags,targets:tags,roots:tags,anchors:[[0,0,.035],[0,0,.035],[0,0,.035]]as[number,number,number][],pose}
}
