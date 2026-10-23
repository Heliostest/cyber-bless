import * as THREE from 'three'

// An original flat-backed relief: a rounded upper section, curved taper and
// single closed tip. The digital solid does not reproduce hollow manufacture.
function hornGeometry() {
 const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(-.10,0,-.48),new THREE.Vector3(-.46,0,-.03),new THREE.Vector3(.30,0,.20),new THREE.Vector3(.16,0,.50))
 const rows=48,sides=16,vertices:number[]=[],indices:number[]=[]
 for(let i=0;i<rows;i++){
  const u=i/rows,p=curve.getPoint(u),t=curve.getTangent(u),normal=new THREE.Vector3(t.z,0,-t.x).normalize(),radius=.14*Math.pow(1-u,.8)
  for(let j=0;j<=sides;j++){const a=Math.PI*j/sides;vertices.push(p.x+normal.x*radius*Math.cos(a),j===0||j===sides?0:2*radius*Math.sin(a),p.z+normal.z*radius*Math.cos(a))}
 }
 for(let i=0;i<rows-1;i++){
  for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+1,c=a+sides+1,d=c+1;indices.push(a,b,d,a,d,c)}
  const a=i*(sides+1),b=a+sides,c=a+sides+1,d=c+sides;indices.push(a,c,d,a,d,b)
 }
 for(let j=1;j<sides;j++)indices.push(0,j+1,j)
 const p=curve.getPoint(1),tip=vertices.length/3,last=(rows-1)*(sides+1);vertices.push(p.x,0,p.z)
 for(let j=0;j<sides;j++)indices.push(last+j,last+j+1,tip)
 indices.push(last,tip,last+sides)
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g
}

export function createNeapolitanCornicelloModel(){
 const root=new THREE.Group();root.name='neapolitan-cornicello-root'
 const subject=new THREE.Group();subject.name='neapolitan-cornicello-subject';root.add(subject)
 const cream=new THREE.MeshStandardMaterial({color:0xe7cba1,roughness:.67}),green=new THREE.MeshStandardMaterial({color:0x55725b,roughness:.95}),wood=new THREE.MeshStandardMaterial({color:0x946744,roughness:.88}),red=new THREE.MeshStandardMaterial({color:0xb52f24,roughness:.32}),paper=new THREE.MeshStandardMaterial({color:0xfff2cf,roughness:.94}),gold=new THREE.MeshStandardMaterial({color:0xc49145,metalness:.55,roughness:.34}),stone=new THREE.MeshStandardMaterial({color:0xcebd9e,roughness:.96})
 const add=(parent:THREE.Object3D,name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 add(subject,'cornicello-stone-base',[4.6,.12,3],[0,-.06,.20],stone)
 add(subject,'cornicello-horn-pad',[1.1,.10,1.30],[-1.4,.05,-.30],wood)
 add(subject,'cornicello-card-pad',[1.1,.10,1.30],[1.4,.05,-.30],wood)
 const giftBox=new THREE.Group();giftBox.name='cornicello-gift-box';subject.add(giftBox)
 add(giftBox,'cornicello-box-base',[1.6,.10,1.6],[0,.05,0],cream)
 add(giftBox,'cornicello-box-left',[.08,.40,1.6],[-.76,.30,0],cream)
 add(giftBox,'cornicello-box-right',[.08,.40,1.6],[.76,.30,0],cream)
 add(giftBox,'cornicello-box-front',[1.44,.40,.08],[0,.30,.76],cream)
 add(giftBox,'cornicello-box-back',[1.44,.40,.08],[0,.30,-.76],cream)
 add(giftBox,'cornicello-box-lining',[1.44,.04,1.44],[0,.12,0],green)
 const horn=new THREE.Group();horn.name='cornicello-horn';giftBox.add(horn)
 const body=new THREE.Mesh(hornGeometry(),red);body.name='cornicello-horn-surface';body.castShadow=body.receiveShadow=true;horn.add(body)
 const card=new THREE.Group();card.name='cornicello-card';giftBox.add(card)
 add(card,'cornicello-card-paper',[.44,.025,.72],[0,.0125,0],paper)
 // A small raised heart is a product gift mark, without a traditional claim.
 const heart=new THREE.Shape();heart.moveTo(0,-.08);heart.bezierCurveTo(-.18,.02,-.08,.16,0,.07);heart.bezierCurveTo(.08,.16,.18,.02,0,-.08)
 const heartGeometry=new THREE.ExtrudeGeometry(heart,{depth:.004,bevelEnabled:false,curveSegments:12});heartGeometry.rotateX(-Math.PI/2)
 const mark=new THREE.Mesh(heartGeometry,gold);mark.name='cornicello-card-heart';mark.position.y=.025;mark.castShadow=true;card.add(mark)
 const initial=[new THREE.Vector3(-1.4,.10,0),new THREE.Vector3(1.4,.10,0)],goal=[new THREE.Vector3(-.28,.14,0),new THREE.Vector3(.40,.14,0)]
 const roots=[horn,card,giftBox],anchors:[number,number,number][]=[[-.20,.15,-.30],[0,.025,0],[0,.26,.80]]
 const pose=(step:number,n:number)=>{
  n=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1)
  giftBox.position.set(0,0,step>=3?.55:step===2?-.30+.85*n:-.30)
  for(let i=0;i<2;i++){
   const object=roots[i]!,start=initial[i]!,end=goal[i]!
   if(step>i||(step===i&&n===1))object.position.copy(end)
   else if(step<i||n===0)object.position.copy(start)
   else if(n<.25)object.position.copy(start).lerp(new THREE.Vector3(start.x,1.05,start.z),n*4)
   else if(n<.75)object.position.set(THREE.MathUtils.lerp(start.x,end.x,(n-.25)*2),1.05,0)
   else object.position.set(end.x,THREE.MathUtils.lerp(1.05,end.y,(n-.75)*4),end.z)
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0);return{root,subject,horn,card,giftBox,roots,targets:roots,anchors,pose}
}
