import * as THREE from 'three'

/** Original assisted wood press: two pivots, real roller contact and one conserved masa body. */
export function createTortillaPressModel() {
  const subject=new THREE.Group();subject.name='tortilla-press-subject'
  const material=(color:number,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
  const honey=material(0xc7975b),pale=material(0xdfb77c),grainMat=new THREE.LineBasicMaterial({color:0xa17446,transparent:true,opacity:.3})
  const steel=material(0x69797b,.4,.5),teal=material(0x408d87,.5),doughMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1})
  const filmMat=new THREE.MeshStandardMaterial({color:0xe0eee1,roughness:.4,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false})
  const add=(parent:THREE.Object3D,name:string,geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{
    const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh
  }
  const box=(parent:THREE.Object3D,name:string,w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number)=>add(parent,name,new THREE.BoxGeometry(w,h,d),mat,x,y,z)
  const axle=(name:string,r:number,length:number,x:number,y:number,z:number,parent:THREE.Object3D=subject)=>{
    const g=new THREE.CylinderGeometry(r,r,length,32);g.rotateZ(Math.PI/2);return add(parent,name,g,steel,x,y,z)
  }
  const lower=box(subject,'tortilla-lower-plate',2.4,.25,2.4,honey,0,.125,0)
  box(subject,'tortilla-front-lug',.80,.25,.52,honey,0,.125,1.34)
  const lidJoint=new THREE.Group();lidJoint.name='tortilla-lid-joint';lidJoint.position.set(0,.38,-1.1);subject.add(lidJoint)
  const upper=box(lidJoint,'tortilla-upper-plate',2.16,.15,2.16,pale,0,0,1.1)
  const stemGeometry=new THREE.CylinderGeometry(.055,.055,.18,24);stemGeometry.rotateZ(Math.PI/2)
  add(lidJoint,'tortilla-lid-knob-stem',stemGeometry,honey,1.14,0,2.02)
  const knobGeometry=new THREE.CylinderGeometry(.13,.13,.18,32);knobGeometry.rotateZ(Math.PI/2)
  const knob=add(lidJoint,'tortilla-lid-knob',knobGeometry,teal,1.28,0,2.02)
  axle('tortilla-back-axle',.055,2.32,0,.38,-1.1)
  for(const side of [-1,1]){
    box(subject,'tortilla-hinge-ear-'+side,.15,.19,.18,steel,side*.97,.315,-1.10)
    axle('tortilla-back-bolt-'+side,.082,.05,side*1.18,.38,-1.1)
    box(subject,'tortilla-lever-ear-'+side,.09,.45,.22,steel,side*.19,.425,1.35)
  }
  const leverJoint=new THREE.Group();leverJoint.name='tortilla-lever-joint';leverJoint.position.set(0,.635,1.35);subject.add(leverJoint)
  const bar=box(leverJoint,'tortilla-lever-bar',.22,.16,3.20,honey,0,0,-1.60)
  const gripGeometry=new THREE.CapsuleGeometry(.16,.24,6,24);gripGeometry.rotateX(Math.PI/2)
  const grip=add(leverJoint,'tortilla-lever-grip',gripGeometry,teal,0,0,-3.0)
  const roller=axle('tortilla-pressure-roller',.10,.28,0,-.08,-.40,leverJoint)
  axle('tortilla-front-axle',.055,.60,0,.635,1.35)
  for(const side of [-1,1])axle('tortilla-front-bolt-'+side,.079,.04,side*.31,.635,1.35)
  const woodGrain=(parent:THREE.Object3D,name:string,y:number,z0:number,z1:number)=>{
    const points:number[]=[]
    for(let row=0;row<15;row++){const x=-.98+row*.14;for(let k=0;k<18;k++){const z=z0+(z1-z0)*k/18;points.push(x+Math.sin(z*3+row)*.012,y,z,x+Math.sin((z+.045)*3+row)*.012,y,z+.045)}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const line=new THREE.LineSegments(g,grainMat);line.name=name;parent.add(line)
  }
  woodGrain(subject,'tortilla-base-grain',.2506,-1.06,1.06);woodGrain(lidJoint,'tortilla-lid-grain',.0756,.06,2.11)
  const baseY=.254,r0=.28,volume=4/3*Math.PI*r0**3,minHalf=(.38-.075-baseY-.006)/2
  const masaGeometry=new THREE.SphereGeometry(r0,48,24),vertices=masaGeometry.getAttribute('position'),colors:number[]=[]
  const warm=new THREE.Color(0xeed79f),fleck=new THREE.Color(0xe2c486)
  for(let i=0;i<vertices.count;i++){const a=vertices.getX(i),b=vertices.getY(i),c=vertices.getZ(i),t=.22*(.5+.5*Math.sin(a*93+b*157+c*211));const color=warm.clone().lerp(fleck,t);colors.push(color.r,color.g,color.b)}
  masaGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
  const masa=add(subject,'tortilla-masa',masaGeometry,doughMat)
  const lowerLiner=add(subject,'tortilla-lower-liner',new THREE.CylinderGeometry(1.10,1.10,.002,64),filmMat,0,.2525,0);lowerLiner.castShadow=false
  const segments=48,rings=15,filmPositions=new Float32Array(rings*(segments+1)*3),filmIndices:number[]=[]
  for(let row=0;row<rings-1;row++)for(let col=0;col<segments;col++){
    const a=row*(segments+1)+col,b=a+segments+1,c=b+1,d=a+1;filmIndices.push(a,b,d,b,c,d)
  }
  const filmGeometry=new THREE.BufferGeometry();filmGeometry.setAttribute('position',new THREE.BufferAttribute(filmPositions,3));filmGeometry.setIndex(filmIndices)
  filmGeometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.55,0),1.5)
  const topLiner=add(subject,'tortilla-top-liner',filmGeometry,filmMat);topLiner.castShadow=false
  const rimPoints=Array.from({length:64},(_,i)=>new THREE.Vector3(1.10*Math.cos(i*Math.PI/32),.257,1.10*Math.sin(i*Math.PI/32)))
  const rim=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rimPoints),new THREE.LineBasicMaterial({color:0xc0d1c5,transparent:true,opacity:.5}));rim.name='tortilla-liner-rim';subject.add(rim)
  const rollerCenter=new THREE.Vector3(),state={lidAngle:1.8,leverAngle:1.4,radius:r0,halfHeight:r0,volume}
  const contactAngle=(theta:number)=>{
    if(theta<1e-12)return 0
    const a=.635-.08*Math.cos(theta)+.40*Math.sin(theta)-.38,b=1.35-.08*Math.sin(theta)-.40*Math.cos(theta)+1.1
    return Math.max(0,Math.atan2(a,b)-Math.asin(.175/Math.hypot(a,b)))
  }
  const stopAngle=contactAngle(.8)
  const halfHeight=(alpha:number)=>{
    if(alpha>=.6)return r0
    if(alpha<1e-12)return minHalf
    const c=Math.cos(alpha),s=Math.sin(alpha),f=(h:number)=>c*(baseY+h-.38)-s*1.1+.075+Math.hypot(h*c,Math.sqrt(r0**3/h)*s)+.006
    if(f(r0)<=0)return r0
    let lo=minHalf,hi=r0
    for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(f(mid)<=0)lo=mid;else hi=mid}
    return lo
  }
  const pose=(at:number,n:number)=>{
    n=THREE.MathUtils.clamp(n,0,1)
    const theta=at===0?1.4:at===1?THREE.MathUtils.lerp(1.4,0,n):at===2?1.4*Math.min(1,n*2):1.4
    const alpha=at===0?THREE.MathUtils.lerp(1.8,stopAngle,n):at===1?theta>=.8?stopAngle:contactAngle(theta):at===2?1.8*Math.max(0,n*2-1):1.8
    const h=at>=2?minHalf:halfHeight(alpha),radius=Math.sqrt(r0**3/h)
    lidJoint.rotation.x=-alpha;leverJoint.rotation.x=theta;masa.position.set(0,baseY+h,0);masa.scale.set(radius/r0,h/r0,radius/r0)
    Object.assign(state,{lidAngle:alpha,leverAngle:theta,radius,halfHeight:h})
    let index=0
    for(let row=0;row<rings;row++)for(let col=0;col<=segments;col++){
      const phi=col/segments*Math.PI*2,theta=row/12*Math.PI/2
      const r=row<=12?radius*Math.sin(theta):row===13?radius+.08:1.10
      const y=row<=12?baseY+h+h*Math.cos(theta)+.003:.257
      filmPositions[index++]=-r*Math.cos(phi);filmPositions[index++]=y;filmPositions[index++]=r*Math.sin(phi)
    }
    filmGeometry.attributes.position!.needsUpdate=true;filmGeometry.computeVertexNormals();subject.updateMatrixWorld(true)
  }
  pose(0,0)
  const targets=[knob,grip,grip],roots=[lidJoint,leverJoint,leverJoint]
  return {subject,pose,targets,roots,anchors:[[.08,.02,.04],[.10,.08,.04],[.10,.08,.04]] as [number,number,number][],lower,upper,masa,lowerLiner,topLiner,lidJoint,leverJoint,bar,grip,roller,rollerCenter,state,contactAngle}
}
