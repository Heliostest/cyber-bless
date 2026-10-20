import * as THREE from 'three'

/** An illustrative stone ovoo and visitor. Three clockwise circuits are source-supported;
 * one stone per circuit, clothing, landscape and the precise path are product choices. */
export function createOvooModel() {
  const root=new THREE.Group();root.name='ovoo-root'
  const subject=new THREE.Group();subject.name='ovoo-subject';root.add(subject)
  const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.88})
  const grey=[mat(0xa6afa9),mat(0x8c9b99),mat(0xb9b6a4),mat(0x758b8e)],sand=mat(0xd8c8a4),blue=mat(0x74a4ba),bark=mat(0x837158)
  const coat=mat(0xc8874f),pants=mat(0x496d75),skin=mat(0xdbab85),hair=mat(0x504b40),shoe=mat(0x5d5b50)
  const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const ball=(name:string,p:[number,number,number],s:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(name,new THREE.SphereGeometry(1,20,12),m,parent);o.position.set(...p);o.scale.set(...s);return o}
  const rod=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Object3D=subject)=>{
    const o=mesh(name,new THREE.CylinderGeometry(r,r,1,12),m,parent)
    const set=(a:THREE.Vector3,b:THREE.Vector3)=>{const d=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())}
    set(a,b);return {o,set}
  }
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
  const ground=mesh('ovoo-ground',new THREE.CylinderGeometry(2.24,2.3,.09,64),sand);ground.position.y=-.045
  // Overlapping stones form a supported cairn instead of floating decorative layers.
  const cairn=mesh('ovoo-cairn-core',new THREE.CylinderGeometry(.20,.75,.84,14),grey[0]!);cairn.position.y=.42
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
  const visitor=new THREE.Group();visitor.name='ovoo-visitor';subject.add(visitor)
  const body=new THREE.Group();body.name='ovoo-visitor-body';visitor.add(body)
  ball('ovoo-jacket',[0,.71,0],[.19,.29,.14],coat,body)
  ball('ovoo-head',[0,1.13,0],[.135,.17,.13],skin,body)
  rod('ovoo-neck',v(0,.91,0),v(0,1.02,0),.065,skin,body)
  ball('ovoo-hair',[0,1.19,.015],[.139,.12,.132],hair,body)
  ball('ovoo-nose',[0,1.12,-.13],[.032,.035,.04],skin,body)
  ball('ovoo-pack',[0,.74,.145],[.15,.20,.075],pants,body)
  body.position.y=.48;for(const child of body.children)child.position.y-=.48
  const legs=[-.10,.10].map((x,i)=>({
    thigh:rod('ovoo-thigh-'+i,v(x,.48,0),v(x,.28,0),.07,pants,visitor),
    shin:rod('ovoo-shin-'+i,v(x,.28,0),v(x,.07,0),.06,pants,visitor),
    foot:ball('ovoo-shoe-'+i,[x,.055,-.04],[.075,.055,.13],shoe,visitor),
  }))
  const arms=[-1,1].map((sign,i)=>({
    upper:rod('ovoo-upper-arm-'+i,v(sign*.18,.86,0),v(sign*.25,.64,-.09),.058,coat),
    lower:rod('ovoo-forearm-'+i,v(sign*.25,.64,-.09),v(sign*.23,.51,-.2),.048,coat),
    hand:ball('ovoo-hand-'+i,[0,0,0],[.061,.045,.075],skin),
  }))
  const angle0=Math.atan2(-.8,1.65),radius=Math.hypot(-.8,1.65)
  const right=v(-Math.sin(angle0),0,-Math.cos(angle0)),forward=v(-Math.cos(angle0),0,Math.sin(angle0))
  const stones=Array.from({length:3},(_,i)=>{const p=v(-.8,.10,1.65).addScaledVector(right,.60).addScaledVector(forward,(i-1)*.25);return ball('ovoo-offering-'+i,p.toArray() as [number,number,number],[.085,.10,.075],grey[2]!)})
  const initial=stones.map(o=>o.position.clone())
  // All new stones come to rest on the broad crown; their underside is at crown height.
  const land=[v(-.14,.98,.07),v(.12,.98,.08),v(0,.98,.22)]
  const carry=(theta:number)=>v(Math.sin(theta)*(radius-.44)-Math.cos(theta)*.23,.71,Math.cos(theta)*(radius-.44)+Math.sin(theta)*.23)
  const setArms=(hand:THREE.Vector3)=>{
    visitor.updateMatrixWorld(true);body.updateMatrixWorld(true)
    arms.forEach((arm,i)=>{
      const sign=i?1:-1,shoulder=body.localToWorld(v(sign*.18,.38,0))
      const end=i===1?hand.clone():visitor.localToWorld(v(-.24,.51,-.12))
      const mid=shoulder.clone().lerp(end,.5);mid.add(visitor.localToWorld(v(sign*.11,0,.09)).sub(visitor.position))
      arm.upper.set(shoulder,mid);arm.lower.set(mid,end);arm.hand.position.copy(end)
    })
  }
  const pose=(step:number,amount:number)=>{
    const n=Number.isFinite(step)?THREE.MathUtils.clamp(Math.floor(step),0,3):0,t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0
    // Negative polar angle is clockwise viewed from above (north is -z).
    const walk=n<3?THREE.MathUtils.clamp((t-.15)/.63,0,1):0,theta=angle0-walk*Math.PI*2
    const ready=n===3?0:t<.15?1-t/.15:t>.92&&n<2?(t-.92)/.08:0
    visitor.position.set(Math.sin(theta)*radius,0,Math.cos(theta)*radius);visitor.rotation.y=theta+Math.PI/2
    const gait=walk>0&&walk<1?Math.sin(walk*Math.PI*16):0
    legs.forEach((leg,i)=>{const x=i?.10:-.10,z=gait*(i?-.10:.10),lift=Math.max(0,gait*(i?-1:1))*.045;leg.foot.position.set(x,.055+lift,z-.04);leg.thigh.set(v(x,.48,0),v(x,.28,z*.5));leg.shin.set(v(x,.28,z*.5),v(x,.07+lift,z))})
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
