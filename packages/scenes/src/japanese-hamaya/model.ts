import * as THREE from 'three'

// Original display geometry; no shrine insignia or replica measurements.
export function createJapaneseHamayaModel(){
 const root=new THREE.Group();root.name='japanese-hamaya-root'
 const subject=new THREE.Group();subject.name='japanese-hamaya-subject';root.add(subject)
 const arrow=new THREE.Group();arrow.name='hamaya-arrow';subject.add(arrow)
 const wood=new THREE.MeshStandardMaterial({color:0xcfae71,roughness:.64}),dark=new THREE.MeshStandardMaterial({color:0x806340,roughness:.74}),stand=new THREE.MeshStandardMaterial({color:0xa87946,roughness:.7}),cream=new THREE.MeshStandardMaterial({color:0xfff7df,roughness:.84}),rib=new THREE.MeshStandardMaterial({color:0xc8b991,roughness:.75}),red=new THREE.MeshStandardMaterial({color:0x9f3e37,roughness:.82}),gold=new THREE.MeshStandardMaterial({color:0xc89c43,metalness:.75,roughness:.3}),stone=new THREE.MeshStandardMaterial({color:0xb9b9a5,roughness:.96})
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat=stand)=>mesh(subject,name,new THREE.BoxGeometry(w,h,d),mat,x,y,z)
 mesh(subject,'hamaya-stone-base',new THREE.BoxGeometry(4.4,.12,1.65),stone,0,-.06,.30)
 // Each U cradle has an actual horizontal bearing, two separated side lips and a grounded foot.
 const cradle=(kind:string,i:number,x:number,top:number,z:number)=>{
  box('hamaya-'+kind+'-foot-'+i,.30,.08,.34,x,.04,z)
  box('hamaya-'+kind+'-post-'+i,.085,top-.12,.085,x,(top-.12)/2+.08,z)
  box('hamaya-'+kind+'-seat-'+i,.12,.04,.24,x,top-.02,z)
  for(const side of[-1,1])box('hamaya-'+kind+'-lip-'+i+'-'+side,.12,.09,.045,x,top+.045,z+side*.0975)
 }
 for(const[i,x]of[-.65,.05].entries()){cradle('low',i,-.65+x,.45,.70);cradle('high',i,.65+x,.98,0)}
 const shaft=mesh(arrow,'hamaya-shaft',new THREE.CylinderGeometry(.04,.04,2.4,32),wood);shaft.rotation.z=-Math.PI/2
 const cap=mesh(arrow,'hamaya-blunt-end',new THREE.CylinderGeometry(.049,.049,.10,32),dark,-1.25);cap.rotation.z=-Math.PI/2
 const end=mesh(arrow,'hamaya-tail-cap',new THREE.SphereGeometry(.042,16,12),wood,1.2);end.scale.x=.5
 // Closed shallow vanes attach along the central shaft. Rib lines are decorative, not textural cut-outs.
 const outline=new THREE.Shape();outline.moveTo(.38,0);outline.bezierCurveTo(.49,.17,.84,.30,1.16,.22);outline.lineTo(1.19,.04);outline.bezierCurveTo(1.16,-.13,.70,-.23,.38,0)
 const featherGeometry=new THREE.ExtrudeGeometry(outline,{depth:.012,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:2,steps:1,curveSegments:18});featherGeometry.translate(0,0,-.006)
 mesh(arrow,'hamaya-feather-front',featherGeometry,cream)
 const other=mesh(arrow,'hamaya-feather-side',featherGeometry,cream);other.rotation.x=Math.PI/2
 const tube=(parent:THREE.Object3D,name:string,points:THREE.Vector3[],radius:number,mat:THREE.Material)=>mesh(parent,name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(16,points.length*6),radius,6,false),mat)
 for(let i=0;i<10;i++){const x=.50+i*.062;for(const side of[-1,1])tube(arrow,'hamaya-vane-rib-'+i+'-'+side,[new THREE.Vector3(x,0,.0105),new THREE.Vector3(x+.035,side*.025,.0105),new THREE.Vector3(x+.07,side*(side>0?.12:.04),.0105)],.002,rib)}
 for(const x of[.39,1.15]){const b=mesh(arrow,'hamaya-feather-binding-'+x,new THREE.CylinderGeometry(.045,.045,.06,24),red,x);b.rotation.z=-Math.PI/2}
 // Red binding and attached closed suspension loop; cup bell stays attached through the whole rigid translation.
 const wrap=mesh(arrow,'hamaya-cord-wrap',new THREE.TorusGeometry(.043,.009,8,32),red,.27);wrap.rotation.y=Math.PI/2
 tube(arrow,'hamaya-cord',[new THREE.Vector3(.27,-.035,.025),new THREE.Vector3(.28,-.11,.06),new THREE.Vector3(.27,-.17,.055)],.009,red)
 const bellRing=mesh(arrow,'hamaya-bell-ring',new THREE.TorusGeometry(.022,.007,8,24),gold,.27,-.174,.055)
 const profile=[new THREE.Vector2(0,0),new THREE.Vector2(.027,0),new THREE.Vector2(.049,-.026),new THREE.Vector2(.062,-.085),new THREE.Vector2(.054,-.088),new THREE.Vector2(.040,-.031),new THREE.Vector2(.019,-.008),new THREE.Vector2(0,-.008)]
 mesh(arrow,'hamaya-bell-shell',new THREE.LatheGeometry(profile,32),gold,.27,-.198,.055)
 mesh(arrow,'hamaya-bell-stem',new THREE.CylinderGeometry(.004,.004,.054,8),gold,.27,-.231,.055)
 mesh(arrow,'hamaya-bell-clapper',new THREE.SphereGeometry(.016,12,8),dark,.27,-.266,.055)
 const checkpoints=[[-.65,.49,.70],[-.65,1.40,.70],[.65,1.40,0],[.65,1.02,0]]as const
 function pose(step:number,n:number){const s=THREE.MathUtils.clamp(Math.floor(step),0,3),t=THREE.MathUtils.clamp(n,0,1),a=checkpoints[s]!,b=checkpoints[Math.min(s+1,3)]!;arrow.position.set(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,subject,arrow,targets:[arrow,arrow,arrow],roots:[arrow,arrow,arrow],anchors:[[.85,.10,.025],[.85,.10,.025],[.85,.10,.025]]as[number,number,number][],pose}
}
