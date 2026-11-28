import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import {
  applyStylizedHumanSurfaceHint,
  createStylizedGarmentMaterial,
  createStylizedHairGeometry,
  createStylizedHeadGeometry,
  createStylizedLimbGeometry,
  createStylizedPalmGeometry,
  createStylizedShoeGeometry,
  createStylizedSkinMaterial,
  createStylizedSleeveCuffGeometry,
  createStylizedTorsoGeometry,
  subdivideClosedCage,
} from '@wbr/scene-runtime/stylized-human'
import * as THREE from 'three'

/** An illustrative stone ovoo and visitor. Three clockwise circuits are source-supported;
 * one stone per circuit, clothing, landscape and the precise path are product choices. */
export function createOvooModel() {
  const root=new THREE.Group();root.name='ovoo-root'
  const subject=new THREE.Group();subject.name='ovoo-subject';root.add(subject)
  const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.88})
  const grey=[mat(0xa6afa9),mat(0x8c9b99),mat(0xb9b6a4),mat(0x758b8e)],sand=mat(0xd8c8a4),blue=mat(0x74a4ba),bark=mat(0x837158)
  const coat=createStylizedGarmentMaterial({color:0xc8874f,roughness:.91,fabricStrength:.28,name:'ovoo-deel'})
  const pants=createStylizedGarmentMaterial({color:0x496d75,roughness:.92,fabricStrength:.26,name:'ovoo-trousers'})
  const skin=createStylizedSkinMaterial({color:0xe3b48c,roughness:.86,scatterStrength:.12,name:'ovoo-skin'})
  const hair=new THREE.MeshStandardMaterial({color:0x504b40,roughness:.85,vertexColors:true})
  const shoe=new THREE.MeshStandardMaterial({color:0x5d5b50,roughness:.88,vertexColors:true})
  grey.forEach(stone=>applyCraftSurface(stone,{kind:'stone',strength:.45}))
  applyCraftSurface(bark,{kind:'wood',strength:.35,axis:'y'})
  applyCraftSurface(blue,{kind:'fabric',strength:.25})
  const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const ball=(name:string,p:[number,number,number],s:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(name,new THREE.SphereGeometry(1,20,12),m,parent);o.position.set(...p);o.scale.set(...s);return o}
  const rod=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Object3D=subject)=>{
    const o=mesh(name,new THREE.CylinderGeometry(r,r,1,12),m,parent)
    const set=(a:THREE.Vector3,b:THREE.Vector3)=>{const d=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())}
    set(a,b);return {o,set}
  }
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
  const GROUND_Y=-.082
  // Natural tapered earthen cairn skirt & grounded peripheral stones at garden-path surface (-0.082)
  // replace the redundant 4.6m flat sand disc.
  const skirtProfile=[
    new THREE.Vector2(0,-.090),
    new THREE.Vector2(1.18,-.090),
    new THREE.Vector2(1.12,-.072),
    new THREE.Vector2(.98,-.042),
    new THREE.Vector2(.84,-.008),
    new THREE.Vector2(.76,.020),
    new THREE.Vector2(0,.020),
  ]
  const skirtGeo=new THREE.LatheGeometry(skirtProfile,48)
  const skirtPos=skirtGeo.getAttribute('position') as THREE.BufferAttribute
  for(let i=0;i<skirtPos.count;i++){
    const x=skirtPos.getX(i),z=skirtPos.getZ(i),r=Math.hypot(x,z)
    if(r>.05){
      const a=Math.atan2(z,x),wave=1+.042*Math.sin(5*a+.4)+.024*Math.cos(3*a-.7)
      skirtPos.setX(i,x*wave);skirtPos.setZ(i,z*wave)
    }
  }
  skirtGeo.computeVertexNormals()
  mesh('ovoo-cairn-skirt',skirtGeo,sand)
  // Overlapping stones form a supported cairn rooted down into the garden ground.
  const cairn=mesh('ovoo-cairn-core',new THREE.CylinderGeometry(.20,.82,.93,16),grey[0]!);cairn.position.y=.375
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2+.18,rr=.82+.08*Math.sin(i*2.3)
    ball('ovoo-skirt-stone-'+i,[Math.sin(a)*rr,-.042,Math.cos(a)*rr],[.19,.088,.16],grey[i%4]!)
  }
  for(let level=0;level<4;level++){
    const radius=.60-level*.14,count=12-level*2,y=.12+level*.20
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2+level*.31;ball('ovoo-stone-'+level+'-'+i,[Math.sin(a)*radius,y,Math.cos(a)*radius],[.21-level*.024,.135,.18-level*.018],grey[(i+level)%4]!)}
  }
  const cap=ball('ovoo-crown',[0,.845,0],[.26,.10,.25],grey[2]!)
  rod('ovoo-pole',v(0,.71,0),v(0,1.43,0),.022,bark)
  // An uninscribed blue sash is tied to the pole; no invented mantra or colour meaning.
  const sash=mesh('ovoo-sash',new THREE.TorusGeometry(.038,.018,8,20),blue);sash.position.set(0,1.19,0);sash.rotation.x=Math.PI/2
  for(const [i,x]of[-.023,.023].entries()){
    const tail=mesh('ovoo-sash-tail-'+i,new THREE.BoxGeometry(.05,.20,.015),blue);tail.position.set(x,1.08,-.04);tail.rotation.z=i?-.11:.1
  }
  const makeNormalizedLimb=(topRadius:number,bottomRadius:number,bend:number,foldDepth:number,radialSegments=8)=>{
    const g=createStylizedLimbGeometry({length:1,topRadius,bottomRadius,bend,foldDepth,radialSegments,iterations:1})
    g.computeBoundingBox()
    const bb=g.boundingBox!
    const spanY=Math.max(bb.max.y-bb.min.y,1e-4)
    g.translate(0,-(bb.min.y+bb.max.y)*.5,0)
    g.scale(1,1/spanY,1)
    g.computeVertexNormals()
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g
  }
  const makeNormalizedCuff=(cuffR:number,sleeveR:number)=>{
    const g=createStylizedSleeveCuffGeometry({
      length:1,
      cuffRadiusX:cuffR,
      cuffRadiusY:cuffR*.94,
      sleeveRadiusX:sleeveR,
      sleeveRadiusY:sleeveR*.94,
      wallThickness:.008,
      rolledLip:.006,
      foldDepth:.004,
      radialSegments:10,
      iterations:1,
    })
    g.rotateX(Math.PI/2)
    g.computeBoundingBox()
    const bb=g.boundingBox!
    const spanY=Math.max(bb.max.y-bb.min.y,1e-4)
    g.translate(0,-(bb.min.y+bb.max.y)*.5,0)
    g.scale(1,1/spanY,1)
    g.computeVertexNormals()
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g
  }
  const limb=(name:string,g:THREE.BufferGeometry,a:THREE.Vector3,b:THREE.Vector3,m:THREE.Material,parent:THREE.Object3D=subject,role:'garment'|'skin'='garment')=>{
    const o=applyStylizedHumanSurfaceHint(mesh(name,g,m,parent),role)
    const set=(p0:THREE.Vector3,p1:THREE.Vector3)=>{const d=p1.clone().sub(p0);o.position.copy(p0).add(p1).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())}
    set(a,b);return {o,set}
  }
  const visitor=new THREE.Group();visitor.name='ovoo-visitor';subject.add(visitor)
  const body=new THREE.Group();body.name='ovoo-visitor-body';visitor.add(body)

  // Warm stylized Mongolian deel-inspired coat with crossed front lapel (facing -Z) and cinched sash waist.
  const jacketGeo=createStylizedTorsoGeometry({
    shoulderWidth:.37,
    waistWidth:.285,
    hemWidth:.42,
    depth:.255,
    height:.55,
    collarStyle:'crossed',
    foldDepth:.011,
    radialSegments:10,
    iterations:1,
  })
  jacketGeo.rotateY(Math.PI)
  const jacketMesh=applyStylizedHumanSurfaceHint(mesh('ovoo-jacket',jacketGeo,coat,body),'garment')
  jacketMesh.position.set(0,.44,0)

  const sashBeltGeo=createStylizedTorsoGeometry({
    shoulderWidth:.31,
    waistWidth:.315,
    hemWidth:.32,
    depth:.25,
    height:.082,
    collarStyle:'round',
    foldDepth:.004,
    radialSegments:10,
    iterations:1,
  })
  const sashBeltMesh=applyStylizedHumanSurfaceHint(mesh('ovoo-deel-sash',sashBeltGeo,pants,body),'garment')
  sashBeltMesh.position.set(0,.62,0)

  limb('ovoo-neck',makeNormalizedLimb(.054,.062,0,.001,8),v(0,.93,0),v(0,1.06,0),skin,body,'skin')

  const headGeo=createStylizedHeadGeometry({
    width:.255,
    height:.295,
    depth:.245,
    cheekFullness:.18,
    noseProminence:.42,
    chinTaper:.16,
    radialSegments:10,
    iterations:1,
  })
  const headMesh=applyStylizedHumanSurfaceHint(mesh('ovoo-head',headGeo,skin,body),'skin')
  headMesh.position.set(0,1.135,0)
  headMesh.rotation.y=Math.PI

  const hairGeo=createStylizedHairGeometry({
    style:'short',
    headWidth:.255,
    headHeight:.295,
    headDepth:.245,
    volume:.024,
    radialSegments:10,
    iterations:1,
  })
  const hairMesh=applyStylizedHumanSurfaceHint(mesh('ovoo-hair',hairGeo,hair,body),'hair')
  hairMesh.position.set(0,1.145,0)
  hairMesh.rotation.y=Math.PI

  const noseCage=new THREE.IcosahedronGeometry(1,0)
  const noseGeo=subdivideClosedCage(noseCage,{iterations:1})
  noseCage.dispose()
  noseGeo.scale(.022,.026,.024)
  const noseMesh=applyStylizedHumanSurfaceHint(mesh('ovoo-nose',noseGeo,skin,body),'skin')
  noseMesh.position.set(0,1.125,-.126)

  const packCage=new THREE.BoxGeometry(.25,.32,.13,2,2,2)
  const packGeo=subdivideClosedCage(packCage,{iterations:1})
  packCage.dispose()
  const packMesh=applyStylizedHumanSurfaceHint(mesh('ovoo-pack',packGeo,pants,body),'garment')
  packMesh.position.set(0,.74,.152)

  body.position.y=.48;for(const child of body.children)child.position.y-=.48
  const legs=[-.10,.10].map((x,i)=>{
    const bootGeo=createStylizedShoeGeometry({length:.24,width:.132,height:.102,toeLift:.017,radialSegments:8,iterations:1})
    const foot=applyStylizedHumanSurfaceHint(mesh('ovoo-shoe-'+i,bootGeo,shoe,visitor),'garment')
    foot.position.set(x,0,-.02)
    foot.rotation.y=Math.PI
    return {
      thigh:limb('ovoo-thigh-'+i,makeNormalizedLimb(.074,.062,.04,.005,8),v(x,.28,0),v(x,.48,0),pants,visitor,'garment'),
      shin:limb('ovoo-shin-'+i,makeNormalizedLimb(.062,.050,.03,.004,8),v(x,.07,0),v(x,.28,0),pants,visitor,'garment'),
      foot,
    }
  })
  const makeVisitorHandGeo=(handedness:'left'|'right')=>{
    const g=createStylizedPalmGeometry({
      width:.084,
      thickness:.042,
      length:.108,
      handedness,
      palmUp:false,
      arch:.006,
      radialSegments:8,
      iterations:1,
    })
    // Local palm extends from wrist (+Z) to fingers (-Z); rotate +90° around X so wrist is at -Y and fingers at +Y.
    g.rotateX(Math.PI/2)
    g.computeVertexNormals()
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g
  }
  // Facing -Z: left side is -X (i=0), right side is +X (i=1, stone-carrying hand).
  const arms=[-1,1].map((sign,i)=>({
    upper:limb('ovoo-upper-arm-'+i,makeNormalizedLimb(.060,.052,.04,.004,8),v(sign*.25,.64,-.09),v(sign*.18,.86,0),coat,subject,'garment'),
    lower:limb('ovoo-forearm-'+i,makeNormalizedCuff(.044,.052),v(sign*.25,.64,-.09),v(sign*.23,.51,-.2),coat,subject,'garment'),
    hand:applyStylizedHumanSurfaceHint(mesh('ovoo-hand-'+i,makeVisitorHandGeo(i===0?'left':'right'),skin,subject),'skin'),
  }))
  const angle0=Math.atan2(-.8,1.65),radius=Math.hypot(-.8,1.65)
  const right=v(-Math.sin(angle0),0,-Math.cos(angle0)),forward=v(-Math.cos(angle0),0,Math.sin(angle0))
  const stoneBedCenter=v(-.8,0,1.65).addScaledVector(right,.60)
  // Low natural flat stone-and-earth rock bed grounded at -0.090 supports the 3 waiting offering stones at y = 0.
  const bedProfile=[
    new THREE.Vector2(0,-.090),
    new THREE.Vector2(.46,-.090),
    new THREE.Vector2(.44,-.062),
    new THREE.Vector2(.40,-.016),
    new THREE.Vector2(.36,0),
    new THREE.Vector2(0,0),
  ]
  const stoneBed=mesh('ovoo-offering-bed',new THREE.LatheGeometry(bedProfile,28),grey[3]!)
  stoneBed.position.copy(stoneBedCenter);stoneBed.rotation.y=angle0;stoneBed.scale.set(1.08,1,.68)
  const stones=Array.from({length:3},(_,i)=>{const p=v(-.8,.10,1.65).addScaledVector(right,.60).addScaledVector(forward,(i-1)*.25);return ball('ovoo-offering-'+i,p.toArray() as [number,number,number],[.085,.10,.075],grey[2]!)})
  const initial=stones.map(o=>o.position.clone())
  // All new stones come to rest on the broad crown; their underside is at crown height.
  const land=[v(-.14,.98,.07),v(.12,.98,.08),v(0,.98,.22)]
  const carry=(theta:number)=>v(Math.sin(theta)*(radius-.44)-Math.cos(theta)*.23,.64,Math.cos(theta)*(radius-.44)+Math.sin(theta)*.23)
  const setArms=(hand:THREE.Vector3)=>{
    visitor.updateMatrixWorld(true);body.updateMatrixWorld(true)
    arms.forEach((arm,i)=>{
      const sign=i?1:-1,shoulder=body.localToWorld(v(sign*.18,.38,0))
      const end=i===1?hand.clone():visitor.localToWorld(v(-.24,.51,-.12))
      const mid=shoulder.clone().lerp(end,.5);mid.add(visitor.localToWorld(v(sign*.11,0,.09)).sub(visitor.position))
      arm.upper.set(mid,shoulder);arm.lower.set(mid,end);arm.hand.position.copy(end)
      const aim=end.clone().sub(mid)
      if(aim.lengthSq()>1e-8)arm.hand.quaternion.setFromUnitVectors(v(0,1,0),aim.normalize())
    })
  }
  const pose=(step:number,amount:number)=>{
    const n=Number.isFinite(step)?THREE.MathUtils.clamp(Math.floor(step),0,3):0,t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0
    // Negative polar angle is clockwise viewed from above (north is -z).
    const walk=n<3?THREE.MathUtils.clamp((t-.15)/.63,0,1):0,theta=angle0-walk*Math.PI*2
    const ready=n===3?0:t<.15?1-t/.15:t>.92&&n<2?(t-.92)/.08:0
    visitor.position.set(Math.sin(theta)*radius,GROUND_Y,Math.cos(theta)*radius);visitor.rotation.y=theta+Math.PI/2
    const gait=walk>0&&walk<1?Math.sin(walk*Math.PI*16):0
    legs.forEach((leg,i)=>{const x=i?.10:-.10,z=gait*(i?-.10:.10),lift=Math.max(0,gait*(i?-1:1))*.045;leg.foot.position.set(x,lift,z-.02);leg.thigh.set(v(x,.28,z*.5),v(x,.48,0));leg.shin.set(v(x,.07+lift,z),v(x,.28,z*.5))})
    body.rotation.z=-.42*ready
    for(let i=0;i<3;i++)stones[i]!.position.copy(i<n?land[i]!:initial[i]!)
    const grip=v(-Math.sin(theta)*.07,-.04,-Math.cos(theta)*.07)
    let hand=n<3?initial[n]!.clone().add(grip):carry(angle0)
    if(n<3){
      const stone=stones[n]!
      if(t<.15){stone.position.lerpVectors(initial[n]!,carry(angle0),t/.15);hand.copy(stone.position).add(grip)}
      else if(t<.78){stone.position.copy(carry(theta));hand.copy(stone.position).add(grip)}
      else if(t<.92){const u=(t-.78)/.14;stone.position.lerpVectors(carry(angle0),land[n]!,u);stone.position.y+=Math.sin(Math.PI*u)*.55;hand.copy(carry(angle0)).add(grip)}
      else {stone.position.copy(land[n]!);hand.lerpVectors(carry(angle0).add(grip),n<2?initial[n+1]!.clone().add(grip):carry(angle0),(t-.92)/.08)}
    }
    setArms(hand);root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,visitor,stones,cap,land,initial,angle0,radius,targets:stones,roots:stones,anchors:[[0,.05,.02],[0,.05,.02],[0,.05,.02]] as [number,number,number][],pose,dispose(){}}
}
