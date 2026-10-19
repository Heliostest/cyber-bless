import * as THREE from 'three'

export function createJumpingJackModel() {
  const subject=new THREE.Group(),fixed=new THREE.Group();subject.name='jack-subject';fixed.name='jack-fixed';subject.add(fixed)
  const wood=new THREE.MeshStandardMaterial({color:'#ecc999',roughness:.84,vertexColors:true}),bark=new THREE.MeshStandardMaterial({color:'#a48560',roughness:.95,vertexColors:true})
  const coat=new THREE.MeshStandardMaterial({color:'#55a7a0',roughness:.83,vertexColors:true}),trousers=new THREE.MeshStandardMaterial({color:'#537b97',roughness:.86,vertexColors:true}),hatPaint=new THREE.MeshStandardMaterial({color:'#d77d42',roughness:.85,vertexColors:true})
  const linen=new THREE.MeshStandardMaterial({color:'#e0c99f',roughness:.96}),brass=new THREE.MeshStandardMaterial({color:'#c1a06c',roughness:.42,metalness:.48}),dark=new THREE.MeshStandardMaterial({color:'#4d4a40',roughness:.82}),leaf=new THREE.MeshStandardMaterial({color:'#8dbb6b',roughness:.93})
  const mesh=(name:string,g:THREE.BufferGeometry,material:THREE.MeshStandardMaterial,parent:THREE.Object3D,x=0,y=0,z=0)=>{
    if(material.vertexColors){const p=g.getAttribute('position'),colors=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const shade=.94+.04*Math.sin(p.getX(i)*17+p.getY(i)*3+p.getZ(i)*11);colors.set([shade,shade,shade],i*3)}g.setAttribute('color',new THREE.BufferAttribute(colors,3))}
    const item=new THREE.Mesh(g,material);item.name=name;item.position.set(x,y,z);item.castShadow=item.receiveShadow=true;parent.add(item);return item
  }
  const between=(item:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3)=>{item.position.copy(a).add(b).multiplyScalar(.5);item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize())}
  const segment=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.MeshStandardMaterial,parent:THREE.Object3D)=>{const item=mesh(name,new THREE.CylinderGeometry(r,r,a.distanceTo(b),16),material,parent);between(item,a,b);return item}
  const prism=(points:[number,number][],depth=.1)=>{const s=new THREE.Shape();s.moveTo(...points[0]!);for(const p of points.slice(1))s.lineTo(...p);s.closePath();return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:1,steps:1})}
  const plate=(length:number,lever:number,isLeg:boolean)=>{
    const w=.085,bottom=-length,s=new THREE.Shape();s.moveTo(-w,bottom+w)
    if(isLeg){s.lineTo(-w,.02);s.lineTo(-.032,.196);s.absarc(0,.196,.032,Math.PI,0,true);s.lineTo(w,.02)}
    else{const top=lever+.045;s.lineTo(-w,top-w);s.quadraticCurveTo(-w,top,0,top);s.quadraticCurveTo(w,top,w,top-w)}
    s.lineTo(w,bottom+w);s.quadraticCurveTo(w,bottom,0,bottom);s.quadraticCurveTo(-w,bottom,-w,bottom+w);s.closePath()
    return new THREE.ExtrudeGeometry(s,{depth:.07,bevelEnabled:false,curveSegments:8}).translate(0,0,-.035)
  }
  // The branch is the toy's suspension point; there is no added table or display panel.
  const trunkGeometry=new THREE.CylinderGeometry(.105,.15,1,10,8),tp=trunkGeometry.getAttribute('position');for(let i=0;i<tp.count;i++){const t=tp.getY(i)+.5;tp.setXYZ(i,tp.getX(i)+.12*Math.sin(Math.PI*t)+.08*t,3.42*t,tp.getZ(i)+.07*Math.sin(Math.PI*t))}trunkGeometry.computeVertexNormals()
  mesh('jack-tree-trunk',trunkGeometry,bark,fixed,-1.42,0,-.35)
  const branchA=new THREE.Vector3(-1.34,3.39,-.35),branchB=new THREE.Vector3(.02,3.55,-.1),branchLength=branchA.distanceTo(branchB),branchGeometry=new THREE.CylinderGeometry(.04,.075,branchLength,10,6),bp=branchGeometry.getAttribute('position')
  for(let i=0;i<bp.count;i++){const t=bp.getY(i)/branchLength+.5;bp.setX(i,bp.getX(i)+.16*Math.sin(Math.PI*t))}branchGeometry.computeVertexNormals();const branch=mesh('jack-tree-branch',branchGeometry,bark,fixed);between(branch,branchA,branchB)
  segment('jack-tree-twig',new THREE.Vector3(-1.1,3.35,-.33),new THREE.Vector3(-.83,3.80,-.35),.035,bark,fixed)
  for(const [i,[x,y,z]]of[[-1.56,3.63,-.35],[-1.25,3.75,-.36],[-.93,3.85,-.34],[-1.49,3.89,-.35],[-1.15,3.93,-.32]].entries()){const l=mesh('jack-leaf-'+i,new THREE.SphereGeometry(.25,12,8),leaf,fixed,x,y,z);l.scale.set(1.15,.8,.85)}
  mesh('jack-coat',prism([[-.30,2.41],[.30,2.41],[.26,1.70],[-.26,1.70]]),coat,fixed,0,0,.03)
  mesh('jack-neck',new THREE.BoxGeometry(.14,.22,.10),wood,fixed,0,2.47,.05)
  const head=mesh('jack-head',new THREE.SphereGeometry(.31,24,16),wood,fixed,0,2.8,.08);head.scale.set(1,1.08,.25)
  mesh('jack-hat',prism([[-.23,3.07],[.23,3.07],[.14,3.35],[-.14,3.35]],.09),hatPaint,fixed,0,0,.08)
  mesh('jack-hat-brim',new THREE.BoxGeometry(.65,.055,.16),hatPaint,fixed,0,3.075,.13)
  for(const [i,x]of[-.10,.10].entries())mesh('jack-eye-'+i,new THREE.SphereGeometry(.021,12,8),dark,fixed,x,2.85,.159)
  const nose=mesh('jack-nose',new THREE.SphereGeometry(.03,12,8),wood,fixed,0,2.77,.17);nose.scale.set(.65,1,.85)
  const mouth=mesh('jack-mouth',new THREE.SphereGeometry(.055,12,8),dark,fixed,0,2.67,.15);mouth.scale.set(1,.15,.18)
  for(const [i,y]of[2.18,1.99].entries())mesh('jack-button-'+i,new THREE.SphereGeometry(.033,12,8),brass,fixed,0,y,.147)
  const pivots:THREE.Group[]=[],limbs:THREE.Mesh[]=[],attachments:THREE.Mesh[]=[]
  for(const [i,[x,y,lever,length]]of[[-.32,2.30,.16,.65],[.32,2.30,.16,.65],[-.23,1.72,.21,.67],[.23,1.72,.21,.67]].entries()){
    const p=new THREE.Group();p.name=i<2?'jack-arm-pivot-'+i:'jack-leg-pivot-'+(i-2);p.position.set(x!,y!,i<2?-.04:-.12);subject.add(p);pivots.push(p)
    limbs.push(mesh('jack-limb-'+i,plate(length!,lever!,i>=2),i<2?coat:trousers,p))
    const pin=mesh('jack-pivot-pin-'+i,new THREE.CylinderGeometry(.047,.047,.30,16),brass,fixed,x,y,.025);pin.rotation.x=Math.PI/2
    const tie=mesh('jack-tie-'+i,new THREE.CylinderGeometry(i<2?.028:.016,i<2?.028:.016,i<2?.18:.14,16),linen,p,0,lever,i<2?-.11:-.03);tie.rotation.x=Math.PI/2;attachments.push(tie)
  }
  segment('jack-suspension',new THREE.Vector3(0,3.52,-.1),new THREE.Vector3(0,3.35,.1),.014,linen,fixed)
  const junction=(x:number,y:number,a:number,L:number,theta:number)=>y+a*Math.cos(theta)-Math.sqrt(L*L-(x-a*Math.sin(theta))**2)
  const armBase=.12,legBase=.08,armRest=junction(.32,2.30,.16,.40,armBase),legRest=junction(.23,1.72,.21,.35,legBase)
  const handle=mesh('jack-handle',new THREE.SphereGeometry(.12,20,12),wood,subject,0,.55,-.2)
  const knots=[armRest,legRest].map((y,i)=>mesh('jack-junction-'+i,new THREE.SphereGeometry(.031,12,8),linen,subject,0,y,-.2))
  const cordLengths=[.40,.40,.35,.35,armRest-.55],cordEndpoints:[THREE.Vector3,THREE.Vector3][]=cordLengths.map(()=>[new THREE.Vector3(),new THREE.Vector3()])
  const ropes=cordLengths.map((L,i)=>mesh('jack-cord-'+i,new THREE.CylinderGeometry(.012,.012,L,16),linen,subject))
  const pose=(at:number,n:number)=>{
    const step=Number.isFinite(at)?THREE.MathUtils.clamp(Math.floor(at),0,3):0,amount=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
    const phase=amount===0||amount===1||step===3?0:amount<=.6?amount/.6:((1-amount)/.4)**2
    const angle=armBase+1.4*([.55,.80,1][step]??0)*phase,drop=phase===0?0:armRest-junction(.32,2.30,.16,.40,angle)
    let legAngle=legBase
    if(drop>0){let lo=legBase,hi=1.5;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(legRest-junction(.23,1.72,.21,.35,mid)<drop)lo=mid;else hi=mid}legAngle=(lo+hi)/2}
    pivots.forEach((p,i)=>{p.rotation.z=(i%2===0?-1:1)*(i<2?angle:legAngle)})
    handle.position.y=.55-drop;knots[0]!.position.y=armRest-drop;knots[1]!.position.y=legRest-drop;subject.updateMatrixWorld(true)
    for(let i=0;i<4;i++){const a=pivots[i]!.localToWorld(new THREE.Vector3(0,i<2?.16:.21,-.2-pivots[i]!.position.z)),b=knots[i<2?0:1]!.getWorldPosition(new THREE.Vector3());cordEndpoints[i]![0].copy(a);cordEndpoints[i]![1].copy(b);between(ropes[i]!,a,b)}
    cordEndpoints[4]![0].copy(handle.position);cordEndpoints[4]![1].copy(knots[0]!.position);between(ropes[4]!,...cordEndpoints[4]!);subject.updateMatrixWorld(true)
  }
  pose(0,0)
  return {subject,fixed,pivots,limbs,attachments,ropes,cordLengths,cordEndpoints,handle,knots,pose,targets:[handle,handle,handle],roots:[handle,handle,handle],anchors:[[0,0,0],[0,0,0],[0,0,0]] as [number,number,number][]}
}
