import * as THREE from 'three'

type XYZ = [number, number, number]
/** Original open-frame charkha illustration. Fiber paths and winding are deliberately slowed. */
export function createCharkhaModel() {
  const subject=new THREE.Group();subject.name='charkha-subject'
  const wood=new THREE.MeshStandardMaterial({color:0xc48c50,roughness:.82})
  const darkWood=new THREE.MeshStandardMaterial({color:0x89552f,roughness:.85})
  const iron=new THREE.MeshStandardMaterial({color:0x727d80,roughness:.36,metalness:.65})
  const cottonMat=new THREE.MeshStandardMaterial({color:0xf3e8cf,roughness:.98})
  const yarnMat=new THREE.MeshStandardMaterial({color:0xe4d6b4,roughness:.95})
  const cordMat=new THREE.MeshStandardMaterial({color:0x8b7151,roughness:.96})
  const clothMat=new THREE.MeshStandardMaterial({color:0xa7bbaf,roughness:.97})
  const add=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,p:XYZ,parent:THREE.Object3D=subject)=>{
    const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m
  }
  add('charkha-base',new THREE.BoxGeometry(2.62,.17,.56),wood,[0,.055,0])
  for(const side of [-1,1])add('charkha-foot-'+side,new THREE.BoxGeometry(.19,.17,1.10),wood,[side*1.12,.055,.23])
  for(const side of [-1,1]){
    add('charkha-wheel-post-'+side,new THREE.BoxGeometry(.13,1.05,.12),darkWood,[.60,.665,side*.20])
    add('charkha-spindle-post-'+side,new THREE.BoxGeometry(.15,.55,.12),wood,[-.90,.415,side*.19])
  }
  const axle=add('charkha-wheel-axle',new THREE.CylinderGeometry(.035,.035,.70,16),iron,[.60,1.12,0]);axle.rotation.x=Math.PI/2
  const wheel=new THREE.Group();wheel.name='charkha-wheel';wheel.position.set(.60,1.12,0);subject.add(wheel)
  const hub=add('charkha-hub',new THREE.CylinderGeometry(.12,.12,.27,24),darkWood,[0,0,0],wheel);hub.rotation.x=Math.PI/2
  for(const side of [-1,1])add('charkha-rim-'+side,new THREE.TorusGeometry(.72,.045,10,64),wood,[0,0,side*.065],wheel)
  add('charkha-rim-core',new THREE.TorusGeometry(.72,.033,10,64),darkWood,[0,0,0],wheel)
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,spoke=add('charkha-spoke-'+i,new THREE.BoxGeometry(.65,.052,.11),wood,[Math.cos(angle)*.385,Math.sin(angle)*.385,0],wheel);spoke.rotation.z=angle
  }
  add('charkha-crank-arm',new THREE.BoxGeometry(.50,.07,.07),iron,[.25,0,.30],wheel)
  const crank=add('charkha-crank',new THREE.CylinderGeometry(.078,.09,.28,24).rotateX(Math.PI/2),darkWood,[.46,0,.465],wheel)
  const spindle=new THREE.Group();spindle.name='charkha-spindle';spindle.position.set(-.90,.65,0);subject.add(spindle)
  add('charkha-shaft',new THREE.CylinderGeometry(.013,.028,1.34,20).rotateX(Math.PI/2),iron,[0,0,.39],spindle)
  add('charkha-whorl',new THREE.CylinderGeometry(.12,.12,.065,32).rotateX(Math.PI/2),darkWood,[0,0,0],spindle)
  add('charkha-whorl-inlay',new THREE.BoxGeometry(.028,.14,.006),wood,[.055,0,.036],spindle)
  add('charkha-cop-stop',new THREE.CylinderGeometry(.16,.16,.018,32).rotateX(Math.PI/2),iron,[0,0,.29],spindle)
  const copProfile=[[0,.30],[.14,.30],[.14,.38],[.10,.59],[.035,.81],[0,.83]]
  const cop=add('charkha-cop',new THREE.LatheGeometry(copProfile.map(([x,y])=>new THREE.Vector2(x,y)),32).rotateX(Math.PI/2),cottonMat,[0,0,0],spindle)
  const copRadius=(z:number)=>{
    const hi=copProfile.findIndex(([,height])=>height>=z),[r0,z0]=copProfile[hi-1]!,[r1,z1]=copProfile[hi]!
    return THREE.MathUtils.lerp(r0,r1,(z-z0)/(z1-z0))
  }
  // Open belt: common outer tangents and the two pulley contact arcs.
  const large=new THREE.Vector2(.60,1.12),small=new THREE.Vector2(-.90,.65),R=.76,r=.76/6,d=large.distanceTo(small),phi=Math.atan2(small.y-large.y,small.x-large.x),alpha=Math.acos((R-r)/d),a=phi+alpha,b=phi-alpha
  const beltPoints:THREE.Vector3[]=[]
  for(let i=0;i<=64;i++){const t=a+(b+Math.PI*2-a)*i/64;beltPoints.push(new THREE.Vector3(large.x+R*Math.cos(t),large.y+R*Math.sin(t),0))}
  for(let i=0;i<=32;i++){const t=b+(a-b)*i/32;beltPoints.push(new THREE.Vector3(small.x+r*Math.cos(t),small.y+r*Math.sin(t),0))}
  const beltCurve=new THREE.CurvePath<THREE.Vector3>()
  for(let i=0;i<beltPoints.length;i++)beltCurve.add(new THREE.LineCurve3(beltPoints[i]!,beltPoints[(i+1)%beltPoints.length]!))
  add('charkha-drive-belt',new THREE.TubeGeometry(beltCurve,160,.014,6,true),cordMat,[0,0,0])
  const splice=add('charkha-belt-splice',new THREE.SphereGeometry(.022,12,8),cottonMat,[0,0,0]);splice.userData.toonSurface={outline:false}
  add('charkha-cloth',new THREE.BoxGeometry(.78,.035,.62),clothMat,[-1.50,-.0125,.78])
  for(let i=0;i<3;i++)add('charkha-cloth-hem-'+i,new THREE.BoxGeometry(.012,.002,.55),yarnMat,[-1.80+i*.025,.006,.78])
  const cottonGeometry=new THREE.SphereGeometry(1,32,20),v=cottonGeometry.getAttribute('position') as THREE.BufferAttribute
  for(let i=0;i<v.count;i++){
    const x=v.getX(i),y=v.getY(i),z=v.getZ(i),k=1+.06*(1-y*y)*Math.sin(x*13+z*8)*Math.cos(y*11)
    v.setXYZ(i,x*k,y*k,z*k)
  }
  cottonGeometry.computeVertexNormals();cottonGeometry.computeBoundingSphere()
  const cotton=add('charkha-cotton',cottonGeometry,cottonMat,[-1.50,.125,.78]);cotton.scale.set(.23,.12,.16)
  // Buffers are allocated once. Dragging changes vertices, never allocates GPU resources.
  function flexibleTube(name:string,segments:number,radius:number,material:THREE.Material,parent:THREE.Object3D=subject){
    const g=new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,0,1)),segments,radius,6,false)
    const mesh=add(name,g,material,[0,0,0],parent);mesh.userData.toonSurface={outline:false}
    return (sample:(t:number)=>THREE.Vector3)=>{
      const p=g.getAttribute('position') as THREE.BufferAttribute
      for(let i=0;i<=segments;i++){
        const t=i/segments,c=sample(t),tangent=sample(Math.min(1,t+.001)).sub(sample(Math.max(0,t-.001))).normalize()
        const normal=new THREE.Vector3().crossVectors(tangent,Math.abs(tangent.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),binormal=new THREE.Vector3().crossVectors(tangent,normal)
        for(let j=0;j<=6;j++){const angle=j*Math.PI/3,q=c.clone().addScaledVector(normal,radius*Math.cos(angle)).addScaledVector(binormal,radius*Math.sin(angle));p.setXYZ(i*7+j,q.x,q.y,q.z)}
      }
      p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere()
    }
  }
  const yarns=[0,1].map(i=>flexibleTube('charkha-drawn-yarn-'+i,48,.013,i?cottonMat:yarnMat))
  const winding=flexibleTube('charkha-winding',128,.008,yarnMat,spindle)
  const start=new THREE.Vector3(-1.50,.125,.78),drawn=new THREE.Vector3(-1.96,.53,1.14),returned=new THREE.Vector3(-1.46,.39,.54)
  function pose(step:number,amount:number){
    const n=THREE.MathUtils.clamp(amount,0,1),draw=step>0?1:n,twist=step>1?1:step===1?n:0,guide=step>2?1:step===2?Math.min(1,n/.3):0,wind=step>2?1:step===2?Math.max(0,(n-.3)/.7):0
    wheel.rotation.z=draw*Math.PI*.4+twist*Math.PI*2+wind*Math.PI*1.4;spindle.rotation.z=wheel.rotation.z*6
    cotton.position.lerpVectors(start,drawn,draw).lerp(returned,guide)
    cotton.scale.set(.23*(1-wind*.18),.12*(1-wind*.18),.16*(1-wind*.18))
    cop.scale.set(.2+.8*wind,.2+.8*wind,1)
    splice.position.copy(beltCurve.getPointAt(((wheel.rotation.z*R/beltCurve.getLength())%1+1)%1))
    const from=new THREE.Vector3(-.90,.65,THREE.MathUtils.lerp(1.055,.62,guide)),to=cotton.position.clone().add(new THREE.Vector3(.12,.03,0)),direction=to.clone().sub(from).normalize(),normal=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize(),other=new THREE.Vector3().crossVectors(direction,normal)
    yarns.forEach((update,i)=>update(t=>{
      const q=from.clone().lerp(to,t),phase=t*(3+twist*9)*Math.PI*2+i*Math.PI,rad=.013+.004*(1-twist)
      q.y-=.055*Math.sin(Math.PI*t);return q.addScaledVector(normal,rad*Math.cos(phase)).addScaledVector(other,rad*Math.sin(phase))
    }))
    winding(t=>{const z=.32+t*.47,rad=copRadius(z)*cop.scale.x+.013,angle=t*Math.PI*2*12;return new THREE.Vector3(rad*Math.cos(angle),rad*Math.sin(angle),z)})
  }
  pose(0,0)
  return {subject,pose,targets:[cotton,crank,cotton],anchors:[[0,.5,.4],[0,0,.13],[0,.5,.4]] as XYZ[]}
}
