import * as THREE from 'three'

type XYZ = [number, number, number]
/** Original handheld toy; assisted tosses and string curves are deliberately slowed illustrations. */
export function createKendamaModel() {
  const subject=new THREE.Group();subject.name='kendama-subject'
  const wood=new THREE.MeshStandardMaterial({color:0xd9ad72,roughness:.8})
  const endWood=new THREE.MeshStandardMaterial({color:0xb9864f,roughness:.86})
  const red=new THREE.MeshStandardMaterial({color:0xd45343,roughness:.38})
  const cream=new THREE.MeshStandardMaterial({color:0xf0dcb2,roughness:.5})
  const cordMat=new THREE.MeshStandardMaterial({color:0x706b52,roughness:.95})
  const clothMat=new THREE.MeshStandardMaterial({color:0x8faeaa,roughness:.98})
  const add=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],p:XYZ,parent:THREE.Object3D=subject)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...p);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh
  }
  const lathe=(points:number[][],segments=48)=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),segments)
  const R=.34
  function cup(radius:number){
    const rim=R-Math.sqrt(R*R-radius*radius),points=[[0,-.11],[.12,-.11],[radius+.022,rim-.055],[radius+.022,rim],[radius,rim]]
    for(let i=1;i<=20;i++){const r=radius*(1-i/20);points.push([r,R-Math.sqrt(R*R-r*r)])}
    return lathe(points)
  }
  const ken=new THREE.Group();ken.name='kendama-ken';subject.add(ken)
  const handle=add('kendama-handle',lathe([[0,.12],[.16,.12],[.16,.20],[.14,.34],[.125,.55],[.105,.88],[.115,1.14],[.12,1.32],[0,1.34]]),wood,[0,0,0],ken)
  const baseCup=add('kendama-base-cup',cup(.19),wood,[0,R-Math.sqrt(R*R-.19*.19),0],ken);baseCup.rotation.z=Math.PI
  const cross=add('kendama-crosspiece',new THREE.CylinderGeometry(.115,.115,1.0,32),wood,[0,1.20,0],ken);cross.rotation.z=Math.PI/2
  const big=add('kendama-big-cup',cup(.265),wood,[.50,1.20,0],ken);big.rotation.z=-Math.PI/2
  const small=add('kendama-small-cup',cup(.215),wood,[-.50,1.20,0],ken);small.rotation.z=Math.PI/2
  add('kendama-spike',new THREE.ConeGeometry(.10,.46,32),wood,[0,1.67,0],ken)
  add('kendama-spike-neck',new THREE.CylinderGeometry(.10,.11,.14,32),wood,[0,1.38,0],ken)
  add('kendama-string-knot',new THREE.SphereGeometry(.029,12,8),cordMat,[0,1.16,.12],ken)
  for(const [y,r] of [[.27,.15],[.38,.137],[.80,.112]]){
    const ring=add('kendama-grain-'+y,new THREE.TorusGeometry(r,.004,6,48),endWood,[0,y,0],ken);ring.rotation.x=Math.PI/2
  }
  // The ball has a genuine open socket with an internal stop, rather than a dark painted disk.
  const socket=.11,thetaMax=Math.acos(-Math.sqrt(R*R-socket*socket)/R)
  const angles=[...Array.from({length:41},(_,i)=>thetaMax*(1-i/40)),Math.PI/2,Math.acos(.10/R),Math.acos(.18/R)].sort((a,b)=>b-a)
  const profile=[[0,.04],[.05,-.04],[.10,-.30],[socket,-Math.sqrt(R*R-socket*socket)],...angles.slice(1).map(t=>[R*Math.sin(t),R*Math.cos(t)])]
  const ballGeometry=lathe(profile),indices=ballGeometry.getIndex()!,buckets:number[][]=[[],[],[]];ballGeometry.clearGroups()
  for(let i=0;i<48;i++)for(let j=0;j<profile.length-1;j++){
    const y=(profile[j]![1]!+profile[j+1]![1]!)/2,material=j<3?1:y>.10&&y<.18?2:0
    const start=(i*(profile.length-1)+j)*6;for(let k=0;k<6;k++)buckets[material]!.push(indices.getX(start+k))
  }
  ballGeometry.setIndex(buckets.flat());let offset=0
  buckets.forEach((bucket,material)=>{ballGeometry.addGroup(offset,bucket.length,material);offset+=bucket.length})
  const ball=add('kendama-ball',ballGeometry,[red,endWood,cream],[0,0,0])
  add('kendama-cloth',new THREE.BoxGeometry(2.55,.02,1.05),clothMat,[0,-.03,.10])
  for(const x of [-1.18,1.18])add('kendama-cloth-hem-'+x,new THREE.BoxGeometry(.012,.002,.95),cream,[x,-.019,.10])
  const stringGeometry=new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(),new THREE.Vector3(0,1,0)),64,.014,6,false)
  const string=add('kendama-string',stringGeometry,cordMat,[0,0,0]);string.userData.toonSurface={outline:false}
  const roots=[new THREE.Vector3(.25,-.02,0),new THREE.Vector3(.85,.95,0),new THREE.Vector3(-.7,.95,0),new THREE.Vector3(.05,-.02,0)]
  const rotations=[0,Math.PI/2,-Math.PI/2,0],balls=[new THREE.Vector3(-.95,.32,.22),new THREE.Vector3(-.35,1.79,0),new THREE.Vector3(.5,1.79,0),new THREE.Vector3(.05,1.84,0)]
  const ballTie=new THREE.Vector3(.26,0,Math.sqrt(R*R-.26*.26)),kenTie=new THREE.Vector3(0,1.16,.14)
  function pose(step:number,amount:number){
    const at=Math.min(3,Math.max(0,step)),n=at===3?0:THREE.MathUtils.clamp(amount,0,1),next=Math.min(3,at+1),turn=THREE.MathUtils.smoothstep(n,.15,.75)
    ken.position.lerpVectors(roots[at]!,roots[next]!,turn);ken.rotation.z=THREE.MathUtils.lerp(rotations[at]!,rotations[next]!,turn)
    // Toss toward the viewer while the ken flips, clearing the spike's sweep.
    // Complete alignment above each receiver, then descend vertically past its rim.
    const transfer=THREE.MathUtils.smoothstep(n,0,.75)
    ball.position.lerpVectors(balls[at]!,balls[next]!,transfer);ball.position.y+=Math.sin(n*Math.PI)*(at===0?.75:.95)
    ball.position.z+=.70*Math.sin(Math.PI*transfer)
    ball.rotation.x=at===3?0:at===2?-Math.PI/2*(1-THREE.MathUtils.smoothstep(n,.35,.75)):-Math.PI/2
    subject.updateMatrixWorld(true)
    const from=kenTie.clone().applyMatrix4(ken.matrixWorld),to=ballTie.clone().applyMatrix4(ball.matrixWorld),outward=ballTie.clone().normalize().applyQuaternion(ball.quaternion)
    const curve=new THREE.CubicBezierCurve3(from,from.clone().add(new THREE.Vector3(.55,-.2,.50)),to.clone().addScaledVector(outward,.30),to)
    const sample=(t:number)=>{
      const q=curve.getPoint(t),radial=q.clone().sub(ball.position),distance=radial.length(),clearance=R+.03*(1-THREE.MathUtils.smoothstep(t,.90,1))
      if(distance<clearance){if(distance<1e-8)radial.copy(outward);q.copy(ball.position).add(radial.setLength(clearance))}
      return q
    }
    const p=stringGeometry.getAttribute('position') as THREE.BufferAttribute
    for(let i=0;i<=64;i++){
      const t=i/64,c=sample(t),tangent=sample(Math.min(1,t+.001)).sub(sample(Math.max(0,t-.001))).normalize(),normal=new THREE.Vector3().crossVectors(tangent,Math.abs(tangent.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),binormal=new THREE.Vector3().crossVectors(tangent,normal)
      for(let j=0;j<=6;j++){const angle=j*Math.PI/3,q=c.clone().addScaledVector(normal,.014*Math.cos(angle)).addScaledVector(binormal,.014*Math.sin(angle));p.setXYZ(i*7+j,q.x,q.y,q.z)}
    }
    p.needsUpdate=true;stringGeometry.computeVertexNormals();stringGeometry.computeBoundingBox();stringGeometry.computeBoundingSphere()
  }
  pose(0,0)
  return {subject,pose,targets:[handle,handle,handle],anchors:[[0,.5,.1],[0,.5,.1],[0,.5,.1]] as XYZ[]}
}
