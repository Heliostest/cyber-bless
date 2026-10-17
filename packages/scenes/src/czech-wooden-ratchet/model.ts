import * as THREE from 'three'

/** Original held cog rattle. Kinematic elastic tongue, not an impact/stress simulation. */
export function createRatchetModel() {
  const subject=new THREE.Group();subject.name='ratchet-subject'
  const stator=new THREE.Group();stator.name='ratchet-fixed-axis';stator.position.y=2.45;subject.add(stator)
  const wood=new THREE.MeshStandardMaterial({color:0xd8b77e,roughness:.8}),dark=new THREE.MeshStandardMaterial({color:0x9a7148,roughness:.8}),pale=new THREE.MeshStandardMaterial({color:0xefd8a2,roughness:.88}),pinMat=new THREE.MeshStandardMaterial({color:0x71583b,roughness:.7}),sage=new THREE.MeshStandardMaterial({color:0x8ab59a,roughness:.8})
  const add=(name:string,g:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D=stator)=>{const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
  const polygon:THREE.Vector2[]=[]
  for(let tooth=0;tooth<11;tooth++)for(const [phase,r]of[[0,.43],[.72,.57],[.85,.57]]){const a=(tooth+phase!)*Math.PI*2/11;polygon.push(new THREE.Vector2(r!*Math.cos(a),r!*Math.sin(a)))}
  const wheelShape=new THREE.Shape(polygon),hole=new THREE.Path();hole.absarc(0,0,.12,0,Math.PI*2,true);wheelShape.holes.push(hole)
  const halfGearDepth=.11,cheekDepth=.09,wheelGeometry=new THREE.ExtrudeGeometry(wheelShape,{depth:halfGearDepth*2,bevelEnabled:false,curveSegments:32});wheelGeometry.translate(0,0,-halfGearDepth)
  const gear=add('ratchet-cog-wheel',wheelGeometry,dark)
  const cylinder=(name:string,r:number,length:number,z:number,material=pinMat)=>{const g=new THREE.CylinderGeometry(r,r,length,32);g.rotateX(Math.PI/2);const mesh=add(name,g,material);mesh.position.z=z;return mesh}
  const axle=cylinder('ratchet-axle',.10,1.96,.50),handle=cylinder('ratchet-handle',.16,1.10,.88,wood)
  cylinder('ratchet-wheel-hub',.18,.27,0,dark)
  const frame=new THREE.Group();frame.name='ratchet-frame';stator.add(frame)
  const cheeks:THREE.Mesh<THREE.ExtrudeGeometry>[]=[]
  for(const z of[-.20,.20]){
    const shape=new THREE.Shape();shape.moveTo(-.22,0);shape.absarc(0,0,.22,Math.PI,Math.PI*2,false);shape.lineTo(.22,1.88);shape.lineTo(-.22,1.88);shape.closePath()
    const aperture=new THREE.Path();aperture.absarc(0,0,.12,0,Math.PI*2,true);shape.holes.push(aperture)
    const g=new THREE.ExtrudeGeometry(shape,{depth:cheekDepth,bevelEnabled:false,curveSegments:24});g.translate(0,0,-cheekDepth/2)
    const cheek=add(z<0?'ratchet-back-cheek':'ratchet-front-cheek',g,wood,frame) as THREE.Mesh<THREE.ExtrudeGeometry>;cheek.position.z=z;cheeks.push(cheek)
  }
  const washers:THREE.Mesh<THREE.ExtrudeGeometry>[]=[]
  for(const z of[-.31,.31]){const shape=new THREE.Shape();shape.absarc(0,0,.22,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,.105,0,Math.PI*2,true);shape.holes.push(hole);const g=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false,curveSegments:28});g.translate(0,0,-.03);const mesh=add(z<0?'ratchet-back-retainer':'ratchet-front-retainer',g,pinMat) as THREE.Mesh<THREE.ExtrudeGeometry>;mesh.position.z=z;washers.push(mesh)}
  const grip=add('ratchet-frame-grip',new THREE.BoxGeometry(1.18,.24,.56),wood,frame);grip.position.set(.30,1.80,0)
  const accent=add('ratchet-grip-accent',new THREE.BoxGeometry(.12,.245,.565),sage,grip);accent.position.x=.42
  const anchorX=.72,length=1.72,halfWidth=.0175,halfDepth=.065,capRadius=.03,clearance=.001,rowCount=33
  const weights=Array.from({length:rowCount},(_,i)=>{const t=1-i/(rowCount-1);return t*t*(3-t)/2})
  const weightAt=(y:number)=>{const q=THREE.MathUtils.clamp(y/length*(rowCount-1),0,rowCount-1),i=Math.min(rowCount-2,Math.floor(q));return THREE.MathUtils.lerp(weights[i]!,weights[i+1]!,q-i)}
  const tongueGeometry=new THREE.BufferGeometry(),indices:number[]=[]
  tongueGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(rowCount*4*3),3))
  for(let row=0;row<rowCount-1;row++)for(let edge=0;edge<4;edge++){const a=row*4+edge,b=(row+1)*4+edge,c=row*4+(edge+1)%4,d=(row+1)*4+(edge+1)%4;indices.push(a,b,c,b,d,c)}
  indices.push(0,1,2,0,2,3);const top=(rowCount-1)*4;indices.push(top,top+2,top+1,top,top+3,top+2);tongueGeometry.setIndex(indices)
  const spring=add('ratchet-wood-tongue',tongueGeometry,pale,frame)
  const capGeometry=new THREE.CylinderGeometry(capRadius,capRadius,halfDepth*2,32);capGeometry.rotateX(Math.PI/2)
  const cap=add('ratchet-tongue-rounded-end',capGeometry,pale,frame)
  const state={d:0,contactGap:clearance,contactY:0,contactKind:'cap'}
  const pose=(at:number,n:number)=>{
    n=THREE.MathUtils.clamp(n,0,1)
    const angle=at+n===0||at>=3||at===2&&n===1?0:-(at+n)*(Math.PI*2/3)
    frame.rotation.z=angle
    const rotated=polygon.map(p=>p.clone().rotateAround(new THREE.Vector2(),-angle))
    let d=-Infinity,witnessY=0,kind='face',capEnvelope=-Infinity
    const constrain=(x:number,y:number)=>{if(y<0||y>=length)return;const f=weightAt(y);if(f<1e-12)return;const needed=(x+halfWidth+clearance-anchorX)/f;if(needed>d){d=needed;witnessY=y;kind='face'}}
    for(let i=0;i<rotated.length;i++){
      const a=rotated[i]!,b=rotated[(i+1)%rotated.length]!,dy=b.y-a.y
      constrain(a.x,a.y)
      for(let row=0;row<rowCount;row++){const y=length*row/(rowCount-1);if(Math.abs(dy)>1e-12&&y>=Math.min(a.y,b.y)&&y<=Math.max(a.y,b.y))constrain(THREE.MathUtils.lerp(a.x,b.x,(y-a.y)/dy),y)}
      // The expanded circle gives a true Euclidean clearance around the rounded end.
      const r=capRadius+clearance,lo=Math.max(Math.min(a.y,b.y),-r),hi=Math.min(Math.max(a.y,b.y),r)
      if(lo<=hi){
        if(Math.abs(dy)<1e-12)capEnvelope=Math.max(capEnvelope,Math.max(a.x,b.x)+Math.sqrt(Math.max(0,r*r-a.y*a.y)))
        else {const slope=(b.x-a.x)/dy,y=THREE.MathUtils.clamp(slope*r/Math.sqrt(1+slope*slope),lo,hi);capEnvelope=Math.max(capEnvelope,a.x+slope*(y-a.y)+Math.sqrt(Math.max(0,r*r-y*y)))}
      }
    }
    if(capEnvelope-anchorX>d){d=capEnvelope-anchorX;kind='cap';witnessY=0}
    const positions=tongueGeometry.attributes.position!
    for(let row=0;row<rowCount;row++){const x=anchorX+d*weights[row]!,y=length*row/(rowCount-1);positions.setXYZ(row*4,x-halfWidth,y,-halfDepth);positions.setXYZ(row*4+1,x+halfWidth,y,-halfDepth);positions.setXYZ(row*4+2,x+halfWidth,y,halfDepth);positions.setXYZ(row*4+3,x-halfWidth,y,halfDepth)}
    positions.needsUpdate=true;tongueGeometry.computeVertexNormals();tongueGeometry.computeBoundingSphere();cap.position.x=anchorX+d
    state.d=d;state.contactKind=kind;state.contactY=witnessY;state.contactGap=clearance;subject.updateMatrixWorld(true)
  }
  pose(0,0)
  return {subject,stator,gear,polygon,frame,cheeks,washers,axle,handle,grip,spring,cap,halfGearDepth,cheekDepth,anchorX,length,halfWidth,halfDepth,capRadius,clearance,rowCount,weights,state,pose,
    targets:[grip,grip,grip],roots:[frame,frame,frame],anchors:[[.15,.06,.30],[.15,.06,.30],[.15,.06,.30]] as [number,number,number][]}
}
