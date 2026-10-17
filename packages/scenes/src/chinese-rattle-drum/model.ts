import * as THREE from 'three'

/** Original single toy drum; assisted bead paths wrap outside the wooden rim. */
export function createRattleDrumModel() {
  const subject=new THREE.Group();subject.name='rattle-drum-subject'
  const instrument=new THREE.Group();instrument.name='rattle-drum-instrument';subject.add(instrument)
  const material=(color:number,roughness=.75)=>new THREE.MeshStandardMaterial({color,roughness})
  const wood=material(0xcc9a5d),ivory=material(0xf1deb3,.91),backSkin=material(0xe8d9b7,.91),coral=material(0xca7052),teal=material(0x3b8f89),flax=material(0xdac48e,1),blue=material(0x579bb5),gold=material(0xd69b50),pin=material(0xdcb56e,.48)
  const add=(name:string,g:THREE.BufferGeometry,m:THREE.Material)=>{const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;instrument.add(mesh);return mesh}
  const cylinder=(name:string,r:number,h:number,m:THREE.Material,y:number)=>{const mesh=add(name,new THREE.CylinderGeometry(r,r,h,40),m);mesh.position.y=y;return mesh}
  cylinder('rattle-drum-handle',.065,1.28,wood,.76)
  const grip=cylinder('rattle-drum-grip',.11,.56,teal,.50)
  for(const y of [.23,.31,.69,.77]){const ring=add('rattle-drum-grip-binding-'+y,new THREE.TorusGeometry(.111,.008,6,40),coral);ring.rotation.x=Math.PI/2;ring.position.y=y}
  const shape=new THREE.Shape();shape.absarc(0,0,.74,0,Math.PI*2,false)
  const hole=new THREE.Path();hole.absarc(0,0,.68,0,Math.PI*2,true);shape.holes.push(hole)
  const shellGeometry=new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false,curveSegments:24});shellGeometry.translate(0,0,-.12)
  const shell=add('rattle-drum-shell',shellGeometry,wood);shell.position.y=2
  for(const sign of [-1,1]){
    const head=add('rattle-drum-head-'+sign,new THREE.CylinderGeometry(.69,.69,.018,64),sign===1?ivory:backSkin);head.rotation.x=Math.PI/2;head.position.set(0,2,sign*.135)
    const rim=add('rattle-drum-rim-'+sign,new THREE.TorusGeometry(.711,.024,8,64),coral);rim.position.set(0,2,sign*.135)
    const paint=add('rattle-drum-paint-'+sign,new THREE.RingGeometry(.27,.30,64),sign===1?teal:blue);paint.position.set(0,2,sign*.145);if(sign<0)paint.rotation.y=Math.PI;paint.castShadow=false
    for(let i=0;i<16;i++){
      const angle=i*Math.PI/8,rivet=add(`rattle-drum-pin-${sign}-${i}`,new THREE.SphereGeometry(.019,8,6),pin)
      rivet.position.set(.713*Math.cos(angle),2+.713*Math.sin(angle),sign*.156)
    }
  }
  for(const [i,side] of [-1,1].entries()){
    const stud=add('rattle-drum-cord-stud-'+i,new THREE.CylinderGeometry(.028,.028,.08,16),pin)
    stud.rotation.z=Math.PI/2;stud.position.set(side*.745,2,0)
    const knot=add('rattle-drum-cord-knot-'+i,new THREE.SphereGeometry(.018,10,8),flax);knot.position.set(side*.77,2,0)
  }
  const beads=[-1,1].map((side,i)=>add('rattle-drum-bead-'+i,new THREE.SphereGeometry(.11,24,16),i===0?blue:gold))
  const cordGeometry=new THREE.CylinderGeometry(.012,.012,1,6),segments=[0,1].map(i=>[0,1].map(j=>add(`rattle-drum-cord-${i}-${j}`,cordGeometry,flax)))
  const cords=[0,1].map(()=>[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]),axis=new THREE.Vector3(0,1,0),diff=new THREE.Vector3()
  const pose=(at:number,n:number)=>{
    n=THREE.MathUtils.clamp(n,0,1)
    const phase=at===0?n:at===1?1-2*n:at===2?-1+n:0,amount=Math.abs(phase),lower=at===2?n:at>2?1:0
    instrument.rotation.y=at===0?.55*n:at===1?.55-1.1*n:at===2?-.55*(1-n):0
    instrument.position.y=-.12*lower
    beads.forEach((bead,i)=>{
      const side=i===0?-1:1,zSign=-side*Math.sign(phase)
      if(amount<=.5){const t=amount*2;bead.position.set(side*THREE.MathUtils.lerp(.82,1.34,t),THREE.MathUtils.lerp(1.15,1.82,t),zSign*.60*t)}
      else {const t=(amount-.5)*2;bead.position.set(side*THREE.MathUtils.lerp(1.34,.17,t),THREE.MathUtils.lerp(1.82,1.88,t),zSign*THREE.MathUtils.lerp(.60,.256,t))}
      const points=cords[i]!;points[0]!.set(side*.77,2,0);points[1]!.set(side*.78,1.98,zSign*Math.min(.18,amount*.36));points[2]!.copy(bead.position)
      segments[i]!.forEach((segment,j)=>{
        segment.position.copy(points[j]!).add(points[j+1]!).multiplyScalar(.5);diff.subVectors(points[j+1]!,points[j]!);segment.scale.y=diff.length();segment.quaternion.setFromUnitVectors(axis,diff.normalize())
      })
    })
    subject.updateMatrixWorld(true)
  }
  pose(0,0)
  return {subject,instrument,beads,cords,pose,targets:[grip,grip,grip],roots:[grip,grip,grip],anchors:[[0,0,.108],[0,0,.108],[0,0,.108]] as [number,number,number][]}
}
