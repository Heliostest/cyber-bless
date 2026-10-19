import * as THREE from 'three'

const centers=[1.55,1.10,.65],start=.27,end=2*Math.PI-.27
const point=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
function path(levels:number[]){
 const points:THREE.Vector3[]=[],ranges:number[][]=[]
 const add=(v:THREE.Vector3)=>{if(!points.length||points.at(-1)!.distanceToSquared(v)>1e-14)points.push(v)}
 const line=(a:THREE.Vector3,b:THREE.Vector3,n=24)=>{for(let i=0;i<=n;i++)add(a.clone().lerp(b,i/n))}
 const bezier=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,n=32)=>{const curve=new THREE.CubicBezierCurve3(a,b,c,d);for(let i=0;i<=n;i++)add(curve.getPoint(i/n))}
 line(point(.5,.18,.8),point(.5,2,.8))
 const arcStart=point(.15*Math.cos(.75*Math.PI),2.05,.15*Math.sin(.75*Math.PI))
 const arcTangent=(a:number)=>point(-Math.sin(a),0,Math.cos(a))
 bezier(points.at(-1)!,point(.5,2.3,.8),arcStart.clone().addScaledVector(arcTangent(.75*Math.PI),-.16),arcStart)
 for(let i=1;i<=64;i++){const a=(.75+1.5*i/64)*Math.PI;add(point(.15*Math.cos(a),2.05,.15*Math.sin(a)))}
 const knot=(i:number,t:number)=>{const n=levels[i]!,r=.17-.124*n,h=.12-.075*n,y=centers[i]!+(.25+.32*i)*n;return point(.5+r*(2+Math.cos(3*t))*Math.cos(2*t),y+h*Math.sin(3*t),.8+r*(2+Math.cos(3*t))*Math.sin(2*t))}
 const knotTangent=(i:number,t:number)=>{const n=levels[i]!,r=.17-.124*n,h=.12-.075*n,R=r*(2+Math.cos(3*t)),d=-3*r*Math.sin(3*t);return point(d*Math.cos(2*t)-2*R*Math.sin(2*t),3*h*Math.cos(3*t),d*Math.sin(2*t)+2*R*Math.cos(2*t)).normalize()}
 for(let i=0;i<3;i++){
  const to=knot(i,start),from=points.at(-1)!
  if(i===0){const gateway=point(1.18,2.2,1.35),direction=point(0,-1,0);bezier(from,from.clone().addScaledVector(arcTangent(2.25*Math.PI),.30),gateway.clone().addScaledVector(direction,-.40),gateway);bezier(gateway,gateway.clone().addScaledVector(direction,.24),to.clone().addScaledVector(knotTangent(i,start),-.20),to)}
  else {const length=.12+.08*(1-Math.min(levels[i-1]!,levels[i]!));bezier(from,from.clone().addScaledVector(knotTangent(i-1,end),length),to.clone().addScaledVector(knotTangent(i,start),-length),to)}
  const begin=points.length-1;for(let j=1;j<=144;j++)add(knot(i,start+(end-start)*j/144));ranges.push([begin,points.length-1])
 }
 const tail=point(1.1+.08*levels.reduce((a,b)=>a+b,0),.15,1.07)
 bezier(points.at(-1)!,points.at(-1)!.clone().addScaledVector(knotTangent(2,end),.18),point(.92,.18,.97),tail)
 return {points,ranges}
}

function clothTexture(){
 const width=256,height=32,pixels=new Uint8Array(width*height*4)
 // Original woven surface and a simple original Latin label, not copied sacred art.
 const letters=['110101110101110','111101101101111','101111111111101','111100110100100','111010010010111','101111111101101']
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y*width+x)*4,fiber=(x%3===0?4:0)+(y%3===0?-3:0),row=Math.floor((y-8)/3),col=Math.floor(x/3)%24,letter=letters[Math.floor(col/4)]!,ink=row>=0&&row<5&&col%4<3&&letter[row*3+col%4]==='1'
  pixels[at]=ink?139:242+fiber;pixels[at+1]=ink?101:205+fiber;pixels[at+2]=ink?49:111+fiber;pixels[at+3]=255
 }
 const map=new THREE.DataTexture(pixels,width,height);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.needsUpdate=true;return map
}

