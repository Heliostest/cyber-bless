import * as THREE from 'three'

/** One legal opening move on an original plain2x6 board; no full-match engine. */
export function createOwareModel() {
  const subject=new THREE.Group();subject.name='oware-subject'
  const material=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
  const wood=material(0xcc9b60),edge=material(0xb88049),cup=material(0x9d683e),seedMat=material(0x81918a,.35),scar=material(0xd9d3b5,.7),teal=material(0x44877c)
  const add=(parent:THREE.Object3D,name:string,geometry:THREE.BufferGeometry,mat:THREE.Material)=>{
    const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh
  }
  const centers=Array.from({length:12},(_,i)=>new THREE.Vector3((i<6?i:11-i)*.88-2.2,0,i<6?.52:-.52))
  const outline=()=>{
    const s=new THREE.Shape(),x=2.72,z=1.05,r=.24
    s.moveTo(-x+r,-z);s.lineTo(x-r,-z);s.quadraticCurveTo(x,-z,x,-z+r);s.lineTo(x,z-r);s.quadraticCurveTo(x,z,x-r,z)
    s.lineTo(-x+r,z);s.quadraticCurveTo(-x,z,-x,z-r);s.lineTo(-x,-z+r);s.quadraticCurveTo(-x,-z,-x+r,-z);return s
  }
  const top=outline()
  centers.forEach(c=>{const hole=new THREE.Path();hole.absarc(c.x,-c.z,.36,0,Math.PI*2,true);top.holes.push(hole)})
  const boardGeometry=new THREE.ExtrudeGeometry(top,{depth:.30,bevelEnabled:false,curveSegments:16});boardGeometry.rotateX(-Math.PI/2);boardGeometry.translate(0,.04,0)
  const board=add(subject,'oware-board',boardGeometry,wood)
  const bottomGeometry=new THREE.ExtrudeGeometry(outline(),{depth:.04,bevelEnabled:false,curveSegments:16});bottomGeometry.rotateX(-Math.PI/2)
  add(subject,'oware-closed-bottom',bottomGeometry,edge)
  const bowlHeight=(r:number)=>.10+.24*(r/.36)**2
  const profile=Array.from({length:17},(_,i)=>{const r=.36*i/16;return new THREE.Vector2(r,bowlHeight(r))}).reverse()
  const bowlGeometry=new THREE.LatheGeometry(profile,48)
  const pits=centers.map((c,i)=>{const bowl=add(subject,'oware-pit-'+i,bowlGeometry,cup);bowl.position.copy(c);return bowl})
  for(const x of [-2.56,2.56]){const accent=add(subject,'oware-end-inlay-'+x,new THREE.BoxGeometry(.025,.002,1.30),teal);accent.position.set(x,.341,0)}
  // Original fine wood grain runs around, rather than across, the actual openings.
  const grain:number[]=[]
  for(let row=0;row<21;row++)for(let segment=0;segment<100;segment++){
    const x=-2.45+segment*.049,z=-.95+row*.095+Math.sin(x*1.8+row)*.009
    if(centers.some(c=>Math.hypot(c.x-x,c.z-z)<.405))continue
    grain.push(x,.341,z,x+.031,.341,z+.001)
  }
  const grainGeometry=new THREE.BufferGeometry();grainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(grain,3))
  const grainLines=new THREE.LineSegments(grainGeometry,new THREE.LineBasicMaterial({color:0x8b603c,transparent:true,opacity:.27}));grainLines.name='oware-wood-grain';subject.add(grainLines)
  const seedGeometry=new THREE.SphereGeometry(.10,16,10);seedGeometry.scale(1,.75,.85)
  const scarGeometry=new THREE.CylinderGeometry(.017,.017,.002,12),vertices=seedGeometry.getAttribute('position')
  const offsets=[[.13,.13],[-.13,.13],[.13,-.13],[-.13,-.13],[0,0]] as const
  // Solve support against the curved wood, using the real seed surface vertices.
  const heights=offsets.map(([x,z])=>{let y=-Infinity;for(let i=0;i<vertices.count;i++)y=Math.max(y,bowlHeight(Math.hypot(x+vertices.getX(i),z+vertices.getZ(i)))-vertices.getY(i));return y+.0025})
  const homes=centers.map(c=>offsets.map(([x,z],slot)=>new THREE.Vector3(c.x+x,heights[slot]!,c.z+z)))
  const home=(pit:number,slot:number)=>homes[pit]![slot]!
  const carry=new THREE.Group();carry.name='oware-carry';subject.add(carry)
  const seeds:THREE.Mesh[]=[],moving:THREE.Mesh[]=[]
  const makeSeed=(parent:THREE.Object3D,name:string)=>{
    const seed=add(parent,name,seedGeometry,seedMat);seeds.push(seed)
    const mark=add(seed,name+'-scar',scarGeometry,scar);mark.position.y=.075;mark.castShadow=false;return seed
  }
  centers.forEach((_,pit)=>{if(pit===4)return;for(let slot=0;slot<4;slot++)makeSeed(subject,`oware-seed-${pit}-${slot}`).position.copy(home(pit,slot))})
  for(let j=0;j<4;j++)moving.push(makeSeed(carry,'oware-hand-seed-'+j))
  const destinations=[5,6,7,8],point=new THREE.Vector3(),start=new THREE.Vector3(),end=new THREE.Vector3(),lift=.65
  const pose=(at:number,n:number)=>{
    n=THREE.MathUtils.clamp(n,0,1)
    if(at===0){
      carry.position.copy(centers[4]!);carry.position.y=lift*n
      moving.forEach((seed,j)=>seed.position.set(offsets[j]![0],heights[j]!,offsets[j]![1]))
    }else{
      const progress=at===1?2*n:at===2?2+2*n:4,j=Math.min(3,Math.floor(progress)),t=progress-j
      start.copy(centers[j===0?4:destinations[j-1]!]!);end.copy(centers[destinations[j]!]!)
      carry.position.lerpVectors(start,end,THREE.MathUtils.clamp(t/.65,0,1));carry.position.y=lift
      moving.forEach((seed,index)=>{
        if(progress>=index+1)point.copy(home(destinations[index]!,4))
        else if(progress>index){
          // Separate vertically before crossing the carried cluster, then drop at the empty center.
          const raise=THREE.MathUtils.clamp((t-.65)/.04,0,1),align=THREE.MathUtils.clamp((t-.69)/.07,0,1),drop=THREE.MathUtils.clamp((t-.76)/.24,0,1)
          point.set(carry.position.x+offsets[index]![0]*(1-align),THREE.MathUtils.lerp(lift+heights[index]!+.18*raise,heights[4]!,drop),carry.position.z+offsets[index]![1]*(1-align))
        }else point.set(carry.position.x+offsets[index]![0],carry.position.y+heights[index]!,carry.position.z+offsets[index]![1])
        seed.position.copy(point).sub(carry.position)
      })
    }
    subject.updateMatrixWorld(true)
  }
  const counts=()=>{
    const result=Array(12).fill(0) as number[]
    for(const seed of seeds){seed.getWorldPosition(point);if(point.y>.34)continue;const pit=centers.findIndex(c=>Math.hypot(c.x-point.x,c.z-point.z)<.36);if(pit>=0)result[pit]++}
    return result
  }
  pose(0,0)
  const targets=[moving[0]!,moving[0]!,moving[2]!]
  return {subject,board,pits,seeds,moving,carry,centers,bowlHeight,counts,pose,targets,roots:targets,anchors:targets.map(()=>[.05,.04,.03] as [number,number,number])}
}
