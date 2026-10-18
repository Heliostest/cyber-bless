import * as THREE from 'three'

type XYZ = [number, number, number]
/** Original mechanical appreciation model, not a replica or guidance for using ornaments. */
export function createNutcrackerModel() {
  const subject = new THREE.Group(); subject.name = 'nutcracker-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9ad72, roughness: .8 })
  const green = new THREE.MeshPhysicalMaterial({ color: 0x447765, roughness: .48, clearcoat: .18 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b4548, roughness: .7 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9ac53, roughness: .5, metalness: .2 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e6c9, roughness: .9 })
  const brown = new THREE.MeshStandardMaterial({ color: 0x996237, roughness: .94 })
  const inside = new THREE.MeshStandardMaterial({ color: 0xd1a36c, roughness: .93, side: THREE.DoubleSide })
  const kernelMat = new THREE.MeshStandardMaterial({ color: 0xe6c18a, roughness: .9 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const base = add('nutcracker-base',new THREE.CylinderGeometry(1,1,.15,64),wood,[0,.045,0]);base.scale.set(1.2,1,.8)
  for(const side of [-1,1]){
    add('nutcracker-boot-'+side,new THREE.BoxGeometry(.23,.22,.4),dark,[side*.16,.23,.10])
    add('nutcracker-leg-'+side,new THREE.CylinderGeometry(.10,.10,.64,24),gold,[side*.16,.58,0])
    add('nutcracker-arm-'+side,new THREE.CylinderGeometry(.115,.115,.75,24),green,[side*.44,1.275,0])
    add('nutcracker-hand-'+side,new THREE.SphereGeometry(.115,20,12),wood,[side*.44,.87,0])
    add('nutcracker-cuff-'+side,new THREE.CylinderGeometry(.12,.12,.07,24),gold,[side*.44,.94,0])
    add('nutcracker-cheek-'+side,new THREE.BoxGeometry(.14,.42,.51),wood,[side*.28,1.92,.03])
    add('nutcracker-eye-'+side,new THREE.SphereGeometry(.025,16,12),dark,[side*.145,2.35,.325])
    const brow=add('nutcracker-brow-'+side,new THREE.BoxGeometry(.105,.02,.025),dark,[side*.145,2.43,.325]);brow.rotation.z=-side*.12
  }
  add('nutcracker-jacket',new THREE.CylinderGeometry(.35,.37,.92,40),green,[0,1.26,0])
  add('nutcracker-belt',new THREE.CylinderGeometry(.367,.372,.07,40),dark,[0,.98,0])
  add('nutcracker-buckle',new THREE.BoxGeometry(.12,.08,.04),gold,[0,.98,.37])
  for(let i=0;i<3;i++)add('nutcracker-button-'+i,new THREE.SphereGeometry(.035,16,10),gold,[0,1.17+i*.18,.36])
  // Side cheeks hold the head above an actual empty mouth opening.
  add('nutcracker-head',new THREE.CylinderGeometry(.35,.35,.64,48),wood,[0,2.35,0])
  add('nutcracker-upper-lip',new THREE.BoxGeometry(.34,.04,.15),cream,[0,2.01,.38])
  add('nutcracker-nose',new THREE.BoxGeometry(.1,.17,.2),wood,[0,2.25,.397])
  const moustache = new THREE.CatmullRomCurve3([new THREE.Vector3(-.24,2.17,.28),new THREE.Vector3(-.16,2.13,.34),new THREE.Vector3(0,2.16,.38),new THREE.Vector3(.16,2.13,.34),new THREE.Vector3(.24,2.17,.28)])
  add('nutcracker-moustache',new THREE.TubeGeometry(moustache,32,.033,8,false),cream,[0,0,0])
  add('nutcracker-hat-brim',new THREE.CylinderGeometry(.41,.41,.07,48),dark,[0,2.685,0])
  add('nutcracker-hat',new THREE.CylinderGeometry(.32,.35,.34,40),dark,[0,2.86,0])
  add('nutcracker-hat-band',new THREE.CylinderGeometry(.348,.352,.065,40),gold,[0,2.745,0])
  const axle=add('nutcracker-axle',new THREE.CylinderGeometry(.055,.055,.70,20),gold,[0,1.87,0]);axle.rotation.z=Math.PI/2
  const joint=new THREE.Group();joint.name='nutcracker-joint';joint.position.set(0,1.87,0);subject.add(joint)
  add('nutcracker-jaw',new THREE.BoxGeometry(.36,.12,.66),wood,[0,0,.20],joint)
  const beard=add('nutcracker-beard',new THREE.ConeGeometry(.15,.37,24),cream,[0,-.19,.52],joint);beard.rotation.z=Math.PI;beard.scale.z=.33
  // The solid rear arm and lower jaw share the same axle; this mesh is the hit target.
  const outline=new THREE.Shape();outline.moveTo(0,.07)
  for(const [u,y] of [[.83,.07],[1.13,-.82],[1.0,-.87],[.72,-.07],[0,-.07]])outline.lineTo(u!,y!)
  outline.closePath()
  const leverGeometry=new THREE.ExtrudeGeometry(outline,{depth:.13,bevelEnabled:false}).translate(0,0,-.065).rotateY(Math.PI/2)
  const lever=add('nutcracker-lever',leverGeometry,wood,[0,0,0],joint)
  const nutGeometry=new THREE.SphereGeometry(1,40,28)
  const vertices=nutGeometry.getAttribute('position') as THREE.BufferAttribute
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),a=Math.atan2(z,x)
    const r=1-.025*(1-y*y)*(1+Math.sin(a*10+y*8)*Math.cos(y*13))
    vertices.setXYZ(i,x*r,y*r,z*r)
  }
  nutGeometry.computeVertexNormals();nutGeometry.computeBoundingSphere()
  const walnut=add('nutcracker-walnut',nutGeometry,brown,[-.78,.25,.48]);walnut.scale.setScalar(.13)
  const shells=[-1,1].map(side=>{
    const shell=add('nutcracker-shell-'+(side<0?'left':'right'),new THREE.SphereGeometry(1,24,24,side<0?-Math.PI/2:Math.PI/2,Math.PI),brown,[0,0,0])
    add('nutcracker-shell-inner-'+side,new THREE.CircleGeometry(.97,32).rotateY(Math.PI/2),inside,[0,0,0],shell)
    return shell
  })
  const kernel=add('nutcracker-kernel',new THREE.SphereGeometry(1,20,16),kernelMat,[0,0,0]);kernel.scale.set(.032,.065,.09)
  const jawRest=(y:number,angle:number)=>new THREE.Vector3(0,y,.42).applyAxisAngle(new THREE.Vector3(1,0,0),angle).add(joint.position)
  const path=new THREE.CubicBezierCurve3(new THREE.Vector3(-.78,.25,.48),new THREE.Vector3(-.9,1.7,1.05),new THREE.Vector3(0,1.72,1.05),jawRest(.19,.6))
  function pose(step:number,amount:number){
    const n=THREE.MathUtils.clamp(amount,0,1), closing=step===2?n:step>2?1:0
    joint.rotation.x=step===0?THREE.MathUtils.lerp(.18,.6,n):THREE.MathUtils.lerp(.6,.25,closing)
    walnut.position.copy(step===0?path.v0:step===1?path.getPoint(n):jawRest(.19,joint.rotation.x))
    const crack=THREE.MathUtils.clamp((closing-.4)/.6,0,1), centre=jawRest(THREE.MathUtils.lerp(.19,.14,crack),joint.rotation.x)
    walnut.visible=crack===0
    shells.forEach((shell,i)=>{shell.visible=crack>0;shell.position.copy(centre);shell.position.x+=(i===0?-1:1)*.035*crack;shell.rotation.x=joint.rotation.x;shell.scale.set(.13,THREE.MathUtils.lerp(.13,.08,crack),.13)})
    kernel.visible=crack>0
    // The exposed kernel rests on the front of the jaw, between the split shells.
    kernel.position.copy(new THREE.Vector3(0,.125,.49).applyAxisAngle(new THREE.Vector3(1,0,0),joint.rotation.x).add(joint.position));kernel.rotation.x=joint.rotation.x
  }
  pose(0,0)
  return {subject,pose,targets:[lever,walnut,lever],anchors:[[0,-.66,-1.03],[0,.35,.6],[0,-.66,-1.03]] as XYZ[],
    placement:{object:joint,anchor:[0,.19,.42] as XYZ,radius:.23}}
}
