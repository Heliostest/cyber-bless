import * as THREE from 'three'

/** Original half-open folding fan; analytic accordion, no hand or cloth dynamics. */
export function createFoldingFanModel() {
  const subject=new THREE.Group();subject.name='folding-fan-subject'
  const fan=new THREE.Group();fan.name='fan-body';fan.position.y=.28;subject.add(fan)
  const wood=new THREE.MeshStandardMaterial({color:0xcba46c,roughness:.8}),guardMat=new THREE.MeshStandardMaterial({color:0xb28a56,roughness:.7})
  const brass=new THREE.MeshStandardMaterial({color:0xb99b53,roughness:.4,metalness:.6})
  const cloth=[0xe9aa86,0xfff1ce,0x6fa9a1].map(color=>new THREE.MeshStandardMaterial({color,roughness:.95,side:THREE.DoubleSide,flatShading:true}))
  const add=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D=fan)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m}
  const ribs:THREE.Mesh<THREE.ExtrudeGeometry>[]=[],joints:THREE.Group[]=[],leaves:THREE.Mesh<THREE.BufferGeometry>[]=[],spacing=.016,minSpread=1.30,maxSpread=2.72
  for(let i=0;i<17;i++){
    const outer=i===0||i===16,w=outer?.12:.075,depth=outer?.020:.008,s=new THREE.Shape()
    s.moveTo(-.10,-.08);s.quadraticCurveTo(0,-.18,.10,-.08);s.lineTo(.095,.15);s.lineTo(w/2,.30);s.lineTo(w/2,2.86);s.quadraticCurveTo(w/2,2.92,0,2.92);s.quadraticCurveTo(-w/2,2.92,-w/2,2.86);s.lineTo(-w/2,.30);s.lineTo(-.095,.15);s.closePath()
    const hole=new THREE.Path();hole.absarc(0,0,.058,0,Math.PI*2,true);s.holes.push(hole)
    const geometry=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:16});geometry.translate(0,0,-depth/2)
    const joint=new THREE.Group();joint.name='fan-rib-joint-'+i;joint.position.z=(i-8)*spacing;fan.add(joint);joints.push(joint)
    const rib=add(i===16?'fan-guard-right':i===0?'fan-guard-left':'fan-rib-'+i,geometry,outer?guardMat:wood,joint) as THREE.Mesh<THREE.ExtrudeGeometry>
    ribs.push(rib)
  }
  const cylinder=(name:string,r:number,length:number,z:number)=>{const g=new THREE.CylinderGeometry(r,r,length,40);g.rotateX(Math.PI/2);const m=add(name,g,brass);m.position.z=z;return m}
  const shaft=cylinder('fan-pin',.052,.34,0)
  cylinder('fan-back-washer',.132,.025,-.151);cylinder('fan-front-washer',.132,.025,.151)
  cylinder('fan-back-cap',.13,.035,-.18);const frontCap=cylinder('fan-front-cap',.13,.035,.18)
  const rows=[1.42,1.49,1.55,2.50,2.57,2.73]
  for(let i=0;i<16;i++){
    const g=new THREE.BufferGeometry(),indices:number[]=[]
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(rows.length*3*3),3))
    for(let row=0;row<rows.length-1;row++){
      const start=indices.length
      // Keep authored normals towards +Z: DoubleSide lighting cannot fix normal-biased shadow coordinates.
      for(let col=0;col<2;col++){const a=row*3+col,b=a+3;indices.push(a,a+1,b,b,a+1,b+1)}
      g.addGroup(start,indices.length-start,[1,2,0,2,1][row]!)
    }
    g.setIndex(indices);g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1.6,0),3)
    leaves.push(add('fan-pleat-'+i,g,cloth))
  }
  const state={spread:minSpread,wave:0}
  const pose=(at:number,n:number)=>{
    n=THREE.MathUtils.clamp(n,0,1)
    const interpolate=(from:number,to:number)=>n===0?from:n===1?to:THREE.MathUtils.lerp(from,to,n)
    const spread=at===0?interpolate(minSpread,maxSpread):at===1?maxSpread:at===2?interpolate(maxSpread,minSpread):minSpread
    const wave=at===1&&n>0&&n<1?Math.sin(Math.PI*2*n):0
    fan.rotation.set(0,.24*wave,.08*wave);state.spread=spread;state.wave=wave
    for(let i=0;i<17;i++)joints[i]!.rotation.z=-(i/16-.5)*spread
    for(let i=0;i<16;i++){
      const positions=leaves[i]!.geometry.attributes.position!,a=(i/16-.5)*spread,b=((i+1)/16-.5)*spread,mid=(a+b)/2,z0=(i-8)*spacing+.017,z1=z0+spacing
      for(let row=0;row<rows.length;row++){
        const r=rows[row]!,dx=2*r*Math.sin((b-a)/2),length=Math.hypot(dx,spacing)
        // Offset perpendicular to the 3D chord, so both half-pleat lengths stay fixed.
        const half=Math.hypot(r*Math.sin(maxSpread/32),spacing/2,.028),height=Math.sqrt(Math.max(0,half*half-length*length/4))
        const cx=(r*Math.sin(a)+r*Math.sin(b))/2,cy=(r*Math.cos(a)+r*Math.cos(b))/2
        positions.setXYZ(row*3,r*Math.sin(a),r*Math.cos(a),z0)
        positions.setXYZ(row*3+1,cx-height*spacing*Math.cos(mid)/length,cy+height*spacing*Math.sin(mid)/length,(z0+z1)/2+height*dx/length)
        positions.setXYZ(row*3+2,r*Math.sin(b),r*Math.cos(b),z1)
      }
      positions.needsUpdate=true;leaves[i]!.geometry.computeVertexNormals()
    }
    subject.updateMatrixWorld(true)
  }
  pose(0,0)
  return {subject,fan,ribs,joints,leaves,frontCap,shaft,spacing,rows,minSpread,maxSpread,state,pose,
    targets:[ribs[16]!,frontCap,ribs[16]!],roots:[joints[16]!,frontCap,joints[16]!],
    anchors:[[0,2.83,.028],[.035,.025,.026],[0,2.83,.028]] as [number,number,number][]}
}
