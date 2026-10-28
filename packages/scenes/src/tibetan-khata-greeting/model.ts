import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

/** Ordinary welcoming gift, with a pre-folded khata. The transfer is a product
 * sequence, not a prescribed three-part rite or a teacher's blessing. */
export function createKhataModel() {
  const root=new THREE.Group();root.name='khata-root'
  const subject=new THREE.Group();subject.name='khata-subject';root.add(subject)
  const material=(color:number,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness})
  const stone=material(0xd3cbb3),cream=material(0xfff4db,.48),edgeCream=createRitualMaterial({color:0xfff4db,roughness:.48}, { kind: 'cloth', strength: .10, fiber: false }),hem=createRitualMaterial({color:0xe1dbc4,roughness:.6}, { kind: 'cloth', strength: .14, fiber: false }),skin=material(0xd7a17e),hair=material(0x584f43),shoe=material(0x555852)
  const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material|THREE.Material[],parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
  const ball=(name:string,p:THREE.Vector3,s:[number,number,number],m:THREE.Material)=>{const o=mesh(name,new THREE.SphereGeometry(1,20,12),m);o.position.copy(p);o.scale.set(...s);return o}
  const rod=(name:string,r:number,m:THREE.Material,parent:THREE.Object3D=subject)=>{
    const o=mesh(name,new THREE.CylinderGeometry(r,r,1,12),m,parent)
    const set=(a:THREE.Vector3,b:THREE.Vector3)=>{const d=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(v(0,1,0),d.normalize())}
    return {o,set}
  }
  const ground=mesh('khata-ground',new THREE.CylinderGeometry(1.37,1.42,.08,64),stone);ground.scale.z=.8;ground.position.y=-.04
  // The folded cross-section is a continuous thin C: crease at -x, two open
  // edges at +x facing the arriving guest. End caps make one closed cloth solid.
  const section=[[-.085,-.009],[.095,-.009],[.095,-.004],[-.081,-.004],[-.086,0],[-.081,.004],[.095,.004],[.095,.009],[-.085,.009],[-.095,.004],[-.095,-.004]].map(([x,y])=>new THREE.Vector2(x,y))
  const drape=(z:number)=>-.32*Math.pow(Math.max(0,(Math.abs(z)-.20)/.54),1.35)+.018*Math.max(0,1-Math.abs(z)/.20)
  const vertices:number[]=[],indices:number[]=[],rings=48,N=section.length
  for(let i=0;i<=rings;i++){const z=(i/rings-.5)*1.48;for(const p of section)vertices.push(p.x,drape(z)+p.y,z)}
  for(let i=0;i<rings;i++)for(let j=0;j<N;j++){const a=i*N+j,b=i*N+(j+1)%N,c=(i+1)*N+j,d=(i+1)*N+(j+1)%N;indices.push(a,b,c,b,d,c)}
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(section,[])){indices.push(c!,b!,a!,rings*N+a!,rings*N+b!,rings*N+c!)}
  const joined=new THREE.BufferGeometry();joined.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));joined.setIndex(indices)
  // Keep the thin folded edges sharp; averaging across the inner/outer crease
  // would reverse some vertex normals on this narrow cross-section.
  const clothGeometry=joined.toNonIndexed();joined.dispose();clothGeometry.computeVertexNormals();clothGeometry.setIndex(Array.from({length:clothGeometry.getAttribute('position').count},(_,i)=>i))
  // Keep the broad folded faces unchanged. Only the two free +x section edges
  // get thin-silk backlighting; regroup indices into two draws, not one per fold.
  const solidIndices:number[]=[],edgeIndices:number[]=[]
  const originalIndex=clothGeometry.index!
  for(let i=0;i<originalIndex.count;i+=3){
    const sectionEdge=Math.floor(i/6)%N
    const target=i<rings*N*6&&(sectionEdge===1||sectionEdge===6)?edgeIndices:solidIndices
    target.push(originalIndex.getX(i),originalIndex.getX(i+1),originalIndex.getX(i+2))
  }
  clothGeometry.setIndex([...solidIndices,...edgeIndices])
  clothGeometry.addGroup(0,solidIndices.length,0)
  clothGeometry.addGroup(solidIndices.length,edgeIndices.length,1)
  const scarf=new THREE.Group();scarf.name='khata-scarf';subject.add(scarf)
  const cloth=mesh('khata-cloth',clothGeometry,[cream,edgeCream],scarf)
  // Short uninscribed fringes meet the cloth ends; no invented sacred symbols.
  for(const sign of[-1,1])for(let i=0;i<9;i++){const x=-.08+i*.02,z=sign*.74,t=rod('khata-fringe-'+sign+'-'+i,.0035,hem,scarf);t.set(v(x,drape(z),z),v(x+.006*Math.sin(i),drape(z)-.065,z+sign*.035))}
  const people=[{name:'giver',x:-.83,dir:1,color:0xc18b56},{name:'guest',x:.83,dir:-1,color:0x6b9a91}].map(({name,x,dir,color})=>{
    const coat=material(color),pants=material(name==='giver'?0x667c85:0x828371)
    const body=ball('khata-'+name+'-jacket',v(x,.84,0),[.17,.30,.22],coat)
    const neck=rod('khata-'+name+'-neck',.068,skin);neck.set(v(x,1.04,0),v(x,1.19,0))
    const head=ball('khata-'+name+'-head',v(x,1.31,0),[.13,.17,.14],skin)
    const hairMesh=ball('khata-'+name+'-hair',v(x-dir*.025,1.37,0),[.13,.12,.143],hair)
    const nose=ball('khata-'+name+'-nose',v(x+dir*.13,1.30,0),[.04,.035,.035],skin)
    const arms=[-1,1].map((sign,i)=>({shoulder:v(x,1.02,sign*.20),upper:rod('khata-'+name+'-upper-'+i,.061,coat),lower:rod('khata-'+name+'-lower-'+i,.035,coat),hand:ball('khata-'+name+'-hand-'+i,v(0,0,0),[.069,.047,.055],skin)}))
    const feet=[-1,1].map((sign,i)=>{
      const upper=rod('khata-'+name+'-thigh-'+i,.075,pants),lower=rod('khata-'+name+'-shin-'+i,.063,pants)
      upper.set(v(x,.58,sign*.12),v(x,.31,sign*.12));lower.set(v(x,.31,sign*.12),v(x,.075,sign*.12))
      return ball('khata-'+name+'-shoe-'+i,v(x+dir*.035,.055,sign*.12),[.13,.055,.085],shoe)
    })
    const setHands=(points:THREE.Vector3[])=>arms.forEach((arm,i)=>{const end=points[i]!,elbow=arm.shoulder.clone().lerp(end,.48);elbow.y-=.12;elbow.z+=(i?1:-1)*.07;arm.upper.set(arm.shoulder,elbow);arm.lower.set(elbow,end);arm.hand.position.copy(end)})
    return {name,x,dir,body,head,hair:hairMesh,nose,arms,feet,setHands}
  })
  const pose=(step:number,amount:number)=>{
    const n=Number.isFinite(step)?THREE.MathUtils.clamp(Math.floor(step),0,3):0,t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0
    const lift=n===0?t:1,extend=n===1?t:n>1?1:0,receive=n===2?t:n>2?1:0
    const move=.12*receive+.88*THREE.MathUtils.clamp((receive-.22)/.78,0,1),scarfX=-.35+.35*extend+.35*move,scarfY=.92+.24*lift
    scarf.position.set(scarfX,scarfY,0)
    const support=(x:number,z:number)=>v(x,scarfY+drape(z)-.055,z)
    const giverX=receive<=.30?scarfX-.035:THREE.MathUtils.lerp(scarfX-.035,-.39,(receive-.30)/.70)
    const giver=people[0]!,guest=people[1]!
    giver.setHands([-1,1].map(sign=>{const p=support(giverX,sign*.34);if(receive>.30)p.y=THREE.MathUtils.lerp(p.y,.84,(receive-.30)/.70);return p}))
    const meet=THREE.MathUtils.clamp(receive/.22,0,1)
    guest.setHands([-1,1].map(sign=>v(.46,.82,sign*.20).lerp(support(scarfX+.035,sign*.20),meet)))
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,scarf,cloth,people,drape,targets:[scarf,scarf,scarf],roots:[scarf,scarf,scarf],anchors:[[0,.025,0],[0,.025,0],[0,.025,0]] as [number,number,number][],pose,dispose(){}}
}
