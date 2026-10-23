import * as THREE from 'three'

/** An original stone recumbent ox: no museum object's dimensions or surface art are copied. */
export function createNadeushiModel() {
  const root = new THREE.Group(); root.name = 'nadeushi-subject'; root.position.y = -.012
  const stone = new THREE.MeshStandardMaterial({ color: 0x6c8182, roughness: .88 })
  const cutStone = new THREE.MeshStandardMaterial({ color: 0xb6bfae, roughness: .95 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x384f54, roughness: .82 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0bc91, roughness: .82 })
  const cuff = new THREE.MeshStandardMaterial({ color: 0xd5ede3, roughness: .91 })
  // Remove the degenerate pole triangles from sphere/lathe primitives before rendering.
  const clean = (source: THREE.BufferGeometry) => {
    const raw = source.index ? source.toNonIndexed() : source, p = raw.getAttribute('position'), values: number[] = []
    for (let i=0;i<p.count;i+=3) {
      const a = new THREE.Vector3().fromBufferAttribute(p,i), b = new THREE.Vector3().fromBufferAttribute(p,i+1), c = new THREE.Vector3().fromBufferAttribute(p,i+2)
      if (new THREE.Triangle(a,b,c).getArea() > 1e-12) values.push(...a.toArray(),...b.toArray(),...c.toArray())
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(values,3)); g.computeVertexNormals(); g.computeBoundingSphere()
    if (source !== raw) raw.dispose(); source.dispose(); return g
  }
  const mesh = (name:string, g:THREE.BufferGeometry, material:THREE.Material, parent:THREE.Object3D=root) => {
    const m = new THREE.Mesh(clean(g),material); m.name=name; m.castShadow=m.receiveShadow=true; parent.add(m); return m
  }
  const ellipsoid = (name:string,p:number[],s:number[],mat=stone,parent:THREE.Object3D=root) => {
    const m=mesh(name,new THREE.SphereGeometry(1,32,20),mat,parent); m.position.set(p[0]!,p[1]!,p[2]!); m.scale.set(s[0]!,s[1]!,s[2]!); return m
  }
  const block = (name:string,p:number[],s:number[],mat:THREE.Material) => {
    const m=mesh(name,new THREE.BoxGeometry(...s as [number,number,number]),mat);m.position.set(...p as [number,number,number]);return m
  }
  const pedestal=block('stone-plinth',[0,.14,0],[2.95,.28,1.43],cutStone)
  block('plinth-cap',[0,.32,0],[2.78,.08,1.3],cutStone)
  const ox=new THREE.Group();ox.name='recumbent-ox';root.add(ox)
  ellipsoid('ox-body',[.22,.75,0],[.86,.40,.44],stone,ox)
  ellipsoid('ox-haunch',[.82,.69,-.015],[.38,.31,.4],stone,ox)
  ellipsoid('ox-neck',[-.48,.98,.05],[.38,.43,.34],stone,ox)
  // The broad forehead remains directly accessible from the camera-facing side.
  const head=ellipsoid('ox-head',[-.85,1.29,.18],[.36,.30,.30],stone,ox)
  ellipsoid('ox-muzzle',[-1.10,1.10,.32],[.28,.19,.25],stone,ox)
  ellipsoid('lower-jaw',[-.96,.99,.27],[.30,.13,.23],stone,ox)
  for (const side of [-1,1]) {
    const z=side*.33
    ellipsoid('folded-front-leg-'+side,[-.43,.46,z],[.50,.105,.12],stone,ox)
    ellipsoid('front-hoof-'+side,[-.87,.45,z],[.17,.085,.13],stone,ox)
    ellipsoid('folded-hind-leg-'+side,[.66,.46,z],[.42,.105,.13],stone,ox)
    ellipsoid('hind-hoof-'+side,[.30,.45,z],[.16,.085,.12],stone,ox)
    const ear=ellipsoid('ox-ear-'+side,[-.56,1.38,.18+side*.31],[.18,.075,.10],stone,ox);ear.rotation.x=side*.32
    ellipsoid('eye-'+side,[-.99,1.33,.18+side*.255],[.044,.029,.022],dark,ox)
    ellipsoid('nostril-'+side,[-1.325,1.14,.32+side*.145],[.024,.026,.032],dark,ox)
    const points=[new THREE.Vector3(-.63,1.40,.18+side*.19),new THREE.Vector3(-.49,1.56,.18+side*.28),new THREE.Vector3(-.52,1.72,.18+side*.32)]
    const curve=new THREE.CatmullRomCurve3(points)
    const rings=18, radial=12, vertices:number[]=[],frames=curve.computeFrenetFrames(rings,false)
    const ring=(i:number,j:number)=>curve.getPoint(i/rings).addScaledVector(frames.normals[i]!,Math.cos(j/radial*Math.PI*2)*(.064*(1-i/(rings+1)))).addScaledVector(frames.binormals[i]!,Math.sin(j/radial*Math.PI*2)*(.064*(1-i/(rings+1))))
    const tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray())
    for(let i=0;i<rings;i++)for(let j=0;j<radial;j++){const k=(j+1)%radial;tri(ring(i,j),ring(i+1,k),ring(i+1,j));tri(ring(i,j),ring(i,k),ring(i+1,k))}
    for(let j=0;j<radial;j++){tri(points[0]!,ring(0,(j+1)%radial),ring(0,j));tri(points[2]!,ring(rings,j),ring(rings,(j+1)%radial))}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));mesh('horn-'+side,g,stone,ox)
  }
  const tailCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.94,.87,-.3),new THREE.Vector3(1.14,.68,-.35),new THREE.Vector3(1.04,.44,-.22)])
  mesh('stone-tail',new THREE.TubeGeometry(tailCurve,24,.045,10,false),stone,ox)
  ellipsoid('tail-tip',[1.04,.44,-.22],[.09,.065,.065],stone,ox)

  const hand=new THREE.Group();hand.name='visitor-hand';root.add(hand)
  ellipsoid('palm',[0,0,0],[.115,.044,.14],skin,hand)
  for(let i=0;i<4;i++)ellipsoid('finger-'+i,[-.078+i*.051,-.006,-.13-(i===1?.025:0)],[.024,.033,.105-(i===3?.025:0)],skin,hand)
  const thumb=ellipsoid('thumb',[-.13,-.006,-.045],[.034,.035,.087],skin,hand);thumb.rotation.y=-.55
  ellipsoid('wrist',[0,-.008,.17],[.074,.045,.10],skin,hand)
  ellipsoid('sleeve-cuff',[0,-.008,.27],[.088,.058,.085],cuff,hand)
  const rest=new THREE.Vector3(-.9,.78,.91)
  hand.updateMatrixWorld(true)
  const handVertexMap=new Map<string,THREE.Vector3>(),handInverse=hand.matrixWorld.clone().invert()
  hand.traverse(o=>{const m=o as THREE.Mesh;if(!m.geometry)return;const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).applyMatrix4(handInverse);handVertexMap.set(v.toArray().join(','),v)}})
  const handVertices=[...handVertexMap.values()]
  // Solve the height for the whole hand, including fingertips, against the forehead.
  // The approach goes above the stone first; a diagonal path would cut through it.
  const contact=(t:number)=>{
    const x=-.97+.24*THREE.MathUtils.clamp(t,0,1),z=.36;let y=1.40
    for(const p of handVertices){const horizontal=((x+p.x+.85)/.36)**2+((z+p.z-.18)/.30)**2;if(horizontal<1)y=Math.max(y,1.29+.30*Math.sqrt(1-horizontal)-p.y+.002)}
    return new THREE.Vector3(x,y,z)
  }
  const firstContact=contact(0),lastContact=contact(1)
  const pose=(step:number,amount:number)=>{
    const t=THREE.MathUtils.clamp(amount,0,1)
    if(step===0){
      if(t<.35)hand.position.set(rest.x,THREE.MathUtils.lerp(rest.y,1.90,t/.35),rest.z)
      else if(t<.8)hand.position.lerpVectors(new THREE.Vector3(rest.x,1.90,rest.z),new THREE.Vector3(firstContact.x,1.90,firstContact.z),(t-.35)/.45)
      else hand.position.lerpVectors(new THREE.Vector3(firstContact.x,1.90,firstContact.z),firstContact,(t-.8)/.2)
    }
    else if(step===1)hand.position.copy(contact(t))
    else if(step===2){
      if(t<.2)hand.position.lerpVectors(lastContact,new THREE.Vector3(lastContact.x,1.90,lastContact.z),t/.2)
      else if(t<.65)hand.position.lerpVectors(new THREE.Vector3(lastContact.x,1.90,lastContact.z),new THREE.Vector3(rest.x,1.90,rest.z),(t-.2)/.45)
      else hand.position.set(rest.x,THREE.MathUtils.lerp(1.90,rest.y,(t-.65)/.35),rest.z)
    }
    else hand.position.copy(rest)
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,ox,head,hand,pedestal,contact,pose,targets:[hand,head,hand],roots:[hand,head,hand],anchors:[[0,0,0],[0,.05,.99],[0,0,0]] as [number,number,number][],dispose(){}}
}
