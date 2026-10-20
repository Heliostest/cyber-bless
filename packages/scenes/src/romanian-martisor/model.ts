import * as THREE from 'three'

/** A worn cord with an open loop, placed over the free end of a blossoming branch. */
export function createMartisorModel() {
  const root = new THREE.Group(); root.name = 'martisor-root'
  const subject = new THREE.Group(); subject.name = 'martisor-subject'; root.add(subject)
  const cord = new THREE.Group(); cord.name = 'martisor-cord'; subject.add(cord)
  const material = (color: number, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness })
  const red = material(0xc43c54), white = material(0xffedce), bark = material(0x805f44), cut = material(0xc9a77b)
  const petal = material(0xffd8d8), pale = material(0xfff1df), pollen = material(0xe2ad42), leaf = material(0x80a468)
  let serial = 0
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, name?: string) => {
    const m = new THREE.Mesh(geometry, mat); m.name = name ?? `martisor-detail-${serial++}`; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
  }
  const ellipsoid = (parent: THREE.Object3D, mat: THREE.Material, pos: number[], scale: number[], name?: string) => {
    const m = mesh(new THREE.SphereGeometry(1, 16, 12), mat, parent, name); m.position.set(pos[0]!,pos[1]!,pos[2]!); m.scale.set(scale[0]!,scale[1]!,scale[2]!); return m
  }
  const rod = (a: number[], b: number[], radius: number, mat = bark, parent = subject, name?: string) => {
    const start = new THREE.Vector3(...a as [number,number,number]), end = new THREE.Vector3(...b as [number,number,number]), d = end.clone().sub(start)
    const m = mesh(new THREE.CylinderGeometry(radius,radius,d.length(),12),mat,parent,name); m.position.copy(start).add(end).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m
  }
  // The contact branch is an actual capped cylinder: free tip z=.40, radius .055.
  rod([.55,-.01,-.65],[.55,1.58,-.65],.075,bark,subject,'martisor-trunk')
  rod([.55,1.5,-.65],[.55,1.5,.40],.055,bark,subject,'martisor-support-branch')
  const tip=mesh(new THREE.CircleGeometry(.055,12),cut,subject,'martisor-branch-tip'); tip.position.set(.55,1.5,.4001)
  rod([.55,1.35,-.65],[-.38,2.05,-.72],.037)
  rod([.55,1.52,-.65],[1.12,2.18,-.7],.035)
  rod([-.16,1.88,-.70],[-.55,2.27,-.65],.022)
  rod([.88,1.90,-.68],[1.42,2.02,-.75],.023)
  const bloom=(x:number,y:number,z:number,large=false)=>{
    const s=large ? .105 : .078
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const p=ellipsoid(subject,i%2?petal:pale,[x+Math.cos(a)*s*.55,y+Math.sin(a)*s*.55,z+.013],[s*.62,s*.37,.022]);p.rotation.z=a}
    ellipsoid(subject,pollen,[x,y,z+.037],[.024,.024,.018])
  }
  ;[[-.38,2.05,-.72],[-.55,2.27,-.65],[.08,1.73,-.68],[1.12,2.18,-.7],[1.42,2.02,-.75],[.79,1.80,-.69]].forEach(([x,y,z],i)=>bloom(x!,y!,z!,i%2===0))
  for(const [x,y,z,angle] of [[-.43,2.15,-.665,.6],[1.25,2.03,-.73,-.7],[.95,2.05,-.67,.6]]){const m=ellipsoid(subject,leaf,[x!,y!,z!],[.03,.105,.014]);m.rotation.z=angle!}
  const ground=mesh(new THREE.CylinderGeometry(1.42,1.38,.075,64),material(0xd5dfab),root,'martisor-ground'); ground.position.set(.15,-.0375,.10)
  // Two radial/z tubes twist around the open loop. Keeping a radial cross-section
  // makes its lowest inner surface at the support point exactly measurable (.208).
  const strand=(phase:number,mat:THREE.Material,name:string)=>{
    const p:number[]=[],indices:number[]=[],segments=360,sides=8
    for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=.23+.012*Math.cos(18*a+phase),z=.012*Math.sin(18*a+phase)
      for(let j=0;j<=sides;j++){const b=j/sides*Math.PI*2,rr=r+.010*Math.cos(b);p.push(rr*Math.cos(a),rr*Math.sin(a),z+.010*Math.sin(b))}}
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return mesh(g,mat,cord,name)
  }
  strand(0,red,'martisor-red-strand'); strand(Math.PI,white,'martisor-white-strand')
  // Both loop strands enter a visible gathering knot; separate tails leave its
  // underside. A tail must not cut through the other strand's exposed surface.
  ellipsoid(cord,red,[0,-.242,0],[.042,.06,.022],'martisor-gathering-knot')
  const binding=mesh(new THREE.TorusGeometry(.03,.006,8,24),white,cord,'martisor-knot-binding');binding.position.y=-.242;binding.rotation.x=Math.PI/2;binding.scale.set(1.4,.5,1)
  const tail=(mat:THREE.Material,x:number,y:number,name:string)=>{
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(Math.sign(x)*.014,-.28,0),new THREE.Vector3(x*.5,-.34,0),new THREE.Vector3(x,y,0)])
    mesh(new THREE.TubeGeometry(path,24,.012,8,false),mat,cord)
    const head=ellipsoid(cord,mat,[x,y,0],[.055,.062,.022],name)
    for(let i=0;i<7;i++){const dx=(i-3)*.011;const m=ellipsoid(cord,mat,[x+dx,y-.13,0],[.009,.12+(i%2)*.012,.012]);m.rotation.z=-(i-3)*.04}
    return head
  }
  const redHead=tail(red,-.085,-.39,'martisor-red-head');tail(white,.085,-.46,'martisor-white-head')
  const pose=(step:number,n:number)=>{
    const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
    cord.rotation.set(0,0,0)
    if(step<=0){
      const lift=Math.min(1,t/.3),turn=THREE.MathUtils.clamp((t-.3)/.3,0,1),reach=THREE.MathUtils.clamp((t-.6)/.4,0,1)
      cord.position.set(THREE.MathUtils.lerp(-.65,.55,reach),THREE.MathUtils.lerp(.022,1.5,lift),THREE.MathUtils.lerp(.2,.7,reach));cord.rotation.x=-Math.PI/2*(1-turn)
    } else if(step===1) cord.position.set(.55,1.5,THREE.MathUtils.lerp(.7,-.05,t))
    else cord.position.set(.55,THREE.MathUtils.lerp(1.5,1.347,step>=3?1:t),-.05)
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,cord,targets:[redHead,redHead,redHead],roots:[cord,cord,cord],anchors:[[0,0,0],[0,0,0],[0,0,0]] as [number,number,number][],pose}
}
