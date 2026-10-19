import * as THREE from 'three'

/** Standard seven-piece square dissection; coordinates are original geometry. */
export function createTangramModel() {
  const subject=new THREE.Group();subject.name='tangram-subject'
  const material=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
  const cotton=material(0xb9d4d8,1),stitch=material(0x7dabb2,1),maple=material(0xd7b783),edge=material(0xb18a54)
  const add=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,m:THREE.Material|THREE.Material[])=>{
    const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh
  }
  const box=(name:string,w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number)=>{
    const mesh=add(subject,name,new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);return mesh
  }
  box('tangram-cotton-mat',5.25,.025,4.25,cotton,0,-.0125,.52)
  for(let i=0;i<44;i++)for(const z of [-1.53,2.57])box(`tangram-stitch-${i}-${z}`,.065,.002,.012,stitch,-2.48+i*.115,.002,z)
  box('tangram-board',2.54,.035,2.54,maple,0,.0175,0)
  for(const x of [-1.25,1.25])box(`tangram-border-x-${x}`,.035,.018,2.54,edge,x,.042,0)
  for(const z of [-1.25,1.25])box(`tangram-border-z-${z}`,2.54,.018,.035,edge,0,.042,z)
  const definitions:[string,number,number[][]][]=[
    ['large-0',0xd77759,[[0,0],[4,0],[2,2]]],
    ['large-1',0xe2b955,[[0,0],[2,2],[0,4]]],
    ['medium',0x58a397,[[4,4],[2,4],[4,2]]],
    ['small-1',0x74acc0,[[2,2],[3,1],[3,3]]],
    ['square',0xa18ab6,[[2,2],[3,3],[2,4],[1,3]]],
    ['small-2',0xa4c6d1,[[0,4],[1,3],[2,4]]],
    ['parallelogram',0xc9878d,[[4,0],[4,2],[3,3],[3,1]]],
  ]
  const pieces:THREE.Group[]=[],destinations:THREE.Vector3[]=[]
  for(const [name,color,points] of definitions){
    const center=new THREE.Vector2(points.reduce((s,p)=>s+p[0]!,0)/points.length,points.reduce((s,p)=>s+p[1]!,0)/points.length)
    const shape=new THREE.Shape();points.forEach((p,i)=>shape[i?'lineTo':'moveTo']((p[0]!-center.x)*.6*.985,-(p[1]!-center.y)*.6*.985));shape.closePath()
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2)
    const piece=new THREE.Group();piece.name='tangram-'+name;subject.add(piece);pieces.push(piece)
    add(piece,piece.name+'-shell',geometry,[material(color,.65),maple])
    destinations.push(new THREE.Vector3((center.x-2)*.6,.045,(center.y-2)*.6))
  }
  const moving=[3,4,6],starts=[new THREE.Vector3(2,.045,-.40),new THREE.Vector3(0,.045,2.0),new THREE.Vector3(-2,.045,-.35)],rotations=[0,Math.PI/4,-Math.PI]
  const pose=(at:number,n:number)=>{
    n=THREE.MathUtils.clamp(n,0,1)
    pieces.forEach((p,i)=>{p.position.copy(destinations[i]!);p.rotation.set(0,0,0)})
    moving.forEach((index,step)=>{
      const t=step<at?1:step===at?n:0,p=pieces[index]!,travel=THREE.MathUtils.clamp((t-.15)/.70,0,1)
      p.position.lerpVectors(starts[step]!,destinations[index]!,travel)
      // Complete lateral travel and rotation at full clearance before lowering.
      p.position.y+=.30*Math.min(1,t/.15,(1-t)/.15)
      p.rotation.y=rotations[step]!*(1-travel)
    })
    subject.updateMatrixWorld(true)
  }
  pose(0,0)
  const roots=moving.map(i=>pieces[i]!),targets=roots.map(p=>p.children[0]!)
  return {subject,pieces,pose,targets,roots,anchors:roots.map(()=>[0,.09,0] as [number,number,number])}
}
