import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

/** Original simplified wagasa. Assisted linkage/fold geometry, not paper tension or gravity. */
export function createWagasaModel() {
 const subject=new THREE.Group();subject.name='wagasa-subject'
 const spin=new THREE.Group();spin.name='wagasa-spin';subject.add(spin)
 const bamboo=new THREE.MeshStandardMaterial({color:'#b9874c',roughness:.65})
 const wood=new THREE.MeshStandardMaterial({color:'#5f6e53',roughness:.75})
 const joint=new THREE.MeshStandardMaterial({color:'#966e41',roughness:.7})
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;spin.add(o);return o}
 const shaft=mesh('wagasa-shaft',new THREE.CylinderGeometry(.045,.045,2.8,12),bamboo);shaft.position.y=1.4;shaft.userData.radius=.045
 const grip=mesh('wagasa-grip',new THREE.CylinderGeometry(.075,.075,.75,8),wood);grip.position.y=.375
 const hub=mesh('wagasa-top-hub',new THREE.CylinderGeometry(.12,.12,.20,24),joint);hub.position.y=2.82
 const profile=[[.05,-.08],[.095,-.08],[.095,.08],[.05,.08],[.05,-.08]].map(([x,y])=>new THREE.Vector2(x!,y!))
 const runner=mesh('wagasa-runner',new THREE.LatheGeometry(profile,24),wood);runner.userData.boreRadius=.05
 const ribs:THREE.Mesh[]=[],stretchers:THREE.Mesh[]=[]
 for(let i=0;i<24;i++){ribs.push(mesh('wagasa-rib-'+i,new THREE.CylinderGeometry(.012,.0003,1.4,5),bamboo));stretchers.push(mesh('wagasa-stretcher-'+i,new THREE.CylinderGeometry(.009,.009,.85,5),bamboo))}
 const positions=new Float32Array(24*18),colors=new Float32Array(positions.length)
 for(let i=0;i<24;i++){const color=new THREE.Color(i===6?'#f5dfb8':i%2?'#cf5d49':'#d76b54');for(let j=0;j<6;j++)color.toArray(colors,i*18+j*3)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
 // Local radial bands follow the existing bamboo spokes through every fold and turn.
 const paper=mesh('wagasa-paper',geometry,createRitualMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.86}, {
  kind: 'paper', strength: .8, fiber: 'paper',
  paper: { layout: 'radial', spacing: 2*Math.PI/24, width: .10, contrast: .48 },
 }))
 const L=1.4,half=Math.PI/24,open=1.25,M2=L*L-(L*Math.sin(open)*Math.sin(half))**2
 const up=new THREE.Vector3(0,1,0),origin=new THREE.Vector3(0,2.8,0),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3(),direction=new THREE.Vector3()
 const segment=(o:THREE.Object3D,start:THREE.Vector3,end:THREE.Vector3)=>{o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(up,direction.subVectors(end,start).normalize())}
 function pose(step:number,n:number){
  const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1),theta=step===0?(t===1?open:.18+(open-.18)*t):step===1?open:step===2?(t===1?.18:open-(open-.18)*t):.18
  // Inspection owns azimuth independently of the real opening/folding linkage.
  const radius=L*Math.sin(theta),y=2.8-L*Math.cos(theta),jointRadius=radius*.48,jointY=2.8-L*.48*Math.cos(theta)
  runner.position.y=jointY-Math.sqrt(.85**2-(jointRadius-.095)**2)
  // Each sector is two rigid triangles sharing an outward crease; all three side lengths stay fixed.
  const ax=radius*Math.cos(half),ay=y-2.8,q2=ax*ax+ay*ay,q=Math.sqrt(q2),height=Math.sqrt(Math.max(0,M2-M2*M2/q2))
  const creaseR=M2/q2*ax-height*ay/q,creaseY=2.8+M2/q2*ay+height*ax/q
  for(let i=0;i<24;i++){
   const phi=i*2*Math.PI/24,next=phi+2*half,mid=phi+half
   b.set(radius*Math.cos(phi),y,radius*Math.sin(phi));segment(ribs[i]!,origin,b)
   c.copy(origin).lerp(b,.48);a.set(.095*Math.cos(phi),runner.position.y,.095*Math.sin(phi));segment(stretchers[i]!,a,c)
   a.copy(origin);a.y+=.09;b.y+=.09;c.set(creaseR*Math.cos(mid),creaseY+.09,creaseR*Math.sin(mid));d.set(radius*Math.cos(next),y+.09,radius*Math.sin(next))
   const offset=i*18;a.toArray(positions,offset);c.toArray(positions,offset+3);b.toArray(positions,offset+6);a.toArray(positions,offset+9);d.toArray(positions,offset+12);c.toArray(positions,offset+15)
  }
  geometry.attributes.position!.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();subject.updateMatrixWorld(true)
 }
 pose(0,0)
 return{subject,spin,shaft,grip,hub,runner,ribs,stretchers,paper,pose,targets:[runner,grip,runner],roots:[runner,grip,runner],anchors:[[.03,-.055,.08],[.04,.1,.06],[.03,-.055,.08]] as [number,number,number][]}
}
