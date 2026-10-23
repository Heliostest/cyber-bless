import * as THREE from 'three'

/** Original window and cloth: the three paths are product choreography. */
export function createBratBrideModel() {
 const root=new THREE.Group();root.name='brat-cloth-subject'
 const material=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.86})
 const stone=material(0xaaa6b1),wood=material(0x80584d),glass=material(0x35435f),benchMat=material(0xb18061),base=material(0x586775)
 const box=(name:string,size:[number,number,number],at:[number,number,number],mat:THREE.Material)=>{const g=new THREE.BoxGeometry(...size).toNonIndexed(),mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.position.set(...at);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh}
 const board=box('window-plinth',[3.6,.08,3.35],[0,.04,.80],base)
 box('window-lower-wall',[2.70,.68,.36],[0,.42,-.22],stone)
 box('window-left-pier',[.28,2.12,.36],[-1.47,1.14,-.22],stone)
 box('window-right-pier',[.28,2.12,.36],[1.47,1.14,-.22],stone)
 box('window-lintel',[3.22,.16,.36],[0,2.12,-.22],stone)
 const sill=box('outside-windowsill',[3.25,.12,1.30],[0,.82,.30],stone)
 box('window-night-pane',[2.62,1.12,.06],[0,1.49,-.31],glass)
 for(const x of[-1.27,1.27])box(`window-frame-${x}`,[.065,1.18,.10],[x,1.49,-.24],wood)
 for(const y of[.91,2.07])box(`window-crossbar-${y}`,[2.60,.065,.10],[0,y,-.24],wood)
 box('window-mullion',[.035,1.16,.10],[0,1.49,-.24],wood)
 box('window-middle-bar',[2.60,.035,.10],[0,1.49,-.24],wood)
 const bench=box('preparing-bench',[2.12,.06,.98],[0,.29,1.75],benchMat)
 for(const x of[-.83,.83])for(const z of[1.42,2.08])box(`bench-leg-${x}-${z}`,[.12,.18,.12],[x,.17,z],wood)

 // Top and underside share the same curved parameterization; all four sides are sealed.
 const nx=24,nz=12,points:number[][]=[],faces:number[]=[],colors:number[]=[],top=new THREE.Color(0x477d84),hem=new THREE.Color(0xb6c7bd),bottom=new THREE.Color(0x385f69)
 for(let side=0;side<2;side++)for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)points.push([(i/nx-.5)*1.65,side,(j/nz-.5)*.74])
 const layer=(nx+1)*(nz+1),at=(i:number,j:number)=>j*(nx+1)+i,quad=(a:number,b:number,c:number,d:number)=>faces.push(a,b,c,a,c,d)
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);quad(a,d,c,b);quad(a+layer,b+layer,c+layer,d+layer)}
 const boundary:number[]=[];for(let j=0;j<=nz;j++)boundary.push(at(0,j));for(let i=1;i<=nx;i++)boundary.push(at(i,nz));for(let j=nz-1;j>=0;j--)boundary.push(at(nx,j));for(let i=nx-1;i>0;i--)boundary.push(at(i,0));
 for(let i=0;i<boundary.length;i++){const a=boundary[i]!,b=boundary[(i+1)%boundary.length]!;quad(a,a+layer,b+layer,b)}
 const vertices:number[]=[],sample:{x:number;z:number;under:boolean}[]=[]
 for(const index of faces){const [x,side,z]=points[index]!;vertices.push(x!,0,z!);sample.push({x:x!,z:z!,under:side===1});const rim=Math.abs(x!)>.78||Math.abs(z!)>.34,color=side===1?bottom:rim?hem:top;colors.push(color.r,color.g,color.b)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals()
 const cloth=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.95}));cloth.name='brat-cloth';cloth.castShadow=cloth.receiveShadow=true;root.add(cloth)
 const clamp=(n:number)=>THREE.MathUtils.clamp(n,0,1)
 function pose(step:number,t:number){
  t=clamp(t);let y=.32,z=1.75,amplitude=.045
  if(step===0){y=THREE.MathUtils.lerp(.32,1.16,t);amplitude=THREE.MathUtils.lerp(.045,.085,t)}
  else if(step===1){y=1.16;z=THREE.MathUtils.lerp(1.75,.48,t);amplitude=.085}
  else if(step===2){y=THREE.MathUtils.lerp(1.16,.88,t);z=.48;amplitude=THREE.MathUtils.lerp(.085,.035,t)}
  else if(step>=3){y=.88;z=.48;amplitude=.035}
  cloth.position.set(0,y,z)
  const p=geometry.getAttribute('position')
  for(let i=0;i<sample.length;i++){const s=sample[i]!,u=s.x/1.65+.5,v=s.z/.74+.5,wave=amplitude*Math.pow(Math.sin(Math.PI*u)*Math.sin(Math.PI*v),2)*(.65+.35*Math.cos(6*Math.PI*u));p.setY(i,wave+(s.under?0:.012))}
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,cloth,board,bench,sill,pose,targets:[cloth,cloth,cloth],roots:[cloth,cloth,cloth],anchors:[[0,.03,0],[0,.03,0],[0,.03,0]] as [number,number,number][],dispose(){}}
}
