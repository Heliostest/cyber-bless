import * as THREE from 'three'

type XYZ = [number, number, number]
/** Authored nine-key illustration, not a regional instrument replica or tuning chart. */
export function createSansiModel() {
  const subject = new THREE.Group(); subject.name = 'sansi-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xb67c48, roughness: .88 })
  const grain = new THREE.MeshStandardMaterial({ color: 0x996237, roughness: 1 })
  const bridgeWood = new THREE.MeshStandardMaterial({ color: 0x684530, roughness: .92 })
  const steel = new THREE.MeshStandardMaterial({ color: 0xa6c2c8, metalness: .62, roughness: .32 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xbb9057, metalness: .55, roughness: .36 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: XYZ) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; subject.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, material: THREE.Material, p: XYZ) => add(name, new THREE.BoxGeometry(...size), material, p)
  const shape = new THREE.Shape()
  shape.moveTo(-1.04, -1.30); shape.quadraticCurveTo(-1.25,-1.30,-1.25,-1.06); shape.lineTo(-1.20,1.02); shape.quadraticCurveTo(-1.20,1.30,-.94,1.30); shape.lineTo(.94,1.30); shape.quadraticCurveTo(1.20,1.30,1.20,1.02); shape.lineTo(1.25,-1.06); shape.quadraticCurveTo(1.25,-1.30,1.04,-1.30); shape.closePath()
  const board = new THREE.ExtrudeGeometry(shape,{ depth:.16, bevelEnabled:true, bevelThickness:.04, bevelSize:.035, bevelSegments:3, steps:1, curveSegments:18 }).rotateX(-Math.PI/2)
  add('sansi-soundboard',board,wood,[0,.01,0])
  // Subtle original grain is geometry, so the entire instrument works offline.
  for(let i=0;i<17;i++) {
    const x=(i-8)*.133, points:THREE.Vector3[]=[]
    for(let j=0;j<12;j++)points.push(new THREE.Vector3(x+.012*Math.sin(j*.63+i),.212,-1.17+j*.21))
    const curve=new THREE.CatmullRomCurve3(points)
    const line=add(`sansi-grain-${i}`,new THREE.TubeGeometry(curve,22,.0025,3,false),grain,[0,0,0]);line.userData.toonSurface={outline:false}
  }
  box('sansi-wooden-bridge',[2.16,.2625,.13],bridgeWood,[0,.34125,-.64])
  box('sansi-tail-support',[2.12,.275,.17],bridgeWood,[0,.335,-1.02])
  box('sansi-brass-pressure-bar',[2.24,.065,.13],brass,[0,.54,-.87])
  for(const x of [-1.06,1.06]){
    add(`sansi-clamp-pin-${x}`,new THREE.CylinderGeometry(.034,.034,.40,12),brass,[x,.40,-.87])
    add(`sansi-clamp-head-${x}`,new THREE.SphereGeometry(.049,16,8),brass,[x,.60,-.87]).scale.y=.38
  }
  const ends=[.19,.37,.61,.83,1.00,.77,.49,.29,.12]
  const tines=ends.map((end,i)=>{
    const length=end+1.11, geometry=new THREE.BoxGeometry(.17,.035,length,1,1,28).translate(0,0,-length/2)
    const mesh=add(`sansi-tine-${i}`,geometry,steel,[(i-4)*.235,.49,end])
    mesh.userData.toonSurface={outline:true}
    return {mesh,original:new Float32Array(geometry.getAttribute('position').array),end}
  })
  const rings=[-.92,.92].map((x,i)=>{
    box(`sansi-rattle-staple-${i}`,[.17,.03,.045],brass,[x,.275,1.07])
    for(const side of [-1,1])box(`sansi-rattle-leg-${i}-${side}`,[.022,.08,.045],brass,[x+side*.074,.235,1.07])
    const ring=add(`sansi-rattle-ring-${i}`,new THREE.TorusGeometry(.071,.013,8,24),steel,[x,.285,1.11]);ring.rotation.x=-Math.PI/2+.28;return ring
  })
  const chosen=[4,2,6]
  function pose(step:number, amount:number) {
    for(let i=0;i<tines.length;i++){
      const {mesh,original,end}=tines[i]!, d=i===chosen[step] ? .13*amount : 0, vertices=mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      mesh.position.y=.49-d
      for(let j=0;j<vertices.count;j++){
        const z=original[j*3+2]!, free=THREE.MathUtils.clamp((z+end+.575)/(end+.575),0,1)
        vertices.setY(j,original[j*3+1]!+d*(1-free*free))
      }
      vertices.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox()
    }
    rings.forEach((ring,i)=>{ring.rotation.x=-Math.PI/2+.28+amount*.16*(i?1:-1)})
  }
  pose(0,0)
  return {subject,pose,targets:chosen.map(i=>tines[i]!.mesh),anchors:[[0,.02,-.035],[0,.02,-.035],[0,.02,-.035]] as XYZ[]}
}