/** Original continuous thick cloth, already wound and loosely knotted before entry. */
export function createBonfimModel(){
 const root=new THREE.Group();root.name='bonfim-subject'
 const metal=new THREE.MeshStandardMaterial({color:0x477f7a,metalness:.48,roughness:.65}),texture=clothTexture(),cloth=new THREE.MeshStandardMaterial({color:0xffffff,map:texture,roughness:.93})
 const make=(name:string,g:THREE.BufferGeometry,mat:THREE.Material)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;root.add(m);return m}
 const bars=[-1.35,0,1.35].map((x,i)=>{const m=make('bonfim-bar-'+i,new THREE.CylinderGeometry(.055,.055,2.8,16),metal);m.position.set(x,1.4,0);return m})
 const rails=[.15,2.65].map((y,i)=>{const m=make('bonfim-rail-'+i,new THREE.BoxGeometry(2.8,.085,.085),metal);m.position.y=y;return m})
 const initial=path([0,0,0]),count=initial.points.length,position=new Float32Array(count*12),uv=new Float32Array(count*8),indices:number[]=[]
 for(let i=0;i<count;i++)for(let j=0;j<4;j++){uv[i*8+j*2]=i/count*12;uv[i*8+j*2+1]=j===0||j===3?1:0}
 for(let i=0;i<count-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+(j+1)%4,d=(i+1)*4+j;indices.push(a,b,c,a,c,d)}
 indices.push(0,2,1,0,3,2);const last=(count-1)*4;indices.push(last,last+1,last+2,last,last+2,last+3)
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices)
 const ribbon=make('bonfim-ribbon',geometry,cloth),knotLevels=[0,0,0],width=.04,thickness=.006
 const write=(points:THREE.Vector3[])=>{
  let normal=point(1,0,0)
  for(let i=0;i<count;i++){
   const tangent=points[Math.min(count-1,i+1)]!.clone().sub(points[Math.max(0,i-1)]!).normalize()
   normal.addScaledVector(tangent,-normal.dot(tangent));if(normal.lengthSq()<1e-12)normal=point(0,0,1).addScaledVector(tangent,-tangent.z);normal.normalize()
   const binormal=tangent.clone().cross(normal).normalize()
   for(const [j,a,b]of[[0,1,1],[1,-1,1],[2,-1,-1],[3,1,-1]]){const v=points[i]!.clone().addScaledVector(normal,a!*width/2).addScaledVector(binormal,b!*thickness/2),at=(i*4+j!)*3;position[at]=v.x;position[at+1]=v.y;position[at+2]=v.z}
  }
  geometry.attributes.position!.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere()
 }
 function pose(step:number,amount:number){const t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0;for(let i=0;i<3;i++)knotLevels[i]=i<step?1:i===step?t:0;write(path(knotLevels).points);root.updateMatrixWorld(true)}
 pose(0,0);let disposed=false;const dispose=()=>{if(!disposed){disposed=true;texture.dispose()}}
 const isKnotFace=(step:number,face:number|undefined)=>{const range=initial.ranges[step];return !!range&&face!==undefined&&face>=range[0]!*8&&face<range[1]!*8}
 return{root,subject:root,ribbon,bars,rails,knotLevels,knotRanges:initial.ranges,bandWidth:width,bandThickness:thickness,pose,dispose,isKnotFace,targets:[ribbon,ribbon,ribbon],roots:[ribbon,ribbon,ribbon],anchors:[[.648121563476,1.669623803414,1.091023272286],[.648121563476,1.219623803414,1.091023272286],[.648121563476,.769623803414,1.091023272286]] as [number,number,number][]}
}
