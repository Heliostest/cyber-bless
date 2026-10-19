import * as THREE from 'three'

export function createVillageSwingModel() {
  const subject = new THREE.Group(), frame = new THREE.Group(), joint = new THREE.Group(), platform = new THREE.Group()
  subject.name = 'swing-subject'; frame.name = 'swing-frame'; joint.name = 'swing-joint'; platform.name = 'swing-platform'
  subject.add(frame, joint); joint.position.y = 3.08; joint.add(platform)
  const timber = new THREE.MeshStandardMaterial({color: '#ad8258', roughness: .87, vertexColors: true})
  const honey = new THREE.MeshStandardMaterial({color: '#d6aa70', roughness: .82, vertexColors: true})
  const armsMaterial = new THREE.MeshStandardMaterial({color: '#bd925e', roughness: .85, vertexColors: true})
  const iron = new THREE.MeshStandardMaterial({color: '#788b88', roughness: .43, metalness: .44})
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, parent: THREE.Object3D, x=0,y=0,z=0) => {
    if (material.vertexColors) {
      const ps = geometry.getAttribute('position'), colors = new Float32Array(ps.count * 3)
      for(let i=0;i<ps.count;i++){const shade=.94+.045*Math.sin(ps.getY(i)*2+ps.getX(i)*22+ps.getZ(i)*18);colors.set([shade,shade,shade],i*3)}
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
    }
    const item = new THREE.Mesh(geometry,material);item.name=name;item.position.set(x,y,z);item.castShadow=item.receiveShadow=true;parent.add(item);return item
  }
  // Sheared closed prisms keep the foot cuts horizontal and exactly on the ground.
  const legs = [-1.65,1.65].flatMap((x,side)=>[-1.10,1.10].map((z,leg)=>{
    const g=new THREE.BoxGeometry(.26,1,.28),p=g.getAttribute('position')
    for(let i=0;i<p.count;i++){const top=p.getY(i)>0;p.setY(i,top?3.46:0);p.setZ(i,p.getZ(i)+(top?0:z))}
    g.computeVertexNormals();return mesh(`swing-leg-${side}-${leg}`,g,timber,frame,x)
  }))
  mesh('swing-top-beam',new THREE.BoxGeometry(3.8,.28,.32),timber,frame,0,3.42)
  for(const [i,x]of[-1.65,1.65].entries())mesh(`swing-side-brace-${i}`,new THREE.BoxGeometry(.20,.15,1.58),timber,frame,x,1.15)
  const rings: THREE.Mesh<THREE.TorusGeometry,THREE.MeshStandardMaterial>[]=[]
  for(const [i,sign]of[-1,1].entries()){
    const x=sign*1.23
    mesh(`swing-bearing-strap-${i}`,new THREE.BoxGeometry(.07,.2,.07),iron,frame,x,3.25)
    const ring=mesh(`swing-bearing-ring-${i}`,new THREE.TorusGeometry(.10,.035,12,48),iron,frame,x,3.08) as THREE.Mesh<THREE.TorusGeometry,THREE.MeshStandardMaterial>
    ring.rotation.y=Math.PI/2;rings.push(ring)
    const pin=mesh(`swing-axle-${i}`,new THREE.CylinderGeometry(.06,.06,.32,24),iron,frame,sign*1.17,3.08);pin.rotation.z=Math.PI/2
  }
  const armPivots:THREE.Group[]=[],arms:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[]
  for(const [i,x]of[-1.1,1.1].entries()){
    const pivot=new THREE.Group();pivot.name=`swing-arm-pivot-${i}`;pivot.position.x=x;joint.add(pivot);armPivots.push(pivot)
    arms.push(mesh(`swing-rigid-arm-${i}`,new THREE.CylinderGeometry(.075,.075,2.53,12),armsMaterial,pivot,0,-1.165))
    mesh(`swing-platform-support-${i}`,new THREE.BoxGeometry(.18,.10,.85),timber,platform,x,-2.52)
  }
  const planks=[-.30,-.10,.10,.30].map((z,i)=>mesh(i===3?'swing-front-plank':`swing-plank-${i}`,new THREE.BoxGeometry(2.50,.12,.18),honey,platform,0,-2.43,z))
  const angles=[0,.23,-.23,0]
  const pose=(at:number,n:number)=>{
    const step=THREE.MathUtils.clamp(Math.floor(at),0,3),amount=THREE.MathUtils.clamp(n,0,1)
    // Assisted held poses: this is not a free pendulum, load or friction solver.
    joint.rotation.x=step===3?0:THREE.MathUtils.lerp(angles[step]!,angles[step+1]!,amount)
    subject.updateMatrixWorld(true)
  }
  pose(0,0)
  const target=planks[3]!
  return {subject,frame,joint,platform,legs,arms,armPivots,planks,rings,pinRadius:.06,target,pose,
    targets:[target,target,target],roots:[platform,platform,platform],anchors:[[0,.07,0],[0,.07,0],[0,.07,0]] as [number,number,number][]}
}
