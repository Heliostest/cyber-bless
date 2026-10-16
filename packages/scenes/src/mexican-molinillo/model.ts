import * as THREE from 'three'

type XYZ = [number, number, number]
/** Original appreciation model: no collection replica, recipe, or fluid simulation. */
export function createMolinilloModel() {
  const subject = new THREE.Group(); subject.name = 'molinillo-subject'
  const whisk = new THREE.Group(); whisk.name = 'molinillo-whisk'; subject.add(whisk)
  const wood = new THREE.MeshStandardMaterial({ color: 0xc58b4e, roughness: .81 })
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x8c512e, roughness: .89 })
  const clay = new THREE.MeshPhysicalMaterial({ color: 0xa95032, roughness: .34, clearcoat: .3, clearcoatRoughness: .28 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xe9c89a, roughness: .74 })
  const chocolate = new THREE.MeshPhysicalMaterial({ color: 0x5e3020, roughness: .3, clearcoat: .4 })
  const foam = new THREE.MeshStandardMaterial({ color: 0xbc8757, roughness: .76 })
  const foamLight = new THREE.MeshStandardMaterial({ color: 0xd4a16c, roughness: .8 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Group = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const lathe = (points: [number, number][]) => new THREE.LatheGeometry(points.map(([x,y]) => new THREE.Vector2(x,y)), 64)
  add('molinillo-cup',lathe([[0,-.03],[.61,-.03],[.7,.04],[.79,.23],[.9,.53],[.98,.87],[1,.96],[.99,1.01],[.93,1.015],[.9,.95],[.86,.58],[.73,.24],[.58,.12],[0,.12]]),clay,[0,0,0])
  const cupHandle=add('molinillo-cup-handle',new THREE.TorusGeometry(.32,.075,12,40),clay,[1.11,.56,0]);cupHandle.scale.set(1.1,1.3,1)
  const rim=add('molinillo-cream-rim',new THREE.TorusGeometry(.962,.032,12,64),cream,[0,.988,0]);rim.rotation.x=Math.PI/2
  const foot=add('molinillo-foot-ring',new THREE.TorusGeometry(.66,.025,8,64),clay,[0,.025,0]);foot.rotation.x=Math.PI/2
  const liquid=add('molinillo-chocolate',new THREE.CircleGeometry(.888,64),chocolate,[0,.88,0]);liquid.rotation.x=-Math.PI/2;liquid.castShadow=false
  // A fluted lathed head straddles the air/liquid interface after immersion.
  const headGeometry=lathe([[0,.62],[.14,.63],[.26,.69],[.31,.80],[.29,.92],[.21,1.0],[.11,1.03]])
  const vertices=headGeometry.getAttribute('position') as THREE.BufferAttribute
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i),a=Math.atan2(z,x),groove=.86+.14*Math.cos(10*a)
    vertices.setXYZ(i,x*groove,vertices.getY(i),z*groove)
  }
  headGeometry.computeVertexNormals();headGeometry.computeBoundingSphere()
  add('molinillo-fluted-head',headGeometry,wood,[0,0,0],whisk)
  // The handle itself is the only selectable solid; no invisible hit proxy.
  const handle=add('molinillo-handle',new THREE.CylinderGeometry(.095,.115,1.64,32),wood,[0,1.91,0],whisk)
  add('molinillo-neck',new THREE.CylinderGeometry(.105,.11,.49,24),wood,[0,1.235,0],whisk)
  const cap=add('molinillo-handle-cap',new THREE.SphereGeometry(.107,24,12),wood,[0,2.74,0],whisk);cap.scale.y=.65
  const rings=[1.08,1.26].map((y,i)=>{
    add('molinillo-collar-'+i,new THREE.CylinderGeometry(.24,.24,.07,32),darkWood,[0,y-.08,0],whisk)
    const ring=add('molinillo-ring-'+i,new THREE.TorusGeometry(.18,.045,10,48).rotateX(Math.PI/2),wood,[0,y,0],whisk)
    // Small inlaid bands make the free ring's lag visible without invented symbols.
    for(let j=0;j<4;j++){
      const band=new THREE.Mesh(new THREE.TorusGeometry(.18,.046,8,5,.18).rotateX(Math.PI/2),darkWood)
      band.name=`molinillo-ring-band-${i}-${j}`;band.rotation.y=j*Math.PI/2;ring.add(band)
    }
    return ring
  })
  add('molinillo-ring-stop',new THREE.CylinderGeometry(.24,.24,.05,32),darkWood,[0,1.34,0],whisk)
  for(let i=0;i<3;i++){
    const line=add('molinillo-handle-band-'+i,new THREE.TorusGeometry(.111-i*.003,.008,8,32),darkWood,[0,1.44+i*.075,0],whisk);line.rotation.x=Math.PI/2
  }
  // An offset grain streak reveals rolling on an otherwise round wooden shaft.
  const grain=add('molinillo-grain',new THREE.BoxGeometry(.025,.33,.007),darkWood,[.044,2.48,.086],whisk);grain.rotation.y=.4
  const bubbleGeometry=new THREE.SphereGeometry(1,12,8)
  const bubbles=Array.from({length:68},(_,i)=>{
    const a=i*2.3999632297,r=.38+.405*Math.sqrt((i+.5)/68),size=.030+(i%5)*.009
    const b=add('molinillo-bubble-'+i,bubbleGeometry,i%4===0?foamLight:foam,[r*Math.cos(a),.89,r*Math.sin(a)])
    b.userData.toonSurface={outline:false};return {mesh:b,size,threshold:(i%17)/20}
  })
  function pose(step:number,amount:number) {
    const n=THREE.MathUtils.clamp(amount,0,1), immersed=step>0?1:n
    whisk.position.y=.65*(1-immersed)
    // A right roll followed by a left roll; ring rotation lags relative to the shaft.
    const roll=step===1?n:step===2?1-n:0
    whisk.rotation.y=roll*Math.PI*2.4
    rings.forEach((ring,i)=>{ring.rotation.y=-roll*Math.PI*(.75+i*.15)})
    const aeration=step<1?0:step===1?n*.5:step===2?.5+n*.5:1
    bubbles.forEach(({mesh,size,threshold})=>{
      const growth=THREE.MathUtils.clamp((aeration-threshold)*4,0,1)
      mesh.scale.set(size*growth,size*growth*.42,size*growth);mesh.visible=growth>0
    })
  }
  pose(0,0)
  return {subject,pose,targets:[handle,handle,handle],anchors:[[0,.15,0],[0,.15,0],[0,.15,0]] as XYZ[]}
}
