import * as THREE from 'three'

function solid(source:THREE.BufferGeometry){
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),data:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-20)continue;data.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6}
 if(volume<0)for(let i=0;i<data.length;i+=9)for(let j=0;j<3;j++){const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();if(input!==source)input.dispose();source.dispose();return g
}

export function createLongevityLockModel(){
 const root=new THREE.Group();root.name='longevity-subject'
 const materials=new Map<string,THREE.MeshStandardMaterial>(),material=(color:string)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:color==='#c8d4d7'||color==='#e8eef1'?.30:.88,metalness:color==='#c8d4d7'||color==='#e8eef1'?.65:0}));return materials.get(color)!}
 const mesh=(parent:THREE.Object3D,name:string,source:THREE.BufferGeometry,color:string,p:[number,number,number])=>{const m=new THREE.Mesh(solid(source),material(color));m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const box=new THREE.Group();box.name='longevity-gift-case';root.add(box)
 mesh(box,'longevity-case-base',new THREE.BoxGeometry(2.16,.12,2.36),'#74553b',[.95,.06,0])
 const pad=mesh(box,'longevity-case-inner-pad',new THREE.BoxGeometry(2.0,.04,2.20),'#9b6f56',[.95,.14,0])
 for(const side of[-1,1]){
  mesh(box,`longevity-case-side-${side}`,new THREE.BoxGeometry(.08,.24,2.36),'#96724e',[.95+side*1.04,.24,0])
  mesh(box,`longevity-case-end-${side}`,new THREE.BoxGeometry(2.0,.24,.08),'#96724e',[.95,.24,side*1.14])
 }
 const stand=mesh(root,'longevity-preparation-stand',new THREE.BoxGeometry(2.0,.16,2.20),'#b89770',[-1.3,.08,.55])
 const actor=new THREE.Group();actor.name='longevity-carrier';root.add(actor)
 const board=mesh(actor,'longevity-carrier-board',new THREE.BoxGeometry(1.90,.08,2.10),'#674448',[0,.04,0])
 // The original insert carries the complete necklace as one prepared rigid object.
 const cordCurve=new THREE.CatmullRomCurve3(Array.from({length:48},(_,i)=>{const a=i*Math.PI*2/48;return new THREE.Vector3(.62*Math.cos(a),.105,-.45+.55*Math.sin(a))}),true)
 const cord=mesh(actor,'longevity-cotton-neck-cord',new THREE.TubeGeometry(cordCurve,96,.025,8,true),'#bd7046',[0,0,0])
 const outline=new THREE.Shape();outline.moveTo(-.54,.20)
 outline.bezierCurveTo(-.70,.19,-.69,-.12,-.51,-.12);outline.bezierCurveTo(-.49,-.28,-.28,-.28,-.25,-.19)
 outline.bezierCurveTo(-.12,-.29,.12,-.29,.25,-.19);outline.bezierCurveTo(.28,-.28,.49,-.28,.51,-.12)
 outline.bezierCurveTo(.69,-.12,.70,.19,.54,.20);outline.lineTo(.25,.20);outline.bezierCurveTo(.21,.29,-.21,.29,-.25,.20);outline.closePath()
 const extrude=(shape:THREE.Shape,depth:number,bottom:number,bevel=.01)=>{const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:12});g.rotateX(-Math.PI/2);g.computeBoundingBox();g.translate(0,bottom-g.boundingBox!.min.y,0);return g}
 const lock=mesh(actor,'longevity-silver-lock',extrude(outline,.065,.08),'#c8d4d7',[0,0,.45])
 const rimPoints=outline.getPoints(12);if(rimPoints.at(-1)!.distanceTo(rimPoints[0]!)<1e-8)rimPoints.pop()
 const rimCurve=new THREE.CatmullRomCurve3(rimPoints.map(p=>new THREE.Vector3(p.x,.169,.45-p.y)),true)
 mesh(actor,'longevity-raised-lock-rim',new THREE.TubeGeometry(rimCurve,128,.008,6,true),'#e8eef1',[0,0,0])
 mesh(actor,'longevity-suspension-bar',new THREE.BoxGeometry(.30,.04,.06),'#e8eef1',[0,.15,.14])
 for(const side of[-1,1])mesh(actor,`longevity-suspension-post-${side}`,new THREE.BoxGeometry(.04,.08,.08),'#c8d4d7',[side*.13,.125,.185])
 const line=(parent:THREE.Object3D,name:string,a:THREE.Vector3,b:THREE.Vector3,r=.008,color='#50606a')=>{const m=mesh(parent,name,new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),color,a.clone().add(b).multiplyScalar(.5).toArray() as[number,number,number]);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m}
 // Original raised geometric strokes, not a scanned inscription or a font asset.
 const letters:[string,number,number[][][]][]=[['long',-.23,[[[.09,-.14],[-.09,-.02]],[[-.14,0],[.13,0]],[[-.02,-.17],[-.02,.15],[.07,.10]],[[.01,.02],[.15,.16]]]],['ming',.23,[[[0,-.17],[-.16,-.06]],[[0,-.17],[.16,-.06]],[[-.09,-.035],[.09,-.035]],[[-.13,.01],[-.13,.14],[-.025,.14],[-.025,.01],[-.13,.01]],[[.04,.01],[.14,.01],[.14,.12],[.10,.12]],[[.04,.01],[.04,.18]]]]]
 for(const[name,x,strokes]of letters){const group=new THREE.Group();group.name=`longevity-letter-${name}`;actor.add(group);for(const[i,stroke]of strokes.entries())for(let j=1;j<stroke.length;j++){const a=stroke[j-1]!,b=stroke[j]!;line(group,`${name}-${i}-${j}`,new THREE.Vector3(x+a[0]!, .173,.45+a[1]!),new THREE.Vector3(x+b[0]!, .173,.45+b[1]!))}}
 const drops:THREE.Mesh[]=[]
 for(const[i,x]of[-.42,0,.42].entries()){
  line(actor,`longevity-drop-stem-${i}`,new THREE.Vector3(x,.105,.68),new THREE.Vector3(x,.105,.92),.012,'#c8d4d7')
  const flower=new THREE.Shape(Array.from({length:10},(_,j)=>{const a=j*Math.PI/5,r=j%2===0?.095:.055;return new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r)}));flower.closePath()
  drops.push(mesh(actor,`longevity-flower-drop-${i}`,extrude(flower,.03,.08,.01),'#c8d4d7',[x,0,.92]))
 }
 const pose=(step:number,t:number)=>{const n=THREE.MathUtils.clamp(t,0,1);if(step===0)actor.position.set(-1.3,.16+.54*n,.55);else if(step===1)actor.position.set(-1.3+2.25*n,.70,.55*(1-n));else actor.position.set(.95,step===2?.70-.54*n:.16,0);root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,actor,board,cord,lock,drops,stand,pad,box,pose,targets:[actor,actor,actor],roots:[actor,actor,actor],anchors:[[-.4,.04,1.05],[-.4,.04,1.05],[0,.165,.50]] as[number,number,number][],dispose(){}}
}
